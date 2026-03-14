import type {
  AnyAgentTool,
  PropAiSyncPluginApi,
  PropAiSyncPluginToolFactory,
} from "propai/plugin-sdk/lobster";
import { createLobsterTool } from "./src/lobster-tool.js";

export default function register(api: PropAiSyncPluginApi) {
  api.registerTool(
    ((ctx) => {
      if (ctx.sandboxed) {
        return null;
      }
      return createLobsterTool(api) as AnyAgentTool;
    }) as PropAiSyncPluginToolFactory,
    { optional: true },
  );
}



