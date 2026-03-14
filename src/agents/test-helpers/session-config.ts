import type { PropAiSyncConfig } from "../../config/config.js";

export function createPerSenderSessionConfig(
  overrides: Partial<NonNullable<PropAiSyncConfig["session"]>> = {},
): NonNullable<PropAiSyncConfig["session"]> {
  return {
    mainKey: "main",
    scope: "per-sender",
    ...overrides,
  };
}


