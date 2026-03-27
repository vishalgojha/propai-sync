import type { OutboundSendDeps } from "../infra/outbound/deliver.js";
import type { CliDeps } from "./deps.js";

export type { CliDeps } from "./deps.js";

export function createOutboundSendDeps(deps: CliDeps): OutboundSendDeps {
  return {
    sendWhatsApp: deps.sendWhatsApp,
  };
}
