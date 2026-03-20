import { DEFAULT_CONTEXT_TOKENS } from "../agents/defaults.js";
import { normalizeProviderId, parseModelRef } from "../agents/model-selection.js";
import { DEFAULT_AGENT_MAX_CONCURRENT, DEFAULT_SUBAGENT_MAX_CONCURRENT } from "./agent-limits.js";
import { resolveAgentModelPrimaryValue } from "./model-input.js";
import {
  DEFAULT_TALK_PROVIDER,
  normalizeTalkConfig,
  resolveActiveTalkProviderConfig,
  resolveTalkApiKey,
} from "./talk.js";
import type { PropAiSyncConfig } from "./types.js";
import type { ModelDefinitionConfig } from "./types.models.js";
import { hasConfiguredSecretInput } from "./types.secrets.js";
import { readPropAiEnvValue } from "../infra/env-read.js";

type WarnState = { warned: boolean };

let defaultWarnState: WarnState = { warned: false };

type AnthropicAuthDefaultsMode = "api_key" | "oauth";

const DEFAULT_MODEL_ALIASES: Readonly<Record<string, string>> = {
  // Anthropic (pi-ai catalog uses "latest" ids without date suffix)
  opus: "anthropic/claude-opus-4-6",
  sonnet: "anthropic/claude-sonnet-4-6",

  // OpenAI
  gpt: "openai/gpt-5.4",
  "gpt-mini": "openai/gpt-5-mini",

  // Google Gemini (3.x are preview ids in the catalog)
  gemini: "google/gemini-3.1-pro-preview",
  "gemini-flash": "google/gemini-3-flash-preview",
  "gemini-flash-lite": "google/gemini-3.1-flash-lite-preview",
};

const DEFAULT_MODEL_COST: ModelDefinitionConfig["cost"] = {
  input: 0,
  output: 0,
  cacheRead: 0,
  cacheWrite: 0,
};
const DEFAULT_MODEL_INPUT: ModelDefinitionConfig["input"] = ["text"];
const DEFAULT_MODEL_MAX_TOKENS = 8192;

type ModelDefinitionLike = Partial<ModelDefinitionConfig> &
  Pick<ModelDefinitionConfig, "id" | "name">;

function resolveDefaultProviderApi(
  providerId: string,
  providerApi: ModelDefinitionConfig["api"] | undefined,
): ModelDefinitionConfig["api"] | undefined {
  if (providerApi) {
    return providerApi;
  }
  return normalizeProviderId(providerId) === "anthropic" ? "anthropic-messages" : undefined;
}

function isPositiveNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function resolveModelCost(
  raw?: Partial<ModelDefinitionConfig["cost"]>,
): ModelDefinitionConfig["cost"] {
  return {
    input: typeof raw?.input === "number" ? raw.input : DEFAULT_MODEL_COST.input,
    output: typeof raw?.output === "number" ? raw.output : DEFAULT_MODEL_COST.output,
    cacheRead: typeof raw?.cacheRead === "number" ? raw.cacheRead : DEFAULT_MODEL_COST.cacheRead,
    cacheWrite:
      typeof raw?.cacheWrite === "number" ? raw.cacheWrite : DEFAULT_MODEL_COST.cacheWrite,
  };
}

function resolveAnthropicDefaultAuthMode(cfg: PropAiSyncConfig): AnthropicAuthDefaultsMode | null {
  const profiles = cfg.auth?.profiles ?? {};
  const anthropicProfiles = Object.entries(profiles).filter(
    ([, profile]) => profile?.provider === "anthropic",
  );

  const order = cfg.auth?.order?.anthropic ?? [];
  for (const profileId of order) {
    const entry = profiles[profileId];
    if (!entry || entry.provider !== "anthropic") {
      continue;
    }
    if (entry.mode === "api_key") {
      return "api_key";
    }
    if (entry.mode === "oauth" || entry.mode === "token") {
      return "oauth";
    }
  }

  const hasApiKey = anthropicProfiles.some(([, profile]) => profile?.mode === "api_key");
  const hasOauth = anthropicProfiles.some(
    ([, profile]) => profile?.mode === "oauth" || profile?.mode === "token",
  );
  if (hasApiKey && !hasOauth) {
    return "api_key";
  }
  if (hasOauth && !hasApiKey) {
    return "oauth";
  }

  if (process.env.ANTHROPIC_OAUTH_TOKEN?.trim()) {
    return "oauth";
  }
  if (process.env.ANTHROPIC_API_KEY?.trim()) {
    return "api_key";
  }
  return null;
}

