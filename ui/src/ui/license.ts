import { generateUUID } from "./uuid.ts";
import { tauriInvoke } from "./desktop/tauri.ts";

const LICENSE_TOKEN_KEY = "propai.license.token";
const LICENSE_ACTIVATION_KEY = "propai.license.activation";
const LICENSE_CACHE_KEY = "propai.license.cache";
const LICENSE_DEVICE_KEY = "propai.license.device";
const LICENSE_API_KEY = "propai.license.api";
const LOOPBACK_HOSTNAME = ["local", "host"].join("");
const DEFAULT_LICENSE_API_URL = `http://${LOOPBACK_HOSTNAME}:8787`;

export type LicenseStatus =
  | "unknown"
  | "checking"
  | "pending"
  | "active"
  | "grace"
  | "expired"
  | "invalid";

export type LicenseEntitlement = {
  licenseId?: string | null;
  activationId?: string | null;
  plan?: string | null;
  status?: string | null;
  entitlements: string[];
  expiresAt?: string | null;
  issuedAt?: string | null;
  graceUntil?: string | null;
  refreshAt?: string | null;
  lastValidatedAt?: string | null;
  validatedAt?: string | null;
  deviceLimit?: number | null;
  devicesUsed?: number | null;
};

export type LicenseCommandResult =
  | {
      ok: true;
      valid: true;
      activationToken?: string | null;
      entitlement: LicenseEntitlement;
      code?: string;
      message?: string;
    }
  | {
      ok: true;
      valid: false;
      entitlement: LicenseEntitlement | null;
      code?: string;
      message?: string;
    }
  | {
      ok: false;
      valid: false;
      entitlement: LicenseEntitlement | null;
      message?: string;
      code?: string;
    };

type LicenseApiBody = {
  deviceId: string;
  appVersion?: string | null;
  client?: Record<string, unknown>;
};

type LicenseCommandResponse = {
  valid?: unknown;
  code?: unknown;
  message?: unknown;
  activationToken?: unknown;
  token?: unknown;
  licenseId?: unknown;
  activationId?: unknown;
  plan?: unknown;
  status?: unknown;
  entitlements?: unknown;
  expiresAt?: unknown;
  issuedAt?: unknown;
  graceUntil?: unknown;
  refreshAt?: unknown;
  lastValidatedAt?: unknown;
  validatedAt?: unknown;
  deviceLimit?: unknown;
  devicesUsed?: unknown;
};

export type LicenseKeyRequestResult =
  | {
      ok: true;
      token: string;
      licenseId?: string | null;
      plan?: string | null;
      status?: string | null;
      expiresAt?: string | null;
      maxDevices?: number | null;
      entitlements: string[];
      message?: string;
    }
  | {
      ok: false;
      message: string;
    };

function readStorageValue(key: string): string {
  try {
    return window.localStorage?.getItem(key) ?? "";
  } catch {
    return "";
  }
}

function writeStorageValue(key: string, value: string) {
  try {
    if (value) {
      window.localStorage?.setItem(key, value);
      return;
    }
    window.localStorage?.removeItem(key);
  } catch {
    // ignore
  }
}

function parseStoredJson<T>(key: string): T | null {
  const raw = readStorageValue(key);
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function serializeJson(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return "";
  }
}

export function loadLicenseToken(): string {
  return readStorageValue(LICENSE_TOKEN_KEY).trim();
}

export function saveLicenseToken(token: string) {
  writeStorageValue(LICENSE_TOKEN_KEY, token.trim());
}

export function loadLicenseActivationToken(): string {
  return readStorageValue(LICENSE_ACTIVATION_KEY).trim();
}

export function saveLicenseActivationToken(token: string) {
  writeStorageValue(LICENSE_ACTIVATION_KEY, token.trim());
}

export function loadLicenseCache(): LicenseEntitlement | null {
  return parseStoredJson<LicenseEntitlement>(LICENSE_CACHE_KEY);
}

export function saveLicenseCache(entitlement: LicenseEntitlement | null) {
  if (!entitlement) {
    writeStorageValue(LICENSE_CACHE_KEY, "");
    return;
  }
  writeStorageValue(LICENSE_CACHE_KEY, serializeJson(entitlement));
}

