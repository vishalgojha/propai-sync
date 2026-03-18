import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import express from "express";
import jwt, { type JwtPayload } from "jsonwebtoken";
import { z } from "zod";

const PORT = Number(process.env.PORT ?? "8787");
const ADMIN_KEY = process.env.ADMIN_KEY ?? "";
const LICENSE_DB_PATH =
  process.env.LICENSE_DB_PATH?.trim() ||
  path.join(process.cwd(), ".data", "licensing.sqlite");
const ACTIVATION_KEY_PREFIX = "propai_sync";
const ACTIVATION_TOKEN_TTL_DAYS = parsePositiveInt(
  process.env.LICENSE_ACTIVATION_TOKEN_TTL_DAYS,
  30,
);
const LICENSE_GRACE_DAYS = parsePositiveInt(process.env.LICENSE_GRACE_DAYS, 7);
const isDev =
  process.env.PROPAI_PROFILE === "dev" || (process.env.NODE_ENV ?? "development") !== "production";
let jwtSecret = process.env.LICENSE_JWT_SECRET ?? "";

if (!jwtSecret) {
  if (isDev) {
    jwtSecret = crypto.randomBytes(32).toString("hex");
    console.warn(
      "LICENSE_JWT_SECRET is not set; using ephemeral dev secret. Set LICENSE_JWT_SECRET for stable tokens.",
    );
  } else {
    throw new Error("LICENSE_JWT_SECRET is required");
  }
}

const LICENSE_STATUSES = ["pending", "active", "suspended", "revoked", "cancelled"] as const;
type LicenseStatus = (typeof LICENSE_STATUSES)[number];

type LicenseRow = {
  id: string;
  email: string | null;
  plan: string;
  status: string;
  entitlements_json: string;
  max_devices: number;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
};

type ActivationRow = {
  id: string;
  license_id: string;
  device_id: string;
  status: string;
  platform: string | null;
  device_name: string | null;
  app_version: string | null;
  client_json: string;
  first_activated_at: string;
  last_validated_at: string;
  last_seen_at: string;
  deactivated_at: string | null;
  created_at: string;
  updated_at: string;
};

type ActivationClaims = JwtPayload & {
  typ: "activation";
  aid: string;
  lid: string;
  did: string;
};

type LegacyLicenseTokenPayload = JwtPayload & {
  email?: string | null;
  plan?: string | null;
  entitlements?: string[];
  expiresAt?: string | null;
  issuedAt?: string | null;
};

type ClientContext = {
  platform: string | null;
  deviceName: string | null;
  payloadJson: string;
};

const activationRequestSchema = z.object({
  token: z.string().min(6),
  deviceId: z.string().min(6),
  appVersion: z.string().nullable().optional(),
  client: z.record(z.unknown()).optional(),
});

const refreshRequestSchema = z.object({
  activationToken: z.string().min(16),
  deviceId: z.string().min(6),
  appVersion: z.string().nullable().optional(),
  client: z.record(z.unknown()).optional(),
});

const deactivateRequestSchema = z.object({
  activationToken: z.string().min(16),
});

const adminLicenseSchema = z.object({
  token: z.string().min(12).optional(),
  email: z.string().email().optional(),
  plan: z.string().min(1).optional(),
  status: z.enum(LICENSE_STATUSES).optional(),
  expiresAt: z.string().nullable().optional(),
  maxDevices: z.number().int().positive().max(100).optional(),
  entitlements: z.array(z.string().min(1)).max(32).optional(),
});

const licenseRequestSchema = z.object({
  email: z.string().email().optional(),
  plan: z.string().min(1).optional(),
  maxDevices: z.number().int().positive().max(100).optional(),
});

const adminApproveLicenseSchema = z.object({
  token: z.string().min(12),
  email: z.string().email().optional(),
  plan: z.string().min(1).optional(),
  expiresAt: z.string().nullable().optional(),
  maxDevices: z.number().int().positive().max(100).optional(),
  entitlements: z.array(z.string().min(1)).max(32).optional(),
});

const verifySchema = activationRequestSchema;

