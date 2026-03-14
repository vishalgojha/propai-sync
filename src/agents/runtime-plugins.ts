import type { PropAiSyncConfig } from "../config/config.js";
import { loadPropAiSyncPlugins } from "../plugins/loader.js";
import { resolveUserPath } from "../utils.js";

export function ensureRuntimePluginsLoaded(params: {
  config?: PropAiSyncConfig;
  workspaceDir?: string | null;
}): void {
  const workspaceDir =
    typeof params.workspaceDir === "string" && params.workspaceDir.trim()
      ? resolveUserPath(params.workspaceDir)
      : undefined;

  loadPropAiSyncPlugins({
    config: params.config,
    workspaceDir,
  });
}


