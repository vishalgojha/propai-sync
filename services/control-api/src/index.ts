import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import express from "express";
import jwt, { type JwtPayload } from "jsonwebtoken";
import { z } from "zod";

const PORT = Number(process.env.PORT ?? "8788");
const DB_PATH =
  process.env.CONTROL_DB_PATH?.trim() || path.join(process.cwd(), ".data", "control.sqlite");
const ADMIN_KEY = process.env.CONTROL_ADMIN_KEY ?? "";
const isRailway = Boolean(process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY_PROJECT_ID);
const fallbackGatewayUrl = isRailway ? "http://gateway.railway.internal:8080" : "http://localhost:8080";
const CONTROL_GATEWAY_URL = (process.env.CONTROL_GATEWAY_URL || process.env.GATEWAY_URL || fallbackGatewayUrl).replace(
  /\/+$/,
  "",
);
const CONTROL_GATEWAY_TOKEN =
  process.env.CONTROL_GATEWAY_TOKEN ??
  process.env.GATEWAY_TOKEN ??
  process.env.PROPAI_GATEWAY_TOKEN ??
  "";
const CONTROL_USAGE_INGEST_KEY = process.env.CONTROL_USAGE_INGEST_KEY ?? "";
const JWT_TTL_DAYS = parsePositiveInt(process.env.CONTROL_JWT_TTL_DAYS, 30);
const INVITE_TTL_DAYS = parsePositiveInt(process.env.CONTROL_INVITE_TTL_DAYS, 7);
const isDev =
  process.env.PROPAI_PROFILE === "dev" || (process.env.NODE_ENV ?? "development") !== "production";
let jwtSecret = process.env.CONTROL_JWT_SECRET ?? "";

if (!jwtSecret) {
  if (isDev) {
    jwtSecret = crypto.randomBytes(32).toString("hex");
    console.warn(
      "CONTROL_JWT_SECRET is not set; using ephemeral dev secret. Set CONTROL_JWT_SECRET for stable tokens.",
    );
  } else {
    throw new Error("CONTROL_JWT_SECRET is required");
  }
}

const ROLE_VALUES = ["owner", "manager", "agent", "viewer"] as const;
type Role = (typeof ROLE_VALUES)[number];
const ALLOWED_USAGE_PROVIDERS = new Set(["openai", "anthropic", "xai", "elevenlabs"]);

type AuthClaims = JwtPayload & {
  typ: "control";
  uid: string;
};

type UserRow = {
  id: string;
  email: string;
  password_hash: string;
  created_at: string;
};

type TenantRow = {
  id: string;
  name: string;
  created_at: string;
};

type MembershipRow = {
  id: string;
  tenant_id: string;
  user_id: string;
  role: Role;
  created_at: string;
};

type InviteRow = {
  id: string;
  tenant_id: string;
  email: string;
  role: Role;
  token_hash: string;
  expires_at: string;
  created_at: string;
  accepted_at: string | null;
};

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  tenantName: z.string().min(2),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

const createTenantSchema = z.object({
  name: z.string().min(2),
});

const inviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(ROLE_VALUES),
});

const acceptInviteSchema = z.object({
  token: z.string().min(16),
  password: z.string().min(8).optional(),
});

const updateRoleSchema = z.object({
  role: z.enum(ROLE_VALUES),
});

const providerSchema = z.object({
  apiKey: z.string().min(8).optional(),
});

const androidSetupSchema = z.object({
  publicUrl: z.string().min(6).optional(),
  preferRemoteUrl: z.boolean().optional(),
  forceSecure: z.boolean().optional(),
});

const devicePairRequestSchema = z.object({
  requestId: z.string().min(1),
});

const usageEventSchema = z.object({
  provider: z.string().min(2),
  model: z.string().min(1),
  kind: z.enum(["llm", "tts"]),
  inputTokens: z.number().int().nonnegative().optional(),
  outputTokens: z.number().int().nonnegative().optional(),
  cacheReadTokens: z.number().int().nonnegative().optional(),
  cacheWriteTokens: z.number().int().nonnegative().optional(),
  totalTokens: z.number().int().nonnegative().optional(),
  characters: z.number().int().nonnegative().optional(),
  latencyMs: z.number().int().nonnegative().optional(),
  sessionId: z.string().min(1).optional(),
  runId: z.string().min(1).optional(),
  source: z.string().min(1).optional(),
  timestamp: z.string().min(1).optional(),
});

