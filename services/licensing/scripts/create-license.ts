import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const args = process.argv.slice(2);
const getArg = (flag: string) => {
  const idx = args.indexOf(flag);
  if (idx === -1) {
    return null;
  }
  return args[idx + 1] ?? null;
};

const dbPath =
  process.env.LICENSE_DB_PATH?.trim() ||
  path.join(process.cwd(), ".data", "licensing.sqlite");
const token = getArg("--token")?.trim() || `propai_sync_${crypto.randomBytes(18).toString("base64url")}`;
const email = getArg("--email")?.trim() || null;
const plan = getArg("--plan")?.trim() || "pro";
const status = getArg("--status")?.trim() || "active";
const expiresAt = getArg("--expires-at")?.trim() || null;
const maxDevicesRaw = getArg("--max-devices");
const maxDevices = maxDevicesRaw ? Number.parseInt(maxDevicesRaw, 10) : 2;

if (!Number.isFinite(maxDevices) || maxDevices < 1 || maxDevices > 100) {
  console.error("Invalid --max-devices value.");
  process.exit(1);
}

if (!["active", "suspended", "revoked", "cancelled"].includes(status)) {
  console.error("Invalid --status value.");
  process.exit(1);
}

if (expiresAt) {
  const parsed = Date.parse(expiresAt);
  if (Number.isNaN(parsed)) {
    console.error("Invalid --expires-at value.");
    process.exit(1);
  }
  if (parsed <= Date.now()) {
    console.error("expiresAt must be in the future.");
    process.exit(1);
  }
}

fs.mkdirSync(path.dirname(dbPath), { recursive: true });
const db = new DatabaseSync(dbPath);
db.exec("PRAGMA journal_mode = WAL;");
db.exec("PRAGMA foreign_keys = ON;");
db.exec("PRAGMA busy_timeout = 5000;");
db.exec(`
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
`);

const now = new Date().toISOString();
const licenseId = crypto.randomUUID();
const keyId = crypto.randomUUID();
const keyHash = crypto.createHash("sha256").update(token).digest("hex");
const entitlements = JSON.stringify([plan]);
const keyPrefix = token.slice(0, Math.min(18, token.length));

db.exec("BEGIN IMMEDIATE");
try {
  const existing = db
    .prepare("SELECT id FROM activation_keys WHERE key_hash = ? LIMIT 1")
    .get(keyHash) as { id?: string } | undefined;
  if (existing?.id) {
    throw new Error("duplicate");
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
    .run(licenseId, email, plan, status, entitlements, maxDevices, expiresAt, now, now);
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
    .run(keyId, licenseId, keyHash, keyPrefix, now);
  db.exec("COMMIT");
} catch (error) {
  db.exec("ROLLBACK");
  if (error instanceof Error && error.message === "duplicate") {
    console.error("Token already exists.");
    process.exit(1);
  }
  throw error;
}

console.log(token);