function resolvePrimaryModelRef(raw?: string): string | null {
  if (!raw || typeof raw !== "string") {
    return null;
  }
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }
  const aliasKey = trimmed.toLowerCase();
  return DEFAULT_MODEL_ALIASES[aliasKey] ?? trimmed;
}

export type SessionDefaultsOptions = {
  warn?: (message: string) => void;
  warnState?: WarnState;
};

export function applyMessageDefaults(cfg: PropAiSyncConfig): PropAiSyncConfig {
  const messages = cfg.messages;
  const hasAckScope = messages?.ackReactionScope !== undefined;
  if (hasAckScope) {
    return cfg;
  }

  const nextMessages = messages ? { ...messages } : {};
  nextMessages.ackReactionScope = "group-mentions";
  return {
    ...cfg,
    messages: nextMessages,
  };
}

export function applySessionDefaults(
  cfg: PropAiSyncConfig,
  options: SessionDefaultsOptions = {},
): PropAiSyncConfig {
  const session = cfg.session;
  if (!session || session.mainKey === undefined) {
    return cfg;
  }

  const trimmed = session.mainKey.trim();
  const warn = options.warn ?? console.warn;
  const warnState = options.warnState ?? defaultWarnState;

  const next: PropAiSyncConfig = {
    ...cfg,
    session: { ...session, mainKey: "main" },
  };

  if (trimmed && trimmed !== "main" && !warnState.warned) {
    warnState.warned = true;
    warn('session.mainKey is ignored; main session is always "main".');
  }

  return next;
}

export function applyTalkApiKey(config: PropAiSyncConfig): PropAiSyncConfig {
  const normalized = normalizeTalkConfig(config);
  const resolved = resolveTalkApiKey();
  if (!resolved) {
    return normalized;
  }

  const talk = normalized.talk;
  const active = resolveActiveTalkProviderConfig(talk);
  if (active?.provider && active.provider !== DEFAULT_TALK_PROVIDER) {
    return normalized;
  }

  const existingProviderApiKeyConfigured = hasConfiguredSecretInput(active?.config?.apiKey);
  const existingLegacyApiKeyConfigured = hasConfiguredSecretInput(talk?.apiKey);
  if (existingProviderApiKeyConfigured || existingLegacyApiKeyConfigured) {
    return normalized;
  }

  const providerId = active?.provider ?? DEFAULT_TALK_PROVIDER;
  const providers = { ...talk?.providers };
  const providerConfig = { ...providers[providerId], apiKey: resolved };
  providers[providerId] = providerConfig;

  const nextTalk = {
    ...talk,
    apiKey: resolved,
    provider: talk?.provider ?? providerId,
    providers,
  };

  return {
    ...normalized,
    talk: nextTalk,
  };
}

export function applyTalkConfigNormalization(config: PropAiSyncConfig): PropAiSyncConfig {
  return normalizeTalkConfig(config);
}

function parseEnvList(value?: string): string[] | undefined {
  if (!value) {
    return undefined;
  }
  const items = value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
  return items.length > 0 ? items : undefined;
}

function parseEnvBool(value?: string): boolean | undefined {
  if (!value) {
    return undefined;
  }
  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true;
  }
  if (["0", "false", "no", "off"].includes(normalized)) {
    return false;
  }
  return undefined;
}

