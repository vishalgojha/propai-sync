import dns from "node:dns/promises";
import fs from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import net from "node:net";
import path from "node:path";
import type { AuthProfileCredential } from "../agents/auth-profiles.js";
import {
  ensureAuthProfileStore,
  listProfilesForProvider,
  upsertAuthProfileWithLock,
} from "../agents/auth-profiles.js";
import type { PropAiSyncConfig } from "../config/config.js";
import { loadConfig, writeConfigFile } from "../config/config.js";
import { resolveControlUiRootSync } from "../infra/control-ui-assets.js";
import { fetchWithRetry } from "../infra/retry.js";
import { createSubsystemLogger } from "../logging/subsystem.js";
import { activateSecretsRuntimeSnapshot, prepareSecretsRuntimeSnapshot } from "../secrets/runtime.js";
import type { ControlUiRootState } from "./control-ui.js";
import { readJsonBody } from "./hooks.js";

const CONTROL_UI_API_MAX_BODY_BYTES = 1024 * 1024;
const DEFAULT_LICENSING_URL = "https://propailicense.up.railway.app";
const DEFAULT_GATEWAY_URL_LOCAL = "http://localhost:8080";
const DEFAULT_GATEWAY_URL_RAILWAY = "http://gateway.railway.internal:8080";
const DEFAULT_CONTROL_API_URL_LOCAL = "http://localhost:8788";
const DEFAULT_CONTROL_API_URL_RAILWAY = "http://control-api.railway.internal:8080";
const CONTROL_UI_AUTH_PROFILE_PREFIX = "control-ui";

const log = createSubsystemLogger("gateway").child("control-ui");

type ControlUiApiEnv = {
  licensingUrl: string;
  gatewayUrl: string;
  controlApiUrl: string;
  gatewayToken: string;
};

function resolveEnv(): ControlUiApiEnv {
  const isRailway = Boolean(process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY_PROJECT_ID);
  const licensingUrl = (process.env.LICENSING_URL || DEFAULT_LICENSING_URL).replace(/\/+$/, "");
  const fallbackGatewayUrl = isRailway ? DEFAULT_GATEWAY_URL_RAILWAY : DEFAULT_GATEWAY_URL_LOCAL;
  const fallbackControlApiUrl = isRailway
    ? DEFAULT_CONTROL_API_URL_RAILWAY
    : DEFAULT_CONTROL_API_URL_LOCAL;
  const gatewayUrl = (process.env.GATEWAY_URL || fallbackGatewayUrl).replace(/\/+$/, "");
  const controlApiUrl = (process.env.CONTROL_API_URL || fallbackControlApiUrl).replace(/\/+$/, "");
  const gatewayToken = process.env.GATEWAY_TOKEN || process.env.PROPAI_GATEWAY_TOKEN || "";
  return { licensingUrl, gatewayUrl, controlApiUrl, gatewayToken };
}

type ProviderKeyState = {
  openai: boolean;
  anthropic: boolean;
  xai: boolean;
  elevenlabs: boolean;
};

type ProviderKeyInputs = Partial<Record<keyof ProviderKeyState, string>>;

function hasStoredCredentialForProvider(
  store: ReturnType<typeof ensureAuthProfileStore>,
  provider: string,
): boolean {
  const ids = listProfilesForProvider(store, provider);
  for (const id of ids) {
    const cred = store.profiles[id] as AuthProfileCredential | undefined;
    if (!cred) {
      continue;
    }
    if (cred.type === "api_key") {
      if (typeof cred.key === "string" && cred.key.trim()) {
        return true;
      }
      if (cred.keyRef) {
        return true;
      }
      continue;
    }
    if (cred.type === "token") {
      if (typeof cred.token === "string" && cred.token.trim()) {
        return true;
      }
      if (cred.tokenRef) {
        return true;
      }
      continue;
    }
    if (cred.type === "oauth") {
      return true;
    }
  }
  return false;
}

