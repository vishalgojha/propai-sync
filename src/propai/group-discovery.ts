import { listAgentIds } from "../agents/agent-scope.js";
import type { OpenClawConfig } from "../config/config.js";
import { loadSessionStore, resolveStorePath, type SessionEntry } from "../config/sessions.js";
import { normalizeAccountId, parseAgentSessionKey } from "../routing/session-key.js";
import { normalizeWhatsAppGroupAllowlistEntries } from "./group-allowlist.js";

export type KnownWhatsAppGroup = {
  groupId: string;
  subject?: string;
  lastSeenAt: number | null;
  agentIds: string[];
};

export type ResolvedWhatsAppGroupTarget = {
  input: string;
  groupId: string;
  subject?: string;
  matchedBy: "id" | "name-exact" | "name-contains" | "wildcard";
};

export type ResolveWhatsAppGroupTargetError = {
  input: string;
  reason: "not-found" | "ambiguous";
  matches: Array<{ groupId: string; subject?: string }>;
};

export type ResolveWhatsAppGroupTargetsResult = {
  groupIds: string[];
  resolved: ResolvedWhatsAppGroupTarget[];
  errors: ResolveWhatsAppGroupTargetError[];
  knownGroups: KnownWhatsAppGroup[];
};

export type DiscoverKnownWhatsAppGroupsOptions = {
  accountId?: string;
  agentIds?: string[];
  includeUnscopedAccountSessions?: boolean;
};

function normalizeText(value: string): string {
  return value.trim().toLowerCase();
}