const usageIngestSchema = z.object({
  events: z.array(usageEventSchema).min(1).max(200),
});

const usageRangeSchema = z.enum(["24h", "7d", "30d"]);

const settingsSchema = z.object({
  onboardingComplete: z.boolean().optional(),
  whatsapp: z
    .object({
      phone: z.string().min(6).optional(),
      businessId: z.string().min(6).optional(),
      phoneNumberId: z.string().min(6).optional(),
    })
    .optional(),
  providers: z
    .object({
      groq: providerSchema.optional(),
      openrouter: providerSchema.optional(),
      openai: providerSchema.optional(),
      anthropic: providerSchema.optional(),
      xai: providerSchema.optional(),
      eleven: providerSchema.optional(),
    })
    .optional(),
  chat: z
    .object({
      provider: z.string().min(2).optional(),
      model: z.string().min(2).optional(),
    })
    .optional(),
  tts: z
    .object({
      provider: z.string().min(2).optional(),
      voice: z.string().min(1).optional(),
    })
    .optional(),
  skills: z.array(z.string()).optional(),
});

const app = express();
app.use(express.json({ limit: "1mb" }));

const db = openDatabase(DB_PATH);
initSchema(db);

app.get("/health", (_req, res) => {
  res.json({ ok: true, dbPath: DB_PATH });
});

app.post("/v1/auth/register", (req, res) => {
  const payload = registerSchema.safeParse(req.body);
  if (!payload.success) {
    res.status(400).json({ error: payload.error.message });
    return;
  }
  const { email, password, tenantName } = payload.data;

  const existing = getUserByEmail(email);
  if (existing) {
    res.status(409).json({ error: "Email already registered." });
    return;
  }

  const now = nowIso();
  const tenantId = randomId("tnt");
  const userId = randomId("usr");
  const membershipId = randomId("mem");

  try {
    db.exec("BEGIN;");
    db.prepare(
      "INSERT INTO tenants (id, name, created_at) VALUES (?, ?, ?)",
    ).run(tenantId, tenantName, now);
    db.prepare(
      "INSERT INTO users (id, email, password_hash, created_at) VALUES (?, ?, ?, ?)",
    ).run(userId, email, hashPassword(password), now);
    db.prepare(
      "INSERT INTO memberships (id, tenant_id, user_id, role, created_at) VALUES (?, ?, ?, ?, ?)",
    ).run(membershipId, tenantId, userId, "owner", now);
    db.exec("COMMIT;");
  } catch (err) {
    db.exec("ROLLBACK;");
    res.status(500).json({ error: "Failed to create account." });
    return;
  }

  const token = signToken(userId);
  res.json({
    token,
    user: { id: userId, email },
    tenant: { id: tenantId, name: tenantName, role: "owner" },
  });
});

app.post("/v1/auth/login", (req, res) => {
  const payload = loginSchema.safeParse(req.body);
  if (!payload.success) {
    res.status(400).json({ error: payload.error.message });
    return;
  }

  const { email, password } = payload.data;
  const user = getUserByEmail(email);
  if (!user || !verifyPassword(password, user.password_hash)) {
    res.status(401).json({ error: "Invalid email or password." });
    return;
  }

  const memberships = listMemberships(user.id);
  const token = signToken(user.id);
  res.json({
    token,
    user: { id: user.id, email: user.email },
    tenants: memberships.map((m) => ({ id: m.tenant_id, name: m.tenant_name, role: m.role })),
  });
});

app.get("/v1/me", requireAuth, (req, res) => {
  const user = getUserById(req.auth.uid);
  if (!user) {
    res.status(401).json({ error: "User not found." });
    return;
  }
  const memberships = listMemberships(user.id);
  res.json({
    user: { id: user.id, email: user.email },
    tenants: memberships.map((m) => ({ id: m.tenant_id, name: m.tenant_name, role: m.role })),
  });
});