function resolveGatewayProviderKeys(): ProviderKeyState {
  let store: ReturnType<typeof ensureAuthProfileStore> | null = null;
  try {
    store = ensureAuthProfileStore();
  } catch (error) {
    log.warn(`control-ui health: failed to read auth profiles: ${String(error)}`);
  }
  const openai =
    (store ? hasStoredCredentialForProvider(store, "openai") : false) ||
    Boolean(process.env.OPENAI_API_KEY || process.env.OPENAI_KEY);
  const anthropic =
    (store ? hasStoredCredentialForProvider(store, "anthropic") : false) ||
    Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_KEY);
  const xai =
    (store ? hasStoredCredentialForProvider(store, "xai") : false) ||
    Boolean(process.env.XAI_API_KEY);
  const elevenlabs =
    (store ? hasStoredCredentialForProvider(store, "elevenlabs") : false) ||
    Boolean(process.env.ELEVENLABS_API_KEY);
  return {
    openai,
    anthropic,
    xai,
    elevenlabs,
  };
}

function normalizeProviderKey(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  if (trimmed.length < 8) {
    return null;
  }
  return trimmed;
}

function extractProviderKeysFromSettings(settings: unknown): ProviderKeyInputs {
  if (!settings || typeof settings !== "object") {
    return {};
  }
  const providers = (settings as { providers?: Record<string, unknown> }).providers;
  if (!providers || typeof providers !== "object") {
    return {};
  }
  const record = providers as Record<string, unknown>;
  const openai = normalizeProviderKey((record.openai as { apiKey?: unknown } | undefined)?.apiKey);
  const anthropic = normalizeProviderKey(
    (record.anthropic as { apiKey?: unknown } | undefined)?.apiKey,
  );
  const xai = normalizeProviderKey((record.xai as { apiKey?: unknown } | undefined)?.apiKey);
  const elevenlabs = normalizeProviderKey(
    (record.eleven as { apiKey?: unknown } | undefined)?.apiKey ??
      (record.elevenlabs as { apiKey?: unknown } | undefined)?.apiKey,
  );
  return {
    openai: openai ?? undefined,
    anthropic: anthropic ?? undefined,
    xai: xai ?? undefined,
    elevenlabs: elevenlabs ?? undefined,
  };
}

function withTtsApiKey(
  config: PropAiSyncConfig,
  provider: "openai" | "elevenlabs",
  apiKey: string,
): { config: PropAiSyncConfig; changed: boolean } {
  const current = config.tts?.[provider]?.apiKey;
  if (typeof current === "string" && current.trim() === apiKey.trim()) {
    return { config, changed: false };
  }
  return {
    config: {
      ...config,
      tts: {
        ...config.tts,
        [provider]: {
          ...config.tts?.[provider],
          apiKey,
        },
      },
    },
    changed: true,
  };
}

function withTalkApiKey(
  config: PropAiSyncConfig,
  provider: "elevenlabs",
  apiKey: string,
): { config: PropAiSyncConfig; changed: boolean } {
  const current = config.talk?.providers?.[provider]?.apiKey;
  if (typeof current === "string" && current.trim() === apiKey.trim()) {
    return { config, changed: false };
  }
  return {
    config: {
      ...config,
      talk: {
        ...config.talk,
        apiKey,
        providers: {
          ...config.talk?.providers,
          [provider]: {
            ...config.talk?.providers?.[provider],
            apiKey,
          },
        },
      },
    },
    changed: true,
  };
}

async function refreshSecretsRuntime(config: PropAiSyncConfig) {
  try {
    const snapshot = await prepareSecretsRuntimeSnapshot({ config, env: process.env });
    activateSecretsRuntimeSnapshot(snapshot);
  } catch (error) {
    log.warn(`control-ui settings sync: failed to refresh secrets runtime: ${String(error)}`);
  }
}

