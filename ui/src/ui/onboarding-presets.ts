export type OnboardingWizardPresetId = string;

export type OnboardingWizardPreset = {
  id: OnboardingWizardPresetId;
  label: string;
  hint: string;
  groupLabel?: string;
  choiceLabel?: string;
  providerGroup?: string;
  authChoice?: string;
  model?: string;
};

type PresetChoice = {
  id: OnboardingWizardPresetId;
  label: string;
  hint?: string;
  authChoice: string;
};

type PresetGroup = {
  id: string;
  label: string;
  hint?: string;
  choices: PresetChoice[];
};

export const DEFAULT_ONBOARDING_PRESET_ID = "openai-codex";

const MANUAL_PRESET: OnboardingWizardPreset = {
  id: "none",
  label: "Pick options manually",
  hint: "No preset",
};

const ONBOARDING_PRESET_GROUPS: PresetGroup[] = [
  {
    id: "modelstudio",
    label: "Alibaba Cloud Model Studio",
    hint: "Coding Plan API key (CN / Global)",
    choices: [
      {
        id: "modelstudio-api-key",
        label: "Coding Plan API key (Global/Intl)",
        hint: "Endpoint: coding-intl.dashscope.aliyuncs.com",
        authChoice: "modelstudio-api-key",
      },
      {
        id: "modelstudio-api-key-cn",
        label: "Coding Plan API key (China)",
        hint: "Endpoint: coding.dashscope.aliyuncs.com",
        authChoice: "modelstudio-api-key-cn",
      },
    ],
  },
  {
    id: "anthropic",
    label: "Anthropic",
    hint: "setup-token + API key",
    choices: [
      {
        id: "token",
        label: "Setup token",
        hint: "Run `claude setup-token` and paste it here",
        authChoice: "token",
      },
      {
        id: "apiKey",
        label: "API key",
        authChoice: "apiKey",
      },
    ],
  },
  {
    id: "byteplus",
    label: "BytePlus",
    hint: "API key",
    choices: [{ id: "byteplus-api-key", label: "API key", authChoice: "byteplus-api-key" }],
  },
  {
    id: "chutes",
    label: "Chutes",
    hint: "OAuth",
    choices: [{ id: "chutes", label: "OAuth", authChoice: "chutes" }],
  },
  {
    id: "cloudflare-ai-gateway",
    label: "Cloudflare AI Gateway",
    hint: "Account ID + Gateway ID + API key",
    choices: [
      {
        id: "cloudflare-ai-gateway-api-key",
        label: "API key",
        authChoice: "cloudflare-ai-gateway-api-key",
      },
    ],
  },
  {
    id: "copilot",
    label: "Copilot",
    hint: "GitHub + local proxy",
    choices: [
      {
        id: "github-copilot",
        label: "GitHub Copilot",
        hint: "Uses GitHub device flow",
        authChoice: "github-copilot",
      },
      {
        id: "copilot-proxy",
        label: "Copilot Proxy (local)",
        hint: "Local proxy for VS Code Copilot models",
        authChoice: "copilot-proxy",
      },
    ],
  },
  {
    id: "custom",
    label: "Custom Provider",
    hint: "Any OpenAI or Anthropic compatible endpoint",
    choices: [{ id: "custom-api-key", label: "Custom API key", authChoice: "custom-api-key" }],
  },
  {
    id: "google",
    label: "Google",
    hint: "Gemini API key + OAuth",
    choices: [
      {
        id: "gemini-api-key",
        label: "Gemini API key",
        authChoice: "gemini-api-key",
      },
      {
        id: "google-gemini-cli",
        label: "Gemini CLI OAuth",
        hint: "Unofficial flow; review account-risk warning before use",
        authChoice: "google-gemini-cli",
      },
    ],
  },
  {
    id: "huggingface",
    label: "Hugging Face",
    hint: "Inference API (HF token)",
    choices: [{ id: "huggingface-api-key", label: "API key", authChoice: "huggingface-api-key" }],
  },
  {
    id: "kilocode",
    label: "Kilo Gateway",
    hint: "API key (OpenRouter-compatible)",
    choices: [{ id: "kilocode-api-key", label: "API key", authChoice: "kilocode-api-key" }],
  },
  {
    id: "litellm",
    label: "LiteLLM",
    hint: "Unified LLM gateway (100+ providers)",
    choices: [{ id: "litellm-api-key", label: "API key", authChoice: "litellm-api-key" }],
  },
  {
    id: "minimax",
    label: "MiniMax",
    hint: "M2.5 (recommended)",
    choices: [
      {
        id: "minimax-portal",
        label: "MiniMax OAuth",
        hint: "Oauth plugin for MiniMax",
        authChoice: "minimax-portal",
      },
      { id: "minimax-api", label: "MiniMax M2.5", authChoice: "minimax-api" },
      {
        id: "minimax-api-lightning",
        label: "MiniMax M2.5 Highspeed",
        hint: "Official fast tier (legacy: Lightning)",
        authChoice: "minimax-api-lightning",
      },
      {
        id: "minimax-api-key-cn",
        label: "MiniMax M2.5 (CN)",
        hint: "China endpoint (api.minimaxi.com)",
        authChoice: "minimax-api-key-cn",
      },
    ],
  },
  {
    id: "moonshot",
    label: "Moonshot AI (Kimi K2.5)",
    hint: "Kimi K2.5 + Kimi Coding",
    choices: [
      { id: "moonshot-api-key", label: "Kimi API key (.ai)", authChoice: "moonshot-api-key" },
      {
        id: "moonshot-api-key-cn",
        label: "Kimi API key (.cn)",
        authChoice: "moonshot-api-key-cn",
      },
      {
        id: "kimi-code-api-key",
        label: "Kimi Code API key (subscription)",
        authChoice: "kimi-code-api-key",
      },
    ],
  },
  {
    id: "ollama",
    label: "Ollama",
    hint: "Cloud and local open models",
    choices: [{ id: "ollama", label: "Ollama", authChoice: "ollama" }],
  },
  {
    id: "openai",
    label: "OpenAI",
    hint: "Codex OAuth + API key",
    choices: [
      { id: "openai-codex", label: "Codex OAuth", authChoice: "openai-codex" },
      { id: "openai-api-key", label: "API key", authChoice: "openai-api-key" },
    ],
  },
  {
    id: "opencode",
    label: "OpenCode",
    hint: "Shared API key for Zen + Go catalogs",
    choices: [
      {
        id: "opencode-zen",
        label: "OpenCode Zen catalog",
        hint: "Claude, GPT, Gemini via opencode.ai/zen",
        authChoice: "opencode-zen",
      },
      {
        id: "opencode-go",
        label: "OpenCode Go catalog",
        hint: "Kimi/GLM/MiniMax Go catalog",
        authChoice: "opencode-go",
      },
    ],
  },
  {
    id: "openrouter",
    label: "OpenRouter",
    hint: "API key",
    choices: [{ id: "openrouter-api-key", label: "API key", authChoice: "openrouter-api-key" }],
  },
  {
    id: "qianfan",
    label: "Qianfan",
    hint: "API key",
    choices: [{ id: "qianfan-api-key", label: "API key", authChoice: "qianfan-api-key" }],
  },
  {
    id: "qwen",
    label: "Qwen",
    hint: "OAuth",
    choices: [{ id: "qwen-portal", label: "OAuth", authChoice: "qwen-portal" }],
  },
  {
    id: "synthetic",
    label: "Synthetic",
    hint: "Anthropic-compatible (multi-model)",
    choices: [{ id: "synthetic-api-key", label: "API key", authChoice: "synthetic-api-key" }],
  },
  {
    id: "together",
    label: "Together AI",
    hint: "API key",
    choices: [{ id: "together-api-key", label: "API key", authChoice: "together-api-key" }],
  },
  {
    id: "vllm",
    label: "vLLM",
    hint: "Local/self-hosted OpenAI-compatible",
    choices: [
      {
        id: "vllm",
        label: "vLLM (custom URL + model)",
        hint: "Local/self-hosted OpenAI-compatible server",
        authChoice: "vllm",
      },
    ],
  },
  {
    id: "venice",
    label: "Venice AI",
    hint: "Privacy-focused (uncensored models)",
    choices: [{ id: "venice-api-key", label: "API key", authChoice: "venice-api-key" }],
  },
  {
    id: "volcengine",
    label: "Volcano Engine",
    hint: "API key",
    choices: [{ id: "volcengine-api-key", label: "API key", authChoice: "volcengine-api-key" }],
  },
  {
    id: "xai",
    label: "xAI (Grok)",
    hint: "API key",
    choices: [{ id: "xai-api-key", label: "API key", authChoice: "xai-api-key" }],
  },
  {
    id: "xiaomi",
    label: "Xiaomi",
    hint: "API key",
    choices: [{ id: "xiaomi-api-key", label: "API key", authChoice: "xiaomi-api-key" }],
  },
  {
    id: "zai",
    label: "Z.AI",
    hint: "GLM Coding Plan / Global / CN",
    choices: [
      {
        id: "zai-coding-global",
        label: "Coding-Plan-Global",
        hint: "GLM Coding Plan Global (api.z.ai)",
        authChoice: "zai-coding-global",
      },
      {
        id: "zai-coding-cn",
        label: "Coding-Plan-CN",
        hint: "GLM Coding Plan CN (open.bigmodel.cn)",
        authChoice: "zai-coding-cn",
      },
      {
        id: "zai-global",
        label: "Global",
        hint: "Z.AI Global (api.z.ai)",
        authChoice: "zai-global",
      },
      {
        id: "zai-cn",
        label: "CN",
        hint: "Z.AI CN (open.bigmodel.cn)",
        authChoice: "zai-cn",
      },
    ],
  },
];