export function applyControlUiEnvDefaults(cfg: PropAiSyncConfig): PropAiSyncConfig {
  const allowedOrigins = parseEnvList(
    readPropAiEnvValue(process.env, "CONTROL_UI_ALLOWED_ORIGINS") ??
      process.env.CONTROL_UI_ALLOWED_ORIGINS ??
      process.env.PROPAI_GATEWAY_CONTROL_UI_ALLOWED_ORIGINS ??
      process.env.GATEWAY_CONTROL_UI_ALLOWED_ORIGINS,
  );
  const hostHeaderFallback = parseEnvBool(
    readPropAiEnvValue(process.env, "CONTROL_UI_HOST_HEADER_FALLBACK") ??
      process.env.CONTROL_UI_HOST_HEADER_FALLBACK ??
      process.env.PROPAI_GATEWAY_CONTROL_UI_HOST_HEADER_FALLBACK ??
      process.env.GATEWAY_CONTROL_UI_HOST_HEADER_FALLBACK ??
      process.env.PROPAI_GATEWAY_CONTROL_UI_DANGEROUSLY_ALLOW_HOST_HEADER_ORIGIN_FALLBACK ??
      process.env.GATEWAY_CONTROL_UI_DANGEROUSLY_ALLOW_HOST_HEADER_ORIGIN_FALLBACK ??
      process.env.PROPAI_CONTROL_UI_DANGEROUSLY_ALLOW_HOST_HEADER_ORIGIN_FALLBACK ??
      process.env.CONTROL_UI_DANGEROUSLY_ALLOW_HOST_HEADER_ORIGIN_FALLBACK,
  );

  if (!allowedOrigins && hostHeaderFallback === undefined) {
    return cfg;
  }

  const gateway = cfg.gateway ?? {};
  const controlUi = gateway.controlUi ?? {};
  let mutated = false;

  const nextControlUi = { ...controlUi };
  const existingOrigins =
    Array.isArray(controlUi.allowedOrigins)
      ? controlUi.allowedOrigins.map((value) => value.trim()).filter(Boolean)
      : [];
  if (allowedOrigins) {
    const sameOrigins =
      existingOrigins.length === allowedOrigins.length &&
      existingOrigins.every((value, index) => value === allowedOrigins[index]);
    if (!sameOrigins) {
      nextControlUi.allowedOrigins = allowedOrigins;
      mutated = true;
    }
  }
  if (
    hostHeaderFallback !== undefined &&
    controlUi.dangerouslyAllowHostHeaderOriginFallback !== hostHeaderFallback
  ) {
    nextControlUi.dangerouslyAllowHostHeaderOriginFallback = hostHeaderFallback;
    mutated = true;
  }

  if (!mutated) {
    return cfg;
  }

  return {
    ...cfg,
    gateway: {
      ...gateway,
      controlUi: nextControlUi,
    },
  };
}

export function applyWhatsAppCloudEnvDefaults(cfg: PropAiSyncConfig): PropAiSyncConfig {
  const accessToken = process.env.META_WA_ACCESS_TOKEN?.trim();
  const phoneNumberId = process.env.META_WA_PHONE_NUMBER_ID?.trim();
  const verifyToken = process.env.META_WA_VERIFY_TOKEN?.trim();
  const appSecret = process.env.META_WA_APP_SECRET?.trim();
  const baseUrl = process.env.META_WA_BASE_URL?.trim();

  if (!accessToken && !phoneNumberId && !verifyToken && !appSecret && !baseUrl) {
    return cfg;
  }

  const channels = cfg.channels ?? {};
  const whatsapp = channels.whatsapp ?? {};
  const cloud = whatsapp.cloud ?? {};
  let mutated = false;

  const nextCloud = { ...cloud };
  const assignIfMissing = <T extends keyof typeof nextCloud>(key: T, value?: string) => {
    if (!value || (typeof nextCloud[key] === "string" && nextCloud[key]?.trim())) {
      return;
    }
    nextCloud[key] = value as (typeof nextCloud)[T];
    mutated = true;
  };

  assignIfMissing("accessToken", accessToken);
  assignIfMissing("phoneNumberId", phoneNumberId);
  assignIfMissing("verifyToken", verifyToken);
  assignIfMissing("appSecret", appSecret);
  assignIfMissing("baseUrl", baseUrl);

  let nextProvider = whatsapp.provider;
  if (!nextProvider && (accessToken || phoneNumberId)) {
    nextProvider = "cloud";
    mutated = true;
  }

  if (!mutated) {
    return cfg;
  }

  return {
    ...cfg,
    channels: {
      ...channels,
      whatsapp: {
        ...whatsapp,
        provider: nextProvider,
        cloud: nextCloud,
      },
    },
  };
}