app.post("/v1/tenants", requireAuth, (req, res) => {
  const payload = createTenantSchema.safeParse(req.body);
  if (!payload.success) {
    res.status(400).json({ error: payload.error.message });
    return;
  }
  const { name } = payload.data;
  const now = nowIso();
  const tenantId = randomId("tnt");
  const membershipId = randomId("mem");

  try {
    db.exec("BEGIN;");
    db.prepare(
      "INSERT INTO tenants (id, name, created_at) VALUES (?, ?, ?)",
    ).run(tenantId, name, now);
    db.prepare(
      "INSERT INTO memberships (id, tenant_id, user_id, role, created_at) VALUES (?, ?, ?, ?, ?)",
    ).run(membershipId, tenantId, req.auth.uid, "owner", now);
    db.exec("COMMIT;");
  } catch (err) {
    db.exec("ROLLBACK;");
    res.status(500).json({ error: "Failed to create tenant." });
    return;
  }

  res.json({ tenant: { id: tenantId, name, role: "owner" } });
});

app.post("/v1/tenants/:tenantId/invites", requireAuth, (req, res) => {
  const tenantId = req.params.tenantId;
  const membership = getMembership(req.auth.uid, tenantId);
  if (!membership || !hasRole(membership.role, ["owner", "manager"])) {
    res.status(403).json({ error: "Not allowed." });
    return;
  }

  const payload = inviteSchema.safeParse(req.body);
  if (!payload.success) {
    res.status(400).json({ error: payload.error.message });
    return;
  }

  if (membership.role === "manager" && payload.data.role !== "agent" && payload.data.role !== "viewer") {
    res.status(403).json({ error: "Managers can only invite agent or viewer roles." });
    return;
  }

  const inviteToken = createToken();
  const now = nowIso();
  const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const inviteId = randomId("inv");

  db.prepare(
    "INSERT INTO invites (id, tenant_id, email, role, token_hash, expires_at, created_at, accepted_at) VALUES (?, ?, ?, ?, ?, ?, ?, NULL)",
  ).run(inviteId, tenantId, payload.data.email.toLowerCase(), payload.data.role, hashToken(inviteToken), expiresAt, now);

  res.json({ inviteToken, expiresAt });
});

app.get("/v1/tenants/:tenantId/settings", requireAuth, (req, res) => {
  const tenantId = req.params.tenantId;
  const membership = getMembership(req.auth.uid, tenantId);
  if (!membership) {
    res.status(403).json({ error: "Not allowed." });
    return;
  }

  const settings = getTenantSettings(tenantId);
  res.json({ settings });
});

app.put("/v1/tenants/:tenantId/settings", requireAuth, (req, res) => {
  const tenantId = req.params.tenantId;
  const membership = getMembership(req.auth.uid, tenantId);
  if (!membership || !hasRole(membership.role, ["owner", "manager"])) {
    res.status(403).json({ error: "Not allowed." });
    return;
  }

  const payload = settingsSchema.safeParse(req.body);
  if (!payload.success) {
    res.status(400).json({ error: payload.error.message });
    return;
  }

  const existing = getTenantSettings(tenantId);
  const merged = mergeSettings(existing, payload.data);
  upsertTenantSettings(tenantId, merged);
  res.json({ settings: merged });
});

app.get("/v1/tenants/:tenantId/android/setup", requireAuth, async (req, res) => {
  const tenantId = req.params.tenantId;
  const membership = getMembership(req.auth.uid, tenantId);
  if (!membership || !hasRole(membership.role, ["owner", "manager"])) {
    res.status(403).json({ error: "Not allowed." });
    return;
  }
  await forwardGateway(res, "/v1/device-pair/setup", {
    method: "GET",
  });
});

app.post("/v1/tenants/:tenantId/android/setup", requireAuth, async (req, res) => {
  const tenantId = req.params.tenantId;
  const membership = getMembership(req.auth.uid, tenantId);
  if (!membership || !hasRole(membership.role, ["owner", "manager"])) {
    res.status(403).json({ error: "Not allowed." });
    return;
  }
  const payload = androidSetupSchema.safeParse(req.body);
  if (!payload.success) {
    res.status(400).json({ error: payload.error.message });
    return;
  }
  await forwardGateway(res, "/v1/device-pair/setup", {
    method: "POST",
    body: payload.data,
  });
});

app.get("/v1/tenants/:tenantId/android/devices", requireAuth, async (req, res) => {
  const tenantId = req.params.tenantId;
  const membership = getMembership(req.auth.uid, tenantId);
  if (!membership || !hasRole(membership.role, ["owner", "manager"])) {
    res.status(403).json({ error: "Not allowed." });
    return;
  }
  await forwardGateway(res, "/v1/device-pair", { method: "GET" });
});

