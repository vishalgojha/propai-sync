import chalk from "chalk";
import { DEFAULT_MODEL, DEFAULT_PROVIDER } from "../agents/defaults.js";
import { resolveConfiguredModelRef } from "../agents/model-selection.js";
import type { loadConfig } from "../config/config.js";
import { isTruthyEnvValue } from "../infra/env.js";
import { normalizeControlUiBasePath } from "./control-ui-shared.js";
import { getResolvedLoggerSettings } from "../logging.js";
import { collectEnabledInsecureOrDangerousFlags } from "../security/dangerous-config-flags.js";

function formatHost(host: string) {
  return host.includes(":") ? `[${host}]` : host;
}

function resolveControlUiHost(bindHosts: string[], bindHost: string): string {
  if (bindHosts.includes("127.0.0.1")) {
    return "127.0.0.1";
  }
  if (bindHosts.includes("::1")) {
    return "[::1]";
  }
  if (bindHost === "0.0.0.0") {
    return "127.0.0.1";
  }
  if (bindHost === "::") {
    return "[::1]";
  }
  return formatHost(bindHost);
}

function resolveControlUiUrl(params: {
  cfg: ReturnType<typeof loadConfig>;
  bindHost: string;
  bindHosts: string[];
  port: number;
}): string | null {
  const controlUiEnabled = params.cfg.gateway?.controlUi?.enabled !== false;
  if (!controlUiEnabled) {
    return null;
  }
  const basePath = normalizeControlUiBasePath(params.cfg.gateway?.controlUi?.basePath);
  const uiPath = basePath ? `${basePath}/` : "/";
  const host = resolveControlUiHost(params.bindHosts, params.bindHost);
  return `http://${host}:${params.port}${uiPath}`;
}

export function logGatewayStartup(params: {
  cfg: ReturnType<typeof loadConfig>;
  bindHost: string;
  bindHosts?: string[];
  port: number;
  tlsEnabled?: boolean;
  log: { info: (msg: string, meta?: Record<string, unknown>) => void; warn: (msg: string) => void };
  isNixMode: boolean;
}) {
  const { provider: agentProvider, model: agentModel } = resolveConfiguredModelRef({
    cfg: params.cfg,
    defaultProvider: DEFAULT_PROVIDER,
    defaultModel: DEFAULT_MODEL,
  });
  const modelRef = `${agentProvider}/${agentModel}`;
  params.log.info(`agent model: ${modelRef}`, {
    consoleMessage: `agent model: ${chalk.whiteBright(modelRef)}`,
  });
  const scheme = params.tlsEnabled ? "wss" : "ws";
  const hosts =
    params.bindHosts && params.bindHosts.length > 0 ? params.bindHosts : [params.bindHost];
  const listenEndpoints = hosts.map((host) => `${scheme}://${formatHost(host)}:${params.port}`);
  params.log.info(`listening on ${listenEndpoints.join(", ")} (PID ${process.pid})`);
  const controlUiUrl = resolveControlUiUrl({
    cfg: params.cfg,
    bindHost: params.bindHost,
    bindHosts: hosts,
    port: params.port,
  });
  if (controlUiUrl) {
    const label = isTruthyEnvValue(process.env.PROPAICLAW_MODE) ? "propai ui" : "control ui";
    params.log.info(`${label}: ${controlUiUrl}`);
  }
  params.log.info(`log file: ${getResolvedLoggerSettings().file}`);
  if (params.isNixMode) {
    params.log.info("gateway: running in Nix mode (config managed externally)");
  }

  const enabledDangerousFlags = collectEnabledInsecureOrDangerousFlags(params.cfg);
  if (enabledDangerousFlags.length > 0) {
    const warning =
      `security warning: dangerous config flags enabled: ${enabledDangerousFlags.join(", ")}. ` +
      "Run `openclaw security audit`.";
    params.log.warn(warning);
  }
}