export function applyModelDefaults(cfg: PropAiSyncConfig): PropAiSyncConfig {
  let mutated = false;
  let nextCfg = cfg;

  const providerConfig = nextCfg.models?.providers;
  if (providerConfig) {
    const nextProviders = { ...providerConfig };
    for (const [providerId, provider] of Object.entries(providerConfig)) {
      const models = provider.models;
      if (!Array.isArray(models) || models.length === 0) {
        continue;
      }
      const providerApi = resolveDefaultProviderApi(providerId, provider.api);
      let nextProvider = provider;
      if (providerApi && provider.api !== providerApi) {
        mutated = true;
        nextProvider = { ...nextProvider, api: providerApi };
      }
      let providerMutated = false;
      const nextModels = models.map((model) => {
        const raw = model as ModelDefinitionLike;
        let modelMutated = false;

        const reasoning = typeof raw.reasoning === "boolean" ? raw.reasoning : false;
        if (raw.reasoning !== reasoning) {
          modelMutated = true;
        }

        const input = raw.input ?? [...DEFAULT_MODEL_INPUT];
        if (raw.input === undefined) {
          modelMutated = true;
        }

        const cost = resolveModelCost(raw.cost);
        const costMutated =
          !raw.cost ||
          raw.cost.input !== cost.input ||
          raw.cost.output !== cost.output ||
          raw.cost.cacheRead !== cost.cacheRead ||
          raw.cost.cacheWrite !== cost.cacheWrite;
        if (costMutated) {
          modelMutated = true;
        }

        const contextWindow = isPositiveNumber(raw.contextWindow)
          ? raw.contextWindow
          : DEFAULT_CONTEXT_TOKENS;
        if (raw.contextWindow !== contextWindow) {
          modelMutated = true;
        }

        const defaultMaxTokens = Math.min(DEFAULT_MODEL_MAX_TOKENS, contextWindow);
        const rawMaxTokens = isPositiveNumber(raw.maxTokens) ? raw.maxTokens : defaultMaxTokens;
        const maxTokens = Math.min(rawMaxTokens, contextWindow);
        if (raw.maxTokens !== maxTokens) {
          modelMutated = true;
        }
        const api = raw.api ?? providerApi;
        if (raw.api !== api) {
          modelMutated = true;
        }

        if (!modelMutated) {
          return model;
        }
        providerMutated = true;
        return {
          ...raw,
          reasoning,
          input,
          cost,
          contextWindow,
          maxTokens,
          api,
        } as ModelDefinitionConfig;
      });

      if (!providerMutated) {
        if (nextProvider !== provider) {
          nextProviders[providerId] = nextProvider;
        }
        continue;
      }
      nextProviders[providerId] = { ...nextProvider, models: nextModels };
      mutated = true;
    }

    if (mutated) {
      nextCfg = {
        ...nextCfg,
        models: {
          ...nextCfg.models,
          providers: nextProviders,
        },
      };
    }
  }

  const existingAgent = nextCfg.agents?.defaults;
  if (!existingAgent) {
    return mutated ? nextCfg : cfg;
  }
  const existingModels = existingAgent.models ?? {};
  if (Object.keys(existingModels).length === 0) {
    return mutated ? nextCfg : cfg;
  }

  const nextModels: Record<string, { alias?: string }> = {
    ...existingModels,
  };

  for (const [alias, target] of Object.entries(DEFAULT_MODEL_ALIASES)) {
    const entry = nextModels[target];
    if (!entry) {
      continue;
    }
    if (entry.alias !== undefined) {
      continue;
    }
    nextModels[target] = { ...entry, alias };
    mutated = true;
  }

  if (!mutated) {
    return cfg;
  }

  return {
    ...nextCfg,
    agents: {
      ...nextCfg.agents,
      defaults: { ...existingAgent, models: nextModels },
    },
  };
}

export function applyAgentDefaults(cfg: PropAiSyncConfig): PropAiSyncConfig {
  const agents = cfg.agents;
  const defaults = agents?.defaults;
  const hasMax =
    typeof defaults?.maxConcurrent === "number" && Number.isFinite(defaults.maxConcurrent);
  const hasSubMax =
    typeof defaults?.subagents?.maxConcurrent === "number" &&
    Number.isFinite(defaults.subagents.maxConcurrent);
  if (hasMax && hasSubMax) {
    return cfg;
  }

  let mutated = false;
  const nextDefaults = defaults ? { ...defaults } : {};
  if (!hasMax) {
    nextDefaults.maxConcurrent = DEFAULT_AGENT_MAX_CONCURRENT;
    mutated = true;
  }

  const nextSubagents = defaults?.subagents ? { ...defaults.subagents } : {};
  if (!hasSubMax) {
    nextSubagents.maxConcurrent = DEFAULT_SUBAGENT_MAX_CONCURRENT;
    mutated = true;
  }

  if (!mutated) {
    return cfg;
  }

  return {
    ...cfg,
    agents: {
      ...agents,
      defaults: {
        ...nextDefaults,
        subagents: nextSubagents,
      },
    },
  };
}

