import type { IncomingMessage, ServerResponse } from "node:http";
import { loadConfig } from "../config/config.js";
import {
  approveDevicePairing,
  listDevicePairing,
  removePairedDevice,
  rejectDevicePairing,
  summarizeDeviceTokens,
  type DeviceAuthToken,
  type PairedDevice,
} from "../infra/device-pairing.js";
import { encodePairingSetupCode, resolvePairingSetupFromConfig } from "../pairing/setup-code.js";
import type { AuthRateLimiter } from "./auth-rate-limit.js";
import { authorizeHttpGatewayConnect, type ResolvedGatewayAuth } from "./auth.js";
import {
  readJsonBodyOrError,
  sendGatewayAuthFailure,
  sendInvalidRequest,
  sendJson,
  sendMethodNotAllowed,
} from "./http-common.js";
import { getBearerToken } from "./http-utils.js";

const DEFAULT_BODY_BYTES = 256 * 1024;

type SetupRequestBody = {
  publicUrl?: unknown;
  preferRemoteUrl?: unknown;
  forceSecure?: unknown;
};

type PairingRequestBody = {
  requestId?: unknown;
};

function redactPairedDevice(device: PairedDevice) {
  const { tokens, approvedScopes: _approvedScopes, ...rest } = device;
  return {
    ...rest,
    tokens: summarizeDeviceTokens(tokens as Record<string, DeviceAuthToken> | undefined),
  };
}

async function requireGatewayAuth(
  req: IncomingMessage,
  res: ServerResponse,
  opts: {
    auth: ResolvedGatewayAuth;
    trustedProxies?: string[];
    allowRealIpFallback?: boolean;
    rateLimiter?: AuthRateLimiter;
  },
): Promise<boolean> {
  const cfg = loadConfig();
  const bearer = getBearerToken(req);
  const authResult = await authorizeHttpGatewayConnect({
    auth: opts.auth,
    connectAuth: bearer ? { token: bearer, password: bearer } : null,
    req,
    trustedProxies: opts.trustedProxies ?? cfg.gateway?.trustedProxies,
    allowRealIpFallback: opts.allowRealIpFallback ?? cfg.gateway?.allowRealIpFallback,
    rateLimiter: opts.rateLimiter,
  });
  if (!authResult.ok) {
    sendGatewayAuthFailure(res, authResult);
    return false;
  }
  return true;
}

export async function handleDevicePairHttpRequest(
  req: IncomingMessage,
  res: ServerResponse,
  opts: {
    auth: ResolvedGatewayAuth;
    trustedProxies?: string[];
    allowRealIpFallback?: boolean;
    rateLimiter?: AuthRateLimiter;
  },
): Promise<boolean> {
  const url = new URL(req.url ?? "/", "http://localhost");
  const path = url.pathname;
  const method = (req.method ?? "GET").toUpperCase();

  if (
    !path.startsWith("/v1/device-pair") ||
    path.startsWith("/v1/device-pair/unknown")
  ) {
    return false;
  }

  if (!(await requireGatewayAuth(req, res, opts))) {
    return true;
  }

  if (path === "/v1/device-pair" || path === "/v1/device-pair/") {
    if (method !== "GET") {
      sendMethodNotAllowed(res, "GET");
      return true;
    }
    const list = await listDevicePairing();
    sendJson(res, 200, {
      ok: true,
      pending: list.pending,
      paired: list.paired.map((device) => redactPairedDevice(device)),
    });
    return true;
  }

  if (path === "/v1/device-pair/setup" || path === "/v1/device-pair/setup/") {
    if (method !== "GET" && method !== "POST") {
      sendMethodNotAllowed(res, "GET, POST");
      return true;
    }
    let body: SetupRequestBody = {};
    if (method === "POST") {
      const bodyUnknown = await readJsonBodyOrError(req, res, DEFAULT_BODY_BYTES);
      if (bodyUnknown === undefined) {
        return true;
      }
      body = (bodyUnknown ?? {}) as SetupRequestBody;
    }
    const publicUrl = typeof body.publicUrl === "string" ? body.publicUrl.trim() : undefined;
    const preferRemoteUrl = body.preferRemoteUrl === true;
    const forceSecure = body.forceSecure === true;

    const cfg = loadConfig();
    const resolved = await resolvePairingSetupFromConfig(cfg, {
      publicUrl,
      preferRemoteUrl,
      forceSecure,
    });
    if (!resolved.ok) {
      sendJson(res, 400, { ok: false, error: resolved.error });
      return true;
    }
    const setupCode = encodePairingSetupCode(resolved.payload);
    sendJson(res, 200, {
      ok: true,
      setupCode,
      payload: resolved.payload,
      authLabel: resolved.authLabel,
      urlSource: resolved.urlSource,
    });
    return true;
  }

  if (path === "/v1/device-pair/approve" || path === "/v1/device-pair/approve/") {
    if (method !== "POST") {
      sendMethodNotAllowed(res, "POST");
      return true;
    }
    const bodyUnknown = await readJsonBodyOrError(req, res, DEFAULT_BODY_BYTES);
    if (bodyUnknown === undefined) {
      return true;
    }
    const body = (bodyUnknown ?? {}) as PairingRequestBody;
    if (typeof body.requestId !== "string" || !body.requestId.trim()) {
      sendInvalidRequest(res, "requestId required");
      return true;
    }
    const approved = await approveDevicePairing(body.requestId.trim());
    if (!approved) {
      sendJson(res, 404, { ok: false, error: "unknown requestId" });
      return true;
    }
    sendJson(res, 200, {
      ok: true,
      requestId: approved.requestId,
      device: redactPairedDevice(approved.device),
    });
    return true;
  }

  if (path === "/v1/device-pair/reject" || path === "/v1/device-pair/reject/") {
    if (method !== "POST") {
      sendMethodNotAllowed(res, "POST");
      return true;
    }
    const bodyUnknown = await readJsonBodyOrError(req, res, DEFAULT_BODY_BYTES);
    if (bodyUnknown === undefined) {
      return true;
    }
    const body = (bodyUnknown ?? {}) as PairingRequestBody;
    if (typeof body.requestId !== "string" || !body.requestId.trim()) {
      sendInvalidRequest(res, "requestId required");
      return true;
    }
    const rejected = await rejectDevicePairing(body.requestId.trim());
    if (!rejected) {
      sendJson(res, 404, { ok: false, error: "unknown requestId" });
      return true;
    }
    sendJson(res, 200, { ok: true, ...rejected });
    return true;
  }

  if (path.startsWith("/v1/device-pair/") && method === "DELETE") {
    const deviceId = path.replace("/v1/device-pair/", "").replace(/\/+$/, "");
    if (!deviceId) {
      sendInvalidRequest(res, "deviceId required");
      return true;
    }
    const removed = await removePairedDevice(deviceId);
    if (!removed) {
      sendJson(res, 404, { ok: false, error: "unknown deviceId" });
      return true;
    }
    sendJson(res, 200, { ok: true, ...removed });
    return true;
  }

  return false;
}