async function applyProviderKeysFromSettings(settings: unknown): Promise<void> {
  try {
    const keys = extractProviderKeysFromSettings(settings);
    const anyKeys = Object.values(keys).some(Boolean);
    if (!anyKeys) {
      return;
    }

    const updates: Array<Promise<unknown>> = [];
    if (keys.openai) {
      updates.push(
        upsertAuthProfileWithLock({
          profileId: `${CONTROL_UI_AUTH_PROFILE_PREFIX}-openai`,
          credential: { type: "api_key", provider: "openai", key: keys.openai },
        }),
      );
    }
    if (keys.anthropic) {
      updates.push(
        upsertAuthProfileWithLock({
          profileId: `${CONTROL_UI_AUTH_PROFILE_PREFIX}-anthropic`,
          credential: { type: "api_key", provider: "anthropic", key: keys.anthropic },
        }),
      );
    }
    if (keys.xai) {
      updates.push(
        upsertAuthProfileWithLock({
          profileId: `${CONTROL_UI_AUTH_PROFILE_PREFIX}-xai`,
          credential: { type: "api_key", provider: "xai", key: keys.xai },
        }),
      );
    }
    if (keys.elevenlabs) {
      updates.push(
        upsertAuthProfileWithLock({
          profileId: `${CONTROL_UI_AUTH_PROFILE_PREFIX}-elevenlabs`,
          credential: { type: "api_key", provider: "elevenlabs", key: keys.elevenlabs },
        }),
      );
    }

    let config = loadConfig();
    let configChanged = false;
    if (keys.openai) {
      const applied = withTtsApiKey(config, "openai", keys.openai);
      config = applied.config;
      configChanged = configChanged || applied.changed;
    }
    if (keys.elevenlabs) {
      const appliedTts = withTtsApiKey(config, "elevenlabs", keys.elevenlabs);
      config = appliedTts.config;
      configChanged = configChanged || appliedTts.changed;
      const appliedTalk = withTalkApiKey(config, "elevenlabs", keys.elevenlabs);
      config = appliedTalk.config;
      configChanged = configChanged || appliedTalk.changed;
    }

    try {
      await Promise.all(updates);
    } catch (error) {
      log.warn(`control-ui settings sync: failed to store auth profiles: ${String(error)}`);
    }

    if (configChanged) {
      try {
        await writeConfigFile(config);
      } catch (error) {
        log.warn(`control-ui settings sync: failed to write config: ${String(error)}`);
      }
    }

    if (updates.length > 0 || configChanged) {
      await refreshSecretsRuntime(config);
    }
  } catch (error) {
    log.warn(`control-ui settings sync: ${String(error)}`);
  }
}

function sendJson(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

function sendProxyError(res: ServerResponse, message: string) {
  sendJson(res, 502, { ok: false, message });
}

function resolveBodyErrorStatus(error: string): number {
  if (error === "payload too large") {
    return 413;
  }
  if (error === "request body timeout") {
    return 408;
  }
  return 400;
}

function normalizeUrl(rawUrl: string | null): string | null {
  if (!rawUrl) {
    return null;
  }
  if (rawUrl.startsWith("http://") || rawUrl.startsWith("https://")) {
    return rawUrl;
  }
  return `http://${rawUrl}`;
}

async function probeTcp(host: string, port: number, timeoutMs = 1500) {
  return await new Promise<{ ok: boolean; error?: string }>((resolve) => {
    const socket = new net.Socket();
    let settled = false;
    const finalize = (result: { ok: boolean; error?: string }) => {
      if (settled) {
        return;
      }
      settled = true;
      socket.destroy();
      resolve(result);
    };
    socket.setTimeout(timeoutMs);
    socket.on("connect", () => finalize({ ok: true }));
    socket.on("timeout", () => finalize({ ok: false, error: "timeout" }));
    socket.on("error", (err) => finalize({ ok: false, error: err.message }));
    socket.connect(port, host);
  });
}

async function forwardJson(res: ServerResponse, url: string, body: unknown) {
  try {
    const response = await fetchWithRetry(
      url,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(body ?? {}),
      },
      {
        context: `control-ui proxy ${url}`,
        onRetry: (info) => {
          log.warn(
            {
              attempt: info.retryCount + 1,
              maxRetries: info.maxRetries,
              delayMs: info.delayMs,
            },
            "control-ui proxy failed, retrying",
          );
        },
      },
    );
    const payload = await response.json().catch(() => ({}));
    res.statusCode = response.status;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify(payload));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upstream request failed.";
    sendProxyError(res, message);
  }
}

function resolveControlUiIndexPath(controlUiRoot?: ControlUiRootState) {
  if (controlUiRoot?.kind === "invalid") {
    return { ok: false, indexPath: null, reason: "invalid", configuredRoot: controlUiRoot.path };
  }
  if (controlUiRoot?.kind === "missing") {
    return { ok: false, indexPath: null, reason: "missing", configuredRoot: null };
  }
  const root =
    controlUiRoot?.kind === "resolved" || controlUiRoot?.kind === "bundled"
      ? controlUiRoot.path
      : resolveControlUiRootSync({
          moduleUrl: import.meta.url,
          argv1: process.argv[1],
          cwd: process.cwd(),
        });
  if (!root) {
    return { ok: false, indexPath: null, reason: "missing", configuredRoot: null };
  }
  const indexPath = path.join(root, "index.html");
  return { ok: fs.existsSync(indexPath), indexPath, reason: null, configuredRoot: root };
}