function normalizeGroupId(value: string): string {
  return value.trim().toLowerCase();
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function isWhatsAppGroupJid(value: string): boolean {
  const normalized = normalizeGroupId(value);
  return normalized.endsWith("@g.us") && normalized !== "@g.us";
}

function tryResolveGroupIdFromSession(params: {
  sessionKey: string;
  entry: SessionEntry;
}): string | null {
  const fromEntry = params.entry.groupId?.trim();
  if (fromEntry && isWhatsAppGroupJid(fromEntry)) {
    return normalizeGroupId(fromEntry);
  }

  const channel = params.entry.channel?.trim().toLowerCase();
  if (channel && channel !== "whatsapp") {
    return null;
  }

  const parsed = parseAgentSessionKey(params.sessionKey);
  const rest = parsed?.rest ?? params.sessionKey.trim().toLowerCase();
  const marker = "whatsapp:group:";
  const markerIndex = rest.indexOf(marker);
  if (markerIndex < 0) {
    return null;
  }

  const rawGroupId =
    rest
      .slice(markerIndex + marker.length)
      .split(":")[0]
      ?.trim() ?? "";
  if (!isWhatsAppGroupJid(rawGroupId)) {
    return null;
  }
  return normalizeGroupId(rawGroupId);
}

function resolveSessionAccountId(entry: SessionEntry): string | null {
  const fromLast = entry.lastAccountId?.trim();
  if (fromLast) {
    return normalizeAccountId(fromLast);
  }
  const fromOrigin = entry.origin?.accountId?.trim();
  if (fromOrigin) {
    return normalizeAccountId(fromOrigin);
  }
  return null;
}

type MutableKnownGroup = {
  groupId: string;
  subject?: string;
  lastSeenAt: number | null;
  agentIds: Set<string>;
};

function mergeKnownGroup(
  groups: Map<string, MutableKnownGroup>,
  group: {
    groupId: string;
    subject?: string;
    lastSeenAt: number | null;
    agentId: string;
  },
): void {
  const key = normalizeGroupId(group.groupId);
  const existing = groups.get(key);
  if (!existing) {
    groups.set(key, {
      groupId: key,
      subject: group.subject,
      lastSeenAt: group.lastSeenAt,
      agentIds: new Set([group.agentId]),
    });
    return;
  }

  if (
    group.lastSeenAt !== null &&
    (existing.lastSeenAt === null || group.lastSeenAt > existing.lastSeenAt)
  ) {
    existing.lastSeenAt = group.lastSeenAt;
    if (group.subject) {
      existing.subject = group.subject;
    }
  } else if (group.subject && !existing.subject) {
    existing.subject = group.subject;
  }

  existing.agentIds.add(group.agentId);
}

function toKnownGroupArray(groups: Map<string, MutableKnownGroup>): KnownWhatsAppGroup[] {
  return [...groups.values()]
    .map((group) => ({
      groupId: group.groupId,
      subject: group.subject,
      lastSeenAt: group.lastSeenAt,
      agentIds: [...group.agentIds].toSorted(),
    }))
    .toSorted((left, right) => {
      const leftSeen = left.lastSeenAt ?? -1;
      const rightSeen = right.lastSeenAt ?? -1;
      if (leftSeen !== rightSeen) {
        return rightSeen - leftSeen;
      }
      return left.groupId.localeCompare(right.groupId);
    });
}

export function collectKnownWhatsAppGroupsFromSessionStore(
  store: Record<string, SessionEntry>,
  agentId: string,
  options: Pick<
    DiscoverKnownWhatsAppGroupsOptions,
    "accountId" | "includeUnscopedAccountSessions"
  > = {},
): KnownWhatsAppGroup[] {
  const groups = new Map<string, MutableKnownGroup>();
  const scopedAccountId = options.accountId?.trim()
    ? normalizeAccountId(options.accountId)
    : undefined;
  const includeUnscopedAccountSessions = options.includeUnscopedAccountSessions === true;
  for (const [sessionKey, entry] of Object.entries(store)) {
    const groupId = tryResolveGroupIdFromSession({ sessionKey, entry });
    if (!groupId) {
      continue;
    }
    if (scopedAccountId) {
      const sessionAccountId = resolveSessionAccountId(entry);
      if (!sessionAccountId && !includeUnscopedAccountSessions) {
        continue;
      }
      if (sessionAccountId && sessionAccountId !== scopedAccountId) {
        continue;
      }
    }
    const sourceAgentId = parseAgentSessionKey(sessionKey)?.agentId ?? agentId;
    const subject = entry.subject?.trim() || undefined;
    const lastSeenAt = isFiniteNumber(entry.updatedAt) ? entry.updatedAt : null;
    mergeKnownGroup(groups, { groupId, subject, lastSeenAt, agentId: sourceAgentId });
  }
  return toKnownGroupArray(groups);
}

function collectSessionStoreTargets(
  config: OpenClawConfig,
  options: Pick<DiscoverKnownWhatsAppGroupsOptions, "agentIds"> = {},
): Array<{ agentId: string; storePath: string }> {
  const scopedAgentIds =
    options.agentIds && options.agentIds.length > 0
      ? options.agentIds.map((agentId) => agentId.trim().toLowerCase()).filter(Boolean)
      : null;
  const sourceAgentIds = scopedAgentIds ?? listAgentIds(config);
  const dedupedByStorePath = new Map<string, { agentId: string; storePath: string }>();
  for (const agentId of sourceAgentIds) {
    const storePath = resolveStorePath(config.session?.store, { agentId });
    if (!dedupedByStorePath.has(storePath)) {
      dedupedByStorePath.set(storePath, { agentId, storePath });
    }
  }
  return [...dedupedByStorePath.values()];
}

export function discoverKnownWhatsAppGroups(
  config: OpenClawConfig,
  options: DiscoverKnownWhatsAppGroupsOptions = {},
): KnownWhatsAppGroup[] {
  const groups = new Map<string, MutableKnownGroup>();
  for (const target of collectSessionStoreTargets(config, options)) {
    const store = loadSessionStore(target.storePath);
    const discovered = collectKnownWhatsAppGroupsFromSessionStore(store, target.agentId, options);
    for (const group of discovered) {
      for (const sourceAgentId of group.agentIds) {
        mergeKnownGroup(groups, {
          groupId: group.groupId,
          subject: group.subject,
          lastSeenAt: group.lastSeenAt,
          agentId: sourceAgentId,
        });
      }
    }
  }
  return toKnownGroupArray(groups);
}

function formatKnownGroupMatch(group: KnownWhatsAppGroup): { groupId: string; subject?: string } {
  return { groupId: group.groupId, subject: group.subject };
}

function resolveOneGroupByQuery(params: {
  input: string;
  normalizedInput: string;
  knownGroups: KnownWhatsAppGroup[];
}):
  | { kind: "resolved"; match: KnownWhatsAppGroup; matchedBy: "name-exact" | "name-contains" }
  | { kind: "not-found" }
  | { kind: "ambiguous"; matches: KnownWhatsAppGroup[] } {
  const exactMatches = params.knownGroups.filter((group) => {
    const subject = group.subject ? normalizeText(group.subject) : "";
    return (
      subject === params.normalizedInput ||
      normalizeGroupId(group.groupId) === params.normalizedInput
    );
  });
  if (exactMatches.length === 1) {
    return { kind: "resolved", match: exactMatches[0], matchedBy: "name-exact" };
  }
  if (exactMatches.length > 1) {
    return { kind: "ambiguous", matches: exactMatches };
  }

  const containsMatches = params.knownGroups.filter((group) => {
    const subject = group.subject ? normalizeText(group.subject) : "";
    return (
      subject.includes(params.normalizedInput) ||
      normalizeGroupId(group.groupId).includes(params.normalizedInput)
    );
  });
  if (containsMatches.length === 1) {
    return { kind: "resolved", match: containsMatches[0], matchedBy: "name-contains" };
  }
  if (containsMatches.length > 1) {
    return { kind: "ambiguous", matches: containsMatches };
  }

  return { kind: "not-found" };
}

export function resolveWhatsAppGroupTargetsFromKnownGroups(
  entries: string[],
  knownGroups: KnownWhatsAppGroup[],
): ResolveWhatsAppGroupTargetsResult {
  const normalizedEntries = normalizeWhatsAppGroupAllowlistEntries(entries);
  const groupIds: string[] = [];
  const resolved: ResolvedWhatsAppGroupTarget[] = [];
  const errors: ResolveWhatsAppGroupTargetError[] = [];
  const seenGroupIds = new Set<string>();

  for (const input of normalizedEntries) {
    const trimmed = input.trim();
    if (!trimmed) {
      continue;
    }

    const normalizedInput = normalizeText(trimmed);
    if (normalizedInput === "*") {
      if (!seenGroupIds.has("*")) {
        seenGroupIds.add("*");
        groupIds.push("*");
      }
      resolved.push({ input: trimmed, groupId: "*", matchedBy: "wildcard" });
      continue;
    }

    if (isWhatsAppGroupJid(trimmed)) {
      const groupId = normalizeGroupId(trimmed);
      if (!seenGroupIds.has(groupId)) {
        seenGroupIds.add(groupId);
        groupIds.push(groupId);
      }
      resolved.push({ input: trimmed, groupId, matchedBy: "id" });
      continue;
    }

    const query = resolveOneGroupByQuery({
      input: trimmed,
      normalizedInput,
      knownGroups,
    });
    if (query.kind === "resolved") {
      const groupId = normalizeGroupId(query.match.groupId);
      if (!seenGroupIds.has(groupId)) {
        seenGroupIds.add(groupId);
        groupIds.push(groupId);
      }
      resolved.push({
        input: trimmed,
        groupId,
        subject: query.match.subject,
        matchedBy: query.matchedBy,
      });
      continue;
    }

    if (query.kind === "ambiguous") {
      errors.push({
        input: trimmed,
        reason: "ambiguous",
        matches: query.matches.map(formatKnownGroupMatch).slice(0, 8),
      });
      continue;
    }

    errors.push({
      input: trimmed,
      reason: "not-found",
      matches: [],
    });
  }

  return { groupIds, resolved, errors, knownGroups };
}

export function resolveWhatsAppGroupTargets(
  config: OpenClawConfig,
  entries: string[],
  options: DiscoverKnownWhatsAppGroupsOptions = {},
): ResolveWhatsAppGroupTargetsResult {
  const knownGroups = discoverKnownWhatsAppGroups(config, options);
  return resolveWhatsAppGroupTargetsFromKnownGroups(entries, knownGroups);
}
