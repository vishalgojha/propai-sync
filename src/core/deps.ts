import fs from "node:fs";
import os from "node:os";
import JSON5 from "json5";
import type { sendMessageWhatsApp } from "../web/outbound.js";

export type CliDeps = {
  fs?: typeof fs;
  json5?: typeof JSON5;
  env?: NodeJS.ProcessEnv;
  homedir?: () => string;
  configPath?: string;
  logger?: Pick<typeof console, "error" | "warn">;
  log?: (line: string) => void;
  error?: (line: string) => void;
  cwd?: () => string;
  prompt?: (message: string) => Promise<boolean>;
  sendWhatsApp?: typeof sendMessageWhatsApp;
};

export function createDefaultDeps(): Required<
  Pick<CliDeps, "fs" | "json5" | "env" | "homedir" | "logger" | "log" | "error" | "cwd">
> {
  return {
    fs,
    json5: JSON5,
    env: process.env,
    homedir: () => os.homedir(),
    logger: console,
    log: (line: string) => console.log(line),
    error: (line: string) => console.error(line),
    cwd: () => process.cwd(),
  };
}

export { createOutboundSendDeps } from "./outbound-send-deps.js";
