import type { IncomingMessage, ServerResponse } from "node:http";
import { createHmac } from "node:crypto";
import {
  DEFAULT_ACCOUNT_ID,
  listWhatsAppAccountIds,
  normalizeE164,
  resolveWhatsAppAccount,
  type PropAiSyncConfig,
} from "propai/plugin-sdk/whatsapp";
import { safeEqualSecret } from "../../../src/security/secret-equal.js";
import { getReplyFromConfig } from "../../../src/auto-reply/reply.js";
import { DEFAULT_GROUP_HISTORY_LIMIT } from "../../../src/auto-reply/reply/history.js";
import { resolveWhatsAppMediaMaxBytes } from "../../../src/web/accounts.js";
import { createEchoTracker } from "../../../src/web/auto-reply/monitor/echo.js";
import { createWebOnMessageHandler } from "../../../src/web/auto-reply/monitor/on-message.js";
import { buildMentionConfig } from "../../../src/web/auto-reply/mentions.js";
import { newConnectionId } from "../../../src/web/reconnect.js";
import type { WebInboundMessage } from "../../../src/web/inbound/types.js";
import { fetchWithRetry } from "../../../src/infra/retry.js";
import { getWhatsAppRuntime } from "./runtime.js";

type CloudAccount = ReturnType<typeof resolveWhatsAppAccount> & {
  provider?: "baileys" | "cloud";
};

type CloudHandlerEntry = {
  accountId: string;
  handler: (msg: WebInboundMessage) => Promise<void>;
};

const cloudHandlers = new Map<string, CloudHandlerEntry>();
const DEFAULT_CONTROL_API_URL_LOCAL = "http://localhost:8788";
const DEFAULT_CONTROL_API_URL_RAILWAY = "http://control-api.railway.internal:8080";

function resolveCloudAccounts(cfg: PropAiSyncConfig): CloudAccount[] {
  return listWhatsAppAccountIds(cfg)
    .map((accountId) => resolveWhatsAppAccount({ cfg, accountId }))
    .filter((account) => account.provider === "cloud");
}

function resolveCloudAccountByPhoneNumberId(
  cfg: PropAiSyncConfig,
  phoneNumberId?: string | null,
): CloudAccount | null {
  const normalized = phoneNumberId?.trim();
  if (!normalized) {
    return null;
  }
  for (const account of resolveCloudAccounts(cfg)) {
    if (account.cloud?.phoneNumberId?.trim() === normalized) {
      return account;
    }
  }
  return null;
}

function resolveCloudAccountByVerifyToken(
  cfg: PropAiSyncConfig,
  verifyToken?: string | null,
): CloudAccount | null {
  const normalized = verifyToken?.trim();
  if (!normalized) {
    return null;
  }
  for (const account of resolveCloudAccounts(cfg)) {
    if (account.cloud?.verifyToken?.trim() === normalized) {
      return account;
    }
  }
  return null;
}

function resolveCloudAccountSecrets(cfg: PropAiSyncConfig): string[] {
  return resolveCloudAccounts(cfg)
    .map((account) => account.cloud?.appSecret?.trim())
    .filter((value): value is string => Boolean(value));
}

function isCloudConfigured(account: CloudAccount | null): account is CloudAccount {
  if (!account) {
    return false;
  }
  const cloud = account.cloud;
  return Boolean(cloud?.accessToken?.trim() && cloud?.phoneNumberId?.trim());
}

function normalizeWhatsAppNumber(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return trimmed;
  }
  return trimmed.startsWith("+") ? trimmed.slice(1) : trimmed;
}

function resolveControlApiUrl(): string {
  const isRailway = Boolean(process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY_PROJECT_ID);
  const fallback = isRailway ? DEFAULT_CONTROL_API_URL_RAILWAY : DEFAULT_CONTROL_API_URL_LOCAL;
  return (process.env.CONTROL_API_URL || fallback).replace(/\/+$/, "");
}

