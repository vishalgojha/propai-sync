use futures_util::{SinkExt, StreamExt};
use serde::{Deserialize, Serialize};
use std::sync::atomic::{AtomicU64, Ordering};
use tauri::{AppHandle, Emitter, Manager, Url};
use tokio::sync::{mpsc, Mutex};
use tokio_tungstenite::tungstenite::protocol::Message;

const EVENT_GATEWAY_FRAME: &str = "PropAi Sync:gateway-frame";
const EVENT_GATEWAY_CLOSE: &str = "PropAi Sync:gateway-close";

#[derive(Default)]
pub struct GatewayIpcState {
  inner: Mutex<GatewayIpcInner>,
  next_id: AtomicU64,
}

#[derive(Default)]
struct GatewayIpcInner {
  active_id: u64,
  url: Option<String>,
  token: Option<String>,
  sender: Option<mpsc::UnboundedSender<Message>>,
  connected: bool,
}

#[derive(Clone, Serialize)]
struct GatewayFrameEvent {
  data: String,
}

#[derive(Clone, Serialize)]
struct GatewayCloseEvent {
  code: u16,
  reason: String,
}

#[derive(Deserialize)]
pub struct GatewayIpcStartArgs {
  pub url: String,
  #[serde(default)]
  pub token: Option<String>,
}

#[derive(Deserialize)]
pub struct GatewayIpcRequest {
  pub id: String,
  #[serde(default)]
  pub params: Option<serde_json::Value>,
}