export function applyLoggingDefaults(cfg: PropAiSyncConfig): PropAiSyncConfig {
  const logging = cfg.logging;
  if (!logging) {
    return cfg;
  }
  if (logging.redactSensitive) {
    return cfg;
  }
  return {
    ...cfg,
    logging: {
      ...logging,
      redactSensitive: "tools",
    },
  };
}

export function applyContextPruningDefaults(cfg: PropAiSyncConfig): PropAiSyncConfig {
  const defaults = cfg.agents?.defaults;
  if (!defaults) {
    return cfg;
  }

  const authMode = resolveAnthropicDefaultAuthMode(cfg);
  if (!authMode) {
    return cfg;
  }

  let mutated = false;
  const nextDefaults = { ...defaults };
  const contextPruning = defaults.contextPruning ?? {};
  const heartbeat = defaults.heartbeat ?? {};

  if (defaults.contextPruning?.mode === undefined) {
    nextDefaults.contextPruning = {
      ...contextPruning,
      mode: "cache-ttl",
      ttl: defaults.contextPruning?.ttl ?? "1h",
    };
    mutated = true;
  }

  if (defaults.heartbeat?.every === undefined) {
    nextDefaults.heartbeat = {
      ...heartbeat,
      every: authMode === "oauth" ? "1h" : "30m",
    };
    mutated = true;
  }

  if (authMode === "api_key") {
    const nextModels = defaults.models ? { ...defaults.models } : {};
    let modelsMutated = false;
    const isAnthropicCacheRetentionTarget = (
      parsed: { provider: string; model: string } | null | undefined,
    ): parsed is { provider: string; model: string } =>
      Boolean(
        parsed &&
        (parsed.provider === "anthropic" ||
          (parsed.provider === "amazon-bedrock" &&
            parsed.model.toLowerCase().includes("anthropic.claude"))),
      );

    for (const [key, entry] of Object.entries(nextModels)) {
      const parsed = parseModelRef(key, "anthropic");
      if (!isAnthropicCacheRetentionTarget(parsed)) {
        continue;
      }
      const current = entry ?? {};
      const params = (current as { params?: Record<string, unknown> }).params ?? {};
      if (typeof params.cacheRetention === "string") {
        continue;
      }
      nextModels[key] = {
        ...(current as Record<string, unknown>),
        params: { ...params, cacheRetention: "short" },
      };
      modelsMutated = true;
    }

    const primary = resolvePrimaryModelRef(
      resolveAgentModelPrimaryValue(defaults.model) ?? undefined,
    );
    if (primary) {
      const parsedPrimary = parseModelRef(primary, "anthropic");
      if (isAnthropicCacheRetentionTarget(parsedPrimary)) {
        const key = `${parsedPrimary.provider}/${parsedPrimary.model}`;
        const entry = nextModels[key];
        const current = entry ?? {};
        const params = (current as { params?: Record<string, unknown> }).params ?? {};
        if (typeof params.cacheRetention !== "string") {
          nextModels[key] = {
            ...(current as Record<string, unknown>),
            params: { ...params, cacheRetention: "short" },
          };
          modelsMutated = true;
        }
      }
    }

    if (modelsMutated) {
      nextDefaults.models = nextModels;
      mutated = true;
    }
  }

  if (!mutated) {
    return cfg;
  }

  return {
    ...cfg,
    agents: {
      ...cfg.agents,
      defaults: nextDefaults,
    },
  };
}

export function applyCompactionDefaults(cfg: PropAiSyncConfig): PropAiSyncConfig {
  const defaults = cfg.agents?.defaults;
  if (!defaults) {
    return cfg;
  }
  const compaction = defaults?.compaction;
  if (compaction?.mode) {
    return cfg;
  }

  return {
    ...cfg,
    agents: {
      ...cfg.agents,
      defaults: {
        ...defaults,
        compaction: {
          ...compaction,
          mode: "safeguard",
        },
      },
    },
  };
}

export function resetSessionDefaultsWarningForTests() {
  defaultWarnState = { warned: false };
}
