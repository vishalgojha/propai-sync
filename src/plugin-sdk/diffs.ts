// Narrow plugin-sdk surface for the bundled diffs plugin.
// Keep this list additive and scoped to symbols used under extensions/diffs.

export type { PropAiSyncConfig } from "../config/config.js";
export { resolvePreferredPropAiSyncTmpDir } from "../infra/tmp-propai-dir.js";
export type {
  AnyAgentTool,
  PropAiSyncPluginApi,
  PropAiSyncPluginConfigSchema,
  PluginLogger,
} from "../plugins/types.js";