function isExplicitOnboardingTrigger(text: string): boolean {
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

async function tryHandleWhatsAppOnboarding(params: {
  text: string;
  senderE164?: string;
  senderName?: string | null;
  reply: (text: string) => Promise<void>;
}): Promise<boolean> {
  const trimmed = params.text.trim();
  if (!trimmed) {
    return false;
  }
  const explicitTrigger = isExplicitOnboardingTrigger(trimmed);
  const phone = params.senderE164 ?? null;
  if (!phone) {
    if (explicitTrigger) {
      await params.reply("Please send from a WhatsApp number so we can onboard you.");
      return true;
    }
    return false;
  }
  const controlApiUrl = resolveControlApiUrl();
  try {
    const log = getWhatsAppRuntime().logging.getChildLogger({ module: "whatsapp-cloud" });
    const response = await fetchWithRetry(
      `${controlApiUrl}/v1/whatsapp/onboarding/message`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          phone,
          text: trimmed,
          name: params.senderName ?? undefined,
        }),
      },
      {
        context: "whatsapp-cloud onboarding",
        onRetry: (info) => {
          log.warn(
            {
              attempt: info.retryCount + 1,
              maxRetries: info.maxRetries,
              delayMs: info.delayMs,
            },
            "control-api onboarding failed, retrying",
          );
        },
      },
    );
    const payload = (await response.json().catch(() => ({}))) as { handled?: boolean; reply?: string };
    if (!response.ok) {
      if (explicitTrigger) {
        await params.reply("We could not complete onboarding right now. Please try again in a minute.");
        return true;
      }
      return false;
    }
    if (!payload.handled) {
      return false;
    }
    if (payload.reply?.trim()) {
      await params.reply(payload.reply.trim());
    }
    return true;
  } catch {
    if (explicitTrigger) {
      await params.reply("We could not reach the onboarding service. Please try again shortly.");
      return true;
    }
    return false;
  }
}

async function sendCloudMessage(params: {
  cfg: PropAiSyncConfig;
  accountId: string;
  to: string;
  text: string;
  mediaUrl?: string;
}): Promise<{ messageId: string; toJid: string }> {
  const account = resolveWhatsAppAccount({
    cfg: params.cfg,
    accountId: params.accountId,
  }) as CloudAccount;
  const cloud = account.cloud;
  if (!cloud?.accessToken || !cloud?.phoneNumberId) {
    throw new Error("WhatsApp Cloud API is not configured.");
  }
  const baseUrl = (cloud.baseUrl ?? "https://graph.facebook.com/v21.0").replace(/\/+$/, "");
  const url = `${baseUrl}/${cloud.phoneNumberId}/messages`;
  const toValue = normalizeWhatsAppNumber(params.to);
  const payload: Record<string, unknown> = {
    messaging_product: "whatsapp",
    to: toValue,
  };
  if (params.mediaUrl) {
    payload.type = "image";
    payload.image = {
      link: params.mediaUrl,
      ...(params.text ? { caption: params.text } : {}),
    };
  } else {
    payload.type = "text";
    payload.text = { body: params.text, preview_url: false };
  }
  const log = getWhatsAppRuntime().logging.getChildLogger({
    module: "whatsapp-cloud",
    accountId: params.accountId,
  });
  const response = await fetchWithRetry(
    url,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cloud.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    },
    {
      context: `whatsapp-cloud send (${params.accountId})`,
      onRetry: (info) => {
        log.warn(
          {
            attempt: info.retryCount + 1,
            maxRetries: info.maxRetries,
            delayMs: info.delayMs,
          },
          "whatsapp cloud send failed, retrying",
        );
      },
    },
  );
  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `WhatsApp Cloud API send failed (${response.status}): ${body || response.statusText}`,
    );
  }
  const data = (await response.json().catch(() => null)) as
    | { messages?: Array<{ id?: string }> }
    | null;
  const messageId = data?.messages?.[0]?.id ?? "unknown";
  return { messageId, toJid: params.to };
}