export function loadLicenseApiUrl(): string {
  const override = readStorageValue(LICENSE_API_KEY);
  if (override) {
    return override;
  }
  const globalValue =
    typeof window !== "undefined"
      ? ((window as unknown as Record<string, unknown>).__PROPAI_LICENSE_API__ as string | undefined)
      : undefined;
  if (typeof globalValue === "string" && globalValue.trim()) {
    return globalValue.trim();
  }
  const env = (import.meta as unknown as { env?: Record<string, string> }).env;
  const envValue = env?.VITE_PROPAI_LICENSE_API ?? "";
  return envValue.trim() || DEFAULT_LICENSE_API_URL;
}

export function isLicenseBypassEnabled(): boolean {
  const globalValue =
    typeof window !== "undefined"
      ? (window as unknown as Record<string, unknown>).__PROPAI_LICENSE_BYPASS__
      : undefined;
  if (typeof globalValue === "boolean") {
    return globalValue;
  }
  if (typeof globalValue === "string") {
    const normalized = globalValue.trim().toLowerCase();
    return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
  }
  const env = (import.meta as unknown as { env?: Record<string, string> }).env;
  const raw = env?.VITE_PROPAI_LICENSE_BYPASS ?? "";
  const normalized = raw.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}

export function saveLicenseApiUrl(url: string) {
  writeStorageValue(LICENSE_API_KEY, url.trim());
}

export function getOrCreateLicenseDeviceId(): string {
  const existing = readStorageValue(LICENSE_DEVICE_KEY);
  if (existing) {
    return existing;
  }
  const created = generateUUID();
  writeStorageValue(LICENSE_DEVICE_KEY, created);
  return created;
}

export function parseDateMs(value?: string | null): number | null {
  if (!value) {
    return null;
  }
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? null : ms;
}

export function isEntitlementValid(entitlement: LicenseEntitlement | null, now = Date.now()): boolean {
  if (!entitlement) {
    return false;
  }
  const expiryMs = parseDateMs(entitlement.expiresAt);
  if (expiryMs !== null && expiryMs < now) {
    return false;
  }
  const graceMs = parseDateMs(entitlement.graceUntil);
  if (graceMs !== null && graceMs < now) {
    return false;
  }
  return true;
}

function normalizeString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalizeNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function normalizeEntitlements(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0);
}

function normalizeEntitlement(response: LicenseCommandResponse): LicenseEntitlement | null {
  const entitlement: LicenseEntitlement = {
    licenseId: normalizeString(response.licenseId),
    activationId: normalizeString(response.activationId),
    plan: normalizeString(response.plan),
    status: normalizeString(response.status),
    entitlements: normalizeEntitlements(response.entitlements),
    expiresAt: normalizeString(response.expiresAt),
    issuedAt: normalizeString(response.issuedAt),
    graceUntil: normalizeString(response.graceUntil),
    refreshAt: normalizeString(response.refreshAt),
    lastValidatedAt: normalizeString(response.lastValidatedAt),
    validatedAt: normalizeString(response.validatedAt),
    deviceLimit: normalizeNumber(response.deviceLimit),
    devicesUsed: normalizeNumber(response.devicesUsed),
  };
  const hasData =
    entitlement.entitlements.length > 0 ||
    entitlement.licenseId ||
    entitlement.activationId ||
    entitlement.plan ||
    entitlement.expiresAt ||
    entitlement.graceUntil;
  return hasData ? entitlement : null;
}

function buildClientContext(): Record<string, unknown> {
  const nav = typeof navigator === "undefined" ? null : navigator;
  const runtime =
    typeof window !== "undefined" &&
    "__TAURI_INTERNALS__" in (window as unknown as Record<string, unknown>)
      ? "tauri"
      : "web";
  return {
    platform: nav?.platform ?? null,
    language: nav?.language ?? null,
    languages: Array.isArray(nav?.languages) ? nav.languages : [],
    userAgent: nav?.userAgent ?? null,
    runtime,
  };
}

