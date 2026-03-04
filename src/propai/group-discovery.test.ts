import { describe, expect, it } from "vitest";
import type { SessionEntry } from "../config/sessions.js";
import {
  collectKnownWhatsAppGroupsFromSessionStore,
  resolveWhatsAppGroupTargetsFromKnownGroups,
} from "./group-discovery.js";

function makeSessionEntry(overrides: Partial<SessionEntry>): SessionEntry {
  return {
    sessionId: "session-1",
    updatedAt: 0,
    ...overrides,
  };
}

describe("collectKnownWhatsAppGroupsFromSessionStore", () => {
  it("collects whatsapp groups from session entries and keeps the newest metadata", () => {
    const store: Record<string, SessionEntry> = {
      "agent:main:whatsapp:group:120000000000001@g.us": makeSessionEntry({
        updatedAt: 100,
        channel: "whatsapp",
        groupId: "120000000000001@g.us",
        lastAccountId: "tenantA",
        subject: "Family Investors",
      }),
      "agent:main:whatsapp:group:120000000000001@g.us:thread:42": makeSessionEntry({
        updatedAt: 250,
        channel: "whatsapp",
        groupId: "120000000000001@g.us",
        lastAccountId: "tenantA",
      }),
      "agent:main:whatsapp:group:120000000000002@g.us": makeSessionEntry({
        updatedAt: 200,
        lastAccountId: "tenantA",
        subject: "Downtown Brokers",
      }),
      "agent:main:telegram:group:-100123": makeSessionEntry({
        updatedAt: 300,
        channel: "telegram",
        groupId: "-100123",
        subject: "Ignored Telegram Group",
      }),
    };

    const discovered = collectKnownWhatsAppGroupsFromSessionStore(store, "main");
    expect(discovered).toEqual([
      {
        groupId: "120000000000001@g.us",
        subject: "Family Investors",
        lastSeenAt: 250,
        agentIds: ["main"],
      },
      {
        groupId: "120000000000002@g.us",
        subject: "Downtown Brokers",
        lastSeenAt: 200,
        agentIds: ["main"],
      },
    ]);
  });

  it("filters groups by account scope when provided", () => {
    const store: Record<string, SessionEntry> = {
      "agent:main:whatsapp:group:120000000000001@g.us": makeSessionEntry({
        updatedAt: 100,
        lastAccountId: "tenantA",
        subject: "Tenant A Group",
      }),
      "agent:main:whatsapp:group:120000000000002@g.us": makeSessionEntry({
        updatedAt: 200,
        lastAccountId: "tenantB",
        subject: "Tenant B Group",
      }),
      "agent:main:whatsapp:group:120000000000003@g.us": makeSessionEntry({
        updatedAt: 300,
        subject: "Unscoped Group",
      }),
    };

    const discovered = collectKnownWhatsAppGroupsFromSessionStore(store, "main", {
      accountId: "tenantA",
    });
    expect(discovered).toEqual([
      {
        groupId: "120000000000001@g.us",
        subject: "Tenant A Group",
        lastSeenAt: 100,
        agentIds: ["main"],
      },
    ]);
  });
});

describe("resolveWhatsAppGroupTargetsFromKnownGroups", () => {
  const knownGroups = [
    {
      groupId: "120000000000001@g.us",
      subject: "Family Investors",
      lastSeenAt: 1000,
      agentIds: ["main"],
    },
    {
      groupId: "120000000000002@g.us",
      subject: "Family Rentals",
      lastSeenAt: 900,
      agentIds: ["main"],
    },
    {
      groupId: "120000000000003@g.us",
      subject: "Downtown Brokers",
      lastSeenAt: 800,
      agentIds: ["main"],
    },
  ] as const;

  it("resolves exact subject names and direct group IDs", () => {
    const resolved = resolveWhatsAppGroupTargetsFromKnownGroups(
      ["Family Investors", "120000000000003@g.us", "*"],
      [...knownGroups],
    );
    expect(resolved.errors).toEqual([]);
    expect(resolved.groupIds).toEqual(["120000000000001@g.us", "120000000000003@g.us", "*"]);
  });

  it("returns ambiguous errors when a name matches multiple groups", () => {
    const resolved = resolveWhatsAppGroupTargetsFromKnownGroups(["Family"], [...knownGroups]);
    expect(resolved.groupIds).toEqual([]);
    expect(resolved.errors).toEqual([
      {
        input: "Family",
        reason: "ambiguous",
        matches: [
          { groupId: "120000000000001@g.us", subject: "Family Investors" },
          { groupId: "120000000000002@g.us", subject: "Family Rentals" },
        ],
      },
    ]);
  });

  it("returns not-found errors for unknown group names", () => {
    const resolved = resolveWhatsAppGroupTargetsFromKnownGroups(
      ["Unknown Group"],
      [...knownGroups],
    );
    expect(resolved.groupIds).toEqual([]);
    expect(resolved.errors).toEqual([
      {
        input: "Unknown Group",
        reason: "not-found",
        matches: [],
      },
    ]);
  });
});
