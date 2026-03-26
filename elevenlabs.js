import axios from "axios";

const ROLE_PRIORITY = {
  lead: 1,
  broker: 2,
  admin: 3,
  owner: 4,
};

const PRIVILEGED_ROLES = new Set(["owner", "admin"]);

const DEFAULT_FALLBACKS = {
  invalidMessage: "Please send a valid message so I can help you.",
  ownerSessionExpired:
    "Your owner session has expired for security. Please re-activate your session and try again.",
  aiError: "I could not process that right now. Please try again in a moment.",
};

function normalizePhone(phone) {
  const raw = String(phone || "").trim();
  if (!raw) return "";
  const digits = raw.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) return digits;
  if (digits.startsWith("00")) return `+${digits.slice(2)}`;
  return `+${digits}`;
}

function toComparablePhone(phone) {
  return normalizePhone(phone).replace(/^\+/, "");
}

function normalizeRole(role) {
  const value = String(role || "").trim().toLowerCase();
  if (!ROLE_PRIORITY[value]) return "lead";
  return value;
}

function getHighestRole(candidates) {
  const normalized = candidates.map(normalizeRole);
  return normalized.sort((a, b) => ROLE_PRIORITY[b] - ROLE_PRIORITY[a])[0] || "lead";
}

function parseResponseText(payload) {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const directCandidates = [
    payload.text,
    payload.reply,
    payload.response,
    payload.output_text,
    payload.message,
  ];

  for (const candidate of directCandidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }
  }

  if (Array.isArray(payload.messages)) {
    for (const item of payload.messages) {
      const text =
        (typeof item?.text === "string" && item.text) ||
        (typeof item?.message === "string" && item.message) ||
        (typeof item?.content === "string" && item.content) ||
        "";
      if (text.trim()) return text.trim();
    }
  }

  return null;
}

/**
 * Creates a focused ElevenLabs integration module.
 *
 * This module is intentionally framework-agnostic: use returned functions
 * inside your own Express/Koa/Fastify routes.
 */