const app = express();
app.use(express.json({ limit: "1mb" }));

const db = openDatabase(LICENSE_DB_PATH);
initSchema(db);

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  const value = Number.parseInt(raw ?? "", 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function openDatabase(dbPath: string): DatabaseSync {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const database = new DatabaseSync(dbPath);
  database.exec("PRAGMA journal_mode = WAL;");
  database.exec("PRAGMA foreign_keys = ON;");
  database.exec("PRAGMA busy_timeout = 5000;");
  return database;
}

function initSchema(database: DatabaseSync) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS licenses (
      id TEXT PRIMARY KEY,
      email TEXT,
      plan TEXT NOT NULL,
      status TEXT NOT NULL,
      entitlements_json TEXT NOT NULL,
      max_devices INTEGER NOT NULL DEFAULT 2,
      expires_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS activation_keys (
      id TEXT PRIMARY KEY,
      license_id TEXT NOT NULL REFERENCES licenses(id) ON DELETE CASCADE,
      key_hash TEXT NOT NULL UNIQUE,
      key_prefix TEXT NOT NULL,
      created_at TEXT NOT NULL,
      revoked_at TEXT,
      last_used_at TEXT
    );

    CREATE TABLE IF NOT EXISTS activations (
      id TEXT PRIMARY KEY,
      license_id TEXT NOT NULL REFERENCES licenses(id) ON DELETE CASCADE,
      device_id TEXT NOT NULL,
      status TEXT NOT NULL,
      platform TEXT,
      device_name TEXT,
      app_version TEXT,
      client_json TEXT NOT NULL DEFAULT '{}',
      first_activated_at TEXT NOT NULL,
      last_validated_at TEXT NOT NULL,
      last_seen_at TEXT NOT NULL,
      deactivated_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(license_id, device_id)
    );

    CREATE INDEX IF NOT EXISTS idx_activation_keys_license_id
      ON activation_keys (license_id);
    CREATE INDEX IF NOT EXISTS idx_activations_license_id
      ON activations (license_id);
    CREATE INDEX IF NOT EXISTS idx_activations_device_id
      ON activations (device_id);
  `);
}

function nowIso() {
  return new Date().toISOString();
}

function parseExpiresAt(expiresAt: string | null | undefined): number | null {
  if (!expiresAt) {
    return null;
  }
  const parsed = Date.parse(expiresAt);
  return Number.isNaN(parsed) ? null : parsed;
}

function sha256(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function normalizeEntitlements(raw: string[] | null | undefined, plan: string): string[] {
  const entitlements = Array.isArray(raw) ? raw : [plan];
  const seen = new Set<string>();
  const normalized: string[] = [];
  for (const entry of entitlements) {
    if (typeof entry !== "string") {
      continue;
    }
    const trimmed = entry.trim();
    if (!trimmed || seen.has(trimmed)) {
      continue;
    }
    seen.add(trimmed);
    normalized.push(trimmed);
  }
  return normalized.length > 0 ? normalized : [plan];
}

function parseEntitlementsJson(raw: string, plan: string): string[] {
  try {
    return normalizeEntitlements(JSON.parse(raw) as string[], plan);
  } catch {
    return [plan];
  }
}

function randomActivationKey(): string {
  return `${ACTIVATION_KEY_PREFIX}_${crypto.randomBytes(18).toString("base64url")}`;
}

function summarizeKey(key: string): string {
  return key.slice(0, Math.min(18, key.length));
}

function normalizeOptionalString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function normalizeClientContext(client: Record<string, unknown> | undefined): ClientContext {
  const platform =
    normalizeOptionalString(client?.platform) ??
    normalizeOptionalString(client?.os) ??
    normalizeOptionalString(client?.platformName);
  const deviceName =
    normalizeOptionalString(client?.deviceName) ??
    normalizeOptionalString(client?.device) ??
    normalizeOptionalString(client?.hostname);
  let payloadJson = "{}";
  try {
    payloadJson = JSON.stringify(client ?? {});
  } catch {
    payloadJson = "{}";
  }
  return { platform, deviceName, payloadJson };
}

function requireAdmin(req: express.Request, res: express.Response): boolean {
  if (!ADMIN_KEY) {
    res.status(403).json({ valid: false, message: "admin disabled" });
    return false;
  }
  const provided = req.header("x-admin-key");
  if (!provided || provided !== ADMIN_KEY) {
    res.status(401).json({ valid: false, message: "invalid admin key" });
    return false;
  }
  return true;
}

function computeLicenseRuntimeStatus(license: LicenseRow): LicenseStatus | "expired" {
  if (license.status !== "active") {
    return LICENSE_STATUSES.includes(license.status as LicenseStatus)
      ? (license.status as LicenseStatus)
      : "cancelled";
  }
  const expiresAtMs = parseExpiresAt(license.expires_at);
  if (expiresAtMs !== null && expiresAtMs < Date.now()) {
    return "expired";
  }
  return "active";
}

function signActivationToken(activation: ActivationRow): string {
  return jwt.sign(
    {
      typ: "activation",
      aid: activation.id,
      lid: activation.license_id,
      did: activation.device_id,
    } satisfies ActivationClaims,
    jwtSecret,
    {
      issuer: "propai-licensing",
      audience: "propai-sync",
      subject: activation.id,
      expiresIn: `${ACTIVATION_TOKEN_TTL_DAYS}d`,
    },
  );
}

function verifyActivationToken(token: string): ActivationClaims {
  return jwt.verify(token, jwtSecret, {
    issuer: "propai-licensing",
    audience: "propai-sync",
  }) as ActivationClaims;
}

function countActiveActivations(licenseId: string): number {
  const row = db
    .prepare(
      "SELECT COUNT(*) AS count FROM activations WHERE license_id = ? AND status = 'active' AND deactivated_at IS NULL",
    )
    .get(licenseId) as { count?: number } | undefined;
  return Number(row?.count ?? 0);
}

function getLicenseByActivationKey(token: string): LicenseRow | null {
  const row = db
    .prepare(
      `
        SELECT
          l.id,
          l.email,
          l.plan,
          l.status,
          l.entitlements_json,
          l.max_devices,
          l.expires_at,
          l.created_at,
          l.updated_at
        FROM activation_keys k
        JOIN licenses l ON l.id = k.license_id
        WHERE k.key_hash = ? AND k.revoked_at IS NULL
      `,
    )
    .get(sha256(token)) as LicenseRow | undefined;
  return row ?? null;
}

function getLicenseById(licenseId: string): LicenseRow | null {
  const row = db
    .prepare(
      `
        SELECT
          id,
          email,
          plan,
          status,
          entitlements_json,
          max_devices,
          expires_at,
          created_at,
          updated_at
        FROM licenses
        WHERE id = ?
      `,
    )
    .get(licenseId) as LicenseRow | undefined;
  return row ?? null;
}

function getActivationById(activationId: string, licenseId: string): ActivationRow | null {
  const row = db
    .prepare(
      `
        SELECT
          id,
          license_id,
          device_id,
          status,
          platform,
          device_name,
          app_version,
          client_json,
          first_activated_at,
          last_validated_at,
          last_seen_at,
          deactivated_at,
          created_at,
          updated_at
        FROM activations
        WHERE id = ? AND license_id = ?
      `,
    )
    .get(activationId, licenseId) as ActivationRow | undefined;
  return row ?? null;
}

function buildEntitlementResponse(license: LicenseRow, activation: ActivationRow) {
  const currentTime = Date.now();
  const currentIso = new Date(currentTime).toISOString();
  const runtimeStatus = computeLicenseRuntimeStatus(license);
  const entitlements = parseEntitlementsJson(license.entitlements_json, license.plan);
  const graceUntil = new Date(currentTime + LICENSE_GRACE_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const refreshAt = new Date(currentTime + Math.min(LICENSE_GRACE_DAYS, 1) * 12 * 60 * 60 * 1000).toISOString();
  return {
    valid: runtimeStatus === "active",
    licenseId: license.id,
    activationId: activation.id,
    activationToken: signActivationToken(activation),
    plan: license.plan,
    status: runtimeStatus,
    entitlements,
    expiresAt: license.expires_at,
    issuedAt: license.created_at,
    lastValidatedAt: activation.last_validated_at,
    graceUntil,
    refreshAt,
    deviceLimit: license.max_devices,
    devicesUsed: countActiveActivations(license.id),
    validatedAt: currentIso,
  };
}

function buildInvalidResponse(
  code: string,
  message: string,
  license?: LicenseRow,
  extra?: Record<string, unknown>,
) {
  return {
    valid: false,
    code,
    message,
    entitlements: license ? parseEntitlementsJson(license.entitlements_json, license.plan) : [],
    expiresAt: license?.expires_at ?? null,
    plan: license?.plan ?? null,
    status: license ? computeLicenseRuntimeStatus(license) : "invalid",
    deviceLimit: license?.max_devices ?? null,
    devicesUsed: license ? countActiveActivations(license.id) : null,
    ...extra,
  };
}

function getLicenseByToken(token: string): LicenseRow | null {
  return getLicenseByActivationKey(token);
}

function withTransaction<T>(run: () => T): T {
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = run();
    db.exec("COMMIT");
    return result;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

function activateLicenseKey(params: {
  token: string;
  deviceId: string;
  appVersion?: string | null;
  client?: Record<string, unknown>;
}) {
  const license = getLicenseByActivationKey(params.token);
  if (!license) {
    return buildInvalidResponse("invalid_key", "Invalid activation key.");
  }
  const runtimeStatus = computeLicenseRuntimeStatus(license);
  if (runtimeStatus !== "active") {
    return buildInvalidResponse(
      runtimeStatus === "pending" ? "pending_approval" : runtimeStatus,
      runtimeStatus === "expired"
        ? "License expired."
        : runtimeStatus === "pending"
          ? "Activation key pending admin approval."
          : `License ${runtimeStatus}.`,
      license,
    );
  }

  const now = nowIso();
  const client = normalizeClientContext(params.client);
  const activation = withTransaction(() => {
    const existing = db
      .prepare(
        `
          SELECT *
          FROM activations
          WHERE license_id = ? AND device_id = ?
          LIMIT 1
        `,
      )
      .get(license.id, params.deviceId) as ActivationRow | undefined;

    if (!existing) {
      const devicesUsed = countActiveActivations(license.id);
      if (devicesUsed >= license.max_devices) {
        throw new Error("device_limit");
      }
      const created: ActivationRow = {
        id: crypto.randomUUID(),
        license_id: license.id,
        device_id: params.deviceId,
        status: "active",
        platform: client.platform,
        device_name: client.deviceName,
        app_version: params.appVersion?.trim() || null,
        client_json: client.payloadJson,
        first_activated_at: now,
        last_validated_at: now,
        last_seen_at: now,
        deactivated_at: null,
        created_at: now,
        updated_at: now,
      };
      db
        .prepare(
          `
            INSERT INTO activations (
              id,
              license_id,
              device_id,
              status,
              platform,
              device_name,
              app_version,
              client_json,
              first_activated_at,
              last_validated_at,
              last_seen_at,
              deactivated_at,
              created_at,
              updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `,
        )
        .run(
          created.id,
          created.license_id,
          created.device_id,
          created.status,
          created.platform,
          created.device_name,
          created.app_version,
          created.client_json,
          created.first_activated_at,
          created.last_validated_at,
          created.last_seen_at,
          created.deactivated_at,
          created.created_at,
          created.updated_at,
        );
      db
        .prepare("UPDATE activation_keys SET last_used_at = ? WHERE key_hash = ?")
        .run(now, sha256(params.token));
      return created;
    }

    const devicesUsed = countActiveActivations(license.id);
    if (existing.status !== "active" && devicesUsed >= license.max_devices) {
      throw new Error("device_limit");
    }

    const updated: ActivationRow = {
      ...existing,
      status: "active",
      platform: client.platform,
      device_name: client.deviceName,
      app_version: params.appVersion?.trim() || null,
      client_json: client.payloadJson,
      last_validated_at: now,
      last_seen_at: now,
      deactivated_at: null,
      updated_at: now,
    };
    db
      .prepare(
        `
          UPDATE activations
          SET status = ?,
              platform = ?,
              device_name = ?,
              app_version = ?,
              client_json = ?,
              last_validated_at = ?,
              last_seen_at = ?,
              deactivated_at = ?,
              updated_at = ?
          WHERE id = ?
        `,
      )
      .run(
        updated.status,
        updated.platform,
        updated.device_name,
        updated.app_version,
        updated.client_json,
        updated.last_validated_at,
        updated.last_seen_at,
        updated.deactivated_at,
        updated.updated_at,
        updated.id,
      );
    db
      .prepare("UPDATE activation_keys SET last_used_at = ? WHERE key_hash = ?")
      .run(now, sha256(params.token));
    return updated;
  });

  return buildEntitlementResponse(license, activation);
}

function refreshActivation(params: {
  activationToken: string;
  deviceId: string;
  appVersion?: string | null;
  client?: Record<string, unknown>;
}) {
  let claims: ActivationClaims;
  try {
    claims = verifyActivationToken(params.activationToken);
  } catch {
    return buildInvalidResponse("invalid_activation", "Activation token invalid.");
  }
  if (claims.typ !== "activation") {
    return buildInvalidResponse("invalid_activation", "Activation token invalid.");
  }
  if (claims.did !== params.deviceId) {
    return buildInvalidResponse("device_mismatch", "Activation token does not match this device.");
  }
  const activation = getActivationById(claims.aid, claims.lid);
  if (!activation) {
    return buildInvalidResponse("activation_missing", "Activation not found.");
  }
  const license = getLicenseById(claims.lid);
  if (!license) {
    return buildInvalidResponse("license_missing", "License not found.");
  }
  if (activation.status !== "active" || activation.deactivated_at) {
    return buildInvalidResponse("activation_revoked", "Activation revoked.", license);
  }
  const runtimeStatus = computeLicenseRuntimeStatus(license);
  if (runtimeStatus !== "active") {
    return buildInvalidResponse(
      runtimeStatus,
      runtimeStatus === "expired"
        ? "License expired."
        : `License ${runtimeStatus}.`,
      license,
    );
  }

  const now = nowIso();
  const client = normalizeClientContext(params.client);
  const updated: ActivationRow = {
    ...activation,
    platform: client.platform ?? activation.platform,
    device_name: client.deviceName ?? activation.device_name,
    app_version: params.appVersion?.trim() || activation.app_version,
    client_json: client.payloadJson,
    last_validated_at: now,
    last_seen_at: now,
    updated_at: now,
  };
  db
    .prepare(
      `
        UPDATE activations
        SET platform = ?,
            device_name = ?,
            app_version = ?,
            client_json = ?,
            last_validated_at = ?,
            last_seen_at = ?,
            updated_at = ?
        WHERE id = ?
      `,
    )
    .run(
      updated.platform,
      updated.device_name,
      updated.app_version,
      updated.client_json,
      updated.last_validated_at,
      updated.last_seen_at,
      updated.updated_at,
      updated.id,
    );
  return buildEntitlementResponse(license, updated);
}

function deactivateActivation(activationToken: string) {
  let claims: ActivationClaims;
  try {
    claims = verifyActivationToken(activationToken);
  } catch {
    return { valid: false, code: "invalid_activation", message: "Activation token invalid." };
  }
  const activation = getActivationById(claims.aid, claims.lid);
  if (!activation) {
    return { valid: false, code: "activation_missing", message: "Activation not found." };
  }
  const now = nowIso();
  db
    .prepare(
      `
        UPDATE activations
        SET status = 'deactivated',
            deactivated_at = ?,
            updated_at = ?
        WHERE id = ?
      `,
    )
    .run(now, now, activation.id);
  return { valid: true, activationId: activation.id, deactivatedAt: now };
}

function verifyLegacyJwt(token: string) {
  try {
    const payload = jwt.verify(token, jwtSecret, {
      issuer: "propai-licensing",
      ignoreExpiration: true,
    }) as LegacyLicenseTokenPayload;
    const entitlements = normalizeEntitlements(payload.entitlements, payload.plan ?? "pro");
    const expiresAt =
      typeof payload.exp === "number"
        ? new Date(payload.exp * 1000).toISOString()
        : typeof payload.expiresAt === "string" && payload.expiresAt.trim()
          ? payload.expiresAt.trim()
          : null;
    const expired = typeof payload.exp === "number" && payload.exp * 1000 < Date.now();
    return {
      valid: !expired,
      plan: payload.plan ?? "pro",
      entitlements,
      expiresAt,
      issuedAt: payload.issuedAt ?? null,
      status: expired ? "expired" : "active",
      message: expired ? "token expired" : undefined,
    };
  } catch {
    return null;
  }
}

function issueLicenseRecord(params: {
  token?: string;
  email?: string;
  plan?: string;
  status?: LicenseStatus;
  expiresAt?: string | null;
  maxDevices?: number;
  entitlements?: string[];
}) {
  const token = params.token?.trim() || randomActivationKey();
  const plan = params.plan?.trim() || "pro";
  const status = params.status ?? "active";
  const expiresAt = params.expiresAt?.trim() || null;
  const expiresAtMs = parseExpiresAt(expiresAt);
  if (expiresAt && expiresAtMs === null) {
    throw new Error("invalid_expires_at");
  }
  if (expiresAtMs !== null && expiresAtMs <= Date.now()) {
    throw new Error("expires_in_past");
  }
  const entitlements = normalizeEntitlements(params.entitlements, plan);
  const maxDevices = Math.max(1, Math.min(100, params.maxDevices ?? 2));
  const licenseId = crypto.randomUUID();
  const keyId = crypto.randomUUID();
  const now = nowIso();
  const keyHash = sha256(token);

  withTransaction(() => {
    const existing = db
      .prepare("SELECT id FROM activation_keys WHERE key_hash = ? LIMIT 1")
      .get(keyHash) as { id?: string } | undefined;
    if (existing?.id) {
      throw new Error("duplicate_token");
    }
    db
      .prepare(
        `
          INSERT INTO licenses (
            id,
            email,
            plan,
            status,
            entitlements_json,
            max_devices,
            expires_at,
            created_at,
            updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
      )
      .run(
        licenseId,
        params.email?.trim() || null,
        plan,
        status,
        JSON.stringify(entitlements),
        maxDevices,
        expiresAt,
        now,
        now,
      );
    db
      .prepare(
        `
          INSERT INTO activation_keys (
            id,
            license_id,
            key_hash,
            key_prefix,
            created_at,
            revoked_at,
            last_used_at
          ) VALUES (?, ?, ?, ?, ?, NULL, NULL)
        `,
      )
      .run(keyId, licenseId, keyHash, summarizeKey(token), now);
  });

  return {
    token,
    licenseId,
    plan,
    status,
    expiresAt,
    maxDevices,
    entitlements,
  };
}

