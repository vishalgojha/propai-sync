#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use openclaw_desktop::gateway::{
  gateway_status, start_gateway, stop_gateway, DesktopGatewayError, DesktopGatewayStartRequest,
  DesktopGatewayState,
};
use tauri::{Emitter, Manager};
#[cfg(desktop)]
use tauri_plugin_updater::UpdaterExt;

const MENU_ID_SETUP: &str = "openclaw.menu.setup";
const MENU_ID_GATEWAY_RESTART: &str = "openclaw.menu.gateway-restart";
const EVENT_ONBOARDING_OPEN: &str = "openclaw:onboarding-open";
const EVENT_GATEWAY_RESTART: &str = "openclaw:gateway-restart";

#[cfg(desktop)]
async fn run_auto_update(app: tauri::AppHandle) {
  if cfg!(debug_assertions) {
    return;
  }

  let endpoints_raw = std::env::var("OPENCLAW_TAURI_UPDATE_ENDPOINTS").unwrap_or_default();
  let pubkey = std::env::var("OPENCLAW_TAURI_UPDATE_PUBKEY").unwrap_or_default();
  let endpoints: Vec<String> = endpoints_raw
    .split(',')
    .map(|entry| entry.trim())
    .filter(|entry| !entry.is_empty())
    .map(String::from)
    .collect();

  if endpoints.is_empty() || pubkey.trim().is_empty() {
    return;
  }

  let builder = app
    .updater_builder()
    .endpoints(endpoints)
    .expect("invalid updater endpoints")
    .pubkey(pubkey);

  let update = match builder.build() {
    Ok(update) => update,
    Err(err) => {
      eprintln!("auto-update: failed to build updater: {err}");
      return;
    }
  };

  let update = match update.check().await {
    Ok(update) => update,
    Err(err) => {
      eprintln!("auto-update: check failed: {err}");
      return;
    }
  };

  let Some(update) = update else {
    return;
  };

  if let Err(err) = update.download_and_install(|_, _| {}, || {}).await {
    eprintln!("auto-update: install failed: {err}");
    return;
  }

  app.restart();
}

#[tauri::command]
fn openclaw_start_gateway(
  state: tauri::State<'_, DesktopGatewayState>,
  app: tauri::AppHandle,
  req: DesktopGatewayStartRequest,
) -> Result<openclaw_desktop::gateway::DesktopGatewayStartResponse, String> {
  let resource_root = app.path().resource_dir().ok();
  let app_data_dir = app.path().app_local_data_dir().ok();
  let log_dir = app_data_dir
    .as_ref()
    .map(|p: &std::path::PathBuf| p.join("logs"));
  start_gateway(&state, req, resource_root, log_dir, app_data_dir).map_err(|e| e.to_string())
}

#[tauri::command]
fn openclaw_stop_gateway(state: tauri::State<'_, DesktopGatewayState>) -> Result<(), String> {
  stop_gateway(&state).map_err(|e| e.to_string())
}

#[tauri::command]
fn openclaw_restart_gateway(
  state: tauri::State<'_, DesktopGatewayState>,
  app: tauri::AppHandle,
  req: DesktopGatewayStartRequest,
) -> Result<openclaw_desktop::gateway::DesktopGatewayStartResponse, String> {
  match stop_gateway(&state) {
    Ok(()) | Err(DesktopGatewayError::NotRunning) => {}
    Err(err) => return Err(err.to_string()),
  }
  let resource_root = app.path().resource_dir().ok();
  let app_data_dir = app.path().app_local_data_dir().ok();
  let log_dir = app_data_dir
    .as_ref()
    .map(|p: &std::path::PathBuf| p.join("logs"));
  start_gateway(&state, req, resource_root, log_dir, app_data_dir).map_err(|e| e.to_string())
}

#[tauri::command]
fn openclaw_gateway_status(
  state: tauri::State<'_, DesktopGatewayState>,
) -> openclaw_desktop::gateway::DesktopGatewayStatusResponse {
  gateway_status(&state)
}

fn main() {
  tauri::Builder::default()
    .menu(|handle| {
      use tauri::menu::{Menu, MenuItem, PredefinedMenuItem, Submenu};

      Menu::with_items(
        handle,
        &[
          &Submenu::with_items(
            handle,
            "OpenClaw",
            true,
            &[
              &MenuItem::with_id(handle, MENU_ID_SETUP, "Setup…", true, None::<&str>)?,
              &MenuItem::with_id(handle, MENU_ID_GATEWAY_RESTART, "Restart Gateway", true, None::<&str>)?,
              &PredefinedMenuItem::separator(handle)?,
              &PredefinedMenuItem::quit(handle, None)?,
            ],
          )?,
        ],
      )
    })
    .on_menu_event(|app, event| {
      if event.id() == MENU_ID_SETUP {
        let _ = app.emit(EVENT_ONBOARDING_OPEN, ());
      } else if event.id() == MENU_ID_GATEWAY_RESTART {
        let _ = app.emit(EVENT_GATEWAY_RESTART, ());
      }
    })
    .manage(DesktopGatewayState::default())
    .invoke_handler(tauri::generate_handler![
      openclaw_start_gateway,
      openclaw_stop_gateway,
      openclaw_restart_gateway,
      openclaw_gateway_status
    ])
    .setup(|app| {
      #[cfg(desktop)]
      {
        if let Err(err) = app.handle().plugin(tauri_plugin_updater::Builder::new().build()) {
          eprintln!("auto-update: failed to register updater plugin: {err}");
        } else {
          let handle = app.handle();
          tauri::async_runtime::spawn(async move {
            run_auto_update(handle).await;
          });
        }
      }

      // Best-effort: start a local gateway as soon as the desktop app launches.
      // - dev builds run from the checkout (`scripts/run-node.mjs ...`)
      // - release builds run the bundled runtime (`resources/openclaw` + `resources/node`)
      // Spawn this work so the UI thread doesn't block on first-run bundle extraction.
      let handle = app.handle();
      std::thread::spawn(move || {
        let state = handle.state::<DesktopGatewayState>();
        let req = DesktopGatewayStartRequest {
          dev: cfg!(debug_assertions),
        };
        let resource_root = handle.path().resource_dir().ok();
        let app_data_dir = handle.path().app_local_data_dir().ok();
        let log_dir = app_data_dir.as_ref().map(|p| p.join("logs"));
        let _ = start_gateway(&state, req, resource_root, log_dir, app_data_dir);
      });
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}

