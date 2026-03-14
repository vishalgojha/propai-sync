import type { PropAiSyncConfig } from "../config/config.js";
import type { DmScope } from "../config/types.base.js";
import type { ToolProfileId } from "../config/types.tools.js";

export const ONBOARDING_DEFAULT_DM_SCOPE: DmScope = "per-channel-peer";
export const ONBOARDING_DEFAULT_TOOLS_PROFILE: ToolProfileId = "coding";
const ONBOARDING_DEFAULT_BUNDLED_SKILLS_ALLOWLIST = [
  "action-suggester",
  "blindspot-supervisor",
  "chatgpt-apps",
  "clawhub",
  "coding-agent",
  "gemini",
  "gog",
  "goplaces",
  "himalaya",
  "india-location-normalizer",
  "lead-extractor",
  "lead-storage",
  "nano-pdf",
  "notion",
  "security-ownership-map",
  "security-threat-model",
  "skill-creator",
  "skill-installer",
  "summarize",
  "trello",
  "wacli",
];

export function applyOnboardingLocalWorkspaceConfig(
  baseConfig: PropAiSyncConfig,
  workspaceDir: string,
): PropAiSyncConfig {
  return {
    ...baseConfig,
    agents: {
      ...baseConfig.agents,
      defaults: {
        ...baseConfig.agents?.defaults,
        workspace: workspaceDir,
      },
    },
    gateway: {
      ...baseConfig.gateway,
      mode: "local",
    },
    session: {
      ...baseConfig.session,
      dmScope: baseConfig.session?.dmScope ?? ONBOARDING_DEFAULT_DM_SCOPE,
    },
    tools: {
      ...baseConfig.tools,
      profile: baseConfig.tools?.profile ?? ONBOARDING_DEFAULT_TOOLS_PROFILE,
    },
    skills: {
      ...baseConfig.skills,
      allowBundled:
        baseConfig.skills?.allowBundled ?? ONBOARDING_DEFAULT_BUNDLED_SKILLS_ALLOWLIST,
    },
  };
}


