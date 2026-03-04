import { describe, expect, it } from "vitest";
import {
  applyWhatsAppGroupAllowlist,
  normalizeWhatsAppGroupAllowlistEntries,
} from "./group-allowlist.js";

describe("normalizeWhatsAppGroupAllowlistEntries", () => {
  it("splits comma/newline/semicolon inputs and deduplicates entries", () => {
    const normalized = normalizeWhatsAppGroupAllowlistEntries([
      "1203630@g.us, 1203631@g.us",
      "1203632@g.us\n1203630@g.us",
      "1203633@g.us;1203631@g.us",
    ]);
    expect(normalized).toEqual(["1203630@g.us", "1203631@g.us", "1203632@g.us", "1203633@g.us"]);
  });
});

describe("applyWhatsAppGroupAllowlist", () => {
  it("adds groups and forces allowlist policy for whatsapp groups", () => {
    const result = applyWhatsAppGroupAllowlist(
      {
        channels: {
          whatsapp: {
            groupPolicy: "open",
            groups: {
              "120000000000001@g.us": {},
            },
          },
        },
      },
      ["120000000000001@g.us", "120000000000002@g.us"],
    );

    expect(result.addedGroupIds).toEqual(["120000000000002@g.us"]);
    expect(result.existingGroupIds).toEqual(["120000000000001@g.us"]);
    expect(result.config.channels?.whatsapp?.groupPolicy).toBe("allowlist");
    expect(result.config.channels?.whatsapp?.groups).toEqual({
      "120000000000001@g.us": {},
      "120000000000002@g.us": {},
    });
  });

  it("forces allowlist policy even when all requested groups already exist", () => {
    const result = applyWhatsAppGroupAllowlist(
      {
        channels: {
          whatsapp: {
            groupPolicy: "open",
            groups: {
              "120000000000001@g.us": {},
            },
          },
        },
      },
      ["120000000000001@g.us"],
    );

    expect(result.addedGroupIds).toEqual([]);
    expect(result.existingGroupIds).toEqual(["120000000000001@g.us"]);
    expect(result.config.channels?.whatsapp?.groupPolicy).toBe("allowlist");
  });

  it("returns unchanged config when no valid entries are provided", () => {
    const config = { channels: { whatsapp: { groupPolicy: "allowlist" as const } } };
    const result = applyWhatsAppGroupAllowlist(config, ["", "   "]);
    expect(result.config).toEqual(config);
    expect(result.addedGroupIds).toEqual([]);
    expect(result.existingGroupIds).toEqual([]);
  });

  it("updates account-scoped whatsapp allowlist when account is provided", () => {
    const result = applyWhatsAppGroupAllowlist(
      {
        channels: {
          whatsapp: {
            groupPolicy: "open",
            groups: {
              "120000000000999@g.us": {},
            },
            accounts: {
              tenantA: {
                groupPolicy: "open",
                groups: {
                  "120000000000001@g.us": {},
                },
              },
            },
          },
        },
      },
      ["120000000000001@g.us", "120000000000002@g.us"],
      { accountId: "tenantA" },
    );

    expect(result.addedGroupIds).toEqual(["120000000000002@g.us"]);
    expect(result.existingGroupIds).toEqual(["120000000000001@g.us"]);
    expect(result.config.channels?.whatsapp?.groupPolicy).toBe("open");
    expect(result.config.channels?.whatsapp?.groups).toEqual({
      "120000000000999@g.us": {},
    });
    expect(result.config.channels?.whatsapp?.accounts?.tenantA?.groupPolicy).toBe("allowlist");
    expect(result.config.channels?.whatsapp?.accounts?.tenantA?.groups).toEqual({
      "120000000000001@g.us": {},
      "120000000000002@g.us": {},
    });
  });
});
