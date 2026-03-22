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
const LICENSE_PENDING_APPROVAL_TRIAL_DAYS = parsePositiveInt(
  process.env.LICENSE_PENDING_APPROVAL_TRIAL_DAYS,
  7,
);
const LICENSE_APPROVAL_LINK_TTL_HOURS = parsePositiveInt(
  process.env.LICENSE_APPROVAL_LINK_TTL_HOURS,
  72,
);
const LICENSE_DEFAULT_MAX_DEVICES = clampInt(
  parsePositiveInt(process.env.LICENSE_DEFAULT_MAX_DEVICES, 5),
  1,
  100,
);
const RESEND_API_KEY = process.env.RESEND_API_KEY?.trim() ?? "";
const LICENSE_APPROVAL_FROM = process.env.LICENSE_APPROVAL_FROM?.trim() ?? "";
const LICENSE_APPROVAL_TO = (process.env.LICENSE_APPROVAL_TO ?? "")
  .split(",")
  .map((entry) => entry.trim())
  .filter(Boolean);
const LICENSE_PUBLIC_BASE_URL = (process.env.LICENSE_PUBLIC_BASE_URL?.trim() ?? "").replace(
  /\/+$/,
  "",
);
const isDev =
  process.env.PROPAI_PROFILE === "dev" || (process.env.NODE_ENV ?? "development") !== "production";
let jwtSecret = process.env.LICENSE_JWT_SECRET ?? "";

const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504]);
const RETRY_POLICY = { initialMs: 500, maxMs: 8000, factor: 2, jitter: 0.2, maxRetries: 3 };

function computeBackoff(attempt: number) {
  const base = RETRY_POLICY.initialMs * RETRY_POLICY.factor ** Math.max(attempt - 1, 0);
  const jitter = base * RETRY_POLICY.jitter * Math.random();
  return Math.min(RETRY_POLICY.maxMs, Math.round(base + jitter));
}