app.post("/v1/tenants/:tenantId/android/devices/approve", requireAuth, async (req, res) => {
  const tenantId = req.params.tenantId;
  const membership = getMembership(req.auth.uid, tenantId);
  if (!membership || !hasRole(membership.role, ["owner", "manager"])) {
    res.status(403).json({ error: "Not allowed." });
    return;
  }
  const payload = devicePairRequestSchema.safeParse(req.body);
  if (!payload.success) {
    res.status(400).json({ error: payload.error.message });
    return;
  }
  await forwardGateway(res, "/v1/device-pair/approve", { method: "POST", body: payload.data });
});

app.post("/v1/tenants/:tenantId/android/devices/reject", requireAuth, async (req, res) => {
  const tenantId = req.params.tenantId;
  const membership = getMembership(req.auth.uid, tenantId);
  if (!membership || !hasRole(membership.role, ["owner", "manager"])) {
    res.status(403).json({ error: "Not allowed." });
    return;
  }
  const payload = devicePairRequestSchema.safeParse(req.body);
  if (!payload.success) {
    res.status(400).json({ error: payload.error.message });
    return;
  }
  await forwardGateway(res, "/v1/device-pair/reject", { method: "POST", body: payload.data });
});

app.delete("/v1/tenants/:tenantId/android/devices/:deviceId", requireAuth, async (req, res) => {
  const tenantId = req.params.tenantId;
  const membership = getMembership(req.auth.uid, tenantId);
  if (!membership || !hasRole(membership.role, ["owner", "manager"])) {
    res.status(403).json({ error: "Not allowed." });
    return;
  }
  const deviceId = req.params.deviceId;
  if (!deviceId?.trim()) {
    res.status(400).json({ error: "deviceId required." });
    return;
  }
  await forwardGateway(res, `/v1/device-pair/${encodeURIComponent(deviceId)}`, {
    method: "DELETE",
  });
});

