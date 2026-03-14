import { generateUUID } from "./uuid.ts";

const LICENSE_TOKEN_KEY = "propai.license.token";
const LICENSE_CACHE_KEY = "propai.license.cache";
const LICENSE_DEVICE_KEY = "propai.license.device";
const LICENSE_API_KEY = "propai.license.api";

export type LicenseStatus = "unknown" | "checking" | "active" | "trial" | "expired" | "invalid";

export type LicenseEntitlement = {
  status: "active" | "trial";
  plan?: string | null;
  trialEndsAt?: string | null;
  expiresAt?: string | null;
  graceEndsAt?: string | null;
  features?: string[];
  issuedAt?: string | null;
};

export type LicenseVerifyResult =
  | {
      ok: true;
      status: "active" | "trial";
      plan?: string | null;
      trialEndsAt?: string | null;
      expiresAt?: string | null;
      graceEndsAt?: string | null;
      features?: string[];
      entitlement?: string;
      issuedAt?: string | null;
    }
  | {
      ok: false;
      status?: "expired" | "invalid";
      message?: string;
    };

type LicenseApiBody = {
  token: string;
  deviceId: string;
  appVersion?: string | null;
  client?: Record<string, unknown>;
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
  return envValue.trim() || "http://localhost:8787";
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
  if (entitlement.status !== "active" && entitlement.status !== "trial") {
    return false;
  }
  const cutoff =
    entitlement.status === "trial" ? entitlement.trialEndsAt : entitlement.expiresAt;
  const cutoffMs = parseDateMs(cutoff);
  if (cutoffMs === null) {
    return true;
  }
  if (cutoffMs >= now) {
    return true;
  }
  const graceMs = parseDateMs(entitlement.graceEndsAt);
  return graceMs !== null && graceMs >= now;
}

export async function verifyLicenseToken(params: {
  apiUrl: string;
  token: string;
  deviceId: string;
  appVersion?: string | null;
}): Promise<LicenseVerifyResult> {
  const body: LicenseApiBody = {
    token: params.token.trim(),
    deviceId: params.deviceId,
    appVersion: params.appVersion ?? null,
  };
  const response = await fetch(`${params.apiUrl.replace(/\/+$/, "")}/v1/license/verify`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const text = await response.text();
    return {
      ok: false,
      status: response.status === 410 ? "expired" : "invalid",
      message: text || "License verification failed.",
    };
  }
  return (await response.json()) as LicenseVerifyResult;
}
