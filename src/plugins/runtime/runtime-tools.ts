import { createMemoryGetTool, createMemorySearchTool } from "../../agents/tools/memory-tool.js";
import type { PluginRuntime } from "./types.js";

export function createRuntimeTools(): PluginRuntime["tools"] {
  return {
    createMemoryGetTool,
    createMemorySearchTool,
  };
}

