import { buildDeviceAuthPayload } from "../../../src/gateway/device-auth.js";
import {
  GATEWAY_CLIENT_MODES,
  GATEWAY_CLIENT_NAMES,
  type GatewayClientMode,
  type GatewayClientName,
} from "../../../src/gateway/protocol/client-info.js";
import {
  ConnectErrorDetailCodes,
  readConnectErrorRecoveryAdvice,
  readConnectErrorDetailCode,
} from "../../../src/gateway/protocol/connect-error-details.js";
import { clearDeviceAuthToken, loadDeviceAuthToken, storeDeviceAuthToken } from "./device-auth.ts";
import { isTauriRuntime, tauriInvoke, tauriListen } from "./desktop/tauri.ts";
import { loadOrCreateDeviceIdentity, signDevicePayload } from "./device-identity.ts";
import { generateUUID } from "./uuid.ts";

const LOOPBACK_HOSTNAME = ["local", "host"].join("");
const LOOPBACK_IPV4 = [127, 0, 0, 1].join(".");
const LOOPBACK_IPV6 = "::1";
const LOOPBACK_IPV6_BRACKETED = `[${LOOPBACK_IPV6}]`;
const TAURI_GATEWAY_FRAME_EVENT = "PropAi Sync:gateway-frame";
const TAURI_GATEWAY_CLOSE_EVENT = "PropAi Sync:gateway-close";

const KNOWN_GATEWAY_METHODS = new Set([
  "agent.identity.get",
  "agents.files.get",
  "agents.files.list",
  "agents.files.set",
  "agents.list",
  "channels.logout",
  "channels.status",
  "chat.abort",
  "chat.send",
  "config.apply",
  "config.get",
  "config.schema",
  "config.set",
  "connect",
  "cron.add",
  "cron.list",
  "cron.remove",
  "cron.run",
  "cron.runs",
  "cron.status",
  "cron.update",
  "device.pair.approve",
  "device.pair.reject",
  "device.token.revoke",
  "exec.approval.resolve",
  "health",
  "last-heartbeat",
  "logs.tail",
  "models.list",
  "node.list",
  "sessions.compact",
  "sessions.delete",
  "sessions.list",
  "sessions.patch",
  "sessions.usage",
  "sessions.usage.logs",
  "sessions.usage.timeseries",
  "skills.install",
  "skills.status",
  "skills.update",
  "status",
  "system-presence",
  "tools.catalog",
  "update.run",
  "usage.cost",
  "wizard.cancel",
  "wizard.next",
  "wizard.start",
]);