export function createElevenLabsIntegration(options) {
  const {
    supabase,
    elevenLabsApiKey,
    elevenLabsAgentId,
    apiBaseUrl = "https://api.elevenlabs.io",
    sessionTimeoutMinutes = 10,
    systemNumbers = [],
    privilegedNumbers = [],
    fallbackMessages = {},
    logger = console,
    toolWebhookBaseUrl = null,
    toolWebhookSecret = null,
  } = options || {};

  if (!supabase) {
    throw new Error("supabase client is required");
  }
  if (!elevenLabsApiKey?.trim()) {
    throw new Error("elevenLabsApiKey is required");
  }
  if (!elevenLabsAgentId?.trim()) {
    throw new Error("elevenLabsAgentId is required");
  }

  const fallback = { ...DEFAULT_FALLBACKS, ...(fallbackMessages || {}) };
  const comparableSystemNumbers = new Set(systemNumbers.map(toComparablePhone));
  const comparablePrivilegedNumbers = new Set(privilegedNumbers.map(toComparablePhone));

  const elevenLabs = axios.create({
    baseURL: apiBaseUrl.replace(/\/+$/, ""),
    timeout: 20000,
    headers: {
      "xi-api-key": elevenLabsApiKey,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
  });

  async function resolveIdentity(phone) {
    const normalizedPhone = normalizePhone(phone);

    const { data: contact, error } = await supabase
      .from("contacts")
      .select("phone,name,role,metadata")
      .eq("phone", normalizedPhone)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed resolving contact: ${error.message}`);
    }

    const metadata = contact?.metadata && typeof contact.metadata === "object" ? contact.metadata : {};
    const roleCandidates = [contact?.role];

    // Guardrail 1: respect role hints in metadata.
    roleCandidates.push(metadata.role, metadata.primary_role);

    // Guardrail 2: explicit owner/admin flags can never degrade to lead.
    if (metadata.is_owner === true || metadata.owner === true) {
      roleCandidates.push("owner");
    }
    if (metadata.is_admin === true || metadata.admin === true) {
      roleCandidates.push("admin");
    }

    // Guardrail 3: privileged number list has highest safety priority.
    if (comparablePrivilegedNumbers.has(toComparablePhone(normalizedPhone))) {
      roleCandidates.push("owner");
    }

    const role = getHighestRole(roleCandidates);
    const name = (contact?.name || metadata.user_name || metadata.name || "Customer").toString();

    return {
      phone: normalizedPhone,
      name,
      role,
      metadata,
    };
  }

  async function logConversation({ phone, role, message, sender, timestamp = new Date().toISOString() }) {
    const payload = {
      phone: normalizePhone(phone),
      role: normalizeRole(role),
      message: String(message || ""),
      sender: String(sender || "user"),
      timestamp,
    };

    const { error } = await supabase.from("conversations").insert(payload);
    if (error) {
      throw new Error(`Failed logging conversation: ${error.message}`);
    }
  }

  async function getConversationHistory(phone, limit = 10) {
    const normalizedPhone = normalizePhone(phone);

    const { data, error } = await supabase
      .from("conversations")
      .select("message,sender,timestamp")
      .eq("phone", normalizedPhone)
      .order("timestamp", { ascending: false })
      .limit(limit);

    if (error) {
      throw new Error(`Failed loading conversation history: ${error.message}`);
    }

    return (data || []).reverse().map((item) => ({
      role: item.sender === "assistant" ? "assistant" : "user",
      content: item.message,
      timestamp: item.timestamp,
    }));
  }

  function buildDynamicVariables(name, role, phone = "") {
    return {
      user_name: (name || "Customer").toString(),
      role: normalizeRole(role),
      phone: normalizePhone(phone),
    };
  }

  async function isSessionActive(phone) {
    const normalizedPhone = normalizePhone(phone);

    const { data, error } = await supabase
      .from("sessions")
      .select("active,last_active")
      .eq("phone", normalizedPhone)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed checking session: ${error.message}`);
    }

    if (!data || data.active !== true) {
      return false;
    }

    const lastActiveMs = new Date(data.last_active).getTime();
    if (!Number.isFinite(lastActiveMs)) {
      return false;
    }

    const timeoutMs = Number(sessionTimeoutMinutes) * 60 * 1000;
    if (Date.now() - lastActiveMs > timeoutMs) {
      return false;
    }

    return true;
  }

  async function updateSession(phone) {
    const normalizedPhone = normalizePhone(phone);

    const { error } = await supabase.from("sessions").upsert(
      {
        phone: normalizedPhone,
        active: true,
        last_active: new Date().toISOString(),
      },
      { onConflict: "phone" },
    );

    if (error) {
      throw new Error(`Failed updating session: ${error.message}`);
    }
  }

  function isSystemNumber(phone) {
    return comparableSystemNumbers.has(toComparablePhone(phone));
  }

  async function callElevenLabs({ identity, userMessage, history }) {
    const dynamicVariables = buildDynamicVariables(identity.name, identity.role, identity.phone);

    const payload = {
      message: userMessage,
      user: {
        id: identity.phone,
        name: identity.name,
      },
      dynamic_variables: dynamicVariables,
      // Send in both keys for compatibility across ConvAI API variants.
      history,
      conversation_history: history,
    };

    const response = await elevenLabs.post(
      `/v1/convai/agents/${encodeURIComponent(elevenLabsAgentId)}/chat`,
      payload,
    );

    const replyText = parseResponseText(response.data);
    if (!replyText) {
      return fallback.aiError;
    }
    return replyText;
  }

  async function processMessage(phone, userMessage) {
    const normalizedPhone = normalizePhone(phone);
    const text = String(userMessage || "").trim();

    if (!normalizedPhone || !text) {
      return {
        ok: false,
        reply: fallback.invalidMessage,
shouldSendToUser: true,
reason: "invalid_input",
      };
    }

    let identity;
    try {
      identity = await resolveIdentity(normalizedPhone);
    } catch (error) {
      logger.error?.({ error: error.message, phone: normalizedPhone }, "identity resolution failed");
      return {
        ok: false,
        reply: fallback.aiError,
shouldSendToUser: true,
reason: "identity_resolution_failed",
      };
    }

    // Log all inbound user messages first, even if we skip AI routing.
    try {
      await logConversation({
        phone: normalizedPhone,
        role: identity.role,
        message: text,
        sender: "user",
      });
    } catch (error) {
      logger.error?.({ error: error.message, phone: normalizedPhone }, "failed to log inbound message");
    }

    if (isSystemNumber(normalizedPhone)) {
      logger.info?.({ phone: normalizedPhone }, "system number message logged only");
      return {
        ok: true,
        routedToAi: false,
        reply: null,
shouldSendToUser: false,
        identity,
        reason: "system_number",
      };
    }

    // Owner-specific session guardrail.
    if (identity.role === "owner") {
      try {
        const active = await isSessionActive(normalizedPhone);
        if (!active) {
          return {
            ok: true,
            routedToAi: false,
            reply: fallback.ownerSessionExpired,
shouldSendToUser: true,
            identity,
            reason: "owner_session_inactive",
          };
        }
      } catch (error) {
        logger.error?.({ error: error.message, phone: normalizedPhone }, "failed checking owner session");
        return {
          ok: false,
          routedToAi: false,
          reply: fallback.aiError,
shouldSendToUser: true,
          identity,
          reason: "session_check_failed",
        };
      }
    }

    try {
      const history = await getConversationHistory(normalizedPhone, 10);
      const aiReply = await callElevenLabs({
        identity,
        userMessage: text,
        history,
      });

      try {
        await logConversation({
          phone: normalizedPhone,
          role: identity.role,
          message: aiReply,
          sender: "assistant",
        });
      } catch (error) {
        logger.error?.({ error: error.message, phone: normalizedPhone }, "failed to log assistant reply");
      }

      if (PRIVILEGED_ROLES.has(identity.role)) {
        try {
          await updateSession(normalizedPhone);
        } catch (error) {
          logger.error?.({ error: error.message, phone: normalizedPhone }, "failed to update session");
        }
      }

      return {
        ok: true,
        routedToAi: true,
        reply: aiReply,
shouldSendToUser: true,
        identity,
      };
    } catch (error) {
      logger.error?.({ error: error.message, phone: normalizedPhone }, "elevenlabs processing failed");
      return {
        ok: false,
        routedToAi: false,
        reply: fallback.aiError,
shouldSendToUser: true,
        identity,
        reason: "elevenlabs_error",
      };
    }
  }

  function buildServerToolWebhookConfig() {
    if (!toolWebhookBaseUrl) {
      return [];
    }
    const base = toolWebhookBaseUrl.replace(/\/+$/, "");
    const headers = toolWebhookSecret
      ? { "x-webhook-secret": toolWebhookSecret }
      : {};

    return [
      {
        name: "save-conversation",
        description: "Persist conversation messages in middleware storage.",
        method: "POST",
        url: `${base}/save-conversation`,
        headers,
      },
      {
        name: "save-lead",
        description: "Upsert lead/contact data captured during conversation.",
        method: "POST",
        url: `${base}/save-lead`,
        headers,
      },
      {
        name: "save-listing",
        description: "Persist listing payloads tied to a contact.",
        method: "POST",
        url: `${base}/save-listing`,
        headers,
      },
    ];
  }

  return {
    processMessage,
    getConversationHistory,
    buildDynamicVariables,
    isSessionActive,
    updateSession,
    buildServerToolWebhookConfig,
  };
}

export default createElevenLabsIntegration;
