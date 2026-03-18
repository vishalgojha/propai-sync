import { vi } from "vitest";
import type { ChannelChoice } from "./onboard-types.js";
import type { ChannelOnboardingAdapter } from "./onboarding/types.js";
import * as onboardingRegistry from "./onboarding/registry.js";
import { telegramPlugin } from "../../extensions/telegram/src/channel.js";
import { whatsappPlugin } from "../../extensions/whatsapp/src/channel.js";
import type { ChannelPlugin } from "../channels/plugins/types.plugin.js";
import { setActivePluginRegistry } from "../plugins/runtime.js";
import { createTestRegistry } from "../test-utils/channel-plugins.js";

export function setDefaultChannelPluginRegistryForTests(): void {
  const telegramChannelPlugin = telegramPlugin as unknown as ChannelPlugin;
  const whatsappChannelPlugin = whatsappPlugin as unknown as ChannelPlugin;
  setActivePluginRegistry(
    createTestRegistry([
      {
        pluginId: "telegram",
        source: "test",
        plugin: telegramChannelPlugin,
      },
      {
        pluginId: "whatsapp",
        source: "test",
        plugin: whatsappChannelPlugin,
      },
    ]),
  );
}

export function patchChannelOnboardingAdapter(
  channel: ChannelChoice,
  overrides: Partial<ChannelOnboardingAdapter>,
): () => void {
  const original = onboardingRegistry.getChannelOnboardingAdapter(channel);
  if (!original) {
    throw new Error(`Missing onboarding adapter for ${channel}`);
  }
  const patched: ChannelOnboardingAdapter = { ...original, ...overrides };
  const allAdapters = onboardingRegistry.listChannelOnboardingAdapters();
  const patchedAdapters = allAdapters.map((adapter) =>
    adapter.channel === channel ? patched : adapter,
  );

  const getSpy = vi
    .spyOn(onboardingRegistry, "getChannelOnboardingAdapter")
    .mockImplementation((requested) => (requested === channel ? patched : original));
  const listSpy = vi
    .spyOn(onboardingRegistry, "listChannelOnboardingAdapters")
    .mockReturnValue(patchedAdapters);

  return () => {
    getSpy.mockRestore();
    listSpy.mockRestore();
  };
}