function deriveGatewayCommandName(method: string): string {
  return method
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function resolveGatewayCommand(method: string): { cmd: string; method: string } {
  const trimmed = method.trim();
  if (KNOWN_GATEWAY_METHODS.has(trimmed)) {
    return { cmd: deriveGatewayCommandName(trimmed), method: trimmed };
  }
  return { cmd: "rpc_call", method: trimmed };
}

export type GatewayEventFrame = {
  type: "event";
  event: string;
  payload?: unknown;
  seq?: number;
  stateVersion?: { presence: number; health: number };
};

export type GatewayResponseFrame = {
  type: "res";
  id: string;
  ok: boolean;
  payload?: unknown;
  error?: { code: string; message: string; details?: unknown };
};

export type GatewayErrorInfo = {
  code: string;
  message: string;
  details?: unknown;
};

export class GatewayRequestError extends Error {
  readonly gatewayCode: string;
  readonly details?: unknown;

  constructor(error: GatewayErrorInfo) {
    super(error.message);
    this.name = "GatewayRequestError";
    this.gatewayCode = error.code;
    this.details = error.details;
  }
}

export function resolveGatewayErrorDetailCode(
  error: { details?: unknown } | null | undefined,
): string | null {
  return readConnectErrorDetailCode(error?.details);
}

/**
 * Auth errors that won't resolve without user action — don't auto-reconnect.
 *
 * NOTE: AUTH_TOKEN_MISMATCH is intentionally NOT included here because the
 * browser client supports a bounded one-time retry with a cached device token
 * when the endpoint is trusted. Reconnect suppression for mismatch is handled
 * with client state (after retry budget is exhausted).
 */
export function isNonRecoverableAuthError(error: GatewayErrorInfo | undefined): boolean {
  if (!error) {
    return false;
  }
  const code = resolveGatewayErrorDetailCode(error);
  return (
    code === ConnectErrorDetailCodes.AUTH_TOKEN_MISSING ||
    code === ConnectErrorDetailCodes.AUTH_PASSWORD_MISSING ||
    code === ConnectErrorDetailCodes.AUTH_PASSWORD_MISMATCH ||
    code === ConnectErrorDetailCodes.AUTH_RATE_LIMITED ||
    code === ConnectErrorDetailCodes.PAIRING_REQUIRED ||
    code === ConnectErrorDetailCodes.CONTROL_UI_DEVICE_IDENTITY_REQUIRED ||
    code === ConnectErrorDetailCodes.DEVICE_IDENTITY_REQUIRED
  );
}

function isTrustedRetryEndpoint(url: string): boolean {
  try {
    const gatewayUrl = new URL(url, window.location.href);
    const host = gatewayUrl.hostname.trim().toLowerCase();
    const isLoopbackHost =
      host === LOOPBACK_HOSTNAME ||
      host === LOOPBACK_IPV6 ||
      host === LOOPBACK_IPV6_BRACKETED ||
      host === LOOPBACK_IPV4;
    const isLoopbackIPv4 = host.startsWith("127.");
    if (isLoopbackHost || isLoopbackIPv4) {
      return true;
    }
    const pageUrl = new URL(window.location.href);
    return gatewayUrl.host === pageUrl.host;
  } catch {
    return false;
  }
}

export type GatewayHelloOk = {
  type: "hello-ok";
  protocol: number;
  server?: {
    version?: string;
    connId?: string;
  };
  features?: { methods?: string[]; events?: string[] };
  snapshot?: unknown;
  auth?: {
    deviceToken?: string;
    role?: string;
    scopes?: string[];
    issuedAtMs?: number;
  };
  policy?: { tickIntervalMs?: number };
};

type Pending = {
  resolve: (value: unknown) => void;
  reject: (err: unknown) => void;
};

export type GatewayBrowserClientOptions = {
  url: string;
  token?: string;
  password?: string;
  clientName?: GatewayClientName;
  clientVersion?: string;
  platform?: string;
  mode?: GatewayClientMode;
  instanceId?: string;
  onHello?: (hello: GatewayHelloOk) => void;
  onEvent?: (evt: GatewayEventFrame) => void;
  onClose?: (info: { code: number; reason: string; error?: GatewayErrorInfo }) => void;
  onGap?: (info: { expected: number; received: number }) => void;
};

// 4008 = application-defined code (browser rejects 1008 "Policy Violation")
const CONNECT_FAILED_CLOSE_CODE = 4008;

export class GatewayBrowserClient {
  private ws: WebSocket | null = null;
  private ipcConnected = false;
  private ipcListening = false;
  private ipcUnlisten: Array<() => void> = [];
  private ipcSuppressNextClose = false;
  private pending = new Map<string, Pending>();
  private closed = false;
  private lastSeq: number | null = null;
  private connectNonce: string | null = null;
  private connectSent = false;
  private connectTimer: number | null = null;
  private backoffMs = 800;
  private pendingConnectError: GatewayErrorInfo | undefined;
  private pendingDeviceTokenRetry = false;
  private deviceTokenRetryBudgetUsed = false;

  constructor(private opts: GatewayBrowserClientOptions) {}

  start() {
    this.closed = false;
    this.connect();
  }

  stop() {
    this.closed = true;
    if (isTauriRuntime()) {
      void this.stopIpc();
    } else {
      this.ws?.close();
      this.ws = null;
    }
    this.pendingConnectError = undefined;
    this.pendingDeviceTokenRetry = false;
    this.deviceTokenRetryBudgetUsed = false;
    this.flushPending(new Error("gateway client stopped"));
  }

  get connected() {
    if (isTauriRuntime()) {
      return this.ipcConnected;
    }
    return this.ws?.readyState === WebSocket.OPEN;
  }

  private connect() {
    if (this.closed) {
      return;
    }
    if (isTauriRuntime()) {
      void this.connectIpc();
      return;
    }
    this.connectWebSocket();
  }

  private connectWebSocket() {
    this.ws = new WebSocket(this.opts.url);
    this.ws.addEventListener("open", () => this.queueConnect());
    this.ws.addEventListener("message", (ev) => this.handleMessage(String(ev.data ?? "")));
    this.ws.addEventListener("close", (ev) => {
      const reason = String(ev.reason ?? "");
      this.ws = null;
      this.handleGatewayClose(ev.code, reason);
    });
    this.ws.addEventListener("error", () => {
      // ignored; close handler will fire
    });
  }

  private async connectIpc() {
    if (this.closed) {
      return;
    }
    try {
      await this.ensureIpcListeners();
      await tauriInvoke("gateway_ipc_start", { url: this.opts.url, token: this.opts.token });
      this.ipcConnected = true;
      this.queueConnect();
    } catch (err) {
      this.ipcConnected = false;
      const message = err instanceof Error ? err.message : String(err);
      this.handleGatewayClose(CONNECT_FAILED_CLOSE_CODE, message);
    }
  }

  private async ensureIpcListeners() {
    if (this.ipcListening) {
      return;
    }
    this.ipcListening = true;
    const unlistenFrame = await tauriListen<{ data?: unknown }>(
      TAURI_GATEWAY_FRAME_EVENT,
      (event) => {
        if (this.closed) {
          return;
        }
        const payload = event.payload;
        if (!payload || typeof payload.data !== "string") {
          return;
        }
        this.handleMessage(payload.data);
      },
    );
    const unlistenClose = await tauriListen<{ code?: unknown; reason?: unknown }>(
      TAURI_GATEWAY_CLOSE_EVENT,
      (event) => {
        if (this.closed) {
          return;
        }
        const payload = event.payload ?? {};
        const code = typeof payload.code === "number" ? payload.code : CONNECT_FAILED_CLOSE_CODE;
        const reason = typeof payload.reason === "string" ? payload.reason : "";
        this.ipcConnected = false;
        if (this.ipcSuppressNextClose) {
          this.ipcSuppressNextClose = false;
          return;
        }
        this.handleGatewayClose(code, reason);
      },
    );
    this.ipcUnlisten.push(unlistenFrame, unlistenClose);
  }

  private async stopIpc() {
    this.ipcConnected = false;
    if (this.ipcListening) {
      this.ipcListening = false;
      const unlisten = this.ipcUnlisten;
      this.ipcUnlisten = [];
      for (const handler of unlisten) {
        try {
          handler();
        } catch {
          // ignore
        }
      }
    }
    await this.closeIpcConnection();
  }

  private async closeIpcConnection() {
    this.ipcConnected = false;
    try {
      await tauriInvoke("gateway_ipc_stop", {});
    } catch {
      // ignore
    }
  }

  private handleGatewayClose(code: number, reason: string) {
    const connectError = this.pendingConnectError;
    this.pendingConnectError = undefined;
    this.flushPending(new Error(`gateway closed (${code}): ${reason}`));
    this.opts.onClose?.({ code, reason, error: connectError });
    const connectErrorCode = resolveGatewayErrorDetailCode(connectError);
    if (
      connectErrorCode === ConnectErrorDetailCodes.AUTH_TOKEN_MISMATCH &&
      this.deviceTokenRetryBudgetUsed &&
      !this.pendingDeviceTokenRetry
    ) {
      return;
    }
    if (!isNonRecoverableAuthError(connectError)) {
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect() {
    if (this.closed) {
      return;
    }
    const delay = this.backoffMs;
    this.backoffMs = Math.min(this.backoffMs * 1.7, 15_000);
    window.setTimeout(() => this.connect(), delay);
  }

  private flushPending(err: Error) {
    for (const [, p] of this.pending) {
      p.reject(err);
    }
    this.pending.clear();
  }

  private async sendConnect() {
    if (this.connectSent) {
      return;
    }
    this.connectSent = true;
    if (this.connectTimer !== null) {
      window.clearTimeout(this.connectTimer);
      this.connectTimer = null;
    }

    // crypto.subtle is only available in secure contexts (HTTPS, loopback).
    // Over plain HTTP, we skip device identity and fall back to token-only auth.
    // Gateways may reject this unless gateway.controlUi.allowInsecureAuth is enabled.
    const isSecureContext = typeof crypto !== "undefined" && !!crypto.subtle;

    const scopes = ["operator.admin", "operator.approvals", "operator.pairing"];
    const role = "operator";
    let deviceIdentity: Awaited<ReturnType<typeof loadOrCreateDeviceIdentity>> | null = null;
    let canFallbackToShared = false;
    const explicitGatewayToken = this.opts.token?.trim() || undefined;
    let authToken = explicitGatewayToken;
    let deviceToken: string | undefined;

    if (isSecureContext) {
      deviceIdentity = await loadOrCreateDeviceIdentity();
      const storedToken = loadDeviceAuthToken({
        deviceId: deviceIdentity.deviceId,
        role,
      })?.token;
      const shouldUseDeviceRetryToken =
        this.pendingDeviceTokenRetry &&
        !deviceToken &&
        Boolean(explicitGatewayToken) &&
        Boolean(storedToken) &&
        isTrustedRetryEndpoint(this.opts.url);
      if (shouldUseDeviceRetryToken) {
        deviceToken = storedToken ?? undefined;
        this.pendingDeviceTokenRetry = false;
      } else {
        deviceToken = !(explicitGatewayToken || this.opts.password?.trim())
          ? (storedToken ?? undefined)
          : undefined;
      }
      canFallbackToShared = Boolean(deviceToken && explicitGatewayToken);
    }
    authToken = explicitGatewayToken ?? deviceToken;
    const auth =
      authToken || this.opts.password
        ? {
            token: authToken,
            deviceToken,
            password: this.opts.password,
          }
        : undefined;

    let device:
      | {
          id: string;
          publicKey: string;
          signature: string;
          signedAt: number;
          nonce: string;
        }
      | undefined;

    if (isSecureContext && deviceIdentity) {
      const signedAtMs = Date.now();
      const nonce = this.connectNonce ?? "";
      const payload = buildDeviceAuthPayload({
        deviceId: deviceIdentity.deviceId,
        clientId: this.opts.clientName ?? GATEWAY_CLIENT_NAMES.CONTROL_UI,
        clientMode: this.opts.mode ?? GATEWAY_CLIENT_MODES.WEBCHAT,
        role,
        scopes,
        signedAtMs,
        token: authToken ?? null,
        nonce,
      });
      const signature = await signDevicePayload(deviceIdentity.privateKey, payload);
      device = {
        id: deviceIdentity.deviceId,
        publicKey: deviceIdentity.publicKey,
        signature,
        signedAt: signedAtMs,
        nonce,
      };
    }
    const params = {
      minProtocol: 3,
      maxProtocol: 3,
      client: {
        id: this.opts.clientName ?? GATEWAY_CLIENT_NAMES.CONTROL_UI,
        version: this.opts.clientVersion ?? "control-ui",
        platform: this.opts.platform ?? navigator.platform ?? "web",
        mode: this.opts.mode ?? GATEWAY_CLIENT_MODES.WEBCHAT,
        instanceId: this.opts.instanceId,
      },
      role,
      scopes,
      device,
      caps: ["tool-events"],
      auth,
      userAgent: navigator.userAgent,
      locale: navigator.language,
    };

    void this.request<GatewayHelloOk>("connect", params)
      .then((hello) => {
        this.pendingDeviceTokenRetry = false;
        this.deviceTokenRetryBudgetUsed = false;
        if (hello?.auth?.deviceToken && deviceIdentity) {
          storeDeviceAuthToken({
            deviceId: deviceIdentity.deviceId,
            role: hello.auth.role ?? role,
            token: hello.auth.deviceToken,
            scopes: hello.auth.scopes ?? [],
          });
        }
        this.backoffMs = 800;
        this.opts.onHello?.(hello);
      })
      .catch((err: unknown) => {
        const connectErrorCode =
          err instanceof GatewayRequestError ? resolveGatewayErrorDetailCode(err) : null;
        const recoveryAdvice =
          err instanceof GatewayRequestError ? readConnectErrorRecoveryAdvice(err.details) : {};
        const retryWithDeviceTokenRecommended =
          recoveryAdvice.recommendedNextStep === "retry_with_device_token";
        const canRetryWithDeviceTokenHint =
          recoveryAdvice.canRetryWithDeviceToken === true ||
          retryWithDeviceTokenRecommended ||
          connectErrorCode === ConnectErrorDetailCodes.AUTH_TOKEN_MISMATCH;
        const shouldRetryWithDeviceToken =
          !this.deviceTokenRetryBudgetUsed &&
          !deviceToken &&
          Boolean(explicitGatewayToken) &&
          Boolean(deviceIdentity) &&
          Boolean(
            loadDeviceAuthToken({
              deviceId: deviceIdentity?.deviceId ?? "",
              role,
            })?.token,
          ) &&
          canRetryWithDeviceTokenHint &&
          isTrustedRetryEndpoint(this.opts.url);
        if (shouldRetryWithDeviceToken) {
          this.pendingDeviceTokenRetry = true;
          this.deviceTokenRetryBudgetUsed = true;
        }
        if (err instanceof GatewayRequestError) {
          this.pendingConnectError = {
            code: err.gatewayCode,
            message: err.message,
            details: err.details,
          };
        } else {
          this.pendingConnectError = undefined;
        }
        if (
          canFallbackToShared &&
          deviceIdentity &&
          connectErrorCode === ConnectErrorDetailCodes.AUTH_DEVICE_TOKEN_MISMATCH
        ) {
          clearDeviceAuthToken({ deviceId: deviceIdentity.deviceId, role });
        }
        if (isTauriRuntime()) {
          this.ipcConnected = false;
          this.ipcSuppressNextClose = true;
          this.handleGatewayClose(CONNECT_FAILED_CLOSE_CODE, "connect failed");
          void this.closeIpcConnection();
          return;
        }
        this.ws?.close(CONNECT_FAILED_CLOSE_CODE, "connect failed");
      });
  }

  private handleMessage(raw: string) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return;
    }

    const frame = parsed as { type?: unknown };
    if (frame.type === "event") {
      const evt = parsed as GatewayEventFrame;
      if (evt.event === "connect.challenge") {
        const payload = evt.payload as { nonce?: unknown } | undefined;
        const nonce = payload && typeof payload.nonce === "string" ? payload.nonce : null;
        if (nonce) {
          this.connectNonce = nonce;
          void this.sendConnect();
        }
        return;
      }
      const seq = typeof evt.seq === "number" ? evt.seq : null;
      if (seq !== null) {
        if (this.lastSeq !== null && seq > this.lastSeq + 1) {
          this.opts.onGap?.({ expected: this.lastSeq + 1, received: seq });
        }
        this.lastSeq = seq;
      }
      try {
        this.opts.onEvent?.(evt);
      } catch (err) {
        console.error("[gateway] event handler error:", err);
      }
      return;
    }

    if (frame.type === "res") {
      const res = parsed as GatewayResponseFrame;
      const pending = this.pending.get(res.id);
      if (!pending) {
        return;
      }
      this.pending.delete(res.id);
      if (res.ok) {
        pending.resolve(res.payload);
      } else {
        pending.reject(
          new GatewayRequestError({
            code: res.error?.code ?? "UNAVAILABLE",
            message: res.error?.message ?? "request failed",
            details: res.error?.details,
          }),
        );
      }
      return;
    }
  }

  request<T = unknown>(method: string, params?: unknown): Promise<T> {
    const id = generateUUID();
    const p = new Promise<T>((resolve, reject) => {
      this.pending.set(id, { resolve: (v) => resolve(v as T), reject });
    });
    if (isTauriRuntime()) {
      if (!this.ipcConnected) {
        this.pending.delete(id);
        return Promise.reject(new Error("gateway not connected"));
      }
      const resolved = resolveGatewayCommand(method);
      const args: Record<string, unknown> =
        resolved.cmd === "rpc_call"
          ? { method: resolved.method, id, params }
          : { id, params };
      void this.sendIpcRequest(resolved.cmd, args, id);
      return p;
    }
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      this.pending.delete(id);
      return Promise.reject(new Error("gateway not connected"));
    }
    const frame = { type: "req", id, method, params };
    this.ws.send(JSON.stringify(frame));
    return p;
  }

  private async sendIpcRequest(cmd: string, args: Record<string, unknown>, id: string) {
    try {
      await tauriInvoke(cmd, args);
    } catch (err) {
      const pending = this.pending.get(id);
      if (!pending) {
        return;
      }
      this.pending.delete(id);
      const message = err instanceof Error ? err.message : String(err);
      pending.reject(new Error(message));
    }
  }

  private queueConnect() {
    this.connectNonce = null;
    this.connectSent = false;
    if (this.connectTimer !== null) {
      window.clearTimeout(this.connectTimer);
    }
    this.connectTimer = window.setTimeout(() => {
      void this.sendConnect();
    }, 750);
  }
}
