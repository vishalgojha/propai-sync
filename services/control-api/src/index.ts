import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import express from "express";
import jwt, { type JwtPayload } from "jsonwebtoken";
import { z } from "zod";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const PORT = Number(process.env.PORT ?? "8788");
const DB_PATH =
  process.env.CONTROL_DB_PATH?.trim() || path.join(process.cwd(), ".data", "control.sqlite");
const ADMIN_KEY = process.env.CONTROL_ADMIN_KEY ?? "";
const SUPABASE_URL = process.env.SUPABASE_URL ?? "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const SUPABASE_ENABLED = Boolean(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY);
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
const TOOL_WEBHOOK_SECRET = process.env.TOOL_WEBHOOK_SECRET ?? "";
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
const WHATSAPP_ONBOARDING_STEP_VALUES = ["ownerName", "businessName", "city", "email", "businessType", "done"] as const;
type WhatsAppOnboardingStep = (typeof WHATSAPP_ONBOARDING_STEP_VALUES)[number];
const ALLOWED_USAGE_PROVIDERS = new Set(["openai", "anthropic", "xai", "elevenlabs"]);

type WorkspaceProfile = {
  ownerName?: string;
  businessName?: string;
  city?: string;
  email?: string;
  businessType?: string;
  phone?: string;
};

type WhatsAppOnboardingState = {
  status?: "active" | "complete";
  step?: WhatsAppOnboardingStep;
  startedAt?: string;
  updatedAt?: string;
  completedAt?: string;
  emailSkipped?: boolean;
  source?: string;
};

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

const bootstrapSchema = z.object({
  email: z.string().email(),
  tenantName: z.string().min(2),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

const passwordUpdateSchema = z.object({
  password: z.string().min(8),
});

const whatsappJoinSchema = z.object({
  phone: z.string().min(6),
  name: z.string().min(1).optional(),
  tenantName: z.string().min(2).optional(),
  email: z.string().email().optional(),
});

const whatsappOnboardingMessageSchema = z.object({
  phone: z.string().min(6),
  text: z.string().min(1),
  name: z.string().min(1).optional(),
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
const webhookConversationSchema = z.object({
  phone: z.string().min(6),
  role: z.string().min(2).optional(),
  message: z.string().min(1),
  sender: z.string().min(1).optional(),
  timestamp: z.string().min(1).optional(),
});
const webhookLeadSchema = z.object({
  phone: z.string().min(6),
  name: z.string().min(1).optional(),
  role: z.string().min(2).optional(),
  metadata: z.record(z.unknown()).optional(),
});
const webhookListingSchema = z.object({
  phone: z.string().min(6),
  name: z.string().min(1).optional(),
  role: z.string().min(2).optional(),
  listing: z.record(z.unknown()),
});

const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504]);
const RETRY_POLICY = { initialMs: 500, maxMs: 8000, factor: 2, jitter: 0.2, maxRetries: 3 };

const supabase: SupabaseClient | null = SUPABASE_ENABLED
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  : null;

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
      `[control-api] uncaught exception (process kept alive): ${
        err instanceof Error ? err.stack ?? err.message : String(err)
      }`,
    );
  });
  process.on("unhandledRejection", (reason) => {
    console.error(
      `[control-api] unhandled rejection (process kept alive): ${
        reason instanceof Error ? reason.stack ?? reason.message : String(reason)
      }`,
    );
  });
}

const workspaceProfileSchema = z.object({
  ownerName: z.string().min(1).optional(),
  businessName: z.string().min(2).optional(),
  city: z.string().min(2).optional(),
  email: z.string().email().optional(),
  businessType: z.string().min(2).optional(),
  phone: z.string().min(6).optional(),
});

const whatsappOnboardingStateSchema = z.object({
  status: z.enum(["active", "complete"]).optional(),
  step: z.enum(WHATSAPP_ONBOARDING_STEP_VALUES).optional(),
  startedAt: z.string().min(1).optional(),
  updatedAt: z.string().min(1).optional(),
  completedAt: z.string().min(1).optional(),
  emailSkipped: z.boolean().optional(),
  source: z.string().min(1).optional(),
});

const settingsSchema = z.object({
  onboardingComplete: z.boolean().optional(),
  workspaceProfile: workspaceProfileSchema.optional(),
  whatsappOnboarding: whatsappOnboardingStateSchema.optional(),
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
registerGlobalErrorHandlers();

const db = openDatabase(DB_PATH);
initSchema(db);
if (SUPABASE_ENABLED) {
  console.log("[control-api] storage: supabase");
}

const CONTROL_UI_URL = (process.env.CONTROL_UI_URL || process.env.APP_URL || "https://app.propai.live").replace(
  /\/+$/,
  "",
);

// Health payload exposes runtime storage mode so hosted deploys are easy to verify.
app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    storageMode: SUPABASE_ENABLED ? "supabase" : "sqlite",
    supabaseConfigured: SUPABASE_ENABLED,
    supabaseUrlConfigured: Boolean(SUPABASE_URL),
    supabaseServiceRoleKeyConfigured: Boolean(SUPABASE_SERVICE_ROLE_KEY),
    dbPath: DB_PATH,
    gatewayUrlConfigured: Boolean(CONTROL_GATEWAY_URL),
    gatewayTokenConfigured: Boolean(CONTROL_GATEWAY_TOKEN),
  });
});

app.post("/save-conversation", requireToolWebhookSecret, async (req, res) => {
  const payload = webhookConversationSchema.safeParse(req.body);
  if (!payload.success) {
    res.status(400).json({ error: payload.error.message });
    return;
  }
  const phone = normalizeWhatsAppPhone(payload.data.phone);
  if (!phone) {
    res.status(400).json({ error: "Invalid phone." });
    return;
  }
  try {
    await insertConversationLog({
      phone,
      role: normalizeContactRole(payload.data.role),
      message: payload.data.message.trim(),
      sender: payload.data.sender?.trim() || "assistant",
      timestamp: payload.data.timestamp?.trim() || nowIso(),
    });
    res.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to store conversation.";
    res.status(500).json({ error: message });
  }
});

app.post("/save-lead", requireToolWebhookSecret, async (req, res) => {
  const payload = webhookLeadSchema.safeParse(req.body);
  if (!payload.success) {
    res.status(400).json({ error: payload.error.message });
    return;
  }
  const phone = normalizeWhatsAppPhone(payload.data.phone);
  if (!phone) {
    res.status(400).json({ error: "Invalid phone." });
    return;
  }
  try {
    const existing = await getContactByPhone(phone);
    const nextMetadata = {
      ...(existing?.metadata ?? {}),
      ...(payload.data.metadata ?? {}),
    };
    const upserted = await upsertContact({
      phone,
      name: payload.data.name?.trim() || existing?.name || "Lead",
      role: normalizeContactRole(payload.data.role ?? existing?.role),
      metadata: nextMetadata,
    });
    res.json({ ok: true, contact: upserted });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to save lead.";
    res.status(500).json({ error: message });
  }
});

app.post("/save-listing", requireToolWebhookSecret, async (req, res) => {
  const payload = webhookListingSchema.safeParse(req.body);
  if (!payload.success) {
    res.status(400).json({ error: payload.error.message });
    return;
  }
  const phone = normalizeWhatsAppPhone(payload.data.phone);
  if (!phone) {
    res.status(400).json({ error: "Invalid phone." });
    return;
  }
  try {
    const existing = await getContactByPhone(phone);
    const existingMetadata = existing?.metadata ?? {};
    const listings = Array.isArray(existingMetadata.listings) ? existingMetadata.listings : [];
    const nextMetadata = {
      ...existingMetadata,
      listings: [...listings, payload.data.listing],
    };
    const upserted = await upsertContact({
      phone,
      name: payload.data.name?.trim() || existing?.name || "Broker",
      role: normalizeContactRole(payload.data.role ?? existing?.role ?? "broker"),
      metadata: nextMetadata,
    });
    res.json({ ok: true, contact: upserted });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to save listing.";
    res.status(500).json({ error: message });
  }
});

app.post("/v1/auth/register", async (req, res) => {
  const payload = registerSchema.safeParse(req.body);
  if (!payload.success) {
    res.status(400).json({ error: payload.error.message });
    return;
  }
  const { email, password, tenantName } = payload.data;

  let existing: UserRow | undefined;
  try {
    existing = await getUserByEmail(email);
  } catch (err) {
    res.status(500).json({ error: "Failed to load account." });
    return;
  }
  if (existing) {
    res.status(409).json({ error: "Email already registered." });
    return;
  }

  const now = nowIso();
  const tenantId = randomId("tnt");
  const userId = randomId("usr");
  const membershipId = randomId("mem");

  try {
    if (!SUPABASE_ENABLED) {
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
    } else {
      await insertTenantRow({ id: tenantId, name: tenantName, created_at: now });
      await insertUserRow({ id: userId, email, password_hash: hashPassword(password), created_at: now });
      await insertMembershipRow({
        id: membershipId,
        tenant_id: tenantId,
        user_id: userId,
        role: "owner",
        created_at: now,
      });
    }
  } catch (err) {
    if (!SUPABASE_ENABLED) {
      db.exec("ROLLBACK;");
    } else {
      try {
        await deleteMembershipRow(tenantId, userId);
        await deleteUserRow(userId);
        await deleteTenantRow(tenantId);
      } catch {
        // best-effort cleanup
      }
    }
    res.status(500).json({ error: "Failed to create account." });
    return;
  }

  const token = signToken(userId);
  res.json({
    token,
    user: await buildControlUserPayload({ id: userId, email, password_hash: "", created_at: now }),
    tenant: { id: tenantId, name: tenantName, role: "owner" },
  });
});

