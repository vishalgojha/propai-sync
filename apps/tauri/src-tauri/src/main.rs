#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod gateway_ipc;

use PROPAI_desktop::gateway::{
  gateway_status, start_gateway, stop_gateway, DesktopGatewayError, DesktopGatewayStartRequest,
  DesktopGatewayState,
};
use crate::gateway_ipc::{
  agent_identity_get, agents_files_get, agents_files_list, agents_files_set, agents_list,
  channels_logout, channels_nostr_profile_import, channels_status, chat_abort, chat_send,
  config_apply, config_get, config_schema, config_set, connect, cron_add, cron_list, cron_remove,
  cron_run, cron_runs, cron_status, cron_update, device_pair_approve, device_pair_reject,
  device_token_revoke, exec_approval_resolve, gateway_ipc_start, gateway_ipc_stop, get_avatar,
  get_control_ui_config, health, last_heartbeat, license_verify, logs_tail, models_list,
  node_list, rpc_call, sessions_compact, sessions_delete, sessions_list, sessions_patch,
  sessions_usage, sessions_usage_logs, sessions_usage_timeseries, skills_install, skills_status,
  skills_update, status, system_presence, tools_catalog, update_channels_nostr_profile,
  update_run, usage_cost, wizard_cancel, wizard_next, wizard_start, GatewayIpcState,
};
use tauri::{Emitter, Manager, Url};
#[cfg(desktop)]
use tauri_plugin_updater::UpdaterExt;

const MENU_ID_SETUP: &str = "PropAiSync.menu.setup";
const MENU_ID_GATEWAY_RESTART: &str = "PropAiSync.menu.gateway-restart";
const EVENT_ONBOARDING_OPEN: &str = "PropAi Sync:onboarding-open";
const EVENT_GATEWAY_RESTART: &str = "PropAi Sync:gateway-restart";

#[cfg(desktop)]
async fn run_auto_update(app: tauri::AppHandle) {
  if cfg!(debug_assertions) {
    return;
  }

  let endpoints_raw = std::env::var("PROPAI_TAURI_UPDATE_ENDPOINTS").unwrap_or_default();
  let pubkey = std::env::var("PROPAI_TAURI_UPDATE_PUBKEY").unwrap_or_default();
  let endpoints = match endpoints_raw
    .split(',')
    .map(|entry| entry.trim())
    .filter(|entry| !entry.is_empty())
    .map(Url::parse)
    .collect::<Result<Vec<_>, _>>()
  {
    Ok(endpoints) => endpoints,
    Err(err) => {
      eprintln!("auto-update: invalid update endpoint: {err}");
      return;
    }
  };

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
fn propai_start_gateway(
  state: tauri::State<'_, DesktopGatewayState>,
  app: tauri::AppHandle,
  req: DesktopGatewayStartRequest,
) -> Result<PROPAI_desktop::gateway::DesktopGatewayStartResponse, String> {
  let resource_root = app.path().resource_dir().ok();
  let app_data_dir = app.path().app_local_data_dir().ok();
  let log_dir = app_data_dir
    .as_ref()
    .map(|p: &std::path::PathBuf| p.join("logs"));
  start_gateway(&state, req, resource_root, log_dir, app_data_dir).map_err(|e| e.to_string())
}

#[tauri::command]
fn propai_stop_gateway(state: tauri::State<'_, DesktopGatewayState>) -> Result<(), String> {
  stop_gateway(&state).map_err(|e| e.to_string())
}

#[tauri::command]
fn propai_restart_gateway(
  state: tauri::State<'_, DesktopGatewayState>,
  app: tauri::AppHandle,
  req: DesktopGatewayStartRequest,
) -> Result<PROPAI_desktop::gateway::DesktopGatewayStartResponse, String> {
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
fn propai_gateway_status(
  state: tauri::State<'_, DesktopGatewayState>,
) -> PROPAI_desktop::gateway::DesktopGatewayStatusResponse {
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
            "PropAi Sync",
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
    .manage(GatewayIpcState::default())
    .invoke_handler(tauri::generate_handler![
      propai_start_gateway,
      propai_stop_gateway,
      propai_restart_gateway,
      propai_gateway_status,
      gateway_ipc_start,
      gateway_ipc_stop,
      get_control_ui_config,
      get_avatar,
      update_channels_nostr_profile,
      channels_nostr_profile_import,
      license_verify,
      rpc_call,
      agent_identity_get,
      agents_files_get,
      agents_files_list,
      agents_files_set,
      agents_list,
      channels_logout,
      channels_status,
      chat_abort,
      chat_send,
      config_apply,
      config_get,
      config_schema,
      config_set,
      connect,
      cron_add,
      cron_list,
      cron_remove,
      cron_run,
      cron_runs,
      cron_status,
      cron_update,
      device_pair_approve,
      device_pair_reject,
      device_token_revoke,
      exec_approval_resolve,
      health,
      last_heartbeat,
      logs_tail,
      models_list,
      node_list,
      sessions_compact,
      sessions_delete,
      sessions_list,
      sessions_patch,
      sessions_usage,
      sessions_usage_logs,
      sessions_usage_timeseries,
      skills_install,
      skills_status,
      skills_update,
      status,
      system_presence,
      tools_catalog,
      update_run,
      usage_cost,
      wizard_cancel,
      wizard_next,
      wizard_start
    ])
    .setup(|app| {
      #[cfg(desktop)]
      {
        if let Err(err) = app.handle().plugin(tauri_plugin_updater::Builder::new().build()) {
          eprintln!("auto-update: failed to register updater plugin: {err}");
        } else {
          let handle = app.handle().clone();
          tauri::async_runtime::spawn(async move {
            run_auto_update(handle).await;
          });
        }
      }

      // Best-effort: start a local gateway as soon as the desktop app launches.
      // - dev builds run from the checkout (`scripts/run-node.mjs ...`)
      // - release builds run the bundled runtime (`resources/PropAiSync` + `resources/node`)
      // Spawn this work so the UI thread doesn't block on first-run bundle extraction.
      let handle = app.handle().clone();
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