async function invokeLicenseCommand(
  command:
    | "license_activate"
    | "license_refresh"
    | "license_deactivate"
    | "license_verify",
  payload: Record<string, unknown>,
): Promise<LicenseCommandResult> {
  try {
    const response = await tauriInvoke<LicenseCommandResponse>(command, { args: payload });
    const entitlement = normalizeEntitlement(response);
    const code = normalizeString(response.code) ?? undefined;
    const message = normalizeString(response.message) ?? undefined;
    if (response.valid === true && entitlement) {
      return {
        ok: true,
        valid: true,
        activationToken: normalizeString(response.activationToken),
        entitlement,
        code,
        message,
      };
    }
    return {
      ok: true,
      valid: false,
      entitlement,
      code,
      message,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, valid: false, entitlement: null, message };
  }
}

async function invokeLicenseKeyCommand(
  command: "license_request" | "license_admin_approve",
  payload: Record<string, unknown>,
): Promise<LicenseKeyRequestResult> {
  try {
    const response = await tauriInvoke<LicenseCommandResponse>(command, { args: payload });
    const token = normalizeString(response.token);
    if (!token) {
      return {
        ok: false,
        message: normalizeString(response.message) ?? "License request failed.",
      };
    }
    return {
      ok: true,
      token,
      licenseId: normalizeString(response.licenseId),
      plan: normalizeString(response.plan),
      status: normalizeString(response.status),
      expiresAt: normalizeString(response.expiresAt),
      maxDevices: normalizeNumber(response.maxDevices),
      entitlements: normalizeEntitlements(response.entitlements),
      message: normalizeString(response.message) ?? undefined,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, message };
  }
}

export async function activateLicenseKey(params: {
  apiUrl: string;
  token: string;
  deviceId: string;
  appVersion?: string | null;
}): Promise<LicenseCommandResult> {
  const body: LicenseApiBody & { token: string } = {
    token: params.token.trim(),
    deviceId: params.deviceId,
    appVersion: params.appVersion ?? null,
    client: buildClientContext(),
  };
  return invokeLicenseCommand("license_activate", {
    apiUrl: params.apiUrl.replace(/\/+$/, ""),
    ...body,
  });
}

export async function refreshLicenseActivation(params: {
  apiUrl: string;
  activationToken: string;
  deviceId: string;
  appVersion?: string | null;
}): Promise<LicenseCommandResult> {
  return invokeLicenseCommand("license_refresh", {
    apiUrl: params.apiUrl.replace(/\/+$/, ""),
    activationToken: params.activationToken.trim(),
    deviceId: params.deviceId,
    appVersion: params.appVersion ?? null,
    client: buildClientContext(),
  });
}

export async function deactivateLicenseActivation(params: {
  apiUrl: string;
  activationToken: string;
}): Promise<LicenseCommandResult> {
  return invokeLicenseCommand("license_deactivate", {
    apiUrl: params.apiUrl.replace(/\/+$/, ""),
    activationToken: params.activationToken.trim(),
  });
}

export async function verifyLicenseToken(params: {
  apiUrl: string;
  token: string;
  deviceId: string;
  appVersion?: string | null;
}): Promise<LicenseCommandResult> {
  const body: LicenseApiBody & { token: string } = {
    token: params.token.trim(),
    deviceId: params.deviceId,
    appVersion: params.appVersion ?? null,
    client: buildClientContext(),
  };
  return invokeLicenseCommand("license_verify", {
    apiUrl: params.apiUrl.replace(/\/+$/, ""),
    ...body,
  });
}

export async function requestLicenseKey(params: {
  apiUrl: string;
  email?: string | null;
  plan?: string | null;
  maxDevices?: number | null;
}): Promise<LicenseKeyRequestResult> {
  return invokeLicenseKeyCommand("license_request", {
    apiUrl: params.apiUrl.replace(/\/+$/, ""),
    email: params.email ?? null,
    plan: params.plan ?? null,
    maxDevices: params.maxDevices ?? null,
  });
}

export async function approvePendingLicenseKey(params: {
  apiUrl: string;
  adminKey: string;
  token: string;
}): Promise<LicenseKeyRequestResult> {
  return invokeLicenseKeyCommand("license_admin_approve", {
    apiUrl: params.apiUrl.replace(/\/+$/, ""),
    adminKey: params.adminKey.trim(),
    token: params.token.trim(),
  });
}
