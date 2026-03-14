import crypto from "node:crypto";
import Database from "better-sqlite3";

const DATABASE_URL = process.env.DATABASE_URL ?? "./data/licensing.db";

const args = process.argv.slice(2);
const getArg = (flag: string) => {
  const idx = args.indexOf(flag);
  if (idx === -1) {
    return null;
  }
  return args[idx + 1] ?? null;
};

const plan = getArg("--plan") ?? "pro";
const status = getArg("--status") ?? "active";
const maxDevices = Number(getArg("--max-devices") ?? "2");
const expiresAt = getArg("--expires-at");
const token = getArg("--token") ?? `propai_sync_${crypto.randomBytes(12).toString("hex")}`;

const db = new Database(DATABASE_URL);
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
`);

const now = new Date().toISOString();
db.prepare(
  `
  insert into licenses (token, plan, status, expires_at, max_devices, created_at, updated_at)
  values (?, ?, ?, ?, ?, ?, ?)
`,
).run(token, plan, status, expiresAt, Number.isFinite(maxDevices) ? maxDevices : 2, now, now);

console.log(token);
