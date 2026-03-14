import * as compatSdk from "propai/plugin-sdk/compat";
import * as discordSdk from "propai/plugin-sdk/discord";
import * as imessageSdk from "propai/plugin-sdk/imessage";
import * as lineSdk from "propai/plugin-sdk/line";
import * as msteamsSdk from "propai/plugin-sdk/msteams";
import * as signalSdk from "propai/plugin-sdk/signal";
import * as slackSdk from "propai/plugin-sdk/slack";
import * as telegramSdk from "propai/plugin-sdk/telegram";
import * as whatsappSdk from "propai/plugin-sdk/whatsapp";
import { describe, expect, it } from "vitest";

const bundledExtensionSubpathLoaders = [
  { id: "acpx", load: () => import("propai/plugin-sdk/acpx") },
  { id: "bluebubbles", load: () => import("propai/plugin-sdk/bluebubbles") },
  { id: "copilot-proxy", load: () => import("propai/plugin-sdk/copilot-proxy") },
  { id: "device-pair", load: () => import("propai/plugin-sdk/device-pair") },
  { id: "diagnostics-otel", load: () => import("propai/plugin-sdk/diagnostics-otel") },
  { id: "diffs", load: () => import("propai/plugin-sdk/diffs") },
  { id: "feishu", load: () => import("propai/plugin-sdk/feishu") },
  {
    id: "google-gemini-cli-auth",
    load: () => import("propai/plugin-sdk/google-gemini-cli-auth"),
  },
  { id: "googlechat", load: () => import("propai/plugin-sdk/googlechat") },
  { id: "irc", load: () => import("propai/plugin-sdk/irc") },
  { id: "llm-task", load: () => import("propai/plugin-sdk/llm-task") },
  { id: "lobster", load: () => import("propai/plugin-sdk/lobster") },
  { id: "matrix", load: () => import("propai/plugin-sdk/matrix") },
  { id: "mattermost", load: () => import("propai/plugin-sdk/mattermost") },
  { id: "memory-core", load: () => import("propai/plugin-sdk/memory-core") },
  { id: "memory-lancedb", load: () => import("propai/plugin-sdk/memory-lancedb") },
  {
    id: "minimax-portal-auth",
    load: () => import("propai/plugin-sdk/minimax-portal-auth"),
  },
  { id: "nextcloud-talk", load: () => import("propai/plugin-sdk/nextcloud-talk") },
  { id: "nostr", load: () => import("propai/plugin-sdk/nostr") },
  { id: "open-prose", load: () => import("propai/plugin-sdk/open-prose") },
  { id: "phone-control", load: () => import("propai/plugin-sdk/phone-control") },
  { id: "qwen-portal-auth", load: () => import("propai/plugin-sdk/qwen-portal-auth") },
  { id: "synology-chat", load: () => import("propai/plugin-sdk/synology-chat") },
  { id: "talk-voice", load: () => import("propai/plugin-sdk/talk-voice") },
  { id: "test-utils", load: () => import("propai/plugin-sdk/test-utils") },
  { id: "thread-ownership", load: () => import("propai/plugin-sdk/thread-ownership") },
  { id: "tlon", load: () => import("propai/plugin-sdk/tlon") },
  { id: "twitch", load: () => import("propai/plugin-sdk/twitch") },
  { id: "voice-call", load: () => import("propai/plugin-sdk/voice-call") },
  { id: "zalo", load: () => import("propai/plugin-sdk/zalo") },
  { id: "zalouser", load: () => import("propai/plugin-sdk/zalouser") },
] as const;

describe("plugin-sdk subpath exports", () => {
  it("exports compat helpers", () => {
    expect(typeof compatSdk.emptyPluginConfigSchema).toBe("function");
    expect(typeof compatSdk.resolveControlCommandGate).toBe("function");
  });

  it("exports Discord helpers", () => {
    expect(typeof discordSdk.resolveDiscordAccount).toBe("function");
    expect(typeof discordSdk.inspectDiscordAccount).toBe("function");
    expect(typeof discordSdk.discordOnboardingAdapter).toBe("object");
  });

  it("exports Slack helpers", () => {
    expect(typeof slackSdk.resolveSlackAccount).toBe("function");
    expect(typeof slackSdk.inspectSlackAccount).toBe("function");
    expect(typeof slackSdk.handleSlackMessageAction).toBe("function");
  });

  it("exports Telegram helpers", () => {
    expect(typeof telegramSdk.resolveTelegramAccount).toBe("function");
    expect(typeof telegramSdk.inspectTelegramAccount).toBe("function");
    expect(typeof telegramSdk.telegramOnboardingAdapter).toBe("object");
  });

  it("exports Signal helpers", () => {
    expect(typeof signalSdk.resolveSignalAccount).toBe("function");
    expect(typeof signalSdk.signalOnboardingAdapter).toBe("object");
  });

  it("exports iMessage helpers", () => {
    expect(typeof imessageSdk.resolveIMessageAccount).toBe("function");
    expect(typeof imessageSdk.imessageOnboardingAdapter).toBe("object");
  });

  it("exports WhatsApp helpers", () => {
    expect(typeof whatsappSdk.resolveWhatsAppAccount).toBe("function");
    expect(typeof whatsappSdk.whatsappOnboardingAdapter).toBe("object");
  });

  it("exports LINE helpers", () => {
    expect(typeof lineSdk.processLineMessage).toBe("function");
    expect(typeof lineSdk.createInfoCard).toBe("function");
  });

  it("exports Microsoft Teams helpers", () => {
    expect(typeof msteamsSdk.resolveControlCommandGate).toBe("function");
    expect(typeof msteamsSdk.loadOutboundMediaFromUrl).toBe("function");
  });

  it("exports acpx helpers", async () => {
    const acpxSdk = await import("propai/plugin-sdk/acpx");
    expect(typeof acpxSdk.listKnownProviderAuthEnvVarNames).toBe("function");
    expect(typeof acpxSdk.omitEnvKeysCaseInsensitive).toBe("function");
  });

  it("resolves bundled extension subpaths", async () => {
    for (const { id, load } of bundledExtensionSubpathLoaders) {
      const mod = await load();
      expect(typeof mod).toBe("object");
      expect(mod, `subpath ${id} should resolve`).toBeTruthy();
    }
  });

  it("keeps the newly added bundled plugin-sdk contracts available", async () => {
    const bluebubbles = await import("propai/plugin-sdk/bluebubbles");
    expect(typeof bluebubbles.parseFiniteNumber).toBe("function");

    const mattermost = await import("propai/plugin-sdk/mattermost");
    expect(typeof mattermost.parseStrictPositiveInteger).toBe("function");

    const nextcloudTalk = await import("propai/plugin-sdk/nextcloud-talk");
    expect(typeof nextcloudTalk.waitForAbortSignal).toBe("function");

    const twitch = await import("propai/plugin-sdk/twitch");
    expect(typeof twitch.DEFAULT_ACCOUNT_ID).toBe("string");
    expect(typeof twitch.normalizeAccountId).toBe("function");
  });
});