async function readJsonBodyForRequest(req: IncomingMessage): Promise<
  | { ok: true; value: unknown }
  | { ok: false; status: number; error: string }
> {
  if (req.method === "GET" || req.method === "HEAD") {
    return { ok: true, value: {} };
  }
  const body = await readJsonBody(req, CONTROL_UI_API_MAX_BODY_BYTES);
  if (!body.ok) {
    return { ok: false, status: resolveBodyErrorStatus(body.error), error: body.error };
  }
  return body;
}

export async function handleControlUiApiRequest(
  req: IncomingMessage,
  res: ServerResponse,
  opts: { controlUiRoot?: ControlUiRootState },
): Promise<boolean> {
  const urlRaw = req.url;
  if (!urlRaw) {
    return false;
  }
  const url = new URL(urlRaw, "http://localhost");
  const pathname = url.pathname;
  if (!pathname.startsWith("/api/")) {
    return false;
  }

  const env = resolveEnv();

  if (pathname === "/api/health") {
    sendJson(res, 200, { ok: true, service: "propai-gateway" });
    return true;
  }

  if (pathname === "/api/health/ui") {
    const ui = resolveControlUiIndexPath(opts.controlUiRoot);
    const ok = ui.ok;
    sendJson(res, ok ? 200 : 500, {
      ok,
      indexPath: ui.indexPath,
      configuredRoot: ui.configuredRoot,
      reason: ui.reason,
    });
    return true;
  }

  if (pathname === "/api/health/control") {
    try {
      const response = await fetchWithRetry(
        `${env.controlApiUrl}/health`,
        { headers: { Accept: "application/json" } },
        {
          context: "control-api health",
          onRetry: (info) => {
            log.warn(
              {
                attempt: info.retryCount + 1,
                maxRetries: info.maxRetries,
                delayMs: info.delayMs,
              },
              "control-api health failed, retrying",
            );
          },
        },
      );
      const payload = await response.json().catch(() => ({}));
      res.statusCode = response.status;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.end(JSON.stringify(payload));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Control API not reachable.";
      sendJson(res, 503, { ok: false, message, controlApiUrl: env.controlApiUrl });
    }
    return true;
  }

  if (pathname === "/api/health/full") {
    const ui = resolveControlUiIndexPath(opts.controlUiRoot);
    const uiOk = ui.ok;

    let controlOk = false;
    let controlStatus = 503;
    let controlPayload: unknown = null;
    try {
      const response = await fetchWithRetry(
        `${env.controlApiUrl}/health`,
        { headers: { Accept: "application/json" } },
        {
          context: "control-api health",
          onRetry: (info) => {
            log.warn(
              {
                attempt: info.retryCount + 1,
                maxRetries: info.maxRetries,
                delayMs: info.delayMs,
              },
              "control-api health failed, retrying",
            );
          },
        },
      );
      controlStatus = response.status;
      controlPayload = await response.json().catch(() => ({}));
      controlOk = response.ok;
    } catch (error) {
      controlPayload = {
        ok: false,
        message: error instanceof Error ? error.message : "Control API not reachable.",
        controlApiUrl: env.controlApiUrl,
      };
    }

    let gatewayOk = false;
    let gatewayStatus = 503;
    let gatewayPayload: unknown = null;
    try {
      const response = await fetchWithRetry(
        `${env.gatewayUrl}/healthz`,
        { headers: { Accept: "application/json" } },
        {
          context: "gateway healthz",
          onRetry: (info) => {
            log.warn(
              {
                attempt: info.retryCount + 1,
                maxRetries: info.maxRetries,
                delayMs: info.delayMs,
              },
              "gateway healthz failed, retrying",
            );
          },
        },
      );
      gatewayStatus = response.status;
      gatewayPayload = await response.json().catch(() => ({}));
      gatewayOk = response.ok;
    } catch (error) {
      gatewayPayload = {
        ok: false,
        message: error instanceof Error ? error.message : "Gateway not reachable.",
        gatewayUrl: env.gatewayUrl,
      };
    }

    const ok = uiOk && controlOk && gatewayOk;
    sendJson(res, ok ? 200 : 503, {
      ok,
      ui: { ok: uiOk, indexPath: ui.indexPath },
      control: { ok: controlOk, status: controlStatus, payload: controlPayload },
      gateway: { ok: gatewayOk, status: gatewayStatus, payload: gatewayPayload },
    });
    return true;
  }

  if (pathname === "/api/health/setup") {
    const providerKeys = resolveGatewayProviderKeys();
    const anyProvider = Object.values(providerKeys).some(Boolean);
    const gatewayAuthConfigured = Boolean(env.gatewayToken);

    let controlOk = false;
    let gatewayUrlConfigured = false;
    let gatewayTokenConfigured = false;
    try {
      const response = await fetchWithRetry(
        `${env.controlApiUrl}/health`,
        { headers: { Accept: "application/json" } },
        {
          context: "control-api health",
          onRetry: (info) => {
            log.warn(
              {
                attempt: info.retryCount + 1,
                maxRetries: info.maxRetries,
                delayMs: info.delayMs,
              },
              "control-api health failed, retrying",
            );
          },
        },
      );
      const payload = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        gatewayUrlConfigured?: boolean;
        gatewayTokenConfigured?: boolean;
      };
      controlOk = response.ok;
      gatewayUrlConfigured = Boolean(payload.gatewayUrlConfigured);
      gatewayTokenConfigured = Boolean(payload.gatewayTokenConfigured);
    } catch {
      controlOk = false;
    }

    const controlLinkOk = gatewayUrlConfigured && gatewayTokenConfigured;
    const ok = gatewayAuthConfigured && anyProvider && controlLinkOk;

    sendJson(res, ok ? 200 : 503, {
      ok,
      gateway: {
        authTokenConfigured: gatewayAuthConfigured,
        providerKeys,
        anyProvider,
        licensingUrl: env.licensingUrl,
      },
      control: {
        ok: controlOk,
        gatewayUrlConfigured,
        gatewayTokenConfigured,
      },
    });
    return true;
  }

  if (pathname === "/api/gateway/health") {
    try {
      const response = await fetchWithRetry(
        `${env.gatewayUrl}/healthz`,
        { headers: { Accept: "application/json" } },
        {
          context: "gateway healthz",
          onRetry: (info) => {
            log.warn(
              {
                attempt: info.retryCount + 1,
                maxRetries: info.maxRetries,
                delayMs: info.delayMs,
              },
              "gateway healthz failed, retrying",
            );
          },
        },
      );
      const payload = await response.json().catch(() => ({}));
      res.statusCode = response.status;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.end(JSON.stringify(payload));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Gateway not reachable.";
      sendJson(res, 503, { ok: false, message, gatewayUrl: env.gatewayUrl });
    }
    return true;
  }

  if (pathname === "/api/gateway/chat") {
    const body = await readJsonBodyForRequest(req);
    if (!body.ok) {
      sendJson(res, body.status, { ok: false, error: body.error });
      return true;
    }
    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        Accept: "application/json",
        "x-propai-message-channel": "webcontrol",
      };
      if (env.gatewayToken) {
        headers.Authorization = `Bearer ${env.gatewayToken}`;
      }
      const response = await fetchWithRetry(
        `${env.gatewayUrl}/v1/chat/completions`,
        {
          method: "POST",
          headers,
          body: JSON.stringify(body.value ?? {}),
        },
        {
          context: "gateway chat proxy",
          onRetry: (info) => {
            log.warn(
              {
                attempt: info.retryCount + 1,
                maxRetries: info.maxRetries,
                delayMs: info.delayMs,
              },
              "gateway chat proxy failed, retrying",
            );
          },
        },
      );
      const payloadText = await response.text();
      res.statusCode = response.status;
      if (payloadText) {
        try {
          const payload = JSON.parse(payloadText);
          res.setHeader("Content-Type", "application/json; charset=utf-8");
          res.end(JSON.stringify(payload));
        } catch {
          res.setHeader("Content-Type", "text/plain; charset=utf-8");
          res.end(payloadText);
        }
      } else {
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        res.end(JSON.stringify({}));
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Gateway chat failed.";
      sendProxyError(res, message);
    }
    return true;
  }

  if (pathname === "/api/diag/gateway") {
    const normalized = normalizeUrl(env.gatewayUrl);
    if (!normalized) {
      sendJson(res, 500, { ok: false, message: "GATEWAY_URL not set." });
      return true;
    }
    let parsed: URL;
    try {
      parsed = new URL(normalized);
    } catch (error) {
      sendJson(res, 500, {
        ok: false,
        message: error instanceof Error ? error.message : "Invalid gateway URL.",
        gatewayUrl: env.gatewayUrl,
      });
      return true;
    }
    const host = parsed.hostname;
    const port = parsed.port ? Number(parsed.port) : parsed.protocol === "https:" ? 443 : 80;
    let lookupResult: unknown = null;
    let lookupError: string | null = null;
    try {
      lookupResult = await dns.lookup(host, { all: true });
    } catch (error) {
      lookupError = error instanceof Error ? error.message : "DNS lookup failed.";
    }
    const tcp = await probeTcp(host, port);
    sendJson(res, 200, {
      ok: true,
      gatewayUrl: env.gatewayUrl,
      normalizedUrl: normalized,
      host,
      port,
      dns: lookupResult,
      dnsError: lookupError,
      tcp,
    });
    return true;
  }

  if (
    pathname === "/api/licensing/request" ||
    pathname === "/api/licensing/activate" ||
    pathname === "/api/licensing/refresh" ||
    pathname === "/api/licensing/verify"
  ) {
    const body = await readJsonBodyForRequest(req);
    if (!body.ok) {
      sendJson(res, body.status, { ok: false, error: body.error });
      return true;
    }
    const endpoint =
      pathname === "/api/licensing/request"
        ? "/v1/activations/request"
        : pathname === "/api/licensing/activate"
          ? "/v1/activations/activate"
          : pathname === "/api/licensing/refresh"
            ? "/v1/activations/refresh"
            : "/verify";
    await forwardJson(res, `${env.licensingUrl}${endpoint}`, body.value);
    return true;
  }

  if (pathname === "/api/control" || pathname.startsWith("/api/control/")) {
    const body = await readJsonBodyForRequest(req);
    if (!body.ok) {
      sendJson(res, body.status, { ok: false, error: body.error });
      return true;
    }
    const prefix = "/api/control";
    let upstreamSuffix = urlRaw.slice(prefix.length);
    if (!upstreamSuffix) {
      upstreamSuffix = "/";
    } else if (!upstreamSuffix.startsWith("/")) {
      upstreamSuffix = `/${upstreamSuffix}`;
    }
    const targetUrl = `${env.controlApiUrl}${upstreamSuffix}`;
    try {
      const headers: Record<string, string> = {
        Accept: "application/json",
      };
      const authHeader = req.headers.authorization;
      if (typeof authHeader === "string" && authHeader.trim()) {
        headers.Authorization = authHeader;
      }
      const method = (req.method ?? "GET").toUpperCase();
      if (!["GET", "HEAD"].includes(method)) {
        headers["Content-Type"] = "application/json";
      }
      const response = await fetchWithRetry(
        targetUrl,
        {
          method,
          headers,
          body: ["GET", "HEAD"].includes(method) ? undefined : JSON.stringify(body.value ?? {}),
        },
        {
          context: `control-api proxy ${method} ${upstreamSuffix}`,
          onRetry: (info) => {
            log.warn(
              {
                attempt: info.retryCount + 1,
                maxRetries: info.maxRetries,
                delayMs: info.delayMs,
              },
              "control-api proxy failed, retrying",
            );
          },
        },
      );
      const payload = await response.json().catch(() => ({}));
      res.statusCode = response.status;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.end(JSON.stringify(payload));
      if (method === "PUT" && /^\/api\/control\/v1\/tenants\/[^/]+\/settings\/?$/.test(pathname)) {
        const settings =
          payload && typeof payload === "object" && "settings" in payload
            ? (payload as { settings?: unknown }).settings
            : undefined;
        if (settings) {
          void applyProviderKeysFromSettings(settings);
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Upstream request failed.";
      sendProxyError(res, message);
    }
    return true;
  }

  res.statusCode = 404;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify({ ok: false, message: "Not Found" }));
  return true;
}
