import { afterEach, beforeEach } from "vitest";
import { setActivePluginRegistry } from "../../plugins/runtime.js";
import { createOutboundTestPlugin, createTestRegistry } from "../../test-utils/channel-plugins.js";

export const createTelegramRegistry = () =>
  createTestRegistry([
    {
      pluginId: "telegram",
      plugin: createOutboundTestPlugin({ id: "telegram", outbound: { deliveryMode: "direct" } }),
      source: "test",
    },
  ]);

export function installTelegramRegistryHooks() {
  beforeEach(() => {
    setActivePluginRegistry(createTelegramRegistry());
  });

  afterEach(() => {
    setActivePluginRegistry(createTelegramRegistry());
  });
}
