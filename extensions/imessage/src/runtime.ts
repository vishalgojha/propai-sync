import { createPluginRuntimeStore } from "propai/plugin-sdk/compat";
import type { PluginRuntime } from "propai/plugin-sdk/imessage";

const { setRuntime: setIMessageRuntime, getRuntime: getIMessageRuntime } =
  createPluginRuntimeStore<PluginRuntime>("iMessage runtime not initialized");
export { getIMessageRuntime, setIMessageRuntime };