app.post("/v1/tenants/:tenantId/usage/ingest", (req, res) => {
  if (!CONTROL_USAGE_INGEST_KEY || req.get("x-usage-key") !== CONTROL_USAGE_INGEST_KEY) {
    res.status(401).json({ error: "Invalid usage key." });
    return;
  }
  const tenantId = req.params.tenantId;
  const tenant = getTenantById(tenantId);
  if (!tenant) {
    res.status(404).json({ error: "Tenant not found." });
    return;
  }
  const payload = usageIngestSchema.safeParse(req.body);
  if (!payload.success) {
    res.status(400).json({ error: payload.error.message });
    return;
  }

  const now = nowIso();
  const insert = db.prepare(
    `INSERT INTO usage_events (
      id,
      tenant_id,
      provider,
      model,
      kind,
      input_tokens,
      output_tokens,
      cache_read_tokens,
      cache_write_tokens,
      total_tokens,
      characters,
      latency_ms,
      session_id,
      run_id,
      source,
      created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  let inserted = 0;
  try {
    db.exec("BEGIN;");
    for (const event of payload.data.events) {
      const provider = normalizeUsageProvider(event.provider);
      if (!ALLOWED_USAGE_PROVIDERS.has(provider)) {
        continue;
      }
      const model = event.model.trim() || "unknown";
      const createdAt = parseUsageTimestamp(event.timestamp) ?? now;
      insert.run(
        randomId("use"),
        tenantId,
        provider,
        model,
        event.kind,
        event.inputTokens ?? null,
        event.outputTokens ?? null,
        event.cacheReadTokens ?? null,
        event.cacheWriteTokens ?? null,
        event.totalTokens ?? null,
        event.characters ?? null,
        event.latencyMs ?? null,
        event.sessionId ?? null,
        event.runId ?? null,
        event.source ?? "gateway",
        createdAt,
      );
      inserted += 1;
    }
    db.exec("COMMIT;");
  } catch (err) {
    db.exec("ROLLBACK;");
    res.status(500).json({ error: "Failed to record usage." });
    return;
  }

  res.json({ ok: true, inserted });
});

app.get("/v1/tenants/:tenantId/usage", requireAuth, (req, res) => {
  const tenantId = req.params.tenantId;
  const membership = getMembership(req.auth.uid, tenantId);
  if (!membership) {
    res.status(403).json({ error: "Not allowed." });
    return;
  }
  const rangeValue = (req.query.range ?? "7d") as string;
  const range = usageRangeSchema.safeParse(rangeValue);
  if (!range.success) {
    res.status(400).json({ error: "Invalid range." });
    return;
  }
  const { from, to } = resolveUsageRange(range.data);

  const summaryRows = db
    .prepare(
      `SELECT
        kind,
        COUNT(*) as requests,
        SUM(COALESCE(input_tokens, 0)) as input_tokens,
        SUM(COALESCE(output_tokens, 0)) as output_tokens,
        SUM(COALESCE(cache_read_tokens, 0)) as cache_read_tokens,
        SUM(COALESCE(cache_write_tokens, 0)) as cache_write_tokens,
        SUM(COALESCE(total_tokens, 0)) as total_tokens,
        SUM(COALESCE(characters, 0)) as characters,
        AVG(COALESCE(latency_ms, 0)) as avg_latency_ms
      FROM usage_events
      WHERE tenant_id = ? AND created_at >= ?
      GROUP BY kind`,
    )
    .all(tenantId, from) as Array<{
    kind: "llm" | "tts";
    requests: number;
    input_tokens: number;
    output_tokens: number;
    cache_read_tokens: number;
    cache_write_tokens: number;
    total_tokens: number;
    characters: number;
    avg_latency_ms: number;
  }>;

  const summary = {
    llm: {
      requests: 0,
      inputTokens: 0,
      outputTokens: 0,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
      totalTokens: 0,
      avgLatencyMs: 0,
    },
    tts: {
      requests: 0,
      characters: 0,
      avgLatencyMs: 0,
    },
  };

  for (const row of summaryRows) {
    if (row.kind === "llm") {
      summary.llm = {
        requests: row.requests ?? 0,
        inputTokens: row.input_tokens ?? 0,
        outputTokens: row.output_tokens ?? 0,
        cacheReadTokens: row.cache_read_tokens ?? 0,
        cacheWriteTokens: row.cache_write_tokens ?? 0,
        totalTokens: row.total_tokens ?? 0,
        avgLatencyMs: row.avg_latency_ms ?? 0,
      };
    } else {
      summary.tts = {
        requests: row.requests ?? 0,
        characters: row.characters ?? 0,
        avgLatencyMs: row.avg_latency_ms ?? 0,
      };
    }
  }

  const breakdownRows = db
    .prepare(
      `SELECT
        provider,
        model,
        kind,
        COUNT(*) as requests,
        SUM(COALESCE(input_tokens, 0)) as input_tokens,
        SUM(COALESCE(output_tokens, 0)) as output_tokens,
        SUM(COALESCE(cache_read_tokens, 0)) as cache_read_tokens,
        SUM(COALESCE(cache_write_tokens, 0)) as cache_write_tokens,
        SUM(COALESCE(total_tokens, 0)) as total_tokens,
        SUM(COALESCE(characters, 0)) as characters
      FROM usage_events
      WHERE tenant_id = ? AND created_at >= ?
      GROUP BY provider, model, kind
      ORDER BY requests DESC`,
    )
    .all(tenantId, from) as Array<{
    provider: string;
    model: string;
    kind: "llm" | "tts";
    requests: number;
    input_tokens: number;
    output_tokens: number;
    cache_read_tokens: number;
    cache_write_tokens: number;
    total_tokens: number;
    characters: number;
  }>;

  const breakdown = {
    llm: [] as Array<{
      provider: string;
      model: string;
      requests: number;
      inputTokens: number;
      outputTokens: number;
      cacheReadTokens: number;
      cacheWriteTokens: number;
      totalTokens: number;
    }>,
    tts: [] as Array<{
      provider: string;
      model: string;
      requests: number;
      characters: number;
    }>,
  };

  for (const row of breakdownRows) {
    const provider = normalizeUsageProvider(row.provider);
    if (!ALLOWED_USAGE_PROVIDERS.has(provider)) {
      continue;
    }
    if (row.kind === "llm") {
      breakdown.llm.push({
        provider,
        model: row.model,
        requests: row.requests ?? 0,
        inputTokens: row.input_tokens ?? 0,
        outputTokens: row.output_tokens ?? 0,
        cacheReadTokens: row.cache_read_tokens ?? 0,
        cacheWriteTokens: row.cache_write_tokens ?? 0,
        totalTokens: row.total_tokens ?? 0,
      });
    } else {
      breakdown.tts.push({
        provider,
        model: row.model,
        requests: row.requests ?? 0,
        characters: row.characters ?? 0,
      });
    }
  }

  res.json({ range: range.data, from, to, summary, breakdown });
});

app.post("/v1/invites/accept", (req, res) => {
  const payload = acceptInviteSchema.safeParse(req.body);
  if (!payload.success) {
    res.status(400).json({ error: payload.error.message });
    return;
  }

  const tokenHash = hashToken(payload.data.token);
  const invite = getInviteByTokenHash(tokenHash);
  if (!invite || invite.accepted_at) {
    res.status(404).json({ error: "Invite not found." });
    return;
  }
  if (new Date(invite.expires_at).getTime() < Date.now()) {
    res.status(410).json({ error: "Invite expired." });
    return;
  }

  const email = invite.email.toLowerCase();
  let user = getUserByEmail(email);

  try {
    db.exec("BEGIN;");
    if (!user) {
      if (!payload.data.password) {
        db.exec("ROLLBACK;");
        res.status(400).json({ error: "Password required for new account." });
        return;
      }
      const userId = randomId("usr");
      db.prepare(
        "INSERT INTO users (id, email, password_hash, created_at) VALUES (?, ?, ?, ?)",
      ).run(userId, email, hashPassword(payload.data.password), nowIso());
      user = getUserById(userId);
    }

    const existingMembership = getMembership(user!.id, invite.tenant_id);
    if (!existingMembership) {
      db.prepare(
        "INSERT INTO memberships (id, tenant_id, user_id, role, created_at) VALUES (?, ?, ?, ?, ?)",
      ).run(randomId("mem"), invite.tenant_id, user!.id, invite.role, nowIso());
    }

    db.prepare("UPDATE invites SET accepted_at = ? WHERE id = ?").run(nowIso(), invite.id);
    db.exec("COMMIT;");
  } catch (err) {
    db.exec("ROLLBACK;");
    res.status(500).json({ error: "Failed to accept invite." });
    return;
  }

  const token = signToken(user!.id);
  res.json({ token, user: { id: user!.id, email: user!.email } });
});

app.get(
  "/v1/tenants/:tenantId/users",
  requireAuth,
  (req, res) => {
    const tenantId = req.params.tenantId;
    const membership = getMembership(req.auth.uid, tenantId);
    if (!membership || !hasRole(membership.role, ["owner", "manager"])) {
      res.status(403).json({ error: "Not allowed." });
      return;
    }

    const users = listTenantUsers(tenantId);
    res.json({ users });
  },
);

app.patch(
  "/v1/tenants/:tenantId/users/:userId",
  requireAuth,
  (req, res) => {
    const tenantId = req.params.tenantId;
    const targetUserId = req.params.userId;
    const membership = getMembership(req.auth.uid, tenantId);
    if (!membership || membership.role !== "owner") {
      res.status(403).json({ error: "Owner role required." });
      return;
    }

    const payload = updateRoleSchema.safeParse(req.body);
    if (!payload.success) {
      res.status(400).json({ error: payload.error.message });
      return;
    }

    if (payload.data.role !== "owner" && isLastOwner(tenantId, targetUserId)) {
      res.status(409).json({ error: "Cannot remove the last owner." });
      return;
    }

    const updated = db.prepare(
      "UPDATE memberships SET role = ? WHERE tenant_id = ? AND user_id = ?",
    ).run(payload.data.role, tenantId, targetUserId);

    if (updated.changes === 0) {
      res.status(404).json({ error: "Membership not found." });
      return;
    }

    res.json({ ok: true });
  },
);

app.delete(
  "/v1/tenants/:tenantId/users/:userId",
  requireAuth,
  (req, res) => {
    const tenantId = req.params.tenantId;
    const targetUserId = req.params.userId;
    const membership = getMembership(req.auth.uid, tenantId);
    if (!membership || membership.role !== "owner") {
      res.status(403).json({ error: "Owner role required." });
      return;
    }

    if (isLastOwner(tenantId, targetUserId)) {
      res.status(409).json({ error: "Cannot remove the last owner." });
      return;
    }

    const result = db.prepare(
      "DELETE FROM memberships WHERE tenant_id = ? AND user_id = ?",
    ).run(tenantId, targetUserId);

    if (result.changes === 0) {
      res.status(404).json({ error: "Membership not found." });
      return;
    }

    res.json({ ok: true });
  },
);

app.post("/v1/admin/tenants", (req, res) => {
  if (!ADMIN_KEY || req.get("x-admin-key") !== ADMIN_KEY) {
    res.status(401).json({ error: "Admin key required." });
    return;
  }
  const payload = createTenantSchema.safeParse(req.body);
  if (!payload.success) {
    res.status(400).json({ error: payload.error.message });
    return;
  }
  const now = nowIso();
  const tenantId = randomId("tnt");
  db.prepare(
    "INSERT INTO tenants (id, name, created_at) VALUES (?, ?, ?)",
  ).run(tenantId, payload.data.name, now);
  res.json({ tenant: { id: tenantId, name: payload.data.name } });
});

app.listen(PORT, () => {
  console.log(`control-api listening on :${PORT}`);
});

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
    CREATE TABLE IF NOT EXISTS tenants (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS memberships (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role TEXT NOT NULL,
      created_at TEXT NOT NULL,
      UNIQUE(tenant_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS invites (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      email TEXT NOT NULL,
      role TEXT NOT NULL,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      accepted_at TEXT
    );

    CREATE TABLE IF NOT EXISTS tenant_settings (
      tenant_id TEXT PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
      data TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS usage_events (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      provider TEXT NOT NULL,
      model TEXT NOT NULL,
      kind TEXT NOT NULL,
      input_tokens INTEGER,
      output_tokens INTEGER,
      cache_read_tokens INTEGER,
      cache_write_tokens INTEGER,
      total_tokens INTEGER,
      characters INTEGER,
      latency_ms INTEGER,
      session_id TEXT,
      run_id TEXT,
      source TEXT,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_usage_events_tenant_created
      ON usage_events(tenant_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_usage_events_tenant_kind
      ON usage_events(tenant_id, kind);
  `);
}

function nowIso(): string {
  return new Date().toISOString();
}

function resolveUsageRange(range: z.infer<typeof usageRangeSchema>): { from: string; to: string } {
  const now = new Date();
  const hours = range === "24h" ? 24 : range === "7d" ? 24 * 7 : 24 * 30;
  const from = new Date(now.getTime() - hours * 60 * 60 * 1000);
  return { from: from.toISOString(), to: now.toISOString() };
}

function randomId(prefix: string): string {
  return `${prefix}_${crypto.randomBytes(10).toString("hex")}`;
}

function createToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}.${hash}`;
}

function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(".");
  if (!salt || !hash) {
    return false;
  }
  const candidate = crypto.scryptSync(password, salt, 64).toString("hex");
  return safeEqual(candidate, hash);
}

function safeEqual(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) {
    return false;
  }
  return crypto.timingSafeEqual(aBuf, bBuf);
}

function signToken(userId: string): string {
  return jwt.sign({ typ: "control", uid: userId }, jwtSecret, { expiresIn: `${JWT_TTL_DAYS}d` });
}

function getTenantSettings(tenantId: string): Record<string, unknown> {
  const row = db.prepare(
    "SELECT data FROM tenant_settings WHERE tenant_id = ?",
  ).get(tenantId) as { data: string } | undefined;
  if (!row?.data) {
    return {};
  }
  try {
    return JSON.parse(row.data) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function upsertTenantSettings(tenantId: string, data: Record<string, unknown>) {
  db.prepare(
    `INSERT INTO tenant_settings (tenant_id, data, updated_at)
     VALUES (?, ?, ?)
     ON CONFLICT(tenant_id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`,
  ).run(tenantId, JSON.stringify(data ?? {}), nowIso());
}

function mergeSettings<T>(base: T, patch: Partial<T>): T {
  if (patch === null || typeof patch !== "object" || Array.isArray(patch)) {
    return patch as T;
  }
  const baseObj =
    base && typeof base === "object" && !Array.isArray(base)
      ? (base as Record<string, unknown>)
      : {};
  const result: Record<string, unknown> = { ...baseObj };
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) {
      continue;
    }
    if (value && typeof value === "object" && !Array.isArray(value)) {
      result[key] = mergeSettings(baseObj[key], value as Record<string, unknown>);
    } else {
      result[key] = value;
    }
  }
  return result as T;
}

async function forwardGateway(
  res: express.Response,
  upstreamPath: string,
  opts: { method?: string; body?: Record<string, unknown> },
) {
  if (!CONTROL_GATEWAY_URL) {
    res.status(500).json({ error: "CONTROL_GATEWAY_URL not set." });
    return;
  }
  try {
    const headers: Record<string, string> = { Accept: "application/json" };
    if (CONTROL_GATEWAY_TOKEN) {
      headers.Authorization = `Bearer ${CONTROL_GATEWAY_TOKEN}`;
    }
    if (opts.body && (opts.method ?? "GET") !== "GET") {
      headers["Content-Type"] = "application/json";
    }
    const response = await fetch(`${CONTROL_GATEWAY_URL}${upstreamPath}`, {
      method: opts.method ?? "GET",
      headers,
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
    const payload = await response.json().catch(() => ({}));
    res.status(response.status).json(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upstream request failed.";
    res.status(502).json({ error: message });
  }
}

function requireAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  const header = req.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) {
    res.status(401).json({ error: "Missing bearer token." });
    return;
  }
  try {
    const decoded = jwt.verify(token, jwtSecret) as AuthClaims;
    if (!decoded || decoded.typ !== "control" || !decoded.uid) {
      res.status(401).json({ error: "Invalid token." });
      return;
    }
    (req as typeof req & { auth: AuthClaims }).auth = decoded;
    next();
  } catch (err) {
    res.status(401).json({ error: "Invalid token." });
  }
}

function hasRole(role: Role, allowed: Role[]): boolean {
  return allowed.includes(role);
}

function getUserByEmail(email: string): UserRow | undefined {
  return db.prepare("SELECT * FROM users WHERE email = ?").get(email.toLowerCase()) as
    | UserRow
    | undefined;
}

function getUserById(userId: string): UserRow | undefined {
  return db.prepare("SELECT * FROM users WHERE id = ?").get(userId) as UserRow | undefined;
}

function getTenantById(tenantId: string): TenantRow | undefined {
  return db.prepare("SELECT * FROM tenants WHERE id = ?").get(tenantId) as TenantRow | undefined;
}

function getMembership(userId: string, tenantId: string): MembershipRow | undefined {
  return db
    .prepare("SELECT * FROM memberships WHERE tenant_id = ? AND user_id = ?")
    .get(tenantId, userId) as MembershipRow | undefined;
}

function normalizeUsageProvider(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (normalized === "x.ai" || normalized === "x-ai") {
    return "xai";
  }
  if (normalized === "openai-codex") {
    return "openai";
  }
  if (normalized === "eleven") {
    return "elevenlabs";
  }
  return normalized;
}

function parseUsageTimestamp(value?: string): string | undefined {
  if (!value) {
    return undefined;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return undefined;
  }
  return parsed.toISOString();
}

function isLastOwner(tenantId: string, userId: string): boolean {
  const owners = db
    .prepare("SELECT COUNT(*) as count FROM memberships WHERE tenant_id = ? AND role = 'owner'")
    .get(tenantId) as { count: number } | undefined;
  const isOwner = db
    .prepare("SELECT 1 as exists FROM memberships WHERE tenant_id = ? AND user_id = ? AND role = 'owner'")
    .get(tenantId, userId) as { exists: number } | undefined;
  return Boolean(isOwner?.exists) && (owners?.count ?? 0) <= 1;
}

function listMemberships(userId: string): Array<{ tenant_id: string; tenant_name: string; role: Role }> {
  return db
    .prepare(
      "SELECT memberships.tenant_id as tenant_id, tenants.name as tenant_name, memberships.role as role FROM memberships JOIN tenants ON tenants.id = memberships.tenant_id WHERE memberships.user_id = ? ORDER BY tenants.name",
    )
    .all(userId) as Array<{ tenant_id: string; tenant_name: string; role: Role }>;
}

function listTenantUsers(tenantId: string): Array<{ id: string; email: string; role: Role }> {
  return db
    .prepare(
      "SELECT users.id as id, users.email as email, memberships.role as role FROM memberships JOIN users ON users.id = memberships.user_id WHERE memberships.tenant_id = ? ORDER BY users.email",
    )
    .all(tenantId) as Array<{ id: string; email: string; role: Role }>;
}

function getInviteByTokenHash(tokenHash: string): InviteRow | undefined {
  return db
    .prepare("SELECT * FROM invites WHERE token_hash = ?")
    .get(tokenHash) as InviteRow | undefined;
}

declare global {
  namespace Express {
    interface Request {
      auth: AuthClaims;
    }
  }
}