function getCloudOnMessageHandler(params: { cfg: PropAiSyncConfig; accountId: string }) {
  const cached = cloudHandlers.get(params.accountId);
  if (cached) {
    return cached.handler;
  }
  const connectionId = newConnectionId();
  const account = resolveWhatsAppAccount({
    cfg: params.cfg,
    accountId: params.accountId,
  }) as CloudAccount;
  const replyLogger = getWhatsAppRuntime().logging.getChildLogger({
    module: "whatsapp-cloud",
    accountId: params.accountId,
    connectionId,
  });
  const baseMentionConfig = buildMentionConfig(params.cfg);
  const groupHistoryLimit =
    params.cfg.channels?.whatsapp?.accounts?.[params.accountId]?.historyLimit ??
    params.cfg.channels?.whatsapp?.historyLimit ??
    params.cfg.messages?.groupChat?.historyLimit ??
    DEFAULT_GROUP_HISTORY_LIMIT;
  const groupHistories = new Map<string, Array<{ sender: string; body: string }>>();
  const groupMemberNames = new Map<string, Map<string, string>>();
  const echoTracker = createEchoTracker({ maxItems: 100, logVerbose: () => {} });
  const backgroundTasks = new Set<Promise<unknown>>();
  const handler = createWebOnMessageHandler({
    cfg: params.cfg,
    verbose: getWhatsAppRuntime().logging.shouldLogVerbose(),
    connectionId,
    maxMediaBytes: resolveWhatsAppMediaMaxBytes(account),
    groupHistoryLimit,
    groupHistories,
    groupMemberNames,
    echoTracker,
    backgroundTasks,
    replyResolver: getReplyFromConfig,
    replyLogger,
    baseMentionConfig,
    account,
  });
  cloudHandlers.set(params.accountId, { accountId: params.accountId, handler });
  return handler;
}

