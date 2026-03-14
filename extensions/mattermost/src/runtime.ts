import { createPluginRuntimeStore } from "propai/plugin-sdk/compat";
import type { PluginRuntime } from "propai/plugin-sdk/mattermost";

const { setRuntime: setMattermostRuntime, getRuntime: getMattermostRuntime } =
  createPluginRuntimeStore<PluginRuntime>("Mattermost runtime not initialized");
export { getMattermostRuntime, setMattermostRuntime };


