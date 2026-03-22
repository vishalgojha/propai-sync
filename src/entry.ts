import process from "node:process";
import type { GatewayAuthConfig, GatewayAuthMode, GatewayBindMode } from "./config/types.gateway.js";
import { loadConfig } from "./config/config.js";
import { resolveGatewayPort } from "./config/paths.js";
import { startGatewayServer } from "./gateway/server.js";
import { loadDotEnv } from "./infra/dotenv.js";
import { normalizeEnv } from "./infra/env.js";
import { readPropAiEnvValue } from "./infra/env-read.js";
import { assertSupportedRuntime } from "./infra/runtime-guard.js";
import { enableConsoleCapture } from "./logging.js";
import { createSubsystemLogger } from "./logging/subsystem.js";

const log = createSubsystemLogger("gateway/entry");

const GATEWAY_BIND_MODES: readonly GatewayBindMode[] = [
  "auto",
  "lan",
  "loopback",
  "custom",
  "tailnet",
];

const GATEWAY_AUTH_MODES: readonly GatewayAuthMode[] = ["none", "token", "password", "trusted-proxy"];

function parseBooleanFlag(value: string | undefined): boolean {
  if (!value) {
    return false;
  }
  const normalized = value.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes";
}

function parseGatewayBindMode(value: string | undefined): GatewayBindMode | undefined {
  if (!value) {
    return undefined;
  }
  const trimmed = value.trim();
  return GATEWAY_BIND_MODES.includes(trimmed as GatewayBindMode)
    ? (trimmed as GatewayBindMode)
    : undefined;
}

function parseGatewayAuthMode(value: string | undefined): GatewayAuthMode | undefined {
  if (!value) {
    return undefined;
  }
  const trimmed = value.trim();
  return GATEWAY_AUTH_MODES.includes(trimmed as GatewayAuthMode)
    ? (trimmed as GatewayAuthMode)
    : undefined;
}

function resolveGatewayAuthOverride(env: NodeJS.ProcessEnv): GatewayAuthConfig | undefined {
  const token = readPropAiEnvValue(env, "GATEWAY_TOKEN")?.trim();
  const password = readPropAiEnvValue(env, "GATEWAY_PASSWORD")?.trim();
  const mode = parseGatewayAuthMode(readPropAiEnvValue(env, "GATEWAY_AUTH_MODE"));

  if (!token && !password && !mode) {
    return undefined;
  }

  const auth: GatewayAuthConfig = {};
  if (mode) {
    auth.mode = mode;
  }
  if (token) {
    auth.token = token;
  }
  if (password) {
    auth.password = password;
  }
  return auth;
}

function registerGlobalErrorHandlers() {
  process.on("uncaughtException", (err) => {
    log.error(
      `gateway: uncaught exception (process kept alive): ${
        err instanceof Error ? err.stack ?? err.message : String(err)
      }`,
    );
  });
  process.on("unhandledRejection", (reason) => {
    log.error(
      `gateway: unhandled rejection (process kept alive): ${
        reason instanceof Error ? reason.stack ?? reason.message : String(reason)
      }`,
    );
  });
}

async function startGateway(): Promise<void> {
  loadDotEnv({ quiet: true });
  normalizeEnv();
  enableConsoleCapture();
  assertSupportedRuntime();
  registerGlobalErrorHandlers();

  let cfg;
  try {
    cfg = loadConfig();
  } catch (err) {
    log.error(`gateway: failed to load config: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
    return;
  }

  const allowUnconfigured = parseBooleanFlag(
    readPropAiEnvValue(process.env, "GATEWAY_ALLOW_UNCONFIGURED"),
  );
  if (!allowUnconfigured && cfg.gateway?.mode && cfg.gateway.mode !== "local") {
    log.error(
      `gateway start blocked: gateway.mode=${cfg.gateway.mode} (set gateway.mode=local or PROPAI_GATEWAY_ALLOW_UNCONFIGURED=1).`,
    );
    process.exit(1);
    return;
  }

  const port = resolveGatewayPort(cfg, process.env);
  const bind =
    parseGatewayBindMode(readPropAiEnvValue(process.env, "GATEWAY_BIND")) ??
    cfg.gateway?.bind ??
    "loopback";
  const authOverride = resolveGatewayAuthOverride(process.env);

  const server = await startGatewayServer(port, { bind, auth: authOverride });

  const shutdown = async (signal: string) => {
    log.info(`gateway: shutting down (${signal})`);
    await server.close({ reason: signal });
    process.exit(0);
  };

  process.on("SIGINT", () => {
    void shutdown("SIGINT");
  });
  process.on("SIGTERM", () => {
    void shutdown("SIGTERM");
  });
}

void startGateway().catch((err) => {
  log.error(`gateway: failed to start: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
