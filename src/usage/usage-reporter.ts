import { createSubsystemLogger } from "../logging/subsystem.js";
import { fetchWithRetry } from "../infra/retry.js";

type UsageEventKind = "llm" | "tts";

type UsageEvent = {
  provider: string;
  model: string;
  kind: UsageEventKind;
  inputTokens?: number;
  outputTokens?: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
  totalTokens?: number;
  characters?: number;
  latencyMs?: number;
  sessionId?: string;
  runId?: string;
  source?: string;
  timestamp?: string;
};

const log = createSubsystemLogger("usage-reporter");
const isRailway = Boolean(process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY_PROJECT_ID);
const fallbackControlApiUrl = isRailway ? "http://control-api.railway.internal:8080" : "http://localhost:8788";
const CONTROL_API_URL = (
  process.env.CONTROL_API_URL ||
  process.env.PROPAI_CONTROL_API_URL ||
  fallbackControlApiUrl
).replace(/\/+$/, "");
const CONTROL_TENANT_ID =
  process.env.CONTROL_TENANT_ID || process.env.PROPAI_TENANT_ID || process.env.TENANT_ID || "";
const CONTROL_USAGE_KEY =
  process.env.CONTROL_USAGE_INGEST_KEY ||
  process.env.CONTROL_API_USAGE_KEY ||
  process.env.PROPAI_CONTROL_USAGE_INGEST_KEY ||
  "";
const USAGE_TIMEOUT_MS = 4000;

const ALLOWED_PROVIDERS = new Set(["openai", "anthropic", "xai", "elevenlabs"]);

function normalizeProvider(value: string): string {
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

function toInt(value?: number): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return undefined;
  }
  return Math.max(0, Math.trunc(value));
}

function isUsageConfigured(): boolean {
  return Boolean(CONTROL_API_URL && CONTROL_TENANT_ID && CONTROL_USAGE_KEY);
}

async function postUsageEvents(events: UsageEvent[]): Promise<void> {
  if (!isUsageConfigured() || events.length === 0) {
    return;
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), USAGE_TIMEOUT_MS);
  try {
    const response = await fetchWithRetry(
      `${CONTROL_API_URL}/v1/tenants/${encodeURIComponent(CONTROL_TENANT_ID)}/usage/ingest`,
      {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "x-usage-key": CONTROL_USAGE_KEY,
        },
        body: JSON.stringify({ events }),
        signal: controller.signal,
      },
      {
        context: "usage ingest",
        abortSignal: controller.signal,
        onRetry: (info) => {
          log.warn(
            `usage ingest failed, retrying attempt ${info.retryCount + 1}/${info.maxRetries} in ${info.delayMs}ms`,
          );
        },
      },
    );
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      log.debug(
        `usage ingest failed: ${response.status} ${response.statusText} ${JSON.stringify(payload)}`,
      );
    }
  } catch (err) {
    log.debug(`usage ingest error: ${String(err)}`);
  } finally {
    clearTimeout(timeout);
  }
}

function buildUsageEvent(base: UsageEvent): UsageEvent | null {
  const provider = normalizeProvider(base.provider);
  if (!ALLOWED_PROVIDERS.has(provider)) {
    return null;
  }
  return {
    ...base,
    provider,
    model: base.model.trim() || "unknown",
    inputTokens: toInt(base.inputTokens),
    outputTokens: toInt(base.outputTokens),
    cacheReadTokens: toInt(base.cacheReadTokens),
    cacheWriteTokens: toInt(base.cacheWriteTokens),
    totalTokens: toInt(base.totalTokens),
    characters: toInt(base.characters),
    latencyMs: toInt(base.latencyMs),
    timestamp: base.timestamp ?? new Date().toISOString(),
    source: base.source ?? "gateway",
  };
}

export function reportLlmUsage(params: {
  provider: string;
  model: string;
  usage?: {
    input?: number;
    output?: number;
    cacheRead?: number;
    cacheWrite?: number;
    total?: number;
  };
  sessionId?: string;
  runId?: string;
}): void {
  const usage = params.usage;
  if (!usage) {
    return;
  }
  const event = buildUsageEvent({
    provider: params.provider,
    model: params.model,
    kind: "llm",
    inputTokens: usage.input,
    outputTokens: usage.output,
    cacheReadTokens: usage.cacheRead,
    cacheWriteTokens: usage.cacheWrite,
    totalTokens: usage.total,
    sessionId: params.sessionId,
    runId: params.runId,
  });
  if (!event) {
    return;
  }
  void postUsageEvents([event]);
}

export function reportTtsUsage(params: {
  provider: string;
  model: string;
  characters: number;
  latencyMs?: number;
}): void {
  if (!Number.isFinite(params.characters) || params.characters <= 0) {
    return;
  }
  const event = buildUsageEvent({
    provider: params.provider,
    model: params.model,
    kind: "tts",
    characters: params.characters,
    latencyMs: params.latencyMs,
  });
  if (!event) {
    return;
  }
  void postUsageEvents([event]);
}
