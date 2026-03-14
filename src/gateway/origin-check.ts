import { isLoopbackHost, normalizeHostHeader } from "./net.js";

type OriginCheckResult =
  | {
      ok: true;
      matchedBy: "allowlist" | "host-header-fallback" | "local-loopback";
    }
  | { ok: false; reason: string };

function parseOrigin(
  originRaw?: string,
): { origin: string; host: string; hostname: string } | null {
  const trimmed = (originRaw ?? "").trim();
  if (!trimmed || trimmed === "null") {
    return null;
  }
  try {
    const url = new URL(trimmed);
    return {
      origin: url.origin.toLowerCase(),
      host: url.host.toLowerCase(),
      hostname: url.hostname.toLowerCase(),
    };
  } catch {
    return null;
  }
}

function isDesktopWebviewOrigin(hostname: string): boolean {
  const normalized = hostname.trim().toLowerCase();
  // Tauri (and some WebView hosts) use a synthetic localhost origin.
  // Treat it as local only when the underlying socket client is local.
  return normalized === "tauri.localhost";
}

function isLoopbackRequestHost(requestHost: string | undefined): boolean {
  const normalized = normalizeHostHeader(requestHost);
  if (!normalized) {
    return false;
  }
  const hostname = normalized.split(":")[0]?.trim().toLowerCase();
  if (!hostname) {
    return false;
  }
  return isLoopbackHost(hostname);
}

export function checkBrowserOrigin(params: {
  requestHost?: string;
  origin?: string;
  allowedOrigins?: string[];
  allowHostHeaderOriginFallback?: boolean;
  isLocalClient?: boolean;
}): OriginCheckResult {
  const parsedOrigin = parseOrigin(params.origin);
  if (!parsedOrigin) {
    // Desktop WebViews (and some browser contexts) can send `Origin: null` (or omit the Origin
    // header entirely) for local websocket connections. For genuinely local socket clients, accept
    // missing/invalid Origin as a dev-only fallback.
    if (params.isLocalClient) {
      return { ok: true, matchedBy: "local-loopback" };
    }
    return { ok: false, reason: "origin missing or invalid" };
  }

  const allowlist = new Set(
    (params.allowedOrigins ?? []).map((value) => value.trim().toLowerCase()).filter(Boolean),
  );
  if (allowlist.has("*") || allowlist.has(parsedOrigin.origin)) {
    return { ok: true, matchedBy: "allowlist" };
  }

  const requestHost = normalizeHostHeader(params.requestHost);
  if (
    params.allowHostHeaderOriginFallback === true &&
    requestHost &&
    parsedOrigin.host === requestHost
  ) {
    return { ok: true, matchedBy: "host-header-fallback" };
  }

  // Dev fallback only for genuinely local socket clients, not Host-header claims.
  if (
    params.isLocalClient &&
    (isLoopbackHost(parsedOrigin.hostname) || isDesktopWebviewOrigin(parsedOrigin.hostname))
  ) {
    return { ok: true, matchedBy: "local-loopback" };
  }

  // Desktop fallback: some WebView contexts may not be detected as "local client" due to
  // proxy/header heuristics, but still connect to a loopback-bound gateway. Allow tauri.localhost
  // only when the Host header itself is loopback.
  if (isDesktopWebviewOrigin(parsedOrigin.hostname) && isLoopbackRequestHost(params.requestHost)) {
    return { ok: true, matchedBy: "host-header-fallback" };
  }

  return { ok: false, reason: "origin not allowed" };
}