async function sleep(ms: number) {
  if (ms <= 0) {
    return;
  }
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithRetry(
  input: RequestInfo | URL,
  init: RequestInit,
  context: string,
): Promise<Response> {
  let attempt = 0;
  while (true) {
    attempt += 1;
    try {
      const res = await fetch(input, init);
      if (RETRYABLE_STATUSES.has(res.status)) {
        throw Object.assign(new Error(`fetch failed (${res.status})`), { status: res.status });
      }
      return res;
    } catch (err) {
      if (attempt >= RETRY_POLICY.maxRetries) {
        throw err;
      }
      const delay = computeBackoff(attempt);
      console.warn(
        `[retry] ${context} attempt ${attempt}/${RETRY_POLICY.maxRetries} failed; retrying in ${delay}ms`,
      );
      await sleep(delay);
    }
  }
}

function registerGlobalErrorHandlers() {
  process.on("uncaughtException", (err) => {
    console.error(
      `[licensing] uncaught exception (process kept alive): ${
        err instanceof Error ? err.stack ?? err.message : String(err)
      }`,
    );
  });
  process.on("unhandledRejection", (reason) => {
    console.error(
      `[licensing] unhandled rejection (process kept alive): ${
        reason instanceof Error ? reason.stack ?? reason.message : String(reason)
      }`,
    );
  });
}

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

type ApprovalAction = "approve" | "reject";

type ApprovalClaims = JwtPayload & {
  typ: "license_approval";
  act: ApprovalAction;
  tok: string;
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
  phone: z.string().min(6).max(32).optional(),
  notes: z.string().max(2000).optional(),
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
registerGlobalErrorHandlers();

const db = openDatabase(LICENSE_DB_PATH);
initSchema(db);

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  const value = Number.parseInt(raw ?? "", 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function clampInt(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min;
  }
  return Math.max(min, Math.min(max, Math.trunc(value)));
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

function addDaysIso(days: number): string {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
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

function signApprovalLinkToken(token: string, action: ApprovalAction): string {
  return jwt.sign(
    {
      typ: "license_approval",
      act: action,
      tok: token,
    } satisfies ApprovalClaims,
    jwtSecret,
    {
      issuer: "propai-licensing",
      audience: "propai-license-approval",
      subject: `${action}:${sha256(token).slice(0, 12)}`,
      expiresIn: `${LICENSE_APPROVAL_LINK_TTL_HOURS}h`,
    },
  );
}

function verifyApprovalLinkToken(token: string): ApprovalClaims {
  return jwt.verify(token, jwtSecret, {
    issuer: "propai-licensing",
    audience: "propai-license-approval",
  }) as ApprovalClaims;
}

function getLicensePublicBaseUrl(): string {
  return LICENSE_PUBLIC_BASE_URL || `http://localhost:${PORT}`;
}

function buildApprovalLink(action: ApprovalAction, token: string): string {
  const signedToken = signApprovalLinkToken(token, action);
  return `${getLicensePublicBaseUrl()}/v1/admin/licenses/${action}-email?token=${encodeURIComponent(signedToken)}`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildApprovalEmailContent(params: {
  token: string;
  email?: string | null;
  phone?: string | null;
  notes?: string | null;
  plan: string;
  maxDevices: number;
}) {
  const approveUrl = buildApprovalLink("approve", params.token);
  const rejectUrl = buildApprovalLink("reject", params.token);
  const requester = params.email?.trim() ? params.email.trim() : "Not provided";
  const phone = params.phone?.trim() ? params.phone.trim() : "Not provided";
  const notes = params.notes?.trim() ? params.notes.trim() : "Not provided";
  const subject = `PropAi Sync trial request: ${params.plan.toUpperCase()} (${params.maxDevices} devices)`;
  const safeToken = escapeHtml(params.token);
  const safePlan = escapeHtml(params.plan.toUpperCase());
  const safeRequester = escapeHtml(requester);
  const safePhone = escapeHtml(phone);
  const safeNotes = escapeHtml(notes);
  const safeApproveUrl = escapeHtml(approveUrl);
  const safeRejectUrl = escapeHtml(rejectUrl);
  const html = `
    <div style="background:#020704;padding:24px;font-family:Inter,Segoe UI,Arial,sans-serif;color:#f1fff8;">
      <div style="max-width:720px;margin:0 auto;background:#050d09;border:1px solid rgba(91,247,191,0.18);border-radius:20px;padding:28px;">
        <div style="font-size:12px;letter-spacing:0.28em;text-transform:uppercase;color:#5bf7bf;font-weight:700;">PropAi Sync</div>
        <h1 style="margin:16px 0 8px;font-size:32px;line-height:1.05;">New trial request</h1>
        <p style="margin:0 0 20px;color:#bfead5;font-size:15px;line-height:1.6;">A new desktop trial request is waiting for review.</p>
        <div style="display:grid;gap:10px;background:#020a07;border:1px solid rgba(255,255,255,0.06);border-radius:16px;padding:18px;">
          <div><strong>Key:</strong> <span style="font-family:'JetBrains Mono',monospace;">${safeToken}</span></div>
          <div><strong>Plan:</strong> ${safePlan}</div>
          <div><strong>Max devices:</strong> ${params.maxDevices}</div>
          <div><strong>Requester email:</strong> ${safeRequester}</div>
          <div><strong>Requester phone:</strong> ${safePhone}</div>
          <div><strong>Notes:</strong> ${safeNotes}</div>
        </div>
        <div style="display:flex;gap:12px;flex-wrap:wrap;margin-top:24px;">
          <a href="${safeApproveUrl}" style="display:inline-block;padding:12px 18px;border-radius:999px;background:#5bf7bf;color:#02120b;text-decoration:none;font-weight:700;">Approve 7-day trial</a>
          <a href="${safeRejectUrl}" style="display:inline-block;padding:12px 18px;border-radius:999px;border:1px solid rgba(255,255,255,0.12);color:#f1fff8;text-decoration:none;font-weight:600;">Reject request</a>
        </div>
        <p style="margin:20px 0 0;color:#88c6ad;font-size:12px;line-height:1.6;">These links expire in ${LICENSE_APPROVAL_LINK_TTL_HOURS} hours.</p>
      </div>
    </div>
  `;
  const text = [
    "PropAi Sync trial request",
    "",
    `Key: ${params.token}`,
    `Plan: ${params.plan.toUpperCase()}`,
    `Max devices: ${params.maxDevices}`,
    `Requester email: ${requester}`,
    `Requester phone: ${phone}`,
    `Notes: ${notes}`,
    "",
    `Approve: ${approveUrl}`,
    `Reject: ${rejectUrl}`,
  ].join("\n");
  return { subject, html, text, approveUrl, rejectUrl };
}

async function sendPendingApprovalEmail(params: {
  token: string;
  email?: string | null;
  phone?: string | null;
  notes?: string | null;
  plan: string;
  maxDevices: number;
}) {
  const content = buildApprovalEmailContent(params);
  if (!RESEND_API_KEY || !LICENSE_APPROVAL_FROM || LICENSE_APPROVAL_TO.length === 0 || !LICENSE_PUBLIC_BASE_URL) {
    if (isDev) {
      console.warn("Approval email env vars missing; using console approval links in dev mode.");
      console.info(`Approve: ${content.approveUrl}`);
      console.info(`Reject: ${content.rejectUrl}`);
      return;
    }
    throw new Error("approval_email_disabled");
  }

  const response = await fetchWithRetry(
    "https://api.resend.com/emails",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: LICENSE_APPROVAL_FROM,
        to: LICENSE_APPROVAL_TO,
        subject: content.subject,
        html: content.html,
        text: content.text,
      }),
    },
    "resend approval email",
  );

  if (!response.ok) {
    let detail = `${response.status}`;
    try {
      const body = (await response.json()) as { message?: string; error?: string };
      detail = body.message ?? body.error ?? detail;
    } catch {
      // ignore JSON parse failure
    }
    throw new Error(`approval_email_failed:${detail}`);
  }
}

function renderDecisionPage(params: { title: string; body: string; accent?: "ok" | "warn" }) {
  const accent = params.accent === "warn" ? "#d9fff0" : "#5bf7bf";
  return `<!doctype html>
  <html lang="en">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>${escapeHtml(params.title)}</title>
      <style>
        body { margin:0; font-family: Inter, Segoe UI, Arial, sans-serif; background:#020704; color:#f1fff8; }
        .wrap { min-height:100vh; display:flex; align-items:center; justify-content:center; padding:24px; }
        .card { max-width:720px; background:#050d09; border:1px solid rgba(91,247,191,0.18); border-radius:20px; padding:28px; box-shadow:0 24px 60px rgba(0,0,0,0.35); }
        .eyebrow { font-size:12px; letter-spacing:0.28em; text-transform:uppercase; color:${accent}; font-weight:700; }
        h1 { margin:16px 0 8px; font-size:32px; line-height:1.05; }
        p { margin:0; color:#bfead5; line-height:1.7; font-size:15px; }
      </style>
    </head>
    <body>
      <div class="wrap">
        <div class="card">
          <div class="eyebrow">PropAi Sync</div>
          <h1>${escapeHtml(params.title)}</h1>
          <p>${escapeHtml(params.body)}</p>
        </div>
      </div>
    </body>
  </html>`;
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
          ? "This trial request is still waiting for approval. Please try again after it is reviewed."
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
    const maxDevices = Math.max(1, Math.min(100, params.maxDevices ?? LICENSE_DEFAULT_MAX_DEVICES));
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

function deleteLicenseRecord(licenseId: string) {
  db.prepare("DELETE FROM licenses WHERE id = ?").run(licenseId);
}

function rejectPendingLicense(params: { token: string }) {
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
  withTransaction(() => {
    db
      .prepare(
        `
          UPDATE licenses
          SET status = 'cancelled',
              updated_at = ?
          WHERE id = ?
        `,
      )
      .run(now, license.id);
    db
      .prepare(
        `
          UPDATE activation_keys
          SET revoked_at = ?
          WHERE license_id = ? AND revoked_at IS NULL
        `,
      )
      .run(now, license.id);
  });
  return {
    token,
    licenseId: license.id,
    status: "cancelled" as const,
    rejectedAt: now,
  };
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
  const nextExpiresAtRaw =
    "expiresAt" in params
      ? params.expiresAt
      : addDaysIso(LICENSE_PENDING_APPROVAL_TRIAL_DAYS);
  const nextExpiresAt = nextExpiresAtRaw?.trim() || null;
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

app.post("/v1/activations/request", async (req, res) => {
  const parsed = licenseRequestSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ valid: false, message: "invalid request" });
    return;
  }
  try {
    const result = requestPendingLicense(parsed.data);
    try {
      await sendPendingApprovalEmail({
        token: result.token,
        email: parsed.data.email ?? null,
        phone: parsed.data.phone ?? null,
        notes: parsed.data.notes ?? null,
        plan: result.plan,
        maxDevices: result.maxDevices,
      });
    } catch (error) {
      deleteLicenseRecord(result.licenseId);
      const message = error instanceof Error ? error.message : String(error);
      if (message === "approval_email_disabled") {
        res.status(503).json({
          valid: false,
          message: "Trial requests are temporarily unavailable while email approval is being set up.",
        });
        return;
      }
      if (message.startsWith("approval_email_failed:")) {
        res.status(502).json({
          valid: false,
          message: `Approval email could not be sent (${message.slice("approval_email_failed:".length)}).`,
        });
        return;
      }
      throw error;
    }
    res.status(201).json({
      token: result.token,
      licenseId: result.licenseId,
      plan: result.plan,
      status: result.status,
      expiresAt: result.expiresAt,
      maxDevices: result.maxDevices,
      entitlements: result.entitlements,
      message: "Trial request sent. We will review it shortly.",
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

app.get("/v1/admin/licenses/approve-email", (req, res) => {
  const raw = typeof req.query.token === "string" ? req.query.token.trim() : "";
  if (!raw) {
    res.status(400).type("html").send(
      renderDecisionPage({
        title: "Approval link missing",
        body: "This approval link is incomplete. Request a new approval email.",
        accent: "warn",
      }),
    );
    return;
  }
  try {
    const claims = verifyApprovalLinkToken(raw);
    if (claims.typ !== "license_approval" || claims.act !== "approve") {
      throw new Error("invalid_action");
    }
    const result = approvePendingLicense({ token: claims.tok });
    res.type("html").send(
      renderDecisionPage({
        title: "Trial approved",
        body: `Activation key ${result.token} is now active for a 7-day trial.`,
        accent: "ok",
      }),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const body =
      message === "already_resolved"
        ? "This request was already approved or rejected earlier."
        : message === "license_missing"
          ? "This activation key could not be found."
          : "This approval link is invalid or has expired.";
    res.status(400).type("html").send(
      renderDecisionPage({
        title: "Approval not completed",
        body,
        accent: "warn",
      }),
    );
  }
});

app.get("/v1/admin/licenses/reject-email", (req, res) => {
  const raw = typeof req.query.token === "string" ? req.query.token.trim() : "";
  if (!raw) {
    res.status(400).type("html").send(
      renderDecisionPage({
        title: "Reject link missing",
        body: "This reject link is incomplete. Request a new approval email.",
        accent: "warn",
      }),
    );
    return;
  }
  try {
    const claims = verifyApprovalLinkToken(raw);
    if (claims.typ !== "license_approval" || claims.act !== "reject") {
      throw new Error("invalid_action");
    }
    const result = rejectPendingLicense({ token: claims.tok });
    res.type("html").send(
      renderDecisionPage({
        title: "Trial rejected",
        body: `Activation key ${result.token} has been rejected and turned off.`,
        accent: "warn",
      }),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const body =
      message === "already_resolved"
        ? "This request was already approved or rejected earlier."
        : message === "license_missing"
          ? "This activation key could not be found."
          : "This reject link is invalid or has expired.";
    res.status(400).type("html").send(
      renderDecisionPage({
        title: "Rejection not completed",
        body,
        accent: "warn",
      }),
    );
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
