import { createPluginRuntimeStore } from "propai/plugin-sdk/compat";
import type { PluginRuntime } from "propai/plugin-sdk/telegram";

const { setRuntime: setTelegramRuntime, getRuntime: getTelegramRuntime } =
  createPluginRuntimeStore<PluginRuntime>("Telegram runtime not initialized");
export { getTelegramRuntime, setTelegramRuntime };


