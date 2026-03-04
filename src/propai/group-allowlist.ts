import type { OpenClawConfig } from "../config/config.js";
import { normalizeAccountId } from "../routing/session-key.js";

export type WhatsAppGroupAllowlistUpdate = {
  config: OpenClawConfig;
  addedGroupIds: string[];
  existingGroupIds: string[];
};

export function normalizeWhatsAppGroupAllowlistEntries(entries: string[]): string[] {
  const normalized: string[] = [];
  const seen = new Set<string>();
  for (const rawEntry of entries) {
    for (const token of rawEntry.split(/[,\n;]+/g)) {
      const trimmed = token.trim();
      if (!trimmed) {
        continue;
      }
      if (seen.has(trimmed)) {
        continue;
      }
      seen.add(trimmed);
      normalized.push(trimmed);
    }
  }
  return normalized;
}

export function applyWhatsAppGroupAllowlist(
  config: OpenClawConfig,
  groupIds: string[],
  options: { accountId?: string } = {},
): WhatsAppGroupAllowlistUpdate {
  const normalizedGroupIds = normalizeWhatsAppGroupAllowlistEntries(groupIds);
  if (normalizedGroupIds.length === 0) {
    return {
      config,
      addedGroupIds: [],
      existingGroupIds: [],
    };
  }

  const currentWhatsApp = config.channels?.whatsapp ?? {};
  const accountId = options.accountId?.trim() ? normalizeAccountId(options.accountId) : undefined;
  const accountEntries = currentWhatsApp.accounts ?? {};
  const resolvedAccountKey = accountId
    ? (Object.keys(accountEntries).find(
        (candidate) => normalizeAccountId(candidate) === accountId,
      ) ?? accountId)
    : undefined;
  const currentAccount = accountId
    ? (accountEntries[resolvedAccountKey ?? accountId] ?? {})
    : currentWhatsApp;
  const nextGroups = { ...currentAccount.groups };
  const addedGroupIds: string[] = [];
  const existingGroupIds: string[] = [];

  for (const groupId of normalizedGroupIds) {
    if (Object.prototype.hasOwnProperty.call(nextGroups, groupId)) {
      existingGroupIds.push(groupId);
      continue;
    }
    nextGroups[groupId] = {};
    addedGroupIds.push(groupId);
  }

  const nextScopedConfig = {
    ...currentAccount,
    groupPolicy: "allowlist" as const,
    groups: nextGroups,
  };

  const nextWhatsApp = accountId
    ? {
        ...currentWhatsApp,
        accounts: {
          ...accountEntries,
          [resolvedAccountKey ?? accountId]: nextScopedConfig,
        },
      }
    : nextScopedConfig;

  const nextConfig: OpenClawConfig = {
    ...config,
    channels: {
      ...config.channels,
      whatsapp: nextWhatsApp,
    },
  };

  return {
    config: nextConfig,
    addedGroupIds,
    existingGroupIds,
  };
}