#[derive(Deserialize)]
pub struct GatewayRpcRequest {
  pub method: String,
  pub id: String,
  #[serde(default)]
  pub params: Option<serde_json::Value>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GatewayHttpArgs {
  #[serde(default)]
  pub gateway_url: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GatewayAvatarArgs {
  pub agent_id: String,
  #[serde(default)]
  pub meta: Option<u8>,
  #[serde(default)]
  pub gateway_url: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NostrProfileUpdateArgs {
  pub account_id: String,
  #[serde(default)]
  pub gateway_url: Option<String>,
  #[serde(default)]
  pub token: Option<String>,
  #[serde(flatten)]
  pub profile: serde_json::Map<String, serde_json::Value>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NostrProfileImportArgs {
  pub account_id: String,
  #[serde(default)]
  pub gateway_url: Option<String>,
  #[serde(default)]
  pub token: Option<String>,
  #[serde(flatten)]
  pub body: serde_json::Map<String, serde_json::Value>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LicenseActivateArgs {
  pub api_url: String,
  pub token: String,
  pub device_id: String,
  #[serde(default)]
  pub app_version: Option<String>,
  #[serde(default)]
  pub client: Option<serde_json::Value>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LicenseRequestArgs {
  pub api_url: String,
  #[serde(default)]
  pub email: Option<String>,
  #[serde(default)]
  pub plan: Option<String>,
  #[serde(default)]
  pub max_devices: Option<u32>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LicenseRefreshArgs {
  pub api_url: String,
  pub activation_token: String,
  pub device_id: String,
  #[serde(default)]
  pub app_version: Option<String>,
  #[serde(default)]
  pub client: Option<serde_json::Value>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LicenseDeactivateArgs {
  pub api_url: String,
  pub activation_token: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LicenseAdminApproveArgs {
  pub api_url: String,
  pub admin_key: String,
  pub token: String,
}

struct GatewayHttpTarget {
  origin: String,
  base_path: String,
  token: Option<String>,
}

struct RawHttpResponse {
  status: reqwest::StatusCode,
  text: String,
}

const CONTROL_UI_BOOTSTRAP_CONFIG_PATH: &str = "/__PropAiSync/control-ui-config.json";
const CONTROL_UI_AVATAR_PREFIX: &str = "/avatar";

fn build_request_frame(method: &str, req: GatewayIpcRequest) -> Result<String, String> {
  let method = method.trim();
  if method.is_empty() {
    return Err("gateway method is required".to_string());
  }
  if req.id.trim().is_empty() {
    return Err("gateway request id is required".to_string());
  }
  let mut map = serde_json::Map::new();
  map.insert("type".to_string(), serde_json::Value::String("req".to_string()));
  map.insert("id".to_string(), serde_json::Value::String(req.id));
  map.insert("method".to_string(), serde_json::Value::String(method.to_string()));
  if let Some(params) = req.params {
    map.insert("params".to_string(), params);
  }
  serde_json::to_string(&serde_json::Value::Object(map))
    .map_err(|err| format!("failed to serialize gateway request: {err}"))
}

fn normalize_optional_string(value: Option<String>) -> Option<String> {
  value
    .map(|val| val.trim().to_string())
    .filter(|val| !val.is_empty())
}

fn parse_gateway_http_origin(raw_url: &str) -> Result<(String, String), String> {
  let parsed = Url::parse(raw_url)
    .map_err(|err| format!("invalid gateway url: {err}"))?;
  let scheme = match parsed.scheme() {
    "ws" | "http" => "http",
    "wss" | "https" => "https",
    other => return Err(format!("unsupported gateway url scheme: {other}")),
  };
  let host_raw = parsed
    .host_str()
    .ok_or_else(|| "gateway url missing host".to_string())?;
  let host = if host_raw.contains(':') && !host_raw.starts_with('[') {
    format!("[{host_raw}]")
  } else {
    host_raw.to_string()
  };
  let origin = match parsed.port() {
    Some(port) => format!("{scheme}://{host}:{port}"),
    None => format!("{scheme}://{host}"),
  };
  let mut base_path = parsed.path().trim_end_matches('/').to_string();
  if base_path == "/" {
    base_path.clear();
  }
  Ok((origin, base_path))
}

async fn resolve_gateway_http_target(
  state: &GatewayIpcState,
  gateway_url: Option<String>,
  token: Option<String>,
) -> Result<GatewayHttpTarget, String> {
  let (state_url, state_token) = {
    let inner = state.inner.lock().await;
    (inner.url.clone(), inner.token.clone())
  };
  let resolved_url = normalize_optional_string(gateway_url)
    .or_else(|| normalize_optional_string(state_url))
    .ok_or_else(|| "gateway url is required".to_string())?;
  let resolved_token =
    normalize_optional_string(token).or_else(|| normalize_optional_string(state_token));
  let (origin, base_path) = parse_gateway_http_origin(&resolved_url)?;
  Ok(GatewayHttpTarget {
    origin,
    base_path,
    token: resolved_token,
  })
}

fn build_gateway_url(target: &GatewayHttpTarget, path: &str, use_base_path: bool) -> String {
  let clean_path = if path.starts_with('/') {
    path.to_string()
  } else {
    format!("/{path}")
  };
  if use_base_path && !target.base_path.is_empty() {
    format!("{}{}{}", target.origin, target.base_path, clean_path)
  } else {
    format!("{}{}", target.origin, clean_path)
  }
}

async fn send_request_raw(
  client: &reqwest::Client,
  method: reqwest::Method,
  url: String,
  token: Option<&str>,
  body: Option<serde_json::Value>,
) -> Result<RawHttpResponse, String> {
  let mut builder = client.request(method, &url);
  if let Some(token) = token {
    builder = builder.bearer_auth(token);
  }
  if let Some(body) = body {
    builder = builder.json(&body);
  }
  let res = builder
    .send()
    .await
    .map_err(|err| format!("gateway request failed: {err}"))?;
  let status = res.status();
  let text = res
    .text()
    .await
    .map_err(|err| format!("gateway response read failed: {err}"))?;
  Ok(RawHttpResponse { status, text })
}

fn parse_json_response(resp: RawHttpResponse) -> Result<serde_json::Value, String> {
  if resp.text.trim().is_empty() {
    return Err(format!("gateway returned empty response ({})", resp.status));
  }
  serde_json::from_str::<serde_json::Value>(&resp.text).map_err(|err| {
    format!(
      "gateway returned invalid json ({}): {err}",
      resp.status
    )
  })
}

async fn send_gateway_request(
  state: &GatewayIpcState,
  method: &str,
  req: GatewayIpcRequest,
) -> Result<(), String> {
  let payload = build_request_frame(method, req)?;
  let sender = {
    let inner = state.inner.lock().await;
    inner.sender.clone()
  };
  let Some(sender) = sender else {
    return Err("gateway IPC not connected".to_string());
  };
  sender
    .send(Message::Text(payload))
    .map_err(|_| "gateway IPC not connected".to_string())
}

fn emit_close(app: &AppHandle, code: u16, reason: String) {
  let _ = app.emit(EVENT_GATEWAY_CLOSE, GatewayCloseEvent { code, reason });
}

#[tauri::command]
pub async fn gateway_ipc_start(
  state: tauri::State<'_, GatewayIpcState>,
  app: AppHandle,
  args: GatewayIpcStartArgs,
) -> Result<(), String> {
  let url = args.url.trim();
  if url.is_empty() {
    return Err("gateway url is required".to_string());
  }
  let url = url.to_string();

  let id = state.next_id.fetch_add(1, Ordering::SeqCst) + 1;
  let (sender, receiver) = mpsc::unbounded_channel();

  {
    let mut inner = state.inner.lock().await;
    if inner.sender.is_some()
      && inner.url.as_deref() == Some(url.as_str())
      && inner.connected
    {
      return Ok(());
    }
    if let Some(existing) = inner.sender.take() {
      let _ = existing.send(Message::Close(None));
    }
    inner.active_id = id;
    inner.url = Some(url.clone());
    inner.token = normalize_optional_string(args.token);
    inner.sender = Some(sender);
    inner.connected = false;
  }

  tauri::async_runtime::spawn(run_gateway_ipc(app, url, id, receiver));
  Ok(())
}

#[tauri::command]
pub async fn gateway_ipc_stop(state: tauri::State<'_, GatewayIpcState>) -> Result<(), String> {
  let mut inner = state.inner.lock().await;
  if let Some(sender) = inner.sender.take() {
    let _ = sender.send(Message::Close(None));
  }
  inner.url = None;
  inner.token = None;
  inner.connected = false;
  inner.active_id = inner.active_id.saturating_add(1);
  Ok(())
}

#[tauri::command]
pub async fn rpc_call(
  state: tauri::State<'_, GatewayIpcState>,
  args: GatewayRpcRequest,
) -> Result<(), String> {
  send_gateway_request(
    &state,
    args.method.as_str(),
    GatewayIpcRequest {
      id: args.id,
      params: args.params,
    },
  )
  .await
}

macro_rules! gateway_command {
  ($name:ident, $method:expr) => {
    #[tauri::command]
    pub async fn $name(
      state: tauri::State<'_, GatewayIpcState>,
      args: GatewayIpcRequest,
    ) -> Result<(), String> {
      send_gateway_request(&state, $method, args).await
    }
  };
}

gateway_command!(agent_identity_get, "agent.identity.get");
gateway_command!(agents_files_get, "agents.files.get");
gateway_command!(agents_files_list, "agents.files.list");
gateway_command!(agents_files_set, "agents.files.set");
gateway_command!(agents_list, "agents.list");
gateway_command!(channels_logout, "channels.logout");
gateway_command!(channels_status, "channels.status");
gateway_command!(chat_abort, "chat.abort");
gateway_command!(chat_send, "chat.send");
gateway_command!(config_apply, "config.apply");
gateway_command!(config_get, "config.get");
gateway_command!(config_schema, "config.schema");
gateway_command!(config_set, "config.set");
gateway_command!(connect, "connect");
gateway_command!(cron_add, "cron.add");
gateway_command!(cron_list, "cron.list");
gateway_command!(cron_remove, "cron.remove");
gateway_command!(cron_run, "cron.run");
gateway_command!(cron_runs, "cron.runs");
gateway_command!(cron_status, "cron.status");
gateway_command!(cron_update, "cron.update");
gateway_command!(device_pair_approve, "device.pair.approve");
gateway_command!(device_pair_reject, "device.pair.reject");
gateway_command!(device_token_revoke, "device.token.revoke");
gateway_command!(exec_approval_resolve, "exec.approval.resolve");
gateway_command!(health, "health");
gateway_command!(last_heartbeat, "last-heartbeat");
gateway_command!(logs_tail, "logs.tail");
gateway_command!(models_list, "models.list");
gateway_command!(node_list, "node.list");
gateway_command!(sessions_compact, "sessions.compact");
gateway_command!(sessions_delete, "sessions.delete");
gateway_command!(sessions_list, "sessions.list");
gateway_command!(sessions_patch, "sessions.patch");
gateway_command!(sessions_usage, "sessions.usage");
gateway_command!(sessions_usage_logs, "sessions.usage.logs");
gateway_command!(sessions_usage_timeseries, "sessions.usage.timeseries");
gateway_command!(skills_install, "skills.install");
gateway_command!(skills_status, "skills.status");
gateway_command!(skills_update, "skills.update");
gateway_command!(status, "status");
gateway_command!(system_presence, "system-presence");
gateway_command!(tools_catalog, "tools.catalog");
gateway_command!(update_run, "update.run");
gateway_command!(usage_cost, "usage.cost");
gateway_command!(wizard_cancel, "wizard.cancel");
gateway_command!(wizard_next, "wizard.next");
gateway_command!(wizard_start, "wizard.start");

#[tauri::command]
pub async fn get_control_ui_config(
  state: tauri::State<'_, GatewayIpcState>,
  args: GatewayHttpArgs,
) -> Result<serde_json::Value, String> {
  let target = resolve_gateway_http_target(&state, args.gateway_url, None).await?;
  let url = build_gateway_url(&target, CONTROL_UI_BOOTSTRAP_CONFIG_PATH, true);
  let client = reqwest::Client::new();
  let raw = send_request_raw(&client, reqwest::Method::GET, url, None, None).await?;
  parse_json_response(raw)
}

#[tauri::command]
pub async fn get_avatar(
  state: tauri::State<'_, GatewayIpcState>,
  args: GatewayAvatarArgs,
) -> Result<serde_json::Value, String> {
  let target = resolve_gateway_http_target(&state, args.gateway_url, None).await?;
  let agent_id = args.agent_id.trim();
  if agent_id.is_empty() {
    return Err("agentId is required".to_string());
  }
  let meta = args.meta.unwrap_or(1);
  let path = format!("{CONTROL_UI_AVATAR_PREFIX}/{agent_id}?meta={meta}");
  let url = build_gateway_url(&target, &path, true);
  let client = reqwest::Client::new();
  let raw = send_request_raw(&client, reqwest::Method::GET, url, None, None).await?;
  parse_json_response(raw)
}

#[tauri::command]
pub async fn update_channels_nostr_profile(
  state: tauri::State<'_, GatewayIpcState>,
  args: NostrProfileUpdateArgs,
) -> Result<serde_json::Value, String> {
  let target = resolve_gateway_http_target(&state, args.gateway_url, args.token).await?;
  let account_id = args.account_id.trim();
  if account_id.is_empty() {
    return Err("accountId is required".to_string());
  }
  let path = format!("/api/channels/nostr/{account_id}/profile");
  let url = build_gateway_url(&target, &path, false);
  let body = serde_json::Value::Object(args.profile);
  let client = reqwest::Client::new();
  let token = target.token.as_deref();
  let raw = send_request_raw(
    &client,
    reqwest::Method::POST,
    url.clone(),
    token,
    Some(body.clone()),
  )
  .await?;
  if raw.status == reqwest::StatusCode::METHOD_NOT_ALLOWED {
    let raw = send_request_raw(
      &client,
      reqwest::Method::PUT,
      url,
      token,
      Some(body),
    )
    .await?;
    return parse_json_response(raw);
  }
  parse_json_response(raw)
}

#[tauri::command]
pub async fn channels_nostr_profile_import(
  state: tauri::State<'_, GatewayIpcState>,
  args: NostrProfileImportArgs,
) -> Result<serde_json::Value, String> {
  let target = resolve_gateway_http_target(&state, args.gateway_url, args.token).await?;
  let account_id = args.account_id.trim();
  if account_id.is_empty() {
    return Err("accountId is required".to_string());
  }
  let path = format!("/api/channels/nostr/{account_id}/profile/import");
  let url = build_gateway_url(&target, &path, false);
  let body = serde_json::Value::Object(args.body);
  let client = reqwest::Client::new();
  let raw = send_request_raw(
    &client,
    reqwest::Method::POST,
    url,
    target.token.as_deref(),
    Some(body),
  )
  .await?;
  parse_json_response(raw)
}

#[tauri::command]
pub async fn license_verify(args: LicenseActivateArgs) -> Result<serde_json::Value, String> {
  let url = build_license_url(&args.api_url, "/verify")?;
  let mut body = serde_json::Map::new();
  body.insert("token".to_string(), serde_json::Value::String(args.token));
  body.insert("deviceId".to_string(), serde_json::Value::String(args.device_id));
  if let Some(value) = normalize_optional_string(args.app_version) {
    body.insert("appVersion".to_string(), serde_json::Value::String(value));
  }
  if let Some(client) = args.client {
    body.insert("client".to_string(), client);
  }
  send_license_request(url, serde_json::Value::Object(body), None).await
}

#[tauri::command]
pub async fn license_activate(args: LicenseActivateArgs) -> Result<serde_json::Value, String> {
  let url = build_license_url(&args.api_url, "/v1/activations/activate")?;
  let mut body = serde_json::Map::new();
  body.insert("token".to_string(), serde_json::Value::String(args.token));
  body.insert("deviceId".to_string(), serde_json::Value::String(args.device_id));
  if let Some(value) = normalize_optional_string(args.app_version) {
    body.insert("appVersion".to_string(), serde_json::Value::String(value));
  }
  if let Some(client) = args.client {
    body.insert("client".to_string(), client);
  }
  send_license_request(url, serde_json::Value::Object(body), None).await
}

#[tauri::command]
pub async fn license_request(args: LicenseRequestArgs) -> Result<serde_json::Value, String> {
  let url = build_license_url(&args.api_url, "/v1/activations/request")?;
  let mut body = serde_json::Map::new();
  if let Some(value) = normalize_optional_string(args.email) {
    body.insert("email".to_string(), serde_json::Value::String(value));
  }
  if let Some(value) = normalize_optional_string(args.plan) {
    body.insert("plan".to_string(), serde_json::Value::String(value));
  }
  if let Some(value) = args.max_devices {
    body.insert(
      "maxDevices".to_string(),
      serde_json::Value::Number(serde_json::Number::from(value)),
    );
  }
  send_license_request(url, serde_json::Value::Object(body), None).await
}

#[tauri::command]
pub async fn license_admin_approve(
  args: LicenseAdminApproveArgs,
) -> Result<serde_json::Value, String> {
  let admin_key = normalize_optional_string(Some(args.admin_key))
    .ok_or_else(|| "adminKey is required".to_string())?;
  let token =
    normalize_optional_string(Some(args.token)).ok_or_else(|| "token is required".to_string())?;
  let url = build_license_url(&args.api_url, "/v1/admin/licenses/approve")?;
  let mut body = serde_json::Map::new();
  body.insert("token".to_string(), serde_json::Value::String(token));
  send_license_request(url, serde_json::Value::Object(body), Some(admin_key.as_str())).await
}

#[tauri::command]
pub async fn license_refresh(args: LicenseRefreshArgs) -> Result<serde_json::Value, String> {
  let url = build_license_url(&args.api_url, "/v1/activations/refresh")?;
  let mut body = serde_json::Map::new();
  body.insert(
    "activationToken".to_string(),
    serde_json::Value::String(args.activation_token),
  );
  body.insert("deviceId".to_string(), serde_json::Value::String(args.device_id));
  if let Some(value) = normalize_optional_string(args.app_version) {
    body.insert("appVersion".to_string(), serde_json::Value::String(value));
  }
  if let Some(client) = args.client {
    body.insert("client".to_string(), client);
  }
  send_license_request(url, serde_json::Value::Object(body), None).await
}

#[tauri::command]
pub async fn license_deactivate(args: LicenseDeactivateArgs) -> Result<serde_json::Value, String> {
  let url = build_license_url(&args.api_url, "/v1/activations/deactivate")?;
  let mut body = serde_json::Map::new();
  body.insert(
    "activationToken".to_string(),
    serde_json::Value::String(args.activation_token),
  );
  send_license_request(url, serde_json::Value::Object(body), None).await
}

fn build_license_url(api_url: &str, endpoint: &str) -> Result<String, String> {
  let trimmed = api_url.trim();
  if trimmed.is_empty() {
    return Err("apiUrl is required".to_string());
  }
  if trimmed.ends_with(endpoint) {
    return Ok(trimmed.to_string());
  }
  Ok(format!("{}{}", trimmed.trim_end_matches('/'), endpoint))
}

async fn send_license_request(
  url: String,
  body: serde_json::Value,
  admin_key: Option<&str>,
) -> Result<serde_json::Value, String> {
  let client = reqwest::Client::new();
  let mut builder = client.post(&url).json(&body);
  if let Some(value) = admin_key {
    builder = builder.header("x-admin-key", value);
  }
  let res = builder
    .send()
    .await
    .map_err(|err| format!("license request failed: {err}"))?;
  let status = res.status();
  let text = res
    .text()
    .await
    .map_err(|err| format!("license response read failed: {err}"))?;
  parse_json_response(RawHttpResponse { status, text })
}

async fn run_gateway_ipc(
  app: AppHandle,
  url: String,
  id: u64,
  mut receiver: mpsc::UnboundedReceiver<Message>,
) {
  let connect_result = tokio_tungstenite::connect_async(&url).await;
  let Ok((mut socket, _)) = connect_result else {
    emit_close(&app, 1006, "gateway IPC connect failed".to_string());
    let state = app.state::<GatewayIpcState>();
    let mut inner = state.inner.lock().await;
    if inner.active_id == id {
      inner.sender = None;
      inner.url = Some(url);
      inner.connected = false;
    }
    return;
  };

  {
    let state = app.state::<GatewayIpcState>();
    let mut inner = state.inner.lock().await;
    if inner.active_id == id {
      inner.connected = true;
    }
  }

  loop {
    tokio::select! {
      incoming = socket.next() => {
        match incoming {
          Some(Ok(Message::Text(text))) => {
            let _ = app.emit(EVENT_GATEWAY_FRAME, GatewayFrameEvent { data: text });
          }
          Some(Ok(Message::Binary(_))) => {}
          Some(Ok(Message::Ping(payload))) => {
            let _ = socket.send(Message::Pong(payload)).await;
          }
          Some(Ok(Message::Pong(_))) => {}
          Some(Ok(Message::Close(frame))) => {
            let (code, reason) = match frame {
              Some(frame) => (u16::from(frame.code), frame.reason.to_string()),
              None => (1000, String::new()),
            };
            emit_close(&app, code, reason);
            break;
          }
          Some(Err(err)) => {
            emit_close(&app, 1006, format!("gateway IPC error: {err}"));
            break;
          }
          None => {
            emit_close(&app, 1006, "gateway IPC closed".to_string());
            break;
          }
          _ => {}
        }
      }
      outgoing = receiver.recv() => {
        match outgoing {
          Some(msg) => {
            if socket.send(msg).await.is_err() {
              emit_close(&app, 1006, "gateway IPC closed".to_string());
              break;
            }
          }
          None => {
            let _ = socket.send(Message::Close(None)).await;
            emit_close(&app, 1000, String::new());
            break;
          }
        }
      }
    }
  }

  let state = app.state::<GatewayIpcState>();
  let mut inner = state.inner.lock().await;
  if inner.active_id == id {
    inner.sender = None;
    inner.url = Some(url);
    inner.connected = false;
  }
}
