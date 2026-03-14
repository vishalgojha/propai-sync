import { createPluginRuntimeStore } from "propai/plugin-sdk/compat";
import type { PluginRuntime } from "propai/plugin-sdk/line";

const { setRuntime: setLineRuntime, getRuntime: getLineRuntime } =
  createPluginRuntimeStore<PluginRuntime>("LINE runtime not initialized - plugin not registered");
export { getLineRuntime, setLineRuntime };


