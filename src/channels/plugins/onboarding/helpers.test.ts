import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PropAiSyncConfig } from "../../../config/config.js";
import { DEFAULT_ACCOUNT_ID } from "../../../routing/session-key.js";

const promptAccountIdSdkMock = vi.hoisted(() => vi.fn(async () => "default"));
vi.mock("../../../plugin-sdk/onboarding.js", () => ({
  promptAccountId: promptAccountIdSdkMock,
}));

import {
  applySingleTokenPromptResult,
  buildSingleChannelSecretPromptState,
  normalizeAllowFromEntries,
  noteChannelLookupFailure,
  noteChannelLookupSummary,
  parseMentionOrPrefixedId,
  parseOnboardingEntriesAllowingWildcard,
  patchChannelConfigForAccount,
  promptLegacyChannelAllowFrom,
  parseOnboardingEntriesWithParser,
  promptSingleChannelSecretInput,
  promptSingleChannelToken,
  promptResolvedAllowFrom,
  resolveAccountIdForConfigure,
  resolveOnboardingAccountId,
  setChannelDmPolicyWithAllowFrom,
  setTopLevelChannelAllowFrom,
  setTopLevelChannelDmPolicyWithAllowFrom,
  setTopLevelChannelGroupPolicy,
  setOnboardingChannelEnabled,
  splitOnboardingEntries,
} from "./helpers.js";

function createPrompter(inputs: string[]) {
  return {
    text: vi.fn(async () => inputs.shift() ?? ""),
    note: vi.fn(async () => undefined),
  };
}

function createTokenPrompter(params: { confirms: boolean[]; texts: string[] }) {
  const confirms = [...params.confirms];
  const texts = [...params.texts];
  return {
    confirm: vi.fn(async () => confirms.shift() ?? true),
    text: vi.fn(async () => texts.shift() ?? ""),
  };
}

