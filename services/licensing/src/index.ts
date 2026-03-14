import crypto from "node:crypto";
import path from "node:path";
import express from "express";
import jwt from "jsonwebtoken";
import Database from "better-sqlite3";
import { z } from "zod";

const PORT = Number(process.env.PORT ?? "8787");
const DATABASE_URL = process.env.DATABASE_URL ?? "./data/licensing.db";
const TRIAL_DAYS = Number(process.env.TRIAL_DAYS ?? "7");
const ADMIN_KEY = process.env.ADMIN_KEY ?? "";
const JWT_SECRET = process.env.LICENSE_JWT_SECRET ?? "";

if (!JWT_SECRET) {
  throw new Error("LICENSE_JWT_SECRET is required");
}

const db = new Database(path.resolve(DATABASE_URL));
db.pragma("journal_mode = WAL");
db.exec(`
  create table if not exists licenses (
    token text primary key,
    plan text,
    status text,
    trial_start text,
    trial_end text,
    expires_at text,
    max_devices integer,
    created_at text,
    updated_at text
  );
  create table if not exists devices (
    id text primary key,
    token text,
    first_seen text,
    last_seen text
  );
`);

const app = express();
app.use(express.json({ limit: "1mb" }));

const verifySchema = z.object({
  token: z.string().min(6),
  deviceId: z.string().min(6),
  appVersion: z.string().nullable().optional(),
  client: z.record(z.unknown()).optional(),
});

const adminLicenseSchema = z.object({
  token: z.string().optional(),
  plan: z.string().optional(),
  status: z.string().optional(),
  expiresAt: z.string().nullable().optional(),
  maxDevices: z.number().int().min(1).max(100).optional(),
});

function nowIso() {
  return new Date().toISOString();
}

function addDays(base: Date, days: number) {
  const copy = new Date(base.getTime());
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy;
}

function isExpired(dateValue?: string | null) {
  if (!dateValue) {
    return false;
  }
  const parsed = Date.parse(dateValue);
  if (Number.isNaN(parsed)) {
    return false;
  }
  return parsed < Date.now();
}

function requireAdmin(req: express.Request, res: express.Response): boolean {
  if (!ADMIN_KEY) {
    res.status(403).json({ ok: false, message: "admin disabled" });
    return false;
  }
  const provided = req.header("x-admin-key");
  if (!provided || provided !== ADMIN_KEY) {
    res.status(401).json({ ok: false, message: "invalid admin key" });
    return false;
  }
  return true;
}

app.get("/v1/health", (_req, res) => {
  res.json({ ok: true });
});

app.post("/v1/license/verify", (req, res) => {
  const parsed = verifySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ ok: false, message: "invalid request" });
    return;
  }

  const { token, deviceId } = parsed.data;
  const license = db
    .prepare(
      `select token, plan, status, trial_start as trialStart, trial_end as trialEnd,
        expires_at as expiresAt, max_devices as maxDevices from licenses where token = ?`,
    )
    .get(token);

  if (!license) {
    res.status(404).json({ ok: false, status: "invalid", message: "unknown token" });
    return;
  }

  if (license.status === "revoked") {
    res.status(403).json({ ok: false, status: "invalid", message: "license revoked" });
    return;
  }

  const deviceCount = db
    .prepare("select count(*) as count from devices where token = ?")
    .get(token)?.count as number;
  const existingDevice = db
    .prepare("select id from devices where id = ? and token = ?")
    .get(deviceId, token);
  const maxDevices = typeof license.maxDevices === "number" ? license.maxDevices : 2;

  if (!existingDevice && deviceCount >= maxDevices) {
    res.status(403).json({ ok: false, status: "invalid", message: "device limit reached" });
    return;
  }

  const now = new Date();
  let trialEnd = license.trialEnd as string | null | undefined;
  let trialStart = license.trialStart as string | null | undefined;
  const updatedAt = nowIso();

  if (!trialEnd) {
    trialStart = updatedAt;
    trialEnd = addDays(now, Number.isFinite(TRIAL_DAYS) ? TRIAL_DAYS : 7).toISOString();
    db.prepare("update licenses set trial_start = ?, trial_end = ?, updated_at = ? where token = ?").run(
      trialStart,
      trialEnd,
      updatedAt,
      token,
    );
  }

  const expiredByTrial = isExpired(trialEnd);
  const expiredByLicense = isExpired(license.expiresAt as string | null | undefined);

  if (expiredByTrial || expiredByLicense) {
    res.status(410).json({ ok: false, status: "expired", message: "license expired" });
    return;
  }

  if (!existingDevice) {
    db.prepare("insert into devices (id, token, first_seen, last_seen) values (?, ?, ?, ?)").run(
      deviceId,
      token,
      updatedAt,
      updatedAt,
    );
  } else {
    db.prepare("update devices set last_seen = ? where id = ?").run(updatedAt, deviceId);
  }

  const status = license.status === "active" ? "active" : "trial";
  const entitlement = {
    status,
    plan: license.plan as string | null,
    trialEndsAt: status === "trial" ? trialEnd : null,
    expiresAt: status === "active" ? (license.expiresAt as string | null) : null,
    issuedAt: updatedAt,
  };
  const entitlementJwt = jwt.sign(entitlement, JWT_SECRET, {
    expiresIn: "30d",
    issuer: "propai-licensing",
  });

  res.json({ ok: true, ...entitlement, entitlement: entitlementJwt });
});

app.post("/v1/admin/licenses", (req, res) => {
  if (!requireAdmin(req, res)) {
    return;
  }

  const parsed = adminLicenseSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ ok: false, message: "invalid request" });
    return;
  }

  const token = parsed.data.token ?? `propai_sync_${crypto.randomBytes(12).toString("hex")}`;
  const plan = parsed.data.plan ?? "pro";
  const status = parsed.data.status ?? "active";
  const expiresAt = parsed.data.expiresAt ?? null;
  const maxDevices = parsed.data.maxDevices ?? 2;
  const now = nowIso();

  db.prepare(
    `
    insert into licenses (token, plan, status, expires_at, max_devices, created_at, updated_at)
    values (?, ?, ?, ?, ?, ?, ?)
    on conflict(token) do update set
      plan = excluded.plan,
      status = excluded.status,
      expires_at = excluded.expires_at,
      max_devices = excluded.max_devices,
      updated_at = excluded.updated_at
  `,
  ).run(token, plan, status, expiresAt, maxDevices, now, now);

  res.json({ ok: true, token, plan, status, expiresAt, maxDevices });
});

app.listen(PORT, () => {
  console.log(`PropAI licensing API listening on http://localhost:${PORT}`);
});