function requestPendingLicense(params: {
  email?: string;
  plan?: string;
  maxDevices?: number;
}) {
  return issueLicenseRecord({
    email: params.email,
    plan: params.plan,
    maxDevices: params.maxDevices,
    status: "pending",
  });
}

function approvePendingLicense(params: {
  token: string;
  email?: string;
  plan?: string;
  expiresAt?: string | null;
  maxDevices?: number;
  entitlements?: string[];
}) {
  const token = params.token.trim();
  if (!token) {
    throw new Error("missing_token");
  }
  const license = getLicenseByToken(token);
  if (!license) {
    throw new Error("license_missing");
  }
  if (license.status !== "pending") {
    throw new Error("already_resolved");
  }

  const now = nowIso();
  const nextPlan = params.plan?.trim() || license.plan;
  const nextEmail = params.email?.trim() || license.email;
  const nextExpiresAt = params.expiresAt?.trim() || null;
  const nextExpiresAtMs = parseExpiresAt(nextExpiresAt);
  if (nextExpiresAt && nextExpiresAtMs === null) {
    throw new Error("invalid_expires_at");
  }
  if (nextExpiresAtMs !== null && nextExpiresAtMs <= Date.now()) {
    throw new Error("expires_in_past");
  }
  const nextEntitlements = normalizeEntitlements(
    params.entitlements,
    nextPlan || license.plan,
  );
  const nextMaxDevices = Math.max(1, Math.min(100, params.maxDevices ?? license.max_devices));

  db
    .prepare(
      `
        UPDATE licenses
        SET email = ?,
            plan = ?,
            status = 'active',
            entitlements_json = ?,
            max_devices = ?,
            expires_at = ?,
            updated_at = ?
        WHERE id = ?
      `,
    )
    .run(
      nextEmail,
      nextPlan,
      JSON.stringify(nextEntitlements),
      nextMaxDevices,
      nextExpiresAt,
      now,
      license.id,
    );

  return {
    token,
    licenseId: license.id,
    email: nextEmail,
    plan: nextPlan,
    status: "active" as const,
    expiresAt: nextExpiresAt,
    maxDevices: nextMaxDevices,
    entitlements: nextEntitlements,
    approvedAt: now,
  };
}