function parseCsvInputs(value: string): string[] {
  return value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

type AllowFromResolver = (params: {
  token: string;
  entries: string[];
}) => Promise<Array<{ input: string; resolved: boolean; id?: string | null }>>;

function asAllowFromResolver(resolveEntries: ReturnType<typeof vi.fn>): AllowFromResolver {
  return resolveEntries as AllowFromResolver;
}

async function runPromptResolvedAllowFromWithToken(params: {
  prompter: ReturnType<typeof createPrompter>;
  resolveEntries: AllowFromResolver;
}) {
  return await promptResolvedAllowFrom({
    // oxlint-disable-next-line typescript/no-explicit-any
    prompter: params.prompter as any,
    existing: [],
    token: "xoxb-test",
    message: "msg",
    placeholder: "placeholder",
    label: "allowlist",
    parseInputs: parseCsvInputs,
    parseId: () => null,
    invalidWithoutTokenNote: "ids only",
    resolveEntries: params.resolveEntries,
  });
}

async function runPromptSingleToken(params: {
  prompter: ReturnType<typeof createTokenPrompter>;
  accountConfigured: boolean;
  canUseEnv: boolean;
  hasConfigToken: boolean;
}) {
  return await promptSingleChannelToken({
    prompter: params.prompter,
    accountConfigured: params.accountConfigured,
    canUseEnv: params.canUseEnv,
    hasConfigToken: params.hasConfigToken,
    envPrompt: "use env",
    keepPrompt: "keep",
    inputPrompt: "token",
  });
}

describe("buildSingleChannelSecretPromptState", () => {
  it("enables env path only when env is present and no config token exists", () => {
    expect(
      buildSingleChannelSecretPromptState({
        accountConfigured: false,
        hasConfigToken: false,
        allowEnv: true,
        envValue: "token-from-env",
      }),
    ).toEqual({
      accountConfigured: false,
      hasConfigToken: false,
      canUseEnv: true,
    });
  });

  it("disables env path when config token already exists", () => {
    expect(
      buildSingleChannelSecretPromptState({
        accountConfigured: true,
        hasConfigToken: true,
        allowEnv: true,
        envValue: "token-from-env",
      }),
    ).toEqual({
      accountConfigured: true,
      hasConfigToken: true,
      canUseEnv: false,
    });
  });
});

async function runPromptLegacyAllowFrom(params: {
  cfg?: PropAiSyncConfig;
  prompter: ReturnType<typeof createPrompter>;
  existing: string[];
  token: string;
  noteTitle: string;
  noteLines: string[];
  parseId: (value: string) => string | null;
  resolveEntries: AllowFromResolver;
}) {
  return await promptLegacyChannelAllowFrom({
    cfg: params.cfg ?? {},
    // oxlint-disable-next-line typescript/no-explicit-any
    prompter: params.prompter as any,
    existing: params.existing,
    token: params.token,
    noteTitle: params.noteTitle,
    noteLines: params.noteLines,
    message: "msg",
    placeholder: "placeholder",
    parseId: params.parseId,
    invalidWithoutTokenNote: "ids only",
    resolveEntries: params.resolveEntries,
  });
}

describe("promptResolvedAllowFrom", () => {
  beforeEach(() => {
    promptAccountIdSdkMock.mockReset();
    promptAccountIdSdkMock.mockResolvedValue("default");
  });

  it("re-prompts without token until all ids are parseable", async () => {
    const prompter = createPrompter(["@alice", "123"]);
    const resolveEntries = vi.fn();

    const result = await promptResolvedAllowFrom({
      // oxlint-disable-next-line typescript/no-explicit-any
      prompter: prompter as any,
      existing: ["111"],
      token: "",
      message: "msg",
      placeholder: "placeholder",
      label: "allowlist",
      parseInputs: parseCsvInputs,
      parseId: (value) => (/^\d+$/.test(value.trim()) ? value.trim() : null),
      invalidWithoutTokenNote: "ids only",
      // oxlint-disable-next-line typescript/no-explicit-any
      resolveEntries: resolveEntries as any,
    });

    expect(result).toEqual(["111", "123"]);
    expect(prompter.note).toHaveBeenCalledWith("ids only", "allowlist");
    expect(resolveEntries).not.toHaveBeenCalled();
  });

  it("re-prompts when token resolution returns unresolved entries", async () => {
    const prompter = createPrompter(["alice", "bob"]);
    const resolveEntries = vi
      .fn()
      .mockResolvedValueOnce([{ input: "alice", resolved: false }])
      .mockResolvedValueOnce([{ input: "bob", resolved: true, id: "U123" }]);

    const result = await runPromptResolvedAllowFromWithToken({
      prompter,
      resolveEntries: asAllowFromResolver(resolveEntries),
    });

    expect(result).toEqual(["U123"]);
    expect(prompter.note).toHaveBeenCalledWith("Could not resolve: alice", "allowlist");
    expect(resolveEntries).toHaveBeenCalledTimes(2);
  });

  it("re-prompts when resolver throws before succeeding", async () => {
    const prompter = createPrompter(["alice", "bob"]);
    const resolveEntries = vi
      .fn()
      .mockRejectedValueOnce(new Error("network"))
      .mockResolvedValueOnce([{ input: "bob", resolved: true, id: "U234" }]);

    const result = await runPromptResolvedAllowFromWithToken({
      prompter,
      resolveEntries: asAllowFromResolver(resolveEntries),
    });

    expect(result).toEqual(["U234"]);
    expect(prompter.note).toHaveBeenCalledWith(
      "Failed to resolve usernames. Try again.",
      "allowlist",
    );
    expect(resolveEntries).toHaveBeenCalledTimes(2);
  });
});

describe("promptLegacyChannelAllowFrom", () => {
  it("applies parsed ids without token resolution", async () => {
    const prompter = createPrompter([" 123 "]);
    const resolveEntries = vi.fn();

    const next = await runPromptLegacyAllowFrom({
      cfg: {} as PropAiSyncConfig,
      existing: ["999"],
      prompter,
      token: "",
      noteTitle: "Telegram allowlist",
      noteLines: ["line1", "line2"],
      parseId: (value) => (/^\d+$/.test(value.trim()) ? value.trim() : null),
      resolveEntries: asAllowFromResolver(resolveEntries),
    });

    expect(next).toEqual(["999", "123"]);
    expect(prompter.note).toHaveBeenCalledWith("line1\nline2", "Telegram allowlist");
    expect(resolveEntries).not.toHaveBeenCalled();
  });

  it("uses resolver when token is present", async () => {
    const prompter = createPrompter(["alice"]);
    const resolveEntries = vi.fn(async () => [{ input: "alice", resolved: true, id: "U1" }]);

    const next = await runPromptLegacyAllowFrom({
      cfg: {} as PropAiSyncConfig,
      prompter,
      existing: [],
      token: "xoxb-token",
      noteTitle: "Telegram allowlist",
      noteLines: ["line"],
      parseId: () => null,
      resolveEntries: asAllowFromResolver(resolveEntries),
    });

    expect(next).toEqual(["U1"]);
    expect(resolveEntries).toHaveBeenCalledWith({ token: "xoxb-token", entries: ["alice"] });
  });
});

describe("promptSingleChannelToken", () => {
  it("uses env tokens when confirmed", async () => {
    const prompter = createTokenPrompter({ confirms: [true], texts: [] });
    const result = await runPromptSingleToken({
      prompter,
      accountConfigured: false,
      canUseEnv: true,
      hasConfigToken: false,
    });
    expect(result).toEqual({ useEnv: true, token: null });
    expect(prompter.text).not.toHaveBeenCalled();
  });

  it("prompts for token when env exists but user declines env", async () => {
    const prompter = createTokenPrompter({ confirms: [false], texts: ["abc"] });
    const result = await runPromptSingleToken({
      prompter,
      accountConfigured: false,
      canUseEnv: true,
      hasConfigToken: false,
    });
    expect(result).toEqual({ useEnv: false, token: "abc" });
  });

  it("keeps existing configured token when confirmed", async () => {
    const prompter = createTokenPrompter({ confirms: [true], texts: [] });
    const result = await runPromptSingleToken({
      prompter,
      accountConfigured: true,
      canUseEnv: false,
      hasConfigToken: true,
    });
    expect(result).toEqual({ useEnv: false, token: null });
    expect(prompter.text).not.toHaveBeenCalled();
  });

  it("prompts for token when no env/config token is used", async () => {
    const prompter = createTokenPrompter({ confirms: [false], texts: ["xyz"] });
    const result = await runPromptSingleToken({
      prompter,
      accountConfigured: true,
      canUseEnv: false,
      hasConfigToken: false,
    });
    expect(result).toEqual({ useEnv: false, token: "xyz" });
  });
});

describe("promptSingleChannelSecretInput", () => {
  it("returns use-env action when plaintext mode selects env fallback", async () => {
    const prompter = {
      select: vi.fn(async () => "plaintext"),
      confirm: vi.fn(async () => true),
      text: vi.fn(async () => ""),
      note: vi.fn(async () => undefined),
    };

    const result = await promptSingleChannelSecretInput({
      cfg: {},
      // oxlint-disable-next-line typescript/no-explicit-any
      prompter: prompter as any,
      providerHint: "telegram",
      credentialLabel: "Telegram bot token",
      accountConfigured: false,
      canUseEnv: true,
      hasConfigToken: false,
      envPrompt: "use env",
      keepPrompt: "keep",
      inputPrompt: "token",
      preferredEnvVar: "TELEGRAM_BOT_TOKEN",
    });

    expect(result).toEqual({ action: "use-env" });
  });

  it("returns ref + resolved value when external env ref is selected", async () => {
    process.env.propai_TEST_TOKEN = "secret-token";
    const prompter = {
      select: vi.fn().mockResolvedValueOnce("ref").mockResolvedValueOnce("env"),
      confirm: vi.fn(async () => false),
      text: vi.fn(async () => "PROPAI_TEST_TOKEN"),
      note: vi.fn(async () => undefined),
    };

    const result = await promptSingleChannelSecretInput({
      cfg: {},
      // oxlint-disable-next-line typescript/no-explicit-any
      prompter: prompter as any,
      providerHint: "telegram",
      credentialLabel: "Discord bot token",
      accountConfigured: false,
      canUseEnv: false,
      hasConfigToken: false,
      envPrompt: "use env",
      keepPrompt: "keep",
      inputPrompt: "token",
      preferredEnvVar: "PROPAI_TEST_TOKEN",
    });

    expect(result).toEqual({
      action: "set",
      value: {
        source: "env",
        provider: "default",
        id: "PROPAI_TEST_TOKEN",
      },
      resolvedValue: "secret-token",
    });
  });

  it("returns keep action when ref mode keeps an existing configured ref", async () => {
    const prompter = {
      select: vi.fn(async () => "ref"),
      confirm: vi.fn(async () => true),
      text: vi.fn(async () => ""),
      note: vi.fn(async () => undefined),
    };

    const result = await promptSingleChannelSecretInput({
      cfg: {},
      // oxlint-disable-next-line typescript/no-explicit-any
      prompter: prompter as any,
      providerHint: "telegram",
      credentialLabel: "Telegram bot token",
      accountConfigured: true,
      canUseEnv: false,
      hasConfigToken: true,
      envPrompt: "use env",
      keepPrompt: "keep",
      inputPrompt: "token",
      preferredEnvVar: "TELEGRAM_BOT_TOKEN",
    });

    expect(result).toEqual({ action: "keep" });
    expect(prompter.text).not.toHaveBeenCalled();
  });
});

describe("applySingleTokenPromptResult", () => {
  it("writes env selection as an empty patch on target account", () => {
    const next = applySingleTokenPromptResult({
      cfg: {},
      channel: "telegram",
      accountId: "work",
      tokenPatchKey: "botToken",
      tokenResult: { useEnv: true, token: null },
    });

    expect(next.channels?.telegram?.enabled).toBe(true);
    expect(next.channels?.telegram?.accounts?.work?.enabled).toBe(true);
    expect(next.channels?.telegram?.accounts?.work?.botToken).toBeUndefined();
  });

  it("writes provided token under requested key", () => {
    const next = applySingleTokenPromptResult({
      cfg: {},
      channel: "telegram",
      accountId: DEFAULT_ACCOUNT_ID,
      tokenPatchKey: "botToken",
      tokenResult: { useEnv: false, token: "abc" },
    });

    expect(next.channels?.telegram?.enabled).toBe(true);
    expect(next.channels?.telegram?.botToken).toBe("abc");
  });
});

describe("channel lookup note helpers", () => {
  it("emits summary lines for resolved and unresolved entries", async () => {
    const prompter = { note: vi.fn(async () => undefined) };
    await noteChannelLookupSummary({
      prompter,
      label: "Slack channels",
      resolvedSections: [
        { title: "Resolved", values: ["C1", "C2"] },
        { title: "Resolved guilds", values: [] },
      ],
      unresolved: ["#typed-name"],
    });
    expect(prompter.note).toHaveBeenCalledWith(
      "Resolved: C1, C2\nUnresolved (kept as typed): #typed-name",
      "Slack channels",
    );
  });

  it("skips note output when there is nothing to report", async () => {
    const prompter = { note: vi.fn(async () => undefined) };
    await noteChannelLookupSummary({
      prompter,
      label: "Discord channels",
      resolvedSections: [{ title: "Resolved", values: [] }],
      unresolved: [],
    });
    expect(prompter.note).not.toHaveBeenCalled();
  });

  it("formats lookup failures consistently", async () => {
    const prompter = { note: vi.fn(async () => undefined) };
    await noteChannelLookupFailure({
      prompter,
      label: "Discord channels",
      error: new Error("boom"),
    });
    expect(prompter.note).toHaveBeenCalledWith(
      "Channel lookup failed; keeping entries as typed. Error: boom",
      "Discord channels",
    );
  });
});

describe("patchChannelConfigForAccount", () => {
  it("patches root channel config for default account", () => {
    const cfg: PropAiSyncConfig = {
      channels: {
        telegram: {
          enabled: false,
          botToken: "old",
        },
      },
    };

    const next = patchChannelConfigForAccount({
      cfg,
      channel: "telegram",
      accountId: DEFAULT_ACCOUNT_ID,
      patch: { botToken: "new", dmPolicy: "allowlist" },
    });

    expect(next.channels?.telegram?.enabled).toBe(true);
    expect(next.channels?.telegram?.botToken).toBe("new");
    expect(next.channels?.telegram?.dmPolicy).toBe("allowlist");
  });

  it("patches nested account config and preserves existing enabled flag", () => {
    const cfg: PropAiSyncConfig = {
      channels: {
        whatsapp: {
          enabled: true,
          accounts: {
            work: {
              enabled: false,
              authDir: "/tmp/wa-auth-old",
            },
          },
        },
      },
    };

    const next = patchChannelConfigForAccount({
      cfg,
      channel: "whatsapp",
      accountId: "work",
      patch: { authDir: "/tmp/wa-auth-new" },
    });

    expect(next.channels?.whatsapp?.enabled).toBe(true);
    expect(next.channels?.whatsapp?.accounts?.work?.enabled).toBe(false);
    expect(next.channels?.whatsapp?.accounts?.work?.authDir).toBe("/tmp/wa-auth-new");
  });

  it("moves single-account config into default account when patching non-default", () => {
    const cfg: PropAiSyncConfig = {
      channels: {
        telegram: {
          enabled: true,
          botToken: "legacy-token",
          allowFrom: ["100"],
          groupPolicy: "allowlist",
          streaming: "partial",
        },
      },
    };

    const next = patchChannelConfigForAccount({
      cfg,
      channel: "telegram",
      accountId: "work",
      patch: { botToken: "work-token" },
    });

    expect(next.channels?.telegram?.accounts?.default).toEqual({
      botToken: "legacy-token",
      allowFrom: ["100"],
      groupPolicy: "allowlist",
      streaming: "partial",
    });
    expect(next.channels?.telegram?.botToken).toBeUndefined();
    expect(next.channels?.telegram?.allowFrom).toBeUndefined();
    expect(next.channels?.telegram?.groupPolicy).toBeUndefined();
    expect(next.channels?.telegram?.streaming).toBeUndefined();
    expect(next.channels?.telegram?.accounts?.work?.botToken).toBe("work-token");
  });

  it("supports whatsapp account-scoped channel patches", () => {
    const cfg: PropAiSyncConfig = {
      channels: {
        whatsapp: {
          enabled: false,
          accounts: {},
        },
      },
    };

    const next = patchChannelConfigForAccount({
      cfg,
      channel: "whatsapp",
      accountId: "work",
      patch: { authDir: "/tmp/wa-auth" },
    });
    expect(next.channels?.whatsapp?.enabled).toBe(true);
    expect(next.channels?.whatsapp?.accounts?.work?.enabled).toBe(true);
    expect(next.channels?.whatsapp?.accounts?.work?.authDir).toBe("/tmp/wa-auth");
  });
});

describe("setOnboardingChannelEnabled", () => {
  it("updates enabled and keeps existing channel fields", () => {
    const cfg: PropAiSyncConfig = {
      channels: {
        telegram: {
          enabled: true,
          botToken: "abc",
        },
      },
    };

    const next = setOnboardingChannelEnabled(cfg, "telegram", false);
    expect(next.channels?.telegram?.enabled).toBe(false);
    expect(next.channels?.telegram?.botToken).toBe("abc");
  });

  it("creates missing channel config with enabled state", () => {
    const next = setOnboardingChannelEnabled({}, "whatsapp", true);
    expect(next.channels?.whatsapp?.enabled).toBe(true);
  });
});

describe("setChannelDmPolicyWithAllowFrom", () => {
  it("supports telegram channel dmPolicy updates", () => {
    const cfg: PropAiSyncConfig = {
      channels: {
        telegram: {
          dmPolicy: "pairing",
          allowFrom: ["123"],
        },
      },
    };

    const next = setChannelDmPolicyWithAllowFrom({
      cfg,
      channel: "telegram",
      dmPolicy: "open",
    });
    expect(next.channels?.telegram?.dmPolicy).toBe("open");
    expect(next.channels?.telegram?.allowFrom).toEqual(["123", "*"]);
  });

  it("adds wildcard allowFrom when setting whatsapp dmPolicy=open", () => {
    const cfg: PropAiSyncConfig = {
      channels: {
        whatsapp: {
          dmPolicy: "pairing",
          allowFrom: ["+15555550123"],
        },
      },
    };

    const next = setChannelDmPolicyWithAllowFrom({
      cfg,
      channel: "whatsapp",
      dmPolicy: "open",
    });

    expect(next.channels?.whatsapp?.dmPolicy).toBe("open");
    expect(next.channels?.whatsapp?.allowFrom).toEqual(["+15555550123", "*"]);
  });
});

describe("setTopLevelChannelDmPolicyWithAllowFrom", () => {
  it("adds wildcard allowFrom for open policy", () => {
    const cfg: PropAiSyncConfig = {
      channels: {
        zalo: {
          dmPolicy: "pairing",
          allowFrom: ["12345"],
        },
      },
    };

    const next = setTopLevelChannelDmPolicyWithAllowFrom({
      cfg,
      channel: "zalo",
      dmPolicy: "open",
    });
    expect(next.channels?.zalo?.dmPolicy).toBe("open");
    expect(next.channels?.zalo?.allowFrom).toEqual(["12345", "*"]);
  });

  it("supports custom allowFrom lookup callback", () => {
    const cfg: PropAiSyncConfig = {
      channels: {
        "nextcloud-talk": {
          dmPolicy: "pairing",
          allowFrom: ["alice"],
        },
      },
    };

    const next = setTopLevelChannelDmPolicyWithAllowFrom({
      cfg,
      channel: "nextcloud-talk",
      dmPolicy: "open",
      getAllowFrom: (inputCfg) =>
        normalizeAllowFromEntries(inputCfg.channels?.["nextcloud-talk"]?.allowFrom ?? []),
    });
    expect(next.channels?.["nextcloud-talk"]?.allowFrom).toEqual(["alice", "*"]);
  });
});

describe("setTopLevelChannelAllowFrom", () => {
  it("writes allowFrom and can force enabled state", () => {
    const next = setTopLevelChannelAllowFrom({
      cfg: {},
      channel: "msteams",
      allowFrom: ["user-1"],
      enabled: true,
    });
    expect(next.channels?.msteams?.allowFrom).toEqual(["user-1"]);
    expect(next.channels?.msteams?.enabled).toBe(true);
  });
});

describe("setTopLevelChannelGroupPolicy", () => {
  it("writes groupPolicy and can force enabled state", () => {
    const next = setTopLevelChannelGroupPolicy({
      cfg: {},
      channel: "feishu",
      groupPolicy: "allowlist",
      enabled: true,
    });
    expect(next.channels?.feishu?.groupPolicy).toBe("allowlist");
    expect(next.channels?.feishu?.enabled).toBe(true);
  });
});

describe("splitOnboardingEntries", () => {
  it("splits comma/newline/semicolon input and trims blanks", () => {
    expect(splitOnboardingEntries(" alice, bob \ncarol;  ;\n")).toEqual(["alice", "bob", "carol"]);
  });
});

describe("parseOnboardingEntriesWithParser", () => {
  it("maps entries and de-duplicates parsed values", () => {
    expect(
      parseOnboardingEntriesWithParser(" alice, ALICE ; * ", (entry) => {
        if (entry === "*") {
          return { value: "*" };
        }
        return { value: entry.toLowerCase() };
      }),
    ).toEqual({
      entries: ["alice", "*"],
    });
  });

  it("returns parser errors and clears parsed entries", () => {
    expect(
      parseOnboardingEntriesWithParser("ok, bad", (entry) =>
        entry === "bad" ? { error: "invalid entry: bad" } : { value: entry },
      ),
    ).toEqual({
      entries: [],
      error: "invalid entry: bad",
    });
  });
});

describe("parseOnboardingEntriesAllowingWildcard", () => {
  it("preserves wildcard and delegates non-wildcard entries", () => {
    expect(
      parseOnboardingEntriesAllowingWildcard(" *, Foo ", (entry) => ({
        value: entry.toLowerCase(),
      })),
    ).toEqual({
      entries: ["*", "foo"],
    });
  });

  it("returns parser errors for non-wildcard entries", () => {
    expect(
      parseOnboardingEntriesAllowingWildcard("ok,bad", (entry) =>
        entry === "bad" ? { error: "bad entry" } : { value: entry },
      ),
    ).toEqual({
      entries: [],
      error: "bad entry",
    });
  });
});

describe("parseMentionOrPrefixedId", () => {
  it("parses mention ids", () => {
    expect(
      parseMentionOrPrefixedId({
        value: "<@!123>",
        mentionPattern: /^<@!?(\d+)>$/,
        prefixPattern: /^(user:|discord:)/i,
        idPattern: /^\d+$/,
      }),
    ).toBe("123");
  });

  it("parses prefixed ids and normalizes result", () => {
    expect(
      parseMentionOrPrefixedId({
        value: "slack:u123abc",
        mentionPattern: /^<@([A-Z0-9]+)>$/i,
        prefixPattern: /^(slack:|user:)/i,
        idPattern: /^[A-Z][A-Z0-9]+$/i,
        normalizeId: (id) => id.toUpperCase(),
      }),
    ).toBe("U123ABC");
  });

  it("returns null for blank or invalid input", () => {
    expect(
      parseMentionOrPrefixedId({
        value: "   ",
        mentionPattern: /^<@!?(\d+)>$/,
        prefixPattern: /^(user:|discord:)/i,
        idPattern: /^\d+$/,
      }),
    ).toBeNull();
    expect(
      parseMentionOrPrefixedId({
        value: "@alice",
        mentionPattern: /^<@!?(\d+)>$/,
        prefixPattern: /^(user:|discord:)/i,
        idPattern: /^\d+$/,
      }),
    ).toBeNull();
  });
});

describe("normalizeAllowFromEntries", () => {
  it("normalizes values, preserves wildcard, and removes duplicates", () => {
    expect(
      normalizeAllowFromEntries([" +15555550123 ", "*", "+15555550123", "bad"], (value) =>
        value.startsWith("+1") ? value : null,
      ),
    ).toEqual(["+15555550123", "*"]);
  });

  it("trims and de-duplicates without a normalizer", () => {
    expect(normalizeAllowFromEntries([" alice ", "bob", "alice"])).toEqual(["alice", "bob"]);
  });
});

describe("resolveOnboardingAccountId", () => {
  it("normalizes provided account ids", () => {
    expect(
      resolveOnboardingAccountId({
        accountId: " Work Account ",
        defaultAccountId: DEFAULT_ACCOUNT_ID,
      }),
    ).toBe("work-account");
  });

  it("falls back to default account id when input is blank", () => {
    expect(
      resolveOnboardingAccountId({
        accountId: "   ",
        defaultAccountId: "custom-default",
      }),
    ).toBe("custom-default");
  });
});

describe("resolveAccountIdForConfigure", () => {
  beforeEach(() => {
    promptAccountIdSdkMock.mockReset();
    promptAccountIdSdkMock.mockResolvedValue("default");
  });

  it("uses normalized override without prompting", async () => {
    const accountId = await resolveAccountIdForConfigure({
      cfg: {},
      // oxlint-disable-next-line typescript/no-explicit-any
      prompter: {} as any,
      label: "Signal",
      accountOverride: " Team Primary ",
      shouldPromptAccountIds: true,
      listAccountIds: () => ["default", "team-primary"],
      defaultAccountId: DEFAULT_ACCOUNT_ID,
    });
    expect(accountId).toBe("team-primary");
  });

  it("uses default account when override is missing and prompting disabled", async () => {
    const accountId = await resolveAccountIdForConfigure({
      cfg: {},
      // oxlint-disable-next-line typescript/no-explicit-any
      prompter: {} as any,
      label: "Signal",
      shouldPromptAccountIds: false,
      listAccountIds: () => ["default"],
      defaultAccountId: "fallback",
    });
    expect(accountId).toBe("fallback");
  });

  it("prompts for account id when prompting is enabled and no override is provided", async () => {
    promptAccountIdSdkMock.mockResolvedValueOnce("prompted-id");

    const accountId = await resolveAccountIdForConfigure({
      cfg: {},
      // oxlint-disable-next-line typescript/no-explicit-any
      prompter: {} as any,
      label: "Signal",
      shouldPromptAccountIds: true,
      listAccountIds: () => ["default", "prompted-id"],
      defaultAccountId: "fallback",
    });

    expect(accountId).toBe("prompted-id");
    expect(promptAccountIdSdkMock).toHaveBeenCalledWith(
      expect.objectContaining({
        label: "Signal",
        currentId: "fallback",
        defaultAccountId: "fallback",
      }),
    );
  });
});
