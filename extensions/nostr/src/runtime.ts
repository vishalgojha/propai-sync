import { createPluginRuntimeStore } from "propai/plugin-sdk/compat";
import type { PluginRuntime } from "propai/plugin-sdk/nostr";

const { setRuntime: setNostrRuntime, getRuntime: getNostrRuntime } =
  createPluginRuntimeStore<PluginRuntime>("Nostr runtime not initialized");
export { getNostrRuntime, setNostrRuntime };