app.post("/v1/auth/bootstrap", async (req, res) => {
  const payload = bootstrapSchema.safeParse(req.body);
  if (!payload.success) {
    res.status(400).json({ error: payload.error.message });
    return;
  }

  try {
    if ((await countUsers()) > 0) {
      res.status(409).json({ error: "Bootstrap closed. Sign in instead." });
      return;
    }
  } catch (err) {
    res.status(500).json({ error: "Failed to check bootstrap state." });
    return;
  }

  const { email, tenantName } = payload.data;
  let existing: UserRow | undefined;
  try {
    existing = await getUserByEmail(email);
  } catch (err) {
    res.status(500).json({ error: "Failed to load account." });
    return;
  }
  if (existing) {
    res.status(409).json({ error: "Email already registered." });
    return;
  }

  const now = nowIso();
  const tenantId = randomId("tnt");
  const userId = randomId("usr");
  const membershipId = randomId("mem");
  const tempPassword = `${createToken()}${createToken()}`;

  try {
    if (!SUPABASE_ENABLED) {
      db.exec("BEGIN;");
      db.prepare(
        "INSERT INTO tenants (id, name, created_at) VALUES (?, ?, ?)",
      ).run(tenantId, tenantName, now);
      db.prepare(
        "INSERT INTO users (id, email, password_hash, created_at) VALUES (?, ?, ?, ?)",
      ).run(userId, email, hashPassword(tempPassword), now);
      db.prepare(
        "INSERT INTO memberships (id, tenant_id, user_id, role, created_at) VALUES (?, ?, ?, ?, ?)",
      ).run(membershipId, tenantId, userId, "owner", now);
      db.exec("COMMIT;");
    } else {
      await insertTenantRow({ id: tenantId, name: tenantName, created_at: now });
      await insertUserRow({ id: userId, email, password_hash: hashPassword(tempPassword), created_at: now });
      await insertMembershipRow({
        id: membershipId,
        tenant_id: tenantId,
        user_id: userId,
        role: "owner",
        created_at: now,
      });
    }
  } catch (err) {
    if (!SUPABASE_ENABLED) {
      db.exec("ROLLBACK;");
    } else {
      try {
        await deleteMembershipRow(tenantId, userId);
        await deleteUserRow(userId);
        await deleteTenantRow(tenantId);
      } catch {
        // best-effort cleanup
      }
    }
    res.status(500).json({ error: "Failed to create account." });
    return;
  }

  const token = signToken(userId);
  res.json({
    token,
    user: await buildControlUserPayload({ id: userId, email, password_hash: "", created_at: now }),
    tenant: { id: tenantId, name: tenantName, role: "owner" },
    bootstrap: true,
  });
});

app.post("/v1/auth/login", async (req, res) => {
  const payload = loginSchema.safeParse(req.body);
  if (!payload.success) {
    res.status(400).json({ error: payload.error.message });
    return;
  }

  const { email, password } = payload.data;
  let user: UserRow | undefined;
  try {
    user = await getUserByEmail(email);
  } catch (err) {
    res.status(500).json({ error: "Failed to load account." });
    return;
  }
  if (!user || !verifyPassword(password, user.password_hash)) {
    res.status(401).json({ error: "Invalid email or password." });
    return;
  }

  let memberships: Array<{ tenant_id: string; tenant_name: string; role: Role }> = [];
  try {
    memberships = await listMemberships(user.id);
  } catch (err) {
    res.status(500).json({ error: "Failed to load memberships." });
    return;
  }
  const token = signToken(user.id);
  res.json({
    token,
    user: await buildControlUserPayload(user),
    tenants: memberships.map((m) => ({ id: m.tenant_id, name: m.tenant_name, role: m.role })),
  });
});

app.post("/v1/auth/password", requireAuth, async (req, res) => {
  const payload = passwordUpdateSchema.safeParse(req.body);
  if (!payload.success) {
    res.status(400).json({ error: payload.error.message });
    return;
  }
  try {
    await updateUserPassword(req.auth.uid, hashPassword(payload.data.password));
  } catch (err) {
    res.status(500).json({ error: "Failed to update password." });
    return;
  }
  res.json({ ok: true });
});

app.post("/v1/whatsapp/join", async (req, res) => {
  const payload = whatsappJoinSchema.safeParse(req.body);
  if (!payload.success) {
    res.status(400).json({ error: payload.error.message });
    return;
  }

  const phone = normalizeWhatsAppPhone(payload.data.phone);
  if (!phone) {
    res.status(400).json({ error: "Phone required." });
    return;
  }

  const requestedEmail = payload.data.email?.trim().toLowerCase();
  if (requestedEmail) {
    let existingEmailUser: UserRow | undefined;
    try {
      existingEmailUser = await getUserByEmail(requestedEmail);
    } catch (err) {
      res.status(500).json({ error: "Failed to check backup email." });
      return;
    }
    if (existingEmailUser) {
      res.status(409).json({ error: "Email already registered. Use WhatsApp sign-in or another backup email." });
      return;
    }
  }

  let existingIdentity: { phone: string; user_id: string; tenant_id: string } | undefined;
  try {
    existingIdentity = await getWhatsappIdentity(phone);
  } catch (err) {
    res.status(500).json({ error: "Failed to check WhatsApp identity." });
    return;
  }
  if (existingIdentity) {
    let user: UserRow | undefined;
    let tenant: TenantRow | undefined;
    try {
      user = await getUserById(existingIdentity.user_id);
      tenant = await getTenantById(existingIdentity.tenant_id);
    } catch (err) {
      res.status(500).json({ error: "Failed to load existing account." });
      return;
    }
    if (user && tenant) {
      const token = signToken(user.id);
      res.json({
        token,
        loginUrl: buildControlLoginUrl(token, tenant.id),
        user: await buildControlUserPayload(user),
        tenant: { id: tenant.id, name: tenant.name, role: "owner" },
        existing: true,
      });
      return;
    }
  }

  const now = nowIso();
  const tenantId = randomId("tnt");
  const userId = randomId("usr");
  const membershipId = randomId("mem");
  const tenantName =
    payload.data.tenantName?.trim() ||
    payload.data.name?.trim() ||
    `Broker ${phone.replace(/\D/g, "").slice(-4)}`;
  const email = requestedEmail || phoneToEmail(phone);
  const tempPassword = `${createToken()}${createToken()}`;

  try {
    if (!SUPABASE_ENABLED) {
      db.exec("BEGIN;");
      db.prepare(
        "INSERT INTO tenants (id, name, created_at) VALUES (?, ?, ?)",
      ).run(tenantId, tenantName, now);
      db.prepare(
        "INSERT INTO users (id, email, password_hash, created_at) VALUES (?, ?, ?, ?)",
      ).run(userId, email, hashPassword(tempPassword), now);
      db.prepare(
        "INSERT INTO memberships (id, tenant_id, user_id, role, created_at) VALUES (?, ?, ?, ?, ?)",
      ).run(membershipId, tenantId, userId, "owner", now);
      db.prepare(
        "INSERT INTO whatsapp_identities (phone, user_id, tenant_id, created_at) VALUES (?, ?, ?, ?)",
      ).run(phone, userId, tenantId, now);
      db.exec("COMMIT;");
    } else {
      await insertTenantRow({ id: tenantId, name: tenantName, created_at: now });
      await insertUserRow({ id: userId, email, password_hash: hashPassword(tempPassword), created_at: now });
      await insertMembershipRow({
        id: membershipId,
        tenant_id: tenantId,
        user_id: userId,
        role: "owner",
        created_at: now,
      });
      await insertWhatsappIdentityRow(phone, userId, tenantId, now);
    }
  } catch (err) {
    if (!SUPABASE_ENABLED) {
      db.exec("ROLLBACK;");
    } else {
      try {
        await deleteMembershipRow(tenantId, userId);
        await deleteUserRow(userId);
        await deleteTenantRow(tenantId);
      } catch {
        // best-effort cleanup
      }
    }
    res.status(500).json({ error: "Failed to create WhatsApp account." });
    return;
  }

  const token = signToken(userId);
  res.json({
    token,
    loginUrl: buildControlLoginUrl(token, tenantId),
    user: await buildControlUserPayload({ id: userId, email, password_hash: "", created_at: now }),
    tenant: { id: tenantId, name: tenantName, role: "owner" },
    existing: false,
  });
});

