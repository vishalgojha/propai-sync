import type { PropAiSyncPluginApi } from "propai/plugin-sdk/device-pair";

export type PendingPairingRequest = {
  requestId: string;
  deviceId: string;
  displayName?: string;
  platform?: string;
  remoteIp?: string;
  ts?: number;
};

export function formatPendingRequests(pending: PendingPairingRequest[]): string {
  if (pending.length === 0) {
    return "No pending device pairing requests.";
  }
  const lines: string[] = ["Pending device pairing requests:"];
  for (const req of pending) {
    const label = req.displayName?.trim() || req.deviceId;
    const platform = req.platform?.trim();
    const ip = req.remoteIp?.trim();
    const parts = [
      `- ${req.requestId}`,
      label ? `name=${label}` : null,
      platform ? `platform=${platform}` : null,
      ip ? `ip=${ip}` : null,
    ].filter(Boolean);
    lines.push(parts.join(" · "));
  }
  return lines.join("\n");
}

export async function handleNotifyCommand(_params: {
  api: PropAiSyncPluginApi;
  ctx: {
    channel: string;
    senderId?: string;
    from?: string;
    to?: string;
    accountId?: string;
    messageThreadId?: number;
  };
  action: string;
}): Promise<{ text: string }> {
  return { text: "Pairing notifications are disabled in the WhatsApp-only build." };
}

export function registerPairingNotifierService(_api: PropAiSyncPluginApi): void {
  // Notifications are disabled in the WhatsApp-only build.
}
