import type { PropAiSyncConfig } from "./config.js";

export function ensurePluginAllowlisted(cfg: PropAiSyncConfig, pluginId: string): PropAiSyncConfig {
  const allow = cfg.plugins?.allow;
  if (!Array.isArray(allow) || allow.includes(pluginId)) {
    return cfg;
  }
  return {
    ...cfg,
    plugins: {
      ...cfg.plugins,
      allow: [...allow, pluginId],
    },
  };
}