const ONBOARDING_PRESET_GROUPS_SORTED = [...ONBOARDING_PRESET_GROUPS].sort((a, b) =>
  a.label.localeCompare(b.label),
);

export const ONBOARDING_WIZARD_PRESETS: OnboardingWizardPreset[] = [
  MANUAL_PRESET,
  ...ONBOARDING_PRESET_GROUPS_SORTED.flatMap((group) =>
    group.choices.map((choice) => ({
      id: choice.id,
      label: choice.label,
      choiceLabel: choice.label,
      groupLabel: group.label,
      hint: choice.hint ?? group.hint ?? "",
      providerGroup: group.id,
      authChoice: choice.authChoice,
    })),
  ),
];

export const ONBOARDING_WIZARD_PRESET_GROUPS = ONBOARDING_PRESET_GROUPS_SORTED;

const PRESET_ALIAS_MAP = new Map<string, string>([
  ["manual", "none"],
  ["none", "none"],
  ["anthropic", "apiKey"],
  ["anthropic-api-key", "apiKey"],
  ["openai", "openai-codex"],
  ["openai-codex", "openai-codex"],
]);

export function resolveOnboardingWizardPresetId(raw: unknown): OnboardingWizardPresetId {
  const normalized = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  if (!normalized) {
    return MANUAL_PRESET.id;
  }
  const alias = PRESET_ALIAS_MAP.get(normalized);
  const direct = alias ?? normalized;
  const match = ONBOARDING_WIZARD_PRESETS.find((preset) => preset.id === direct);
  if (match) {
    return match.id;
  }
  return DEFAULT_ONBOARDING_PRESET_ID;
}

export function resolveOnboardingWizardPreset(id: unknown): OnboardingWizardPreset {
  const resolvedId = resolveOnboardingWizardPresetId(id);
  const match = ONBOARDING_WIZARD_PRESETS.find((preset) => preset.id === resolvedId);
  return match ?? ONBOARDING_WIZARD_PRESETS[0];
}
