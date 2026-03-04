import { describe, expect, it } from "vitest";
import { withEnv } from "../test-utils/env.js";
import {
  formatChannelSelectionLine,
  listChatChannels,
  normalizeChatChannelId,
} from "./registry.js";

describe("channel registry helpers", () => {
  it("only resolves whatsapp and trims whitespace", () => {
    expect(normalizeChatChannelId(" whatsapp ")).toBe("whatsapp");
    expect(normalizeChatChannelId("telegram")).toBeNull();
    expect(normalizeChatChannelId("imsg")).toBeNull();
    expect(normalizeChatChannelId("gchat")).toBeNull();
    expect(normalizeChatChannelId("web")).toBeNull();
    expect(normalizeChatChannelId("nope")).toBeNull();
  });

  it("keeps WhatsApp as the only default channel", () => {
    const channels = listChatChannels();
    expect(channels.map((channel) => channel.id)).toEqual(["whatsapp"]);
  });

  it("does not include MS Teams", () => {
    const channels = listChatChannels();
    expect(channels.some((channel) => channel.id === "msteams")).toBe(false);
  });

  it("formats selection lines with docs labels + website extras", () => {
    const channels = listChatChannels();
    const first = channels[0];
    if (!first) {
      throw new Error("Missing channel metadata.");
    }
    const line = formatChannelSelectionLine(first, (path, label) =>
      [label, path].filter(Boolean).join(":"),
    );
    expect(line).toContain("Docs:");
    expect(line).toContain("/channels/whatsapp");
    expect(line).toContain("WhatsApp");
  });

  it("enforces whatsapp-only list without mode flags", () => {
    const channels = withEnv(
      { PROPAICLAW_MODE: undefined, PROPAICLAW_CHANNELS_ONLY: undefined },
      () => listChatChannels().map((channel) => channel.id),
    );
    expect(channels).toEqual(["whatsapp"]);

    const normalizedTelegram = withEnv(
      { PROPAICLAW_MODE: undefined, PROPAICLAW_CHANNELS_ONLY: undefined },
      () => normalizeChatChannelId("telegram"),
    );
    expect(normalizedTelegram).toBeNull();
  });

  it("ignores explicit allowlist requests for non-whatsapp channels", () => {
    const channels = withEnv({ PROPAICLAW_CHANNELS_ONLY: "telegram, whatsapp" }, () =>
      listChatChannels().map((channel) => channel.id),
    );
    expect(channels).toEqual(["whatsapp"]);
  });

  it("ignores unrelated allowlist env names", () => {
    const channels = withEnv(
      { PROPAICLAW_CHANNELS_ONLY: undefined, LEGACY_CHANNELS_ONLY: "telegram" },
      () => listChatChannels().map((channel) => channel.id),
    );
    expect(channels).toEqual(["whatsapp"]);
  });
});