app.get("/health", (_req, res) => {
  res.json({ ok: true, dbPath: LICENSE_DB_PATH });
});

app.get("/", (_req, res) => {
  res.json({
    ok: true,
    service: "propai-licensing",
    status: "ready",
    endpoints: {
      health: "/health",
      activate: "/v1/activations/activate",
      refresh: "/v1/activations/refresh",
      deactivate: "/v1/activations/deactivate",
    },
  });
});

app.post("/v1/activations/activate", (req, res) => {
  const parsed = activationRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json(buildInvalidResponse("invalid_request", "Invalid activation request."));
    return;
  }
  try {
    const result = activateLicenseKey(parsed.data);
    if (!result.valid && "code" in result && result.code === "device_limit") {
      res.status(409).json(result);
      return;
    }
    res.json(result);
  } catch (error) {
    if (error instanceof Error && error.message === "device_limit") {
      const joined = getLicenseByActivationKey(parsed.data.token);
      const license = joined
        ? ({
            id: joined.id,
            email: joined.email,
            plan: joined.plan,
            status: joined.status,
            entitlements_json: joined.entitlements_json,
            max_devices: joined.max_devices,
            expires_at: joined.expires_at,
            created_at: joined.created_at,
            updated_at: joined.updated_at,
          } satisfies LicenseRow)
        : undefined;
      res
        .status(409)
        .json(
          buildInvalidResponse(
            "device_limit",
            "Device limit reached for this license.",
            license,
          ),
        );
      return;
    }
    res.status(500).json(buildInvalidResponse("server_error", "Activation failed."));
  }
});

