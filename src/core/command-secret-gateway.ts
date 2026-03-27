import type { PropAiSyncConfig } from "../config/config.js";

export type CommandSecretResolveResult = {
  resolvedConfig: PropAiSyncConfig;
  diagnostics: string[];
};

export async function resolveCommandSecretRefsViaGateway(params: {
  config: PropAiSyncConfig;
  commandName?: string;
  targetIds?: string[];
}): Promise<CommandSecretResolveResult> {
  return {
    resolvedConfig: params.config,
    diagnostics: [],
  };
}
