import { listChannelPluginCatalogEntries } from "../channels/plugins/catalog.js";
import { listChannelPlugins } from "../channels/plugins/index.js";
import { listChatChannels, resolveRuntimeChannelAllowlist } from "../channels/registry.js";
import { isTruthyEnvValue } from "../infra/env.js";
import { ensurePluginRegistryLoaded } from "./plugin-registry.js";

function dedupe(values: string[]): string[] {
  const seen = new Set<string>();
  const resolved: string[] = [];
  for (const value of values) {
    if (!value || seen.has(value)) {
      continue;
    }
    seen.add(value);
    resolved.push(value);
  }
  return resolved;
}

export function resolveCliChannelOptions(): string[] {
  const allowlist = resolveRuntimeChannelAllowlist();
  const catalog = listChannelPluginCatalogEntries()
    .map((entry) => entry.id)
    .filter((id) => !allowlist || allowlist.has(id));
  const base = dedupe([...listChatChannels().map((meta) => meta.id), ...catalog]);
  if (isTruthyEnvValue(process.env.OPENCLAW_EAGER_CHANNEL_OPTIONS)) {
    ensurePluginRegistryLoaded();
    const pluginIds = listChannelPlugins().map((plugin) => plugin.id);
    return dedupe([...base, ...pluginIds]);
  }
  return base;
}

export function formatCliChannelOptions(extra: string[] = []): string {
  return [...extra, ...resolveCliChannelOptions()].join("|");
}