app.post("/v1/activations/request", (req, res) => {
  const parsed = licenseRequestSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ valid: false, message: "invalid request" });
    return;
  }
  try {
    const result = requestPendingLicense(parsed.data);
    res.status(201).json({
      token: result.token,
      licenseId: result.licenseId,
      plan: result.plan,
      status: result.status,
      expiresAt: result.expiresAt,
      maxDevices: result.maxDevices,
      entitlements: result.entitlements,
      message: "Activation key generated. Waiting for admin approval.",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message === "duplicate_token") {
      res.status(409).json({ valid: false, message: "token already exists" });
      return;
    }
    res.status(500).json({ valid: false, message: "failed to create activation key" });
  }
});

app.post("/v1/activations/refresh", (req, res) => {
  const parsed = refreshRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json(buildInvalidResponse("invalid_request", "Invalid refresh request."));
    return;
  }
  const result = refreshActivation(parsed.data);
  if (!result.valid) {
    res.status(401).json(result);
    return;
  }
  res.json(result);
});

app.post("/v1/activations/deactivate", (req, res) => {
  const parsed = deactivateRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ valid: false, message: "Invalid deactivate request." });
    return;
  }
  const result = deactivateActivation(parsed.data.activationToken);
  if (!result.valid) {
    res.status(401).json(result);
    return;
  }
  res.json(result);
});

