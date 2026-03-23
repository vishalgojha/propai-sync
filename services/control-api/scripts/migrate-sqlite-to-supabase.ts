import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL ?? "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const SQLITE_PATH =
  process.env.SQLITE_PATH?.trim() ||
  process.env.CONTROL_DB_PATH?.trim() ||
  path.join(process.cwd(), ".data", "control.sqlite");
const DRY_RUN = (process.env.DRY_RUN ?? "").toLowerCase() === "true";
const SKIP_USAGE = (process.env.SKIP_USAGE ?? "").toLowerCase() === "true";
const CHUNK_SIZE = Math.max(50, Number.parseInt(process.env.CHUNK_SIZE ?? "500", 10));

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function chunk<T>(rows: T[], size: number): T[][] {
  const output: T[][] = [];
  for (let i = 0; i < rows.length; i += size) {
    output.push(rows.slice(i, i + size));
  }
  return output;
}

function parseJsonSafe(raw: string | null | undefined) {
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

async function upsertRows<T extends Record<string, unknown>>(
  table: string,
  rows: T[],
  onConflict: string,
) {
  if (!rows.length) {
    console.log(`[migrate] ${table}: 0 rows`);
    return;
  }
  console.log(`[migrate] ${table}: ${rows.length} rows`);
  if (DRY_RUN) {
    return;
  }
  for (const batch of chunk(rows, CHUNK_SIZE)) {
    const { error } = await supabase.from(table).upsert(batch, { onConflict });
    if (error) {
      throw error;
    }
  }
}

function loadRows<T>(db: DatabaseSync, sql: string): T[] {
  return db.prepare(sql).all() as T[];
}

async function main() {
  const db = new DatabaseSync(SQLITE_PATH);
  db.exec("PRAGMA foreign_keys = ON;");

  const tenants = loadRows<{ id: string; name: string; created_at: string }>(
    db,
    "SELECT id, name, created_at FROM tenants",
  );
  const users = loadRows<{ id: string; email: string; password_hash: string; created_at: string }>(
    db,
    "SELECT id, email, password_hash, created_at FROM users",
  );
  const memberships = loadRows<{
    id: string;
    tenant_id: string;
    user_id: string;
    role: string;
    created_at: string;
  }>(db, "SELECT id, tenant_id, user_id, role, created_at FROM memberships");
  const invites = loadRows<{
    id: string;
    tenant_id: string;
    email: string;
    role: string;
    token_hash: string;
    expires_at: string;
    created_at: string;
    accepted_at: string | null;
  }>(
    db,
    "SELECT id, tenant_id, email, role, token_hash, expires_at, created_at, accepted_at FROM invites",
  );
  const whatsappIdentities = loadRows<{
    phone: string;
    user_id: string;
    tenant_id: string;
    created_at: string;
  }>(db, "SELECT phone, user_id, tenant_id, created_at FROM whatsapp_identities");
  const tenantSettings = loadRows<{ tenant_id: string; data: string; updated_at: string }>(
    db,
    "SELECT tenant_id, data, updated_at FROM tenant_settings",
  ).map((row) => ({
    tenant_id: row.tenant_id,
    data: parseJsonSafe(row.data),
    updated_at: row.updated_at,
  }));

  const usageEvents = SKIP_USAGE
    ? []
    : loadRows<{
        id: string;
        tenant_id: string;
        provider: string;
        model: string;
        kind: string;
        input_tokens: number | null;
        output_tokens: number | null;
        cache_read_tokens: number | null;
        cache_write_tokens: number | null;
        total_tokens: number | null;
        characters: number | null;
        latency_ms: number | null;
        session_id: string | null;
        run_id: string | null;
        source: string | null;
        created_at: string;
      }>(
        db,
        "SELECT id, tenant_id, provider, model, kind, input_tokens, output_tokens, cache_read_tokens, cache_write_tokens, total_tokens, characters, latency_ms, session_id, run_id, source, created_at FROM usage_events",
      );

  await upsertRows("tenants", tenants, "id");
  await upsertRows("users", users, "id");
  await upsertRows("memberships", memberships, "id");
  await upsertRows("invites", invites, "id");
  await upsertRows("whatsapp_identities", whatsappIdentities, "phone");
  await upsertRows("tenant_settings", tenantSettings, "tenant_id");
  if (!SKIP_USAGE) {
    await upsertRows("usage_events", usageEvents, "id");
  }

  console.log("[migrate] completed");
}

main().catch((err) => {
  console.error("[migrate] failed:", err);
  process.exit(1);
});
