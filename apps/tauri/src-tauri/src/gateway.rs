use rand::{distributions::Alphanumeric, Rng};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::fs;
use std::fs::OpenOptions;
use std::io::{BufRead, BufReader, Write};
use std::net::TcpListener;
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use zip::ZipArchive;

#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x08000000;

const FIXED_GATEWAY_PORT: u16 = 18789;

#[derive(Debug, thiserror::Error)]
pub enum DesktopGatewayError {
  #[error("cannot locate PropAi Sync repo root (set PROPAI_DESKTOP_REPO_ROOT)")]
  RepoRootNotFound,
  #[error("desktop resources are missing (run the Tauri bundle prepare step)")]
  MissingResources,
  #[error("failed to spawn gateway: {0}")]
  SpawnFailed(String),
  #[error("gateway is not running")]
  NotRunning,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DesktopGatewayStartRequest {
  #[serde(default)]
  pub dev: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DesktopGatewayStartResponse {
  pub ws_url: String,
  pub token: String,
  pub port: u16,
  pub pid: u32,
  pub log_path: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DesktopGatewayStatusResponse {
  pub running: bool,
  pub ws_url: Option<String>,
  pub port: Option<u16>,
  pub pid: Option<u32>,
  pub log_path: Option<String>,
}

#[derive(Default)]
pub struct DesktopGatewayState {
  inner: Mutex<Option<DesktopGatewayProcess>>,
}

impl Drop for DesktopGatewayState {
  fn drop(&mut self) {
    let Ok(mut guard) = self.inner.lock() else {
      return;
    };
    let Some(mut proc) = guard.take() else {
      return;
    };
    let _ = proc.child.kill();
    let _ = proc.child.wait();
  }
}

struct DesktopGatewayProcess {
  child: Child,
  ws_url: String,
  token: String,
  port: u16,
  log_path: Option<PathBuf>,
}

fn resolve_gateway_entry(root: &Path) -> Option<PathBuf> {
  let entry_js = root.join("dist").join("entry.js");
  if entry_js.is_file() {
    return Some(entry_js);
  }
  let entry_mjs = root.join("dist").join("entry.mjs");
  if entry_mjs.is_file() {
    return Some(entry_mjs);
  }
  None
}

fn resolve_repo_root() -> Result<PathBuf, DesktopGatewayError> {
  if let Ok(raw) = std::env::var("PROPAI_DESKTOP_REPO_ROOT") {
    let candidate = PathBuf::from(raw);
    if resolve_gateway_entry(&candidate).is_some() || candidate.join("src").join("entry.ts").is_file()
    {
      return Ok(candidate);
    }
  }

  let candidate = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
    .parent()
    .and_then(|p| p.parent())
    .map(|p| p.to_path_buf())
    .ok_or(DesktopGatewayError::RepoRootNotFound)?;

  if resolve_gateway_entry(&candidate).is_some() || candidate.join("src").join("entry.ts").is_file()
  {
    return Ok(candidate);
  }

  Err(DesktopGatewayError::RepoRootNotFound)
}

fn pick_free_loopback_port() -> u16 {
  TcpListener::bind(("127.0.0.1", 0))
    .and_then(|listener| listener.local_addr())
    .map(|addr| addr.port())
    .unwrap_or(18789)
}

fn is_port_available(port: u16) -> bool {
  TcpListener::bind(("127.0.0.1", port)).is_ok()
}

#[cfg(windows)]
fn apply_windows_no_window(cmd: &mut Command) {
  use std::os::windows::process::CommandExt;
  cmd.creation_flags(CREATE_NO_WINDOW);
}

#[cfg(not(windows))]
fn apply_windows_no_window(_cmd: &mut Command) {}

#[cfg(windows)]
fn parse_netstat_pids(output: &str, port: u16) -> Vec<u32> {
  let mut out = Vec::<u32>::new();
  let needle = format!(":{}", port);
  for raw_line in output.lines() {
    let line = raw_line.trim();
    if line.is_empty() {
      continue;
    }
    // Example:
    // TCP    127.0.0.1:18789   0.0.0.0:0   LISTENING   12345
    // TCP    [::1]:18789       [::]:0      LISTENING   12345
    let parts: Vec<&str> = line.split_whitespace().collect();
    if parts.len() < 5 {
      continue;
    }
    if parts[0].eq_ignore_ascii_case("tcp") == false {
      continue;
    }
    let local = parts[1];
    if !local.ends_with(&needle) {
      continue;
    }
    let pid_raw = parts[parts.len() - 1];
    if let Ok(pid) = pid_raw.parse::<u32>() {
      if !out.contains(&pid) {
        out.push(pid);
      }
    }
  }
  out
}

#[cfg(windows)]
fn ensure_windows_port_killed(port: u16) -> Result<(), DesktopGatewayError> {
  if is_port_available(port) {
    return Ok(());
  }

  // Best-effort: find any process bound to the port and kill it.
  let mut netstat = Command::new("netstat");
  apply_windows_no_window(&mut netstat);
  let netstat = netstat
    .args(["-ano", "-p", "tcp"])
    .output()
    .map_err(|e| DesktopGatewayError::SpawnFailed(format!("failed to run netstat: {e}")))?;

  let stdout = String::from_utf8_lossy(&netstat.stdout);
  let stderr = String::from_utf8_lossy(&netstat.stderr);
  if !netstat.status.success() {
    return Err(DesktopGatewayError::SpawnFailed(format!(
      "netstat failed (exit {:?}): {}",
      netstat.status.code(),
      stderr.trim()
    )));
  }

  let pids = parse_netstat_pids(&stdout, port);
  if pids.is_empty() {
    // We couldn't map PID, but it's still in use.
    return Err(DesktopGatewayError::SpawnFailed(format!(
      "port {port} is already in use and the owning PID could not be determined"
    )));
  }

  for pid in pids {
    let mut taskkill = Command::new("taskkill");
    apply_windows_no_window(&mut taskkill);
    let res = taskkill.args(["/PID", &pid.to_string(), "/T", "/F"]).output();
    match res {
      Ok(out) if out.status.success() => {}
      Ok(out) => {
        let err = String::from_utf8_lossy(&out.stderr);
        return Err(DesktopGatewayError::SpawnFailed(format!(
          "failed to kill PID {pid} using port {port}: {}",
          err.trim()
        )));
      }
      Err(e) => {
        return Err(DesktopGatewayError::SpawnFailed(format!(
          "failed to run taskkill for PID {pid}: {e}"
        )));
      }
    }
  }

  // Give Windows a moment to release the port.
  std::thread::sleep(std::time::Duration::from_millis(500));
  if is_port_available(port) {
    return Ok(());
  }
  Err(DesktopGatewayError::SpawnFailed(format!(
    "port {port} is still in use after killing the owning process"
  )))
}

fn generate_token() -> String {
  rand::thread_rng()
    .sample_iter(&Alphanumeric)
    .take(48)
    .map(char::from)
    .collect()
}

fn ensure_parent_dir(path: &Path) {
  if let Some(parent) = path.parent() {
    let _ = std::fs::create_dir_all(parent);
  }
}

fn resolve_bundled_resource_base(resource_root: &Path) -> Option<PathBuf> {
  let direct_propai_sync = resource_root.join("propai");
  if resolve_gateway_entry(&direct_propai_sync).is_some() {
    return Some(resource_root.to_path_buf());
  }
  let nested_propai_sync = resource_root.join("resources").join("propai");
  if resolve_gateway_entry(&nested_propai_sync).is_some() {
    return Some(resource_root.join("resources"));
  }
  None
}

fn spawn_log_pump(mut reader: impl BufRead + Send + 'static, mut file: std::fs::File) {
  std::thread::spawn(move || {
    let mut line = String::new();
    loop {
      line.clear();
      match reader.read_line(&mut line) {
        Ok(0) => break,
        Ok(_) => {
          let _ = file.write_all(line.as_bytes());
          let _ = file.flush();
        }
        Err(_) => break,
      }
    }
  });
}

fn open_log_file(path: &Path) -> Option<std::fs::File> {
  ensure_parent_dir(path);
  OpenOptions::new()
    .create(true)
    .append(true)
    .open(path)
    .ok()
}

fn read_text(path: &Path) -> Option<String> {
  fs::read_to_string(path).ok().map(|s| s.trim().to_string())
}

fn ensure_desktop_state_seed(state_dir: &Path) -> Result<(), DesktopGatewayError> {
  fs::create_dir_all(state_dir).map_err(|e| DesktopGatewayError::SpawnFailed(e.to_string()))?;

  let config_path = state_dir.join("propai.json");
  if config_path.is_file() {
    return Ok(());
  }

  // Seed a desktop-friendly configuration:
  // - Allow the Tauri WebView origin so the Control UI can connect without manual config.
  // - Default to OpenRouter to avoid first-run failures due to missing Anthropic keys.
  // - Include a small set of model aliases so pickers have sensible defaults.
  let config = json!({
    "gateway": {
      "controlUi": {
        "allowedOrigins": [
          "http://tauri.localhost",
          "https://tauri.localhost",
          "tauri://localhost"
        ]
      }
    },
    "agents": {
      "defaults": {
        "model": { "primary": "openrouter/auto" },
        "models": {
          "openrouter/auto": { "alias": "openrouter-auto" },
          "openrouter/anthropic/claude-opus-4-5": { "alias": "opus" },
          "openrouter/anthropic/claude-sonnet-4-5": { "alias": "sonnet" },
          "openrouter/x-ai/grok-4.1-fast": { "alias": "grok" },
          "anthropic/claude-opus-4-6": { "alias": "opus-direct" },
          "anthropic/claude-sonnet-4-6": { "alias": "sonnet-direct" },
          "anthropic/claude-haiku-3-5": { "alias": "haiku" },
          "openai/gpt-5.4": { "alias": "gpt" },
          "openai/gpt-5-mini": { "alias": "gpt-mini" },
          "openai/gpt-4o": { "alias": "gpt-4o" },
          "google/gemini-3.1-pro-preview": { "alias": "gemini" },
          "google/gemini-3-flash-preview": { "alias": "gemini-flash" },
          "google/gemini-3.1-flash-lite-preview": { "alias": "gemini-flash-lite" },
          "xai/grok-4": { "alias": "grok-direct" },
          "deepseek/deepseek-r1": { "alias": "deepseek-r1" }
        }
      }
    }
  });

  let rendered = serde_json::to_string_pretty(&config)
    .map_err(|e| DesktopGatewayError::SpawnFailed(e.to_string()))?;
  fs::write(config_path, format!("{rendered}\n"))
    .map_err(|e| DesktopGatewayError::SpawnFailed(e.to_string()))?;

  Ok(())
}

fn copy_dir_recursive(src: &Path, dst: &Path) -> std::io::Result<()> {
  fs::create_dir_all(dst)?;
  for entry in fs::read_dir(src)? {
    let entry = entry?;
    let file_type = entry.file_type()?;
    let from = entry.path();
    let to = dst.join(entry.file_name());
    if file_type.is_dir() {
      copy_dir_recursive(&from, &to)?;
    } else if file_type.is_file() {
      if let Some(parent) = to.parent() {
        fs::create_dir_all(parent)?;
      }
      fs::copy(&from, &to)?;
    }
  }
  Ok(())
}

fn is_safe_rel_path(path: &Path) -> bool {
  for component in path.components() {
    match component {
      std::path::Component::Normal(_) => {}
      _ => return false,
    }
  }
  true
}

fn unzip_node_modules(zip_path: &Path, runtime_root: &Path) -> Result<(), DesktopGatewayError> {
  let node_modules_dir = runtime_root.join("node_modules");
  let file = fs::File::open(zip_path).map_err(|e| DesktopGatewayError::SpawnFailed(e.to_string()))?;
  let mut archive =
    ZipArchive::new(file).map_err(|e| DesktopGatewayError::SpawnFailed(e.to_string()))?;

  fs::create_dir_all(&node_modules_dir)
    .map_err(|e| DesktopGatewayError::SpawnFailed(e.to_string()))?;
  for i in 0..archive.len() {
    let mut file = archive
      .by_index(i)
      .map_err(|e| DesktopGatewayError::SpawnFailed(e.to_string()))?;

    // `Compress-Archive` may include either:
    // - `chalk/...` (contents only), OR
    // - `node_modules/chalk/...` (directory included)
    // Normalize both into `<runtime_root>/node_modules/<pkg>/...`.
    let name = file.name().replace('\\', "/");
    let rel = Path::new(&name);
    if !is_safe_rel_path(rel) {
      continue;
    }

    let mut components: Vec<&std::ffi::OsStr> = rel.components().filter_map(|c| match c {
      std::path::Component::Normal(v) => Some(v),
      _ => None,
    }).collect();
    if components.is_empty() {
      continue;
    }
    if components[0].to_string_lossy().eq_ignore_ascii_case("node_modules") {
      components.remove(0);
    }
    if components.is_empty() {
      continue;
    }

    let mut out_path = node_modules_dir.clone();
    for part in components {
      out_path = out_path.join(part);
    }

    if file.is_dir() {
      fs::create_dir_all(&out_path)
        .map_err(|e| DesktopGatewayError::SpawnFailed(e.to_string()))?;
      continue;
    }

    if let Some(parent) = out_path.parent() {
      fs::create_dir_all(parent)
        .map_err(|e| DesktopGatewayError::SpawnFailed(e.to_string()))?;
    }

    let mut out_file =
      fs::File::create(&out_path).map_err(|e| DesktopGatewayError::SpawnFailed(e.to_string()))?;
    std::io::copy(&mut file, &mut out_file)
      .map_err(|e| DesktopGatewayError::SpawnFailed(e.to_string()))?;
  }
  Ok(())
}

#[cfg(windows)]
fn unzip_node_runtime(zip_path: &Path, node_dir: &Path) -> Result<PathBuf, DesktopGatewayError> {
  let file = fs::File::open(zip_path).map_err(|e| DesktopGatewayError::SpawnFailed(e.to_string()))?;
  let mut archive =
    ZipArchive::new(file).map_err(|e| DesktopGatewayError::SpawnFailed(e.to_string()))?;
  fs::create_dir_all(node_dir).map_err(|e| DesktopGatewayError::SpawnFailed(e.to_string()))?;

  for i in 0..archive.len() {
    let mut file = archive
      .by_index(i)
      .map_err(|e| DesktopGatewayError::SpawnFailed(e.to_string()))?;
    if file.is_dir() {
      continue;
    }

    let name = file.name().replace('\\', "/");
    let Some(filename) = Path::new(&name).file_name() else {
      continue;
    };
    if !filename.to_string_lossy().eq_ignore_ascii_case("node.exe") {
      continue;
    }

    let out_path = node_dir.join("node.exe");
    if let Some(parent) = out_path.parent() {
      fs::create_dir_all(parent).map_err(|e| DesktopGatewayError::SpawnFailed(e.to_string()))?;
    }
    let mut out_file =
      fs::File::create(&out_path).map_err(|e| DesktopGatewayError::SpawnFailed(e.to_string()))?;
    std::io::copy(&mut file, &mut out_file)
      .map_err(|e| DesktopGatewayError::SpawnFailed(e.to_string()))?;
    return Ok(out_path);
  }

  Err(DesktopGatewayError::SpawnFailed(
    "desktop runtime archive missing node.exe".into(),
  ))
}

fn ensure_desktop_runtime(resource_base: &Path, app_data_dir: &Path) -> Result<PathBuf, DesktopGatewayError> {
  // resource_base contains:
  // - propai/ (dist/entry.js, assets, skills, node_modules.zip, etc)
  // - node/ (node-runtime.zip on Windows, node binary on other platforms)
  // - propai/.prepared (timestamp marker)
  let stamp = read_text(&resource_base.join("propai").join(".prepared"))
    .or_else(|| read_text(&resource_base.join("desktop.prepared.txt")))
    .unwrap_or_else(|| "unknown".into());
  let runtime_root = app_data_dir.join("runtime").join("propai");
  let runtime_stamp_path = runtime_root.join(".prepared");
  let chalk_path = runtime_root.join("node_modules").join("chalk").join("package.json");
  #[cfg(windows)]
  let runtime_node_bin = runtime_root.join("node").join("node.exe");
  let templates_path = runtime_root
    .join("docs")
    .join("reference")
    .join("templates")
    .join("AGENTS.md");

  if runtime_stamp_path.is_file() {
    if let Some(existing) = read_text(&runtime_stamp_path) {
      if existing == stamp
        && chalk_path.is_file()
        && templates_path.is_file()
        && {
          #[cfg(windows)]
          {
            runtime_node_bin.is_file()
          }
          #[cfg(not(windows))]
          {
            true
          }
        }
      {
        return Ok(runtime_root);
      }
    }
  }

  let _ = fs::remove_dir_all(&runtime_root);
  fs::create_dir_all(&runtime_root).map_err(|e| DesktopGatewayError::SpawnFailed(e.to_string()))?;

  let resource_propai_sync = resource_base.join("propai");
  if resolve_gateway_entry(&resource_propai_sync).is_none() {
    return Err(DesktopGatewayError::MissingResources);
  }
  copy_dir_recursive(&resource_propai_sync, &runtime_root)
    .map_err(|e| DesktopGatewayError::SpawnFailed(e.to_string()))?;

  let node_modules_zip = runtime_root.join("node_modules.zip");
  if !node_modules_zip.is_file() {
    return Err(DesktopGatewayError::MissingResources);
  }
  let node_modules_dir = runtime_root.join("node_modules");
  let _ = fs::remove_dir_all(&node_modules_dir);
  unzip_node_modules(&node_modules_zip, &runtime_root)?;

  if !chalk_path.is_file() {
    return Err(DesktopGatewayError::SpawnFailed(
      "desktop runtime extract missing chalk".into(),
    ));
  }

  #[cfg(windows)]
  {
    let runtime_node_dir = runtime_root.join("node");
    let _ = fs::remove_dir_all(&runtime_node_dir);
    let node_runtime_zip = resource_base.join("node").join("node-runtime.zip");
    if !node_runtime_zip.is_file() {
      return Err(DesktopGatewayError::MissingResources);
    }
    let extracted = unzip_node_runtime(&node_runtime_zip, &runtime_node_dir)?;
    if !extracted.is_file() {
      return Err(DesktopGatewayError::SpawnFailed(
        "desktop runtime extract missing node.exe".into(),
      ));
    }
  }

  fs::write(runtime_stamp_path, format!("{stamp}\n"))
    .map_err(|e| DesktopGatewayError::SpawnFailed(e.to_string()))?;

  Ok(runtime_root)
}

pub fn start_gateway(
  state: &DesktopGatewayState,
  req: DesktopGatewayStartRequest,
  resource_root: Option<PathBuf>,
  log_dir: Option<PathBuf>,
  app_data_dir: Option<PathBuf>,
) -> Result<DesktopGatewayStartResponse, DesktopGatewayError> {
  let mut guard = state.inner.lock().expect("gateway mutex poisoned");
  if let Some(proc) = guard.as_mut() {
    match proc.child.try_wait() {
      Ok(None) => {
        return Ok(DesktopGatewayStartResponse {
          ws_url: proc.ws_url.clone(),
          token: proc.token.clone(),
          port: proc.port,
          pid: proc.child.id(),
          log_path: proc.log_path.as_ref().map(|p| p.to_string_lossy().to_string()),
        });
      }
      Ok(Some(_)) | Err(_) => {
        *guard = None;
      }
    }
  }

  let port = if cfg!(windows) {
    FIXED_GATEWAY_PORT
  } else {
    pick_free_loopback_port()
  };

  #[cfg(windows)]
  {
    // Non-technical UX requirement: never show "port already in use". Kill any existing process
    // holding the fixed port before starting the gateway.
    ensure_windows_port_killed(port)?;
  }

  let token = generate_token();
  let ws_url = format!("ws://127.0.0.1:{port}");

  let log_path = log_dir.map(|dir| dir.join("propai-desktop-gateway.log"));
  let mut cmd = if req.dev {
    let repo_root = resolve_repo_root()?;
    let mut cmd = Command::new("node");
    cmd.current_dir(&repo_root);
    cmd.env("PROPAI_PROFILE", "dev");
    cmd.arg("scripts/run-node.mjs");
    cmd
  } else {
    let resource_root = resource_root.ok_or(DesktopGatewayError::MissingResources)?;
    let base = resolve_bundled_resource_base(&resource_root).ok_or(DesktopGatewayError::MissingResources)?;
    let app_data_dir_path = app_data_dir.as_ref().ok_or(DesktopGatewayError::MissingResources)?;
    let propai_root = ensure_desktop_runtime(&base, app_data_dir_path)?;
    let node_bin = if cfg!(windows) {
      propai_root.join("node").join("node.exe")
    } else {
      base.join("node").join("node")
    };
    let entry = resolve_gateway_entry(&propai_root).ok_or(DesktopGatewayError::MissingResources)?;
    if !node_bin.is_file() {
      return Err(DesktopGatewayError::MissingResources);
    }

    let mut cmd = Command::new(node_bin);
    cmd.current_dir(&propai_root);
    cmd.arg(entry);
    cmd
  };

  cmd.env("PROPAI_GATEWAY_PORT", port.to_string());
  cmd.env("PROPAI_GATEWAY_BIND", "loopback");
  cmd.env("PROPAI_GATEWAY_AUTH_MODE", "token");
  cmd.env("PROPAI_GATEWAY_TOKEN", &token);
  cmd.env("PROPAI_GATEWAY_ALLOW_UNCONFIGURED", "1");

  apply_windows_no_window(&mut cmd);

  if let Some(app_data_dir) = app_data_dir.as_ref() {
    // Keep desktop installs isolated from the user's CLI installs.
    // This makes the Windows desktop app redistributable and "no terminal required".
    let state_dir = app_data_dir.join("state");
    ensure_desktop_state_seed(&state_dir)?;
    cmd.env("PROPAI_STATE_DIR", &state_dir);
    cmd.env("PROPAI_DESKTOP", "1");
    // Used by onboarding/pickers to choose desktop-friendly defaults.
    cmd.env("PROPAI_ONBOARD_DEFAULT_AUTH_PROVIDER", "openrouter");
  }

  if let Some(path) = log_path.as_ref() {
    let stdout = Stdio::piped();
    let stderr = Stdio::piped();
    cmd.stdout(stdout).stderr(stderr);
    let mut child = cmd.spawn().map_err(|e| DesktopGatewayError::SpawnFailed(e.to_string()))?;

    if let Some(file) = open_log_file(path) {
      if let Some(out) = child.stdout.take() {
        spawn_log_pump(BufReader::new(out), file.try_clone().unwrap_or_else(|_| file));
      }
      if let Some(err) = child.stderr.take() {
        if let Some(file2) = open_log_file(path) {
          spawn_log_pump(BufReader::new(err), file2);
        }
      }
    }

    let pid = child.id();
    *guard = Some(DesktopGatewayProcess {
      child,
      ws_url: ws_url.clone(),
      token: token.clone(),
      port,
      log_path,
    });

    return Ok(DesktopGatewayStartResponse {
      ws_url,
      token,
      port,
      pid,
      log_path: guard
        .as_ref()
        .and_then(|p| p.log_path.as_ref())
        .map(|p| p.to_string_lossy().to_string()),
    });
  }

  let child = cmd.spawn().map_err(|e| DesktopGatewayError::SpawnFailed(e.to_string()))?;
  let pid = child.id();
  *guard = Some(DesktopGatewayProcess {
    child,
    ws_url: ws_url.clone(),
    token: token.clone(),
    port,
    log_path: None,
  });

  Ok(DesktopGatewayStartResponse {
    ws_url,
    token,
    port,
    pid,
    log_path: None,
  })
}

pub fn stop_gateway(state: &DesktopGatewayState) -> Result<(), DesktopGatewayError> {
  let mut guard = state.inner.lock().expect("gateway mutex poisoned");
  let Some(mut proc) = guard.take() else {
    return Err(DesktopGatewayError::NotRunning);
  };
  let _ = proc.child.kill();
  let _ = proc.child.wait();
  Ok(())
}

pub fn gateway_status(state: &DesktopGatewayState) -> DesktopGatewayStatusResponse {
  let mut guard = state.inner.lock().expect("gateway mutex poisoned");
  let Some(proc) = guard.as_mut() else {
    return DesktopGatewayStatusResponse {
      running: false,
      ws_url: None,
      port: None,
      pid: None,
      log_path: None,
    };
  };

  match proc.child.try_wait() {
    Ok(None) => {}
    Ok(Some(_)) | Err(_) => {
      *guard = None;
      return DesktopGatewayStatusResponse {
        running: false,
        ws_url: None,
        port: None,
        pid: None,
        log_path: None,
      };
    }
  }

  DesktopGatewayStatusResponse {
    running: true,
    ws_url: Some(proc.ws_url.clone()),
    port: Some(proc.port),
    pid: Some(proc.child.id()),
    log_path: proc.log_path.as_ref().map(|p| p.to_string_lossy().to_string()),
  }
}