app.post("/verify", (req, res) => {
  const parsed = verifySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json(buildInvalidResponse("invalid_request", "Invalid verify request."));
    return;
  }

  const byKey = getLicenseByActivationKey(parsed.data.token);
  if (byKey) {
    try {
      const result = activateLicenseKey(parsed.data);
      if (!result.valid && "code" in result && result.code === "device_limit") {
        res.status(409).json(result);
        return;
      }
      res.json(result);
      return;
    } catch (error) {
      if (error instanceof Error && error.message === "device_limit") {
        res
          .status(409)
          .json(
            buildInvalidResponse(
              "device_limit",
              "Device limit reached for this license.",
              byKey,
            ),
          );
        return;
      }
    }
  }

  const byActivation = refreshActivation({
    activationToken: parsed.data.token,
    deviceId: parsed.data.deviceId,
    appVersion: parsed.data.appVersion,
    client: parsed.data.client,
  });
  if (byActivation.valid) {
    res.json(byActivation);
    return;
  }

  const legacy = verifyLegacyJwt(parsed.data.token);
  if (legacy) {
    res.json(legacy);
    return;
  }

  res.json(buildInvalidResponse("invalid_token", "Invalid activation key or token."));
});

app.post("/v1/admin/licenses", (req, res) => {
  if (!requireAdmin(req, res)) {
    return;
  }
  const parsed = adminLicenseSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ valid: false, message: "invalid request" });
    return;
  }
  try {
    const result = issueLicenseRecord(parsed.data);
    res.status(201).json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message === "invalid_expires_at") {
      res.status(400).json({ valid: false, message: "invalid expiresAt" });
      return;
    }
    if (message === "expires_in_past") {
      res.status(400).json({ valid: false, message: "expiresAt must be in the future" });
      return;
    }
    if (message === "duplicate_token") {
      res.status(409).json({ valid: false, message: "token already exists" });
      return;
    }
    res.status(500).json({ valid: false, message: "failed to issue license" });
  }
});