app.post("/v1/whatsapp/onboarding/message", async (req, res) => {
  const payload = whatsappOnboardingMessageSchema.safeParse(req.body);
  if (!payload.success) {
    res.status(400).json({ error: payload.error.message });
    return;
  }

  const phone = normalizeWhatsAppPhone(payload.data.phone);
  if (!phone) {
    res.status(400).json({ error: "Phone required." });
    return;
  }

  const text = payload.data.text.trim();
  try {
    const result = await handleWhatsAppOnboardingMessage({
      phone,
      text,
      senderName: payload.data.name?.trim() || undefined,
    });
    res.json(result);
  } catch (error) {
    console.error(
      `[control-api] whatsapp onboarding failed: ${error instanceof Error ? error.stack ?? error.message : String(error)}`
    );
    res.status(500).json({
      handled: isWhatsAppOnboardingTrigger(text),
      reply: "We hit a setup hiccup. Please send join again in a minute.",
    });
  }
});

app.get("/v1/me", requireAuth, async (req, res) => {
  let user: UserRow | undefined;
  try {
    user = await getUserById(req.auth.uid);
  } catch (err) {
    res.status(500).json({ error: "Failed to load user." });
    return;
  }
  if (!user) {
    res.status(401).json({ error: "User not found." });
    return;
  }
  let memberships: Array<{ tenant_id: string; tenant_name: string; role: Role }> = [];
  try {
    memberships = await listMemberships(user.id);
  } catch (err) {
    res.status(500).json({ error: "Failed to load memberships." });
    return;
  }
  res.json({
    user: await buildControlUserPayload(user),
    tenants: memberships.map((m) => ({ id: m.tenant_id, name: m.tenant_name, role: m.role })),
  });
});

app.post("/v1/tenants", requireAuth, async (req, res) => {
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
    if (!SUPABASE_ENABLED) {
      db.exec("BEGIN;");
      db.prepare(
        "INSERT INTO tenants (id, name, created_at) VALUES (?, ?, ?)",
      ).run(tenantId, name, now);
      db.prepare(
        "INSERT INTO memberships (id, tenant_id, user_id, role, created_at) VALUES (?, ?, ?, ?, ?)",
      ).run(membershipId, tenantId, req.auth.uid, "owner", now);
      db.exec("COMMIT;");
    } else {
      await insertTenantRow({ id: tenantId, name, created_at: now });
      await insertMembershipRow({
        id: membershipId,
        tenant_id: tenantId,
        user_id: req.auth.uid,
        role: "owner",
        created_at: now,
      });
    }
  } catch (err) {
    if (!SUPABASE_ENABLED) {
      db.exec("ROLLBACK;");
    } else {
      try {
        await deleteMembershipRow(tenantId, req.auth.uid);
        await deleteTenantRow(tenantId);
      } catch {
        // best-effort cleanup
      }
    }
    res.status(500).json({ error: "Failed to create tenant." });
    return;
  }

  res.json({ tenant: { id: tenantId, name, role: "owner" } });
});