async function readRawBody(req: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

function verifyWebhookSignature(params: {
  rawBody: Buffer;
  signatureHeader: string | null;
  appSecrets: string[];
}): boolean {
  if (params.appSecrets.length === 0) {
    return true;
  }
  if (!params.signatureHeader) {
    return false;
  }
  return params.appSecrets.some((secret) => {
    const digest = createHmac("sha256", secret).update(params.rawBody).digest("hex");
    return safeEqualSecret(params.signatureHeader, `sha256=${digest}`);
  });
}

function extractCloudMessageText(message: Record<string, unknown>): string | null {
  const text = (message.text as { body?: string } | undefined)?.body;
  if (text) {
    return text;
  }
  const buttonText = (message.button as { text?: string } | undefined)?.text;
  if (buttonText) {
    return buttonText;
  }
  const interactive = message.interactive as
    | { button_reply?: { title?: string }; list_reply?: { title?: string } }
    | undefined;
  if (interactive?.button_reply?.title) {
    return interactive.button_reply.title;
  }
  if (interactive?.list_reply?.title) {
    return interactive.list_reply.title;
  }
  return null;
}

function resolveContactName(value: {
  contacts?: Array<{ profile?: { name?: string }; wa_id?: string }>;
  from?: string;
}): string | undefined {
  const match =
    value.contacts?.find((contact) => contact.wa_id === value.from) ?? value.contacts?.[0];
  return match?.profile?.name?.trim() || undefined;
}

export async function handleWhatsAppCloudWebhook(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<boolean> {
  const cfg = getWhatsAppRuntime().config.loadConfig();
  const cloudAccounts = resolveCloudAccounts(cfg);
  if (cloudAccounts.length === 0) {
    res.statusCode = 404;
    res.end("WhatsApp Cloud API not configured");
    return true;
  }

  const url = new URL(req.url ?? "/", "http://localhost");
  if (req.method === "GET") {
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");
    const account = resolveCloudAccountByVerifyToken(cfg, token);
    if (mode === "subscribe" && account && challenge) {
      res.statusCode = 200;
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.end(challenge);
      return true;
    }
    res.statusCode = 403;
    res.end("Forbidden");
    return true;
  }

  if (req.method !== "POST") {
    res.statusCode = 405;
    res.end("Method Not Allowed");
    return true;
  }

  const rawBody = await readRawBody(req);
  const signatureHeader = req.headers["x-hub-signature-256"];
  const signature =
    typeof signatureHeader === "string"
      ? signatureHeader
      : Array.isArray(signatureHeader)
        ? signatureHeader[0] ?? null
        : null;
  if (
    !verifyWebhookSignature({
      rawBody,
      signatureHeader: signature,
      appSecrets: resolveCloudAccountSecrets(cfg),
    })
  ) {
    res.statusCode = 403;
    res.end("Invalid signature");
    return true;
  }

  let payload: {
    entry?: Array<{
      changes?: Array<{
        value?: {
          messaging_product?: string;
          metadata?: { phone_number_id?: string; display_phone_number?: string };
          contacts?: Array<{ profile?: { name?: string }; wa_id?: string }>;
          messages?: Array<Record<string, unknown>>;
        };
      }>;
    }>;
  } | null = null;
  try {
    payload = JSON.parse(rawBody.toString("utf-8"));
  } catch {
    res.statusCode = 400;
    res.end("Invalid JSON");
    return true;
  }

  const entries = payload?.entry ?? [];
  for (const entry of entries) {
    for (const change of entry.changes ?? []) {
      const value = change.value;
      if (!value || value.messaging_product !== "whatsapp") {
        continue;
      }
      const phoneNumberId = value.metadata?.phone_number_id ?? null;
      const displayPhone = value.metadata?.display_phone_number ?? null;
      const messages = value.messages ?? [];
      for (const message of messages) {
        const from = String(message.from ?? "").trim();
        if (!from) {
          continue;
        }
        const account =
          resolveCloudAccountByPhoneNumberId(cfg, phoneNumberId) ??
          resolveWhatsAppAccount({ cfg, accountId: DEFAULT_ACCOUNT_ID });
        const resolved = account as CloudAccount;
        if (!isCloudConfigured(resolved)) {
          continue;
        }
        const text = extractCloudMessageText(message);
        if (!text) {
          continue;
        }
        const senderE164 = normalizeE164(from) ?? (from.startsWith("+") ? from : `+${from}`);
        const contactName = resolveContactName({
          contacts: value.contacts ?? [],
          from,
        });
        const inbound: WebInboundMessage = {
          id: typeof message.id === "string" ? message.id : undefined,
          from: senderE164 ?? from,
          conversationId: senderE164 ?? from,
          to: displayPhone ?? resolved.cloud?.phoneNumberId ?? "",
          accountId: resolved.accountId ?? DEFAULT_ACCOUNT_ID,
          body: text,
          pushName: contactName,
          timestamp: message.timestamp ? Number(message.timestamp) * 1000 : undefined,
          chatType: "direct",
          chatId: senderE164 ?? from,
          senderE164: senderE164 ?? undefined,
          senderName: contactName,
          selfE164: displayPhone ? normalizeE164(displayPhone) ?? displayPhone : undefined,
          sendComposing: async () => {},
          reply: async (replyText: string) => {
            await sendCloudMessage({
              cfg,
              accountId: resolved.accountId ?? DEFAULT_ACCOUNT_ID,
              to: from,
              text: replyText,
            });
          },
          sendMedia: async (payload) => {
            const mediaUrl = (payload as { url?: string }).url;
            await sendCloudMessage({
              cfg,
              accountId: resolved.accountId ?? DEFAULT_ACCOUNT_ID,
              to: from,
              text: typeof (payload as { caption?: string }).caption === "string"
                ? (payload as { caption?: string }).caption ?? ""
                : text,
              mediaUrl,
            });
          },
        };

        const handledJoin = await tryHandleWhatsAppOnboarding({
          text,
          senderE164: inbound.senderE164,
          senderName: contactName,
          reply: inbound.reply,
        });
        if (handledJoin) {
          continue;
        }

        const handler = getCloudOnMessageHandler({
          cfg,
          accountId: resolved.accountId ?? DEFAULT_ACCOUNT_ID,
        });
        await handler(inbound);
      }
    }
  }

  res.statusCode = 200;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify({ ok: true }));
  return true;
}

export async function sendCloudText(params: {
  cfg: PropAiSyncConfig;
  accountId: string;
  to: string;
  text: string;
}): Promise<{ messageId: string; toJid: string }> {
  return await sendCloudMessage({
    cfg: params.cfg,
    accountId: params.accountId,
    to: params.to,
    text: params.text,
  });
}

export async function sendCloudMedia(params: {
  cfg: PropAiSyncConfig;
  accountId: string;
  to: string;
  text: string;
  mediaUrl?: string;
}): Promise<{ messageId: string; toJid: string }> {
  return await sendCloudMessage({
    cfg: params.cfg,
    accountId: params.accountId,
    to: params.to,
    text: params.text,
    mediaUrl: params.mediaUrl,
  });
}
