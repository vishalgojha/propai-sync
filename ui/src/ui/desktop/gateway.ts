import { applySettings } from "../app-settings.ts";
import type { UiSettings } from "../storage.ts";
import { isTauriRuntime, tauriInvoke } from "./tauri.ts";

const LOOPBACK_HOSTNAME = ["local", "host"].join("");
const LOOPBACK_IPV4 = [127, 0, 0, 1].join(".");
const LOOPBACK_IPV6 = "::1";
const TAURI_HOSTNAME = ["tauri", LOOPBACK_HOSTNAME].join(".");

type DesktopGatewayStartResponse = {
  ws_url: string;
  token: string;
  port: number;
  pid: number;
  log_path?: string | null;
};

type DesktopGatewayBootHost = {
  settings: UiSettings;
  theme: UiSettings["theme"];
  themeMode: UiSettings["themeMode"];
  applySessionKey: string;
  lastError?: string | null;
};

function shouldBootDesktopGateway(host: DesktopGatewayBootHost): boolean {
  const url = host.settings.gatewayUrl.trim();
  if (!url) {
    return true;
  }
  if (url.startsWith("/")) {
    return true;
  }
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();
    return (
      hostname === TAURI_HOSTNAME ||
      hostname === LOOPBACK_IPV4 ||
      hostname === LOOPBACK_HOSTNAME ||
      hostname === LOOPBACK_IPV6
    );
  } catch {
    return false;
  }
}

export async function ensureDesktopGateway(host: DesktopGatewayBootHost): Promise<void> {
  if (!isTauriRuntime()) {
    return;
  }
  if (!shouldBootDesktopGateway(host)) {
    return;
  }

  const dev = typeof import.meta !== "undefined" && Boolean(import.meta.env?.DEV);
  let res: DesktopGatewayStartResponse;
  try {
    res = await tauriInvoke<DesktopGatewayStartResponse>("propai_start_gateway", {
      req: { dev },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if ("lastError" in host) {
      host.lastError = `desktop gateway failed to start: ${message}`;
    }
    return;
  }

  const nextGatewayUrl = String(res.ws_url ?? "").trim();
  const nextToken = String(res.token ?? "").trim();
  if (!nextGatewayUrl || !nextToken) {
    if ("lastError" in host) {
      host.lastError = "desktop gateway failed to start: missing ws_url/token";
    }
    return;
  }
  if (host.settings.gatewayUrl === nextGatewayUrl && host.settings.token === nextToken) {
    return;
  }

  applySettings(host as unknown as Parameters<typeof applySettings>[0], {
    ...host.settings,
    gatewayUrl: nextGatewayUrl,
    token: nextToken,
  });
}

export async function restartDesktopGateway(host: DesktopGatewayBootHost): Promise<void> {
  if (!isTauriRuntime()) {
    return;
  }
  if (!shouldBootDesktopGateway(host)) {
    if ("lastError" in host) {
      host.lastError = "desktop gateway restart skipped: gatewayUrl is remote";
    }
    return;
  }

  const dev = typeof import.meta !== "undefined" && Boolean(import.meta.env?.DEV);
  let res: DesktopGatewayStartResponse;
  try {
    res = await tauriInvoke<DesktopGatewayStartResponse>("propai_restart_gateway", {
      req: { dev },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if ("lastError" in host) {
      host.lastError = `desktop gateway failed to restart: ${message}`;
    }
    return;
  }

  const nextGatewayUrl = String(res.ws_url ?? "").trim();
  const nextToken = String(res.token ?? "").trim();
  if (!nextGatewayUrl || !nextToken) {
    if ("lastError" in host) {
      host.lastError = "desktop gateway failed to restart: missing ws_url/token";
    }
    return;
  }
  if (host.settings.gatewayUrl === nextGatewayUrl && host.settings.token === nextToken) {
    return;
  }

  applySettings(host as unknown as Parameters<typeof applySettings>[0], {
    ...host.settings,
    gatewayUrl: nextGatewayUrl,
    token: nextToken,
  });
}


