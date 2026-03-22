import dns from "node:dns/promises";
import fs from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import net from "node:net";
import path from "node:path";
import { resolveControlUiRootSync } from "../infra/control-ui-assets.js";
import type { ControlUiRootState } from "./control-ui.js";
import { readJsonBody } from "./hooks.js";

const CONTROL_UI_API_MAX_BODY_BYTES = 1024 * 1024;
const DEFAULT_LICENSING_URL = "https://propailicense.up.railway.app";
const DEFAULT_GATEWAY_URL_LOCAL = "http://localhost:8080";
const DEFAULT_GATEWAY_URL_RAILWAY = "http://gateway.railway.internal:8080";
const DEFAULT_CONTROL_API_URL_LOCAL = "http://localhost:8788";
const DEFAULT_CONTROL_API_URL_RAILWAY = "http://control-api.railway.internal:8080";

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

function resolveGatewayProviderKeys() {
  const openai = Boolean(process.env.OPENAI_API_KEY || process.env.OPENAI_KEY);
  const anthropic = Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_KEY);
  const xai = Boolean(process.env.XAI_API_KEY);
  const elevenlabs = Boolean(process.env.ELEVENLABS_API_KEY);
  return {
    openai,
    anthropic,
    xai,
    elevenlabs,
  };
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
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(body ?? {}),
    });
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
      const response = await fetch(`${env.controlApiUrl}/health`, {
        headers: { Accept: "application/json" },
      });
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
      const response = await fetch(`${env.controlApiUrl}/health`, {
        headers: { Accept: "application/json" },
      });
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
      const response = await fetch(`${env.gatewayUrl}/healthz`, {
        headers: { Accept: "application/json" },
      });
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
      const response = await fetch(`${env.controlApiUrl}/health`, {
        headers: { Accept: "application/json" },
      });
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
      const response = await fetch(`${env.gatewayUrl}/healthz`, {
        headers: { Accept: "application/json" },
      });
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
      const response = await fetch(`${env.gatewayUrl}/v1/chat/completions`, {
        method: "POST",
        headers,
        body: JSON.stringify(body.value ?? {}),
      });
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
      const response = await fetch(targetUrl, {
        method,
        headers,
        body: ["GET", "HEAD"].includes(method) ? undefined : JSON.stringify(body.value ?? {}),
      });
      const payload = await response.json().catch(() => ({}));
      res.statusCode = response.status;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.end(JSON.stringify(payload));
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
