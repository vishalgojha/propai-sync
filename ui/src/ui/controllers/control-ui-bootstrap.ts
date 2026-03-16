import {
  type ControlUiBootstrapConfig,
} from "../../../../src/gateway/control-ui-contract.js";
import { normalizeAssistantIdentity } from "../assistant-identity.ts";
import { tauriInvoke } from "../desktop/tauri.ts";
import type { UiSettings } from "../storage.ts";

export type ControlUiBootstrapState = {
  basePath: string;
  assistantName: string;
  assistantAvatar: string | null;
  assistantAgentId: string | null;
  serverVersion: string | null;
  settings?: UiSettings;
};

export async function loadControlUiBootstrapConfig(state: ControlUiBootstrapState) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    const gatewayUrl = state.settings?.gatewayUrl?.trim() || "";
    const parsed = await tauriInvoke<ControlUiBootstrapConfig>(
      "get_control_ui_config",
      gatewayUrl ? { gatewayUrl } : {},
    );
    const normalized = normalizeAssistantIdentity({
      agentId: parsed.assistantAgentId ?? null,
      name: parsed.assistantName,
      avatar: parsed.assistantAvatar ?? null,
    });
    state.assistantName = normalized.name;
    state.assistantAvatar = normalized.avatar;
    state.assistantAgentId = normalized.agentId ?? null;
    state.serverVersion = parsed.serverVersion ?? null;
  } catch {
    // Ignore bootstrap failures; UI will update identity after connecting.
  }
}