app.post("/v1/admin/licenses/approve", (req, res) => {
  if (!requireAdmin(req, res)) {
    return;
  }
  const parsed = adminApproveLicenseSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ valid: false, message: "invalid request" });
    return;
  }
  try {
    const result = approvePendingLicense(parsed.data);
    res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message === "missing_token") {
      res.status(400).json({ valid: false, message: "token is required" });
      return;
    }
    if (message === "license_missing") {
      res.status(404).json({ valid: false, message: "activation key not found" });
      return;
    }
    if (message === "already_resolved") {
      res.status(409).json({ valid: false, message: "activation key already approved or inactive" });
      return;
    }
    if (message === "invalid_expires_at") {
      res.status(400).json({ valid: false, message: "invalid expiresAt" });
      return;
    }
    if (message === "expires_in_past") {
      res.status(400).json({ valid: false, message: "expiresAt must be in the future" });
      return;
    }
    res.status(500).json({ valid: false, message: "failed to approve activation key" });
  }
});

app.post("/issue", (req, res) => {
  if (!requireAdmin(req, res)) {
    return;
  }
  const parsed = adminLicenseSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ valid: false, message: "invalid request" });
    return;
  }
  try {
    const result = issueLicenseRecord(parsed.data);
    res.json({ token: result.token });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message === "invalid_expires_at") {
      res.status(400).json({ valid: false, message: "invalid expiresAt" });
      return;
    }
    if (message === "expires_in_past") {
      res.status(400).json({ valid: false, message: "expiresAt must be in the future" });
      return;
    }
    if (message === "duplicate_token") {
      res.status(409).json({ valid: false, message: "token already exists" });
      return;
    }
    res.status(500).json({ valid: false, message: "failed to issue license" });
  }
});

app.listen(PORT, () => {
  console.log(`PropAI licensing API listening on http://localhost:${PORT}`);
});