app.post("/v1/tenants/:tenantId/invites", requireAuth, async (req, res) => {
  const tenantId = req.params.tenantId;
  let membership: MembershipRow | undefined;
  try {
    membership = await getMembership(req.auth.uid, tenantId);
  } catch (err) {
    res.status(500).json({ error: "Failed to load membership." });
    return;
  }
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

  try {
    await insertInviteRow({
      id: inviteId,
      tenant_id: tenantId,
      email: payload.data.email.toLowerCase(),
      role: payload.data.role,
      token_hash: hashToken(inviteToken),
      expires_at: expiresAt,
      created_at: now,
      accepted_at: null,
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to create invite." });
    return;
  }

  res.json({ inviteToken, expiresAt });
});

app.get("/v1/tenants/:tenantId/settings", requireAuth, async (req, res) => {
  const tenantId = req.params.tenantId;
  let membership: MembershipRow | undefined;
  try {
    membership = await getMembership(req.auth.uid, tenantId);
  } catch (err) {
    res.status(500).json({ error: "Failed to load membership." });
    return;
  }
  if (!membership) {
    res.status(403).json({ error: "Not allowed." });
    return;
  }

  let settings: Record<string, unknown> = {};
  try {
    settings = await getTenantSettings(tenantId);
  } catch (err) {
    res.status(500).json({ error: "Failed to load settings." });
    return;
  }
  res.json({ settings });
});

app.put("/v1/tenants/:tenantId/settings", requireAuth, async (req, res) => {
  const tenantId = req.params.tenantId;
  let membership: MembershipRow | undefined;
  try {
    membership = await getMembership(req.auth.uid, tenantId);
  } catch (err) {
    res.status(500).json({ error: "Failed to load membership." });
    return;
  }
  if (!membership || !hasRole(membership.role, ["owner", "manager"])) {
    res.status(403).json({ error: "Not allowed." });
    return;
  }

  const payload = settingsSchema.safeParse(req.body);
  if (!payload.success) {
    res.status(400).json({ error: payload.error.message });
    return;
  }

  let existing: Record<string, unknown> = {};
  try {
    existing = await getTenantSettings(tenantId);
  } catch (err) {
    res.status(500).json({ error: "Failed to load settings." });
    return;
  }
  const merged = mergeSettings(existing, payload.data);
  try {
    await upsertTenantSettings(tenantId, merged);
  } catch (err) {
    res.status(500).json({ error: "Failed to save settings." });
    return;
  }
  res.json({ settings: merged });
});

app.get("/v1/tenants/:tenantId/android/setup", requireAuth, async (req, res) => {
  const tenantId = req.params.tenantId;
  let membership: MembershipRow | undefined;
  try {
    membership = await getMembership(req.auth.uid, tenantId);
  } catch (err) {
    res.status(500).json({ error: "Failed to load membership." });
    return;
  }
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
  let membership: MembershipRow | undefined;
  try {
    membership = await getMembership(req.auth.uid, tenantId);
  } catch (err) {
    res.status(500).json({ error: "Failed to load membership." });
    return;
  }
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
  let membership: MembershipRow | undefined;
  try {
    membership = await getMembership(req.auth.uid, tenantId);
  } catch (err) {
    res.status(500).json({ error: "Failed to load membership." });
    return;
  }
  if (!membership || !hasRole(membership.role, ["owner", "manager"])) {
    res.status(403).json({ error: "Not allowed." });
    return;
  }
  await forwardGateway(res, "/v1/device-pair", { method: "GET" });
});

app.post("/v1/tenants/:tenantId/android/devices/approve", requireAuth, async (req, res) => {
  const tenantId = req.params.tenantId;
  let membership: MembershipRow | undefined;
  try {
    membership = await getMembership(req.auth.uid, tenantId);
  } catch (err) {
    res.status(500).json({ error: "Failed to load membership." });
    return;
  }
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
  let membership: MembershipRow | undefined;
  try {
    membership = await getMembership(req.auth.uid, tenantId);
  } catch (err) {
    res.status(500).json({ error: "Failed to load membership." });
    return;
  }
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
  let membership: MembershipRow | undefined;
  try {
    membership = await getMembership(req.auth.uid, tenantId);
  } catch (err) {
    res.status(500).json({ error: "Failed to load membership." });
    return;
  }
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

app.post("/v1/tenants/:tenantId/usage/ingest", async (req, res) => {
  if (!CONTROL_USAGE_INGEST_KEY || req.get("x-usage-key") !== CONTROL_USAGE_INGEST_KEY) {
    res.status(401).json({ error: "Invalid usage key." });
    return;
  }
  const tenantId = req.params.tenantId;
  let tenant: TenantRow | undefined;
  try {
    tenant = await getTenantById(tenantId);
  } catch (err) {
    res.status(500).json({ error: "Failed to load tenant." });
    return;
  }
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
  let inserted = 0;
  if (!SUPABASE_ENABLED) {
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
  } else if (supabase) {
    const rows = payload.data.events
      .map((event) => {
        const provider = normalizeUsageProvider(event.provider);
        if (!ALLOWED_USAGE_PROVIDERS.has(provider)) {
          return null;
        }
        const model = event.model.trim() || "unknown";
        const createdAt = parseUsageTimestamp(event.timestamp) ?? now;
        return {
          id: randomId("use"),
          tenant_id: tenantId,
          provider,
          model,
          kind: event.kind,
          input_tokens: event.inputTokens ?? null,
          output_tokens: event.outputTokens ?? null,
          cache_read_tokens: event.cacheReadTokens ?? null,
          cache_write_tokens: event.cacheWriteTokens ?? null,
          total_tokens: event.totalTokens ?? null,
          characters: event.characters ?? null,
          latency_ms: event.latencyMs ?? null,
          session_id: event.sessionId ?? null,
          run_id: event.runId ?? null,
          source: event.source ?? "gateway",
          created_at: createdAt,
        };
      })
      .filter(Boolean) as Array<Record<string, unknown>>;
    if (rows.length) {
      const { error } = await supabase.from("usage_events").insert(rows);
      if (error) {
        res.status(500).json({ error: "Failed to record usage." });
        return;
      }
      inserted = rows.length;
    }
  }

  res.json({ ok: true, inserted });
});

app.get("/v1/tenants/:tenantId/usage", requireAuth, async (req, res) => {
  const tenantId = req.params.tenantId;
  let membership: MembershipRow | undefined;
  try {
    membership = await getMembership(req.auth.uid, tenantId);
  } catch (err) {
    res.status(500).json({ error: "Failed to load membership." });
    return;
  }
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

  if (!SUPABASE_ENABLED) {
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
  } else if (supabase) {
    const { data, error } = await supabase
      .from("usage_events")
      .select(
        "provider,model,kind,input_tokens,output_tokens,cache_read_tokens,cache_write_tokens,total_tokens,characters,latency_ms",
      )
      .eq("tenant_id", tenantId)
      .gte("created_at", from)
      .lte("created_at", to);
    if (error) {
      res.status(500).json({ error: "Failed to load usage." });
      return;
    }
    const summaryLatency = { llm: 0, tts: 0 };
    const breakdownMap = new Map<string, {
      provider: string;
      model: string;
      kind: "llm" | "tts";
      requests: number;
      inputTokens: number;
      outputTokens: number;
      cacheReadTokens: number;
      cacheWriteTokens: number;
      totalTokens: number;
      characters: number;
    }>();
    for (const row of data ?? []) {
      const provider = normalizeUsageProvider(row.provider);
      if (!ALLOWED_USAGE_PROVIDERS.has(provider)) {
        continue;
      }
      const kind = row.kind as "llm" | "tts";
      const requests = 1;
      if (kind === "llm") {
        summary.llm.requests += requests;
        summary.llm.inputTokens += row.input_tokens ?? 0;
        summary.llm.outputTokens += row.output_tokens ?? 0;
        summary.llm.cacheReadTokens += row.cache_read_tokens ?? 0;
        summary.llm.cacheWriteTokens += row.cache_write_tokens ?? 0;
        summary.llm.totalTokens += row.total_tokens ?? 0;
        summaryLatency.llm += row.latency_ms ?? 0;
      } else {
        summary.tts.requests += requests;
        summary.tts.characters += row.characters ?? 0;
        summaryLatency.tts += row.latency_ms ?? 0;
      }
      const key = `${provider}::${row.model}::${kind}`;
      const current =
        breakdownMap.get(key) ??
        ({
          provider,
          model: row.model,
          kind,
          requests: 0,
          inputTokens: 0,
          outputTokens: 0,
          cacheReadTokens: 0,
          cacheWriteTokens: 0,
          totalTokens: 0,
          characters: 0,
        } as const);
      const next = {
        ...current,
        requests: current.requests + requests,
        inputTokens: current.inputTokens + (row.input_tokens ?? 0),
        outputTokens: current.outputTokens + (row.output_tokens ?? 0),
        cacheReadTokens: current.cacheReadTokens + (row.cache_read_tokens ?? 0),
        cacheWriteTokens: current.cacheWriteTokens + (row.cache_write_tokens ?? 0),
        totalTokens: current.totalTokens + (row.total_tokens ?? 0),
        characters: current.characters + (row.characters ?? 0),
      };
      breakdownMap.set(key, next);
    }
    summary.llm.avgLatencyMs = summary.llm.requests
      ? Math.round(summaryLatency.llm / summary.llm.requests)
      : 0;
    summary.tts.avgLatencyMs = summary.tts.requests
      ? Math.round(summaryLatency.tts / summary.tts.requests)
      : 0;
    for (const row of breakdownMap.values()) {
      if (row.kind === "llm") {
        breakdown.llm.push({
          provider: row.provider,
          model: row.model,
          requests: row.requests,
          inputTokens: row.inputTokens,
          outputTokens: row.outputTokens,
          cacheReadTokens: row.cacheReadTokens,
          cacheWriteTokens: row.cacheWriteTokens,
          totalTokens: row.totalTokens,
        });
      } else {
        breakdown.tts.push({
          provider: row.provider,
          model: row.model,
          requests: row.requests,
          characters: row.characters,
        });
      }
    }
    breakdown.llm.sort((a, b) => b.requests - a.requests);
    breakdown.tts.sort((a, b) => b.requests - a.requests);
  }

  res.json({ range: range.data, from, to, summary, breakdown });
});

app.post("/v1/invites/accept", async (req, res) => {
  const payload = acceptInviteSchema.safeParse(req.body);
  if (!payload.success) {
    res.status(400).json({ error: payload.error.message });
    return;
  }

  const tokenHash = hashToken(payload.data.token);
  let invite: InviteRow | undefined;
  try {
    invite = await getInviteByTokenHash(tokenHash);
  } catch (err) {
    res.status(500).json({ error: "Failed to load invite." });
    return;
  }
  if (!invite || invite.accepted_at) {
    res.status(404).json({ error: "Invite not found." });
    return;
  }
  if (new Date(invite.expires_at).getTime() < Date.now()) {
    res.status(410).json({ error: "Invite expired." });
    return;
  }

  const email = invite.email.toLowerCase();
  let user: UserRow | undefined;
  try {
    user = await getUserByEmail(email);
  } catch (err) {
    res.status(500).json({ error: "Failed to load account." });
    return;
  }

  try {
    if (!SUPABASE_ENABLED) {
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
        user = db.prepare("SELECT * FROM users WHERE id = ?").get(userId) as UserRow | undefined;
      }

      const existingMembership = db
        .prepare("SELECT * FROM memberships WHERE tenant_id = ? AND user_id = ?")
        .get(invite.tenant_id, user!.id) as MembershipRow | undefined;
      if (!existingMembership) {
        db.prepare(
          "INSERT INTO memberships (id, tenant_id, user_id, role, created_at) VALUES (?, ?, ?, ?, ?)",
        ).run(randomId("mem"), invite.tenant_id, user!.id, invite.role, nowIso());
      }

      db.prepare("UPDATE invites SET accepted_at = ? WHERE id = ?").run(nowIso(), invite.id);
      db.exec("COMMIT;");
    } else {
      if (!user) {
        if (!payload.data.password) {
          res.status(400).json({ error: "Password required for new account." });
          return;
        }
        const userId = randomId("usr");
        await insertUserRow({
          id: userId,
          email,
          password_hash: hashPassword(payload.data.password),
          created_at: nowIso(),
        });
        user = await getUserById(userId);
      }

      const existingMembership = await getMembership(user!.id, invite.tenant_id);
      if (!existingMembership) {
        await insertMembershipRow({
          id: randomId("mem"),
          tenant_id: invite.tenant_id,
          user_id: user!.id,
          role: invite.role,
          created_at: nowIso(),
        });
      }

      await markInviteAccepted(invite.id, nowIso());
    }
  } catch (err) {
    if (!SUPABASE_ENABLED) {
      db.exec("ROLLBACK;");
    }
    res.status(500).json({ error: "Failed to accept invite." });
    return;
  }

  const token = signToken(user!.id);
  res.json({ token, user: { id: user!.id, email: user!.email } });
});

app.get(
  "/v1/tenants/:tenantId/users",
  requireAuth,
  async (req, res) => {
    const tenantId = req.params.tenantId;
    let membership: MembershipRow | undefined;
    try {
      membership = await getMembership(req.auth.uid, tenantId);
    } catch (err) {
      res.status(500).json({ error: "Failed to load membership." });
      return;
    }
    if (!membership || !hasRole(membership.role, ["owner", "manager"])) {
      res.status(403).json({ error: "Not allowed." });
      return;
    }

    try {
      const users = await listTenantUsers(tenantId);
      res.json({ users });
    } catch (err) {
      res.status(500).json({ error: "Failed to load users." });
    }
  },
);

app.patch(
  "/v1/tenants/:tenantId/users/:userId",
  requireAuth,
  async (req, res) => {
    const tenantId = req.params.tenantId;
    const targetUserId = req.params.userId;
    let membership: MembershipRow | undefined;
    try {
      membership = await getMembership(req.auth.uid, tenantId);
    } catch (err) {
      res.status(500).json({ error: "Failed to load membership." });
      return;
    }
    if (!membership || membership.role !== "owner") {
      res.status(403).json({ error: "Owner role required." });
      return;
    }

    const payload = updateRoleSchema.safeParse(req.body);
    if (!payload.success) {
      res.status(400).json({ error: payload.error.message });
      return;
    }

    try {
      if (payload.data.role !== "owner" && (await isLastOwner(tenantId, targetUserId))) {
        res.status(409).json({ error: "Cannot remove the last owner." });
        return;
      }
    } catch (err) {
      res.status(500).json({ error: "Failed to validate owner role." });
      return;
    }

    try {
      const updated = await updateMembershipRole(tenantId, targetUserId, payload.data.role);
      if (!updated) {
        res.status(404).json({ error: "Membership not found." });
        return;
      }
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to update role." });
    }
  },
);

app.delete(
  "/v1/tenants/:tenantId/users/:userId",
  requireAuth,
  async (req, res) => {
    const tenantId = req.params.tenantId;
    const targetUserId = req.params.userId;
    let membership: MembershipRow | undefined;
    try {
      membership = await getMembership(req.auth.uid, tenantId);
    } catch (err) {
      res.status(500).json({ error: "Failed to load membership." });
      return;
    }
    if (!membership || membership.role !== "owner") {
      res.status(403).json({ error: "Owner role required." });
      return;
    }

    try {
      if (await isLastOwner(tenantId, targetUserId)) {
        res.status(409).json({ error: "Cannot remove the last owner." });
        return;
      }
    } catch (err) {
      res.status(500).json({ error: "Failed to validate owner role." });
      return;
    }

    try {
      const removed = await deleteMembershipRow(tenantId, targetUserId);
      if (!removed) {
        res.status(404).json({ error: "Membership not found." });
        return;
      }
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to remove user." });
    }
  },
);

app.post("/v1/admin/tenants", (req, res) => {
  if (!requireAdmin(req, res)) return;
  const payload = createTenantSchema.safeParse(req.body);
  if (!payload.success) {
    res.status(400).json({ error: payload.error.message });
    return;
  }
  const now = nowIso();
  const tenantId = randomId("tnt");
  insertTenantRow({ id: tenantId, name: payload.data.name, created_at: now })
    .then(() => {
      res.json({ tenant: { id: tenantId, name: payload.data.name } });
    })
    .catch(() => {
      res.status(500).json({ error: "Failed to create tenant." });
    });
});

app.get("/v1/admin/tenants", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    const rows = await listAdminTenants();
    res.json({ tenants: rows });
  } catch (err) {
    res.status(500).json({ error: "Failed to load tenants." });
  }
});

app.get("/v1/admin/tenants/:tenantId/users", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const tenantId = req.params.tenantId;
  try {
    const users = await listAdminTenantUsers(tenantId);
    res.json({ users });
  } catch (err) {
    res.status(500).json({ error: "Failed to load users." });
  }
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

    CREATE TABLE IF NOT EXISTS whatsapp_identities (
      phone TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL
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
    const response = await fetchWithRetry(
      `${CONTROL_GATEWAY_URL}${upstreamPath}`,
      {
        method: opts.method ?? "GET",
        headers,
        body: opts.body ? JSON.stringify(opts.body) : undefined,
      },
      `gateway proxy ${opts.method ?? "GET"} ${upstreamPath}`,
    );
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

function requireToolWebhookSecret(req: express.Request, res: express.Response, next: express.NextFunction) {
  if (!TOOL_WEBHOOK_SECRET) {
    next();
    return;
  }
  const supplied = req.get("x-webhook-secret") ?? "";
  if (!supplied || !safeEqual(supplied, TOOL_WEBHOOK_SECRET)) {
    res.status(401).json({ error: "Unauthorized tool webhook." });
    return;
  }
  next();
}

function hasRole(role: Role, allowed: Role[]): boolean {
  return allowed.includes(role);
}

function normalizeContactRole(value: string | undefined): ContactRole {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) {
    return "lead";
  }
  if ((CONTACT_ROLE_VALUES as readonly string[]).includes(normalized)) {
    return normalized as ContactRole;
  }
  return "lead";
}

type ContactRecord = {
  phone: string;
  name: string | null;
  role: ContactRole;
  metadata: Record<string, unknown>;
};

function parseMetadataObject(value: unknown): Record<string, unknown> {
  if (!value) {
    return {};
  }
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
      return {};
    } catch {
      return {};
    }
  }
  if (typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

async function getContactByPhone(phone: string): Promise<ContactRecord | null> {
  if (SUPABASE_ENABLED && supabase) {
    const { data, error } = await supabase.from("contacts").select("*").eq("phone", phone).maybeSingle();
    if (error) {
      throw error;
    }
    if (!data) {
      return null;
    }
    return {
      phone: data.phone,
      name: data.name ?? null,
      role: normalizeContactRole(data.role),
      metadata: parseMetadataObject(data.metadata),
    };
  }
  const row = db.prepare("SELECT phone, name, role, metadata FROM contacts WHERE phone = ?").get(phone) as
    | { phone: string; name: string | null; role: string; metadata: string | null }
    | undefined;
  if (!row) {
    return null;
  }
  return {
    phone: row.phone,
    name: row.name ?? null,
    role: normalizeContactRole(row.role),
    metadata: parseMetadataObject(row.metadata),
  };
}

async function upsertContact(input: {
  phone: string;
  name: string;
  role: ContactRole;
  metadata: Record<string, unknown>;
}): Promise<ContactRecord> {
  if (SUPABASE_ENABLED && supabase) {
    const { data, error } = await supabase
      .from("contacts")
      .upsert(
        {
          phone: input.phone,
          name: input.name,
          role: input.role,
          metadata: input.metadata,
        },
        { onConflict: "phone" },
      )
      .select("*")
      .single();
    if (error) {
      throw error;
    }
    return {
      phone: data.phone,
      name: data.name ?? null,
      role: normalizeContactRole(data.role),
      metadata: parseMetadataObject(data.metadata),
    };
  }
  db.prepare(
    `INSERT INTO contacts (phone, name, role, metadata)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(phone) DO UPDATE SET
       name = excluded.name,
       role = excluded.role,
       metadata = excluded.metadata`,
  ).run(input.phone, input.name, input.role, JSON.stringify(input.metadata ?? {}));
  return {
    phone: input.phone,
    name: input.name,
    role: input.role,
    metadata: input.metadata,
  };
}

async function insertConversationLog(input: {
  phone: string;
  role: ContactRole;
  message: string;
  sender: string;
  timestamp: string;
}): Promise<void> {
  if (SUPABASE_ENABLED && supabase) {
    const { error } = await supabase.from("conversations").insert({
      phone: input.phone,
      role: input.role,
      message: input.message,
      sender: input.sender,
      timestamp: input.timestamp,
    });
    if (error) {
      throw error;
    }
    return;
  }
  db.prepare(
    `INSERT INTO conversations (id, phone, role, message, sender, timestamp)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(randomId("conv"), input.phone, input.role, input.message, input.sender, input.timestamp);
}

async function getUserByEmail(email: string): Promise<UserRow | undefined> {
  const normalized = email.toLowerCase();
  if (SUPABASE_ENABLED && supabase) {
    const { data, error } = await supabase.from("users").select("*").eq("email", normalized).maybeSingle();
    if (error) {
      throw error;
    }
    return data ?? undefined;
  }
  return db.prepare("SELECT * FROM users WHERE email = ?").get(normalized) as UserRow | undefined;
}

async function countUsers(): Promise<number> {
  if (SUPABASE_ENABLED && supabase) {
    const { count, error } = await supabase.from("users").select("id", { count: "exact", head: true });
    if (error) {
      throw error;
    }
    return count ?? 0;
  }
  const row = db.prepare("SELECT COUNT(*) as count FROM users").get() as { count?: number } | undefined;
  return row?.count ?? 0;
}

function normalizeWhatsAppPhone(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const cleaned = trimmed.replace(/[^\d+]/g, "");
  if (!cleaned) {
    return null;
  }
  if (cleaned.startsWith("+")) {
    return cleaned;
  }
  return `+${cleaned}`;
}

function phoneToEmail(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return `wa+${digits}@propai.live`;
}

function isSyntheticWhatsAppEmail(email: string): boolean {
  const normalized = email.trim().toLowerCase();
  return normalized.startsWith("wa+") && normalized.endsWith("@propai.live");
}

function isWhatsAppOnboardingTrigger(text: string): boolean {
  const normalized = text.trim().toLowerCase();
  if (!normalized) {
    return false;
  }
  return (
    normalized === "join" ||
    normalized === "start" ||
    normalized === "get started" ||
    normalized.startsWith("join ") ||
    normalized.startsWith("start ")
  );
}

function readWorkspaceProfile(settings: Record<string, unknown>): WorkspaceProfile {
  const raw = settings.workspaceProfile;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return {};
  }
  return { ...(raw as WorkspaceProfile) };
}

function readWhatsAppOnboardingState(settings: Record<string, unknown>): WhatsAppOnboardingState {
  const raw = settings.whatsappOnboarding;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return {};
  }
  return { ...(raw as WhatsAppOnboardingState) };
}

function resolveWhatsAppOnboardingStep(
  profile: WorkspaceProfile,
  onboarding: WhatsAppOnboardingState,
  userEmail: string,
): WhatsAppOnboardingStep {
  if (!profile.ownerName?.trim()) {
    return "ownerName";
  }
  if (!profile.businessName?.trim()) {
    return "businessName";
  }
  if (!profile.city?.trim()) {
    return "city";
  }
  const hasRealEmail = Boolean(profile.email?.trim()) || (Boolean(userEmail.trim()) && !isSyntheticWhatsAppEmail(userEmail));
  if (!hasRealEmail && !onboarding.emailSkipped) {
    return "email";
  }
  if (!profile.businessType?.trim()) {
    return "businessType";
  }
  return "done";
}

function buildWhatsAppOnboardingPrompt(step: WhatsAppOnboardingStep, profile: WorkspaceProfile): string {
  switch (step) {
    case "ownerName":
      return "Welcome to PropAi. Let us get your workspace ready. What name should I use for you?";
    case "businessName":
      return `Nice to meet you${profile.ownerName ? `, ${profile.ownerName}` : ""}. What should we call your business or team inside PropAi?`;
    case "city":
      return "Which city or market do you mainly work in?";
    case "email":
      return 'What email should we use for recovery, billing, and admin updates? Reply "skip" if you want to add it later.';
    case "businessType":
      return "Last quick one: what best describes you � independent broker, broker team, channel partner, or developer sales?";
    case "done":
    default:
      return "You are all set.";
  }
}

async function updateUserEmailRow(userId: string, email: string): Promise<void> {
  const normalized = email.trim().toLowerCase();
  if (SUPABASE_ENABLED && supabase) {
    const { error } = await supabase.from("users").update({ email: normalized }).eq("id", userId);
    if (error) {
      throw error;
    }
    return;
  }
  db.prepare("UPDATE users SET email = ? WHERE id = ?").run(normalized, userId);
}

async function updateTenantNameRow(tenantId: string, name: string): Promise<void> {
  const normalized = name.trim();
  if (SUPABASE_ENABLED && supabase) {
    const { error } = await supabase.from("tenants").update({ name: normalized }).eq("id", tenantId);
    if (error) {
      throw error;
    }
    return;
  }
  db.prepare("UPDATE tenants SET name = ? WHERE id = ?").run(normalized, tenantId);
}

async function createWhatsAppOnboardingAccount(params: {
  phone: string;
  senderName?: string;
}): Promise<{ user: UserRow; tenant: TenantRow; createdAt: string }> {
  const now = nowIso();
  const tenantId = randomId("tnt");
  const userId = randomId("usr");
  const membershipId = randomId("mem");
  const tenantName = params.senderName?.trim() || `Broker ${params.phone.replace(/\D/g, "").slice(-4)}`;
  const email = phoneToEmail(params.phone);
  const tempPassword = `${createToken()}${createToken()}`;

  try {
    if (!SUPABASE_ENABLED) {
      db.exec("BEGIN;");
      db.prepare("INSERT INTO tenants (id, name, created_at) VALUES (?, ?, ?)").run(tenantId, tenantName, now);
      db.prepare("INSERT INTO users (id, email, password_hash, created_at) VALUES (?, ?, ?, ?)").run(
        userId,
        email,
        hashPassword(tempPassword),
        now,
      );
      db.prepare(
        "INSERT INTO memberships (id, tenant_id, user_id, role, created_at) VALUES (?, ?, ?, ?, ?)",
      ).run(membershipId, tenantId, userId, "owner", now);
      db.prepare(
        "INSERT INTO whatsapp_identities (phone, user_id, tenant_id, created_at) VALUES (?, ?, ?, ?)",
      ).run(params.phone, userId, tenantId, now);
      db.exec("COMMIT;");
    } else {
      await insertTenantRow({ id: tenantId, name: tenantName, created_at: now });
      await insertUserRow({ id: userId, email, password_hash: hashPassword(tempPassword), created_at: now });
      await insertMembershipRow({
        id: membershipId,
        tenant_id: tenantId,
        user_id: userId,
        role: "owner",
        created_at: now,
      });
      await insertWhatsappIdentityRow(params.phone, userId, tenantId, now);
    }
  } catch (error) {
    if (!SUPABASE_ENABLED) {
      db.exec("ROLLBACK;");
    } else {
      try {
        await deleteMembershipRow(tenantId, userId);
        await deleteUserRow(userId);
        await deleteTenantRow(tenantId);
      } catch {
        // best-effort cleanup
      }
    }
    throw error;
  }

  return {
    createdAt: now,
    user: { id: userId, email, password_hash: "", created_at: now },
    tenant: { id: tenantId, name: tenantName, created_at: now },
  };
}

async function handleWhatsAppOnboardingMessage(params: {
  phone: string;
  text: string;
  senderName?: string;
}): Promise<{ handled: boolean; reply?: string; loginUrl?: string; complete?: boolean }> {
  const answer = params.text.trim();
  const explicitStart = isWhatsAppOnboardingTrigger(answer);

  let identity = await getWhatsappIdentity(params.phone);
  let user: UserRow | undefined;
  let tenant: TenantRow | undefined;

  if (!identity) {
    if (!explicitStart) {
      return { handled: false };
    }
    const created = await createWhatsAppOnboardingAccount({
      phone: params.phone,
      senderName: params.senderName,
    });
    identity = { phone: params.phone, user_id: created.user.id, tenant_id: created.tenant.id };
    user = created.user;
    tenant = created.tenant;

    const initialProfile: WorkspaceProfile = {
      phone: params.phone,
      ...(params.senderName?.trim() ? { ownerName: params.senderName.trim() } : {}),
    };
    const initialOnboarding: WhatsAppOnboardingState = {
      status: "active",
      step: initialProfile.ownerName ? "businessName" : "ownerName",
      startedAt: created.createdAt,
      updatedAt: created.createdAt,
      source: "whatsapp-cloud",
    };
    await upsertTenantSettings(created.tenant.id, {
      whatsapp: { phone: params.phone },
      workspaceProfile: initialProfile as unknown as Record<string, unknown>,
      whatsappOnboarding: initialOnboarding as unknown as Record<string, unknown>,
      onboardingComplete: false,
    });
    return {
      handled: true,
      reply: buildWhatsAppOnboardingPrompt(initialOnboarding.step!, initialProfile),
    };
  }

  user = await getUserById(identity.user_id);
  tenant = await getTenantById(identity.tenant_id);
  if (!user || !tenant) {
    return {
      handled: explicitStart,
      reply: explicitStart ? "We found an incomplete account record. Please try again in a minute." : undefined,
    };
  }

  const settings = await getTenantSettings(tenant.id);
  let profile = readWorkspaceProfile(settings);
  let onboarding = readWhatsAppOnboardingState(settings);
  profile = {
    ...profile,
    phone: params.phone,
    ...(profile.email ? {} : !isSyntheticWhatsAppEmail(user.email) ? { email: user.email } : {}),
  };

  const now = nowIso();
  const requestedRestart = answer.toLowerCase() === "restart";
  if (requestedRestart) {
    profile = {
      phone: params.phone,
      ...(params.senderName?.trim() ? { ownerName: params.senderName.trim() } : {}),
    };
    onboarding = {
      status: "active",
      step: profile.ownerName ? "businessName" : "ownerName",
      startedAt: now,
      updatedAt: now,
      source: "whatsapp-cloud",
      emailSkipped: false,
    };
    await upsertTenantSettings(tenant.id, mergeSettings(settings, {
      whatsapp: { phone: params.phone },
      workspaceProfile: profile as unknown as Record<string, unknown>,
      whatsappOnboarding: onboarding as unknown as Record<string, unknown>,
      onboardingComplete: false,
    }));
    return { handled: true, reply: `Starting over. ${buildWhatsAppOnboardingPrompt(onboarding.step!, profile)}` };
  }

  const currentStep = resolveWhatsAppOnboardingStep(profile, onboarding, user.email);
  if (currentStep === "done" || onboarding.status === "complete") {
    if (!explicitStart) {
      return { handled: false };
    }
    const token = signToken(user.id);
    const loginUrl = buildControlLoginUrl(token, tenant.id);
    return {
      handled: true,
      complete: true,
      loginUrl,
      reply: `You are already onboarded. Open this link to continue in PropAi: ${loginUrl}`,
    };
  }

  if (explicitStart) {
    onboarding = {
      ...onboarding,
      status: "active",
      step: currentStep,
      startedAt: onboarding.startedAt ?? now,
      updatedAt: now,
      source: onboarding.source ?? "whatsapp-cloud",
    };
    await upsertTenantSettings(tenant.id, mergeSettings(settings, {
      whatsapp: { phone: params.phone },
      workspaceProfile: profile as unknown as Record<string, unknown>,
      whatsappOnboarding: onboarding as unknown as Record<string, unknown>,
      onboardingComplete: false,
    }));
    return { handled: true, reply: buildWhatsAppOnboardingPrompt(currentStep, profile) };
  }

  const normalizedAnswer = answer.trim();
  if (!normalizedAnswer) {
    return { handled: true, reply: buildWhatsAppOnboardingPrompt(currentStep, profile) };
  }

  switch (currentStep) {
    case "ownerName": {
      if (normalizedAnswer.length < 2) {
        return { handled: true, reply: "Please send the name you want us to use for your workspace." };
      }
      profile.ownerName = normalizedAnswer;
      break;
    }
    case "businessName": {
      if (normalizedAnswer.length < 2) {
        return { handled: true, reply: "Please send the business or team name you want to use inside PropAi." };
      }
      profile.businessName = normalizedAnswer;
      await updateTenantNameRow(tenant.id, normalizedAnswer);
      tenant = { ...tenant, name: normalizedAnswer };
      break;
    }
    case "city": {
      if (normalizedAnswer.length < 2) {
        return { handled: true, reply: "Please send the city or market you mainly work in." };
      }
      profile.city = normalizedAnswer;
      break;
    }
    case "email": {
      if (normalizedAnswer.toLowerCase() === "skip") {
        onboarding.emailSkipped = true;
        break;
      }
      const emailCheck = z.string().email().safeParse(normalizedAnswer.toLowerCase());
      if (!emailCheck.success) {
        return { handled: true, reply: 'That email does not look right. Send a valid email or reply "skip".' };
      }
      const existingEmailUser = await getUserByEmail(emailCheck.data);
      if (existingEmailUser && existingEmailUser.id !== user.id) {
        return { handled: true, reply: "That email is already in use. Send another email or reply skip." };
      }
      await updateUserEmailRow(user.id, emailCheck.data);
      user = { ...user, email: emailCheck.data };
      profile.email = emailCheck.data;
      onboarding.emailSkipped = false;
      break;
    }
    case "businessType": {
      if (normalizedAnswer.length < 2) {
        return { handled: true, reply: "Please describe your business type in a couple of words, like independent broker or broker team." };
      }
      profile.businessType = normalizedAnswer;
      break;
    }
    case "done":
    default:
      break;
  }

  const nextStep = resolveWhatsAppOnboardingStep(profile, onboarding, user.email);
  if (nextStep === "done") {
    const completedOnboarding: WhatsAppOnboardingState = {
      ...onboarding,
      status: "complete",
      step: "done",
      updatedAt: now,
      completedAt: now,
      source: onboarding.source ?? "whatsapp-cloud",
    };
    await upsertTenantSettings(tenant.id, mergeSettings(settings, {
      whatsapp: { phone: params.phone },
      workspaceProfile: profile as unknown as Record<string, unknown>,
      whatsappOnboarding: completedOnboarding as unknown as Record<string, unknown>,
      onboardingComplete: false,
    }));
    const token = signToken(user.id);
    const loginUrl = buildControlLoginUrl(token, tenant.id);
    return {
      handled: true,
      complete: true,
      loginUrl,
      reply: `Perfect. ${profile.businessName ?? tenant.name} is ready. Open this secure link to finish setup in PropAi: ${loginUrl}`,
    };
  }

  const activeOnboarding: WhatsAppOnboardingState = {
    ...onboarding,
    status: "active",
    step: nextStep,
    updatedAt: now,
    startedAt: onboarding.startedAt ?? now,
    source: onboarding.source ?? "whatsapp-cloud",
  };
  await upsertTenantSettings(tenant.id, mergeSettings(settings, {
    whatsapp: { phone: params.phone },
    workspaceProfile: profile as unknown as Record<string, unknown>,
    whatsappOnboarding: activeOnboarding as unknown as Record<string, unknown>,
    onboardingComplete: false,
  }));
  return { handled: true, reply: buildWhatsAppOnboardingPrompt(nextStep, profile) };
}

async function getPrimaryWhatsappForUser(userId: string): Promise<string | null> {
  if (SUPABASE_ENABLED && supabase) {
    const { data, error } = await supabase
      .from("whatsapp_identities")
      .select("phone")
      .eq("user_id", userId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (error) {
      throw error;
    }
    return data?.phone ?? null;
  }
  const row = db
    .prepare("SELECT phone FROM whatsapp_identities WHERE user_id = ? ORDER BY created_at ASC LIMIT 1")
    .get(userId) as { phone?: string } | undefined;
  return row?.phone ?? null;
}

async function buildControlUserPayload(user: UserRow): Promise<{ id: string; email: string; primaryWhatsapp: string | null }> {
  return {
    id: user.id,
    email: user.email,
    primaryWhatsapp: await getPrimaryWhatsappForUser(user.id),
  };
}

async function getWhatsappIdentity(
  phone: string,
): Promise<{ phone: string; user_id: string; tenant_id: string } | undefined> {
  if (SUPABASE_ENABLED && supabase) {
    const { data, error } = await supabase
      .from("whatsapp_identities")
      .select("phone,user_id,tenant_id")
      .eq("phone", phone)
      .maybeSingle();
    if (error) {
      throw error;
    }
    return data ?? undefined;
  }
  return db
    .prepare("SELECT phone, user_id, tenant_id FROM whatsapp_identities WHERE phone = ?")
    .get(phone) as { phone: string; user_id: string; tenant_id: string } | undefined;
}

function buildControlLoginUrl(token: string, tenantId?: string): string {
  const url = new URL(CONTROL_UI_URL);
  url.searchParams.set("control_token", token);
  if (tenantId) {
    url.searchParams.set("tenant_id", tenantId);
  }
  return url.toString();
}

async function getUserById(userId: string): Promise<UserRow | undefined> {
  if (SUPABASE_ENABLED && supabase) {
    const { data, error } = await supabase.from("users").select("*").eq("id", userId).maybeSingle();
    if (error) {
      throw error;
    }
    return data ?? undefined;
  }
  return db.prepare("SELECT * FROM users WHERE id = ?").get(userId) as UserRow | undefined;
}

function requireAdmin(req: express.Request, res: express.Response): boolean {
  if (!ADMIN_KEY || req.get("x-admin-key") !== ADMIN_KEY) {
    res.status(401).json({ error: "Admin key required." });
    return false;
  }
  return true;
}

async function getTenantById(tenantId: string): Promise<TenantRow | undefined> {
  if (SUPABASE_ENABLED && supabase) {
    const { data, error } = await supabase.from("tenants").select("*").eq("id", tenantId).maybeSingle();
    if (error) {
      throw error;
    }
    return data ?? undefined;
  }
  return db.prepare("SELECT * FROM tenants WHERE id = ?").get(tenantId) as TenantRow | undefined;
}

async function getMembership(userId: string, tenantId: string): Promise<MembershipRow | undefined> {
  if (SUPABASE_ENABLED && supabase) {
    const { data, error } = await supabase
      .from("memberships")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("user_id", userId)
      .maybeSingle();
    if (error) {
      throw error;
    }
    return data ?? undefined;
  }
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

async function isLastOwner(tenantId: string, userId: string): Promise<boolean> {
  if (SUPABASE_ENABLED && supabase) {
    const { count: ownerCount, error: ownersError } = await supabase
      .from("memberships")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("role", "owner");
    if (ownersError) {
      throw ownersError;
    }
    const { data: ownerRow, error: ownerError } = await supabase
      .from("memberships")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("user_id", userId)
      .eq("role", "owner")
      .maybeSingle();
    if (ownerError) {
      throw ownerError;
    }
    return Boolean(ownerRow?.id) && (ownerCount ?? 0) <= 1;
  }
  const owners = db
    .prepare("SELECT COUNT(*) as count FROM memberships WHERE tenant_id = ? AND role = 'owner'")
    .get(tenantId) as { count: number } | undefined;
  const isOwner = db
    .prepare("SELECT 1 as exists FROM memberships WHERE tenant_id = ? AND user_id = ? AND role = 'owner'")
    .get(tenantId, userId) as { exists: number } | undefined;
  return Boolean(isOwner?.exists) && (owners?.count ?? 0) <= 1;
}

async function listMemberships(
  userId: string,
): Promise<Array<{ tenant_id: string; tenant_name: string; role: Role }>> {
  if (SUPABASE_ENABLED && supabase) {
    const { data, error } = await supabase
      .from("memberships")
      .select("tenant_id, role, tenants(name)")
      .eq("user_id", userId)
      .order("tenant_id", { ascending: true });
    if (error) {
      throw error;
    }
    return (data ?? []).map((row) => ({
      tenant_id: row.tenant_id as string,
      tenant_name: (row.tenants as { name?: string } | null)?.name ?? "Workspace",
      role: row.role as Role,
    }));
  }
  return db
    .prepare(
      "SELECT memberships.tenant_id as tenant_id, tenants.name as tenant_name, memberships.role as role FROM memberships JOIN tenants ON tenants.id = memberships.tenant_id WHERE memberships.user_id = ? ORDER BY tenants.name",
    )
    .all(userId) as Array<{ tenant_id: string; tenant_name: string; role: Role }>;
}

async function listTenantUsers(tenantId: string): Promise<Array<{ id: string; email: string; role: Role }>> {
  if (SUPABASE_ENABLED && supabase) {
    const { data, error } = await supabase
      .from("memberships")
      .select("role, users(id,email)")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: true });
    if (error) {
      throw error;
    }
    return (data ?? [])
      .map((row) => ({
        id: (row.users as { id?: string } | null)?.id ?? "",
        email: (row.users as { email?: string } | null)?.email ?? "",
        role: row.role as Role,
      }))
      .filter((row) => Boolean(row.id));
  }
  return db
    .prepare(
      "SELECT users.id as id, users.email as email, memberships.role as role FROM memberships JOIN users ON users.id = memberships.user_id WHERE memberships.tenant_id = ? ORDER BY users.email",
    )
    .all(tenantId) as Array<{ id: string; email: string; role: Role }>;
}

async function getInviteByTokenHash(tokenHash: string): Promise<InviteRow | undefined> {
  if (SUPABASE_ENABLED && supabase) {
    const { data, error } = await supabase.from("invites").select("*").eq("token_hash", tokenHash).maybeSingle();
    if (error) {
      throw error;
    }
    return data ?? undefined;
  }
  return db
    .prepare("SELECT * FROM invites WHERE token_hash = ?")
    .get(tokenHash) as InviteRow | undefined;
}

async function insertTenantRow(tenant: TenantRow): Promise<void> {
  if (SUPABASE_ENABLED && supabase) {
    const { error } = await supabase.from("tenants").insert(tenant);
    if (error) {
      throw error;
    }
    return;
  }
  db.prepare("INSERT INTO tenants (id, name, created_at) VALUES (?, ?, ?)").run(
    tenant.id,
    tenant.name,
    tenant.created_at,
  );
}

async function insertUserRow(user: UserRow): Promise<void> {
  if (SUPABASE_ENABLED && supabase) {
    const { error } = await supabase.from("users").insert(user);
    if (error) {
      throw error;
    }
    return;
  }
  db.prepare("INSERT INTO users (id, email, password_hash, created_at) VALUES (?, ?, ?, ?)").run(
    user.id,
    user.email,
    user.password_hash,
    user.created_at,
  );
}

async function insertMembershipRow(membership: MembershipRow): Promise<void> {
  if (SUPABASE_ENABLED && supabase) {
    const { error } = await supabase.from("memberships").insert(membership);
    if (error) {
      throw error;
    }
    return;
  }
  db.prepare("INSERT INTO memberships (id, tenant_id, user_id, role, created_at) VALUES (?, ?, ?, ?, ?)").run(
    membership.id,
    membership.tenant_id,
    membership.user_id,
    membership.role,
    membership.created_at,
  );
}

async function deleteUserRow(userId: string): Promise<void> {
  if (SUPABASE_ENABLED && supabase) {
    const { error } = await supabase.from("users").delete().eq("id", userId);
    if (error) {
      throw error;
    }
    return;
  }
  db.prepare("DELETE FROM users WHERE id = ?").run(userId);
}

async function deleteTenantRow(tenantId: string): Promise<void> {
  if (SUPABASE_ENABLED && supabase) {
    const { error } = await supabase.from("tenants").delete().eq("id", tenantId);
    if (error) {
      throw error;
    }
    return;
  }
  db.prepare("DELETE FROM tenants WHERE id = ?").run(tenantId);
}

async function insertInviteRow(invite: InviteRow): Promise<void> {
  if (SUPABASE_ENABLED && supabase) {
    const { error } = await supabase.from("invites").insert(invite);
    if (error) {
      throw error;
    }
    return;
  }
  db.prepare(
    "INSERT INTO invites (id, tenant_id, email, role, token_hash, expires_at, created_at, accepted_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
  ).run(
    invite.id,
    invite.tenant_id,
    invite.email,
    invite.role,
    invite.token_hash,
    invite.expires_at,
    invite.created_at,
    invite.accepted_at ?? null,
  );
}

async function markInviteAccepted(inviteId: string, acceptedAt: string): Promise<void> {
  if (SUPABASE_ENABLED && supabase) {
    const { error } = await supabase.from("invites").update({ accepted_at: acceptedAt }).eq("id", inviteId);
    if (error) {
      throw error;
    }
    return;
  }
  db.prepare("UPDATE invites SET accepted_at = ? WHERE id = ?").run(acceptedAt, inviteId);
}

async function insertWhatsappIdentityRow(
  phone: string,
  userId: string,
  tenantId: string,
  createdAt: string,
): Promise<void> {
  if (SUPABASE_ENABLED && supabase) {
    const { error } = await supabase
      .from("whatsapp_identities")
      .insert({ phone, user_id: userId, tenant_id: tenantId, created_at: createdAt });
    if (error) {
      throw error;
    }
    return;
  }
  db.prepare("INSERT INTO whatsapp_identities (phone, user_id, tenant_id, created_at) VALUES (?, ?, ?, ?)").run(
    phone,
    userId,
    tenantId,
    createdAt,
  );
}

async function updateUserPassword(userId: string, passwordHash: string): Promise<void> {
  if (SUPABASE_ENABLED && supabase) {
    const { error } = await supabase.from("users").update({ password_hash: passwordHash }).eq("id", userId);
    if (error) {
      throw error;
    }
    return;
  }
  db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(passwordHash, userId);
}

async function updateMembershipRole(tenantId: string, userId: string, role: Role): Promise<boolean> {
  if (SUPABASE_ENABLED && supabase) {
    const { error, data } = await supabase
      .from("memberships")
      .update({ role })
      .eq("tenant_id", tenantId)
      .eq("user_id", userId)
      .select("id");
    if (error) {
      throw error;
    }
    return Boolean(data && data.length);
  }
  const updated = db.prepare("UPDATE memberships SET role = ? WHERE tenant_id = ? AND user_id = ?").run(
    role,
    tenantId,
    userId,
  );
  return updated.changes > 0;
}

async function deleteMembershipRow(tenantId: string, userId: string): Promise<boolean> {
  if (SUPABASE_ENABLED && supabase) {
    const { error, data } = await supabase
      .from("memberships")
      .delete()
      .eq("tenant_id", tenantId)
      .eq("user_id", userId)
      .select("id");
    if (error) {
      throw error;
    }
    return Boolean(data && data.length);
  }
  const result = db.prepare("DELETE FROM memberships WHERE tenant_id = ? AND user_id = ?").run(tenantId, userId);
  return result.changes > 0;
}

async function getTenantSettings(tenantId: string): Promise<Record<string, unknown>> {
  if (SUPABASE_ENABLED && supabase) {
    const { data, error } = await supabase
      .from("tenant_settings")
      .select("data")
      .eq("tenant_id", tenantId)
      .maybeSingle();
    if (error) {
      throw error;
    }
    const row = data?.data;
    if (!row) {
      return {};
    }
    return typeof row === "string" ? JSON.parse(row) : (row as Record<string, unknown>);
  }
  const row = db.prepare("SELECT data FROM tenant_settings WHERE tenant_id = ?").get(tenantId) as
    | { data: string }
    | undefined;
  if (!row?.data) {
    return {};
  }
  return JSON.parse(row.data);
}

async function upsertTenantSettings(tenantId: string, data: Record<string, unknown>) {
  const payload = SUPABASE_ENABLED ? data : JSON.stringify(data);
  const now = nowIso();
  if (SUPABASE_ENABLED && supabase) {
    const { error } = await supabase
      .from("tenant_settings")
      .upsert({ tenant_id: tenantId, data: payload, updated_at: now });
    if (error) {
      throw error;
    }
    return;
  }
  db.prepare(
    `INSERT INTO tenant_settings (tenant_id, data, updated_at)
     VALUES (?, ?, ?)
     ON CONFLICT(tenant_id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`,
  ).run(tenantId, payload, now);
}

async function listAdminTenants(): Promise<
  Array<{ id: string; name: string; created_at: string; members: number; owners: number }>
> {
  if (SUPABASE_ENABLED && supabase) {
    const { data: tenants, error } = await supabase
      .from("tenants")
      .select("id,name,created_at")
      .order("created_at", { ascending: false });
    if (error) {
      throw error;
    }
    const rows = tenants ?? [];
    const enriched = await Promise.all(
      rows.map(async (tenant) => {
        const { count: membersCount, error: membersError } = await supabase
          .from("memberships")
          .select("id", { count: "exact", head: true })
          .eq("tenant_id", tenant.id);
        if (membersError) {
          throw membersError;
        }
        const { count: ownersCount, error: ownersError } = await supabase
          .from("memberships")
          .select("id", { count: "exact", head: true })
          .eq("tenant_id", tenant.id)
          .eq("role", "owner");
        if (ownersError) {
          throw ownersError;
        }
        return {
          id: tenant.id,
          name: tenant.name,
          created_at: tenant.created_at,
          members: membersCount ?? 0,
          owners: ownersCount ?? 0,
        };
      }),
    );
    return enriched;
  }
  return db
    .prepare(
      `SELECT tenants.id as id,
        tenants.name as name,
        tenants.created_at as created_at,
        (SELECT COUNT(*) FROM memberships WHERE tenant_id = tenants.id) as members,
        (SELECT COUNT(*) FROM memberships WHERE tenant_id = tenants.id AND role = 'owner') as owners
       FROM tenants
       ORDER BY tenants.created_at DESC`,
    )
    .all() as Array<{ id: string; name: string; created_at: string; members: number; owners: number }>;
}

async function listAdminTenantUsers(
  tenantId: string,
): Promise<Array<{ id: string; email: string; role: Role; joined_at: string }>> {
  if (SUPABASE_ENABLED && supabase) {
    const { data, error } = await supabase
      .from("memberships")
      .select("role, created_at, users(id,email)")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: true });
    if (error) {
      throw error;
    }
    return (data ?? [])
      .map((row) => ({
        id: (row.users as { id?: string } | null)?.id ?? "",
        email: (row.users as { email?: string } | null)?.email ?? "",
        role: row.role as Role,
        joined_at: row.created_at as string,
      }))
      .filter((row) => Boolean(row.id));
  }
  return db
    .prepare(
      `SELECT users.id as id,
        users.email as email,
        memberships.role as role,
        memberships.created_at as joined_at
       FROM memberships
       JOIN users ON users.id = memberships.user_id
       WHERE memberships.tenant_id = ?
       ORDER BY users.email`,
    )
    .all(tenantId) as Array<{ id: string; email: string; role: Role; joined_at: string }>;
}

declare global {
  namespace Express {
    interface Request {
      auth: AuthClaims;
    }
  }
}




