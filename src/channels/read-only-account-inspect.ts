import type { PropAiSyncConfig } from "../config/config.js";
import {
  inspectTelegramAccount,
  type InspectedTelegramAccount,
} from "../telegram/account-inspect.js";
import type { ChannelId } from "./plugins/types.js";

export type ReadOnlyInspectedAccount = InspectedTelegramAccount;

export function inspectReadOnlyChannelAccount(params: {
  channelId: ChannelId;
  cfg: PropAiSyncConfig;
  accountId?: string | null;
}): ReadOnlyInspectedAccount | null {
  if (params.channelId === "telegram") {
    return inspectTelegramAccount({
      cfg: params.cfg,
      accountId: params.accountId,
    });
  }
  return null;
}

