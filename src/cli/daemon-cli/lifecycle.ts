import { loadConfig, resolveGatewayPort } from "../../config/config.js";
import { resolveGatewayService } from "../../daemon/service.js";
import { defaultRuntime } from "../../runtime.js";
import { theme } from "../../terminal/theme.js";
import { formatCliCommand } from "../command-format.js";
import {
  runServiceRestart,
  runServiceStart,
  runServiceStop,
  runServiceUninstall,
} from "./lifecycle-core.js";
import {
  collectGatewayProcessPids,
  DEFAULT_RESTART_HEALTH_ATTEMPTS,
  DEFAULT_RESTART_HEALTH_DELAY_MS,
  inspectGatewayRestart,
  renderRestartDiagnostics,
  terminateStaleGatewayPids,
  waitForGatewayHealthyRestart,
} from "./restart-health.js";
import { parsePortFromArgs, renderGatewayServiceStartHints } from "./shared.js";
import type { DaemonLifecycleOptions, DaemonStopOptions } from "./types.js";

const POST_RESTART_HEALTH_ATTEMPTS = DEFAULT_RESTART_HEALTH_ATTEMPTS;
const POST_RESTART_HEALTH_DELAY_MS = DEFAULT_RESTART_HEALTH_DELAY_MS;

async function resolveGatewayServicePort() {
  const service = resolveGatewayService();
  const command = await service.readCommand(process.env).catch(() => null);
  const serviceEnv = command?.environment ?? undefined;
  const mergedEnv = {
    ...(process.env as Record<string, string | undefined>),
    ...(serviceEnv ?? undefined),
  } as NodeJS.ProcessEnv;

  const portFromArgs = parsePortFromArgs(command?.programArguments);
  return portFromArgs ?? resolveGatewayPort(loadConfig(), mergedEnv);
}

export async function runDaemonUninstall(opts: DaemonLifecycleOptions = {}) {
  return await runServiceUninstall({
    serviceNoun: "Gateway",
    service: resolveGatewayService(),
    opts,
    stopBeforeUninstall: true,
    assertNotLoadedAfterUninstall: true,
  });
}

export async function runDaemonStart(opts: DaemonLifecycleOptions = {}) {
  return await runServiceStart({
    serviceNoun: "Gateway",
    service: resolveGatewayService(),
    renderStartHints: renderGatewayServiceStartHints,
    opts,
  });
}

export async function runDaemonStop(opts: DaemonStopOptions = {}) {
  const json = Boolean(opts.json);
  const service = resolveGatewayService();
  const stopPort = opts.force
    ? await resolveGatewayServicePort().catch(() => resolveGatewayPort(loadConfig(), process.env))
    : null;
  return await runServiceStop({
    serviceNoun: "Gateway",
    service,
    opts,
    postStopCheck: stopPort
      ? async ({ warnings, fail }) => {
          let snapshot = await inspectGatewayRestart({
            service,
            port: stopPort,
          });
          let stalePids = collectGatewayProcessPids(snapshot);
          if (stalePids.length === 0) {
            return;
          }

          const staleMsg = `Found lingering gateway process(es): ${stalePids.join(", ")}.`;
          warnings.push(staleMsg);
          if (!json) {
            defaultRuntime.log(theme.warn(staleMsg));
            defaultRuntime.log(theme.muted("Stopping lingering process(es)..."));
          }
          await terminateStaleGatewayPids(stalePids);

          snapshot = await inspectGatewayRestart({
            service,
            port: stopPort,
          });
          stalePids = collectGatewayProcessPids(snapshot);
          if (stalePids.length === 0) {
            return;
          }

          const timeoutLine = `Gateway stop --force could not terminate lingering process(es): ${stalePids.join(", ")}.`;
          const diagnostics = renderRestartDiagnostics(snapshot);
          if (!json) {
            defaultRuntime.log(theme.warn(timeoutLine));
            for (const line of diagnostics) {
              defaultRuntime.log(theme.muted(line));
            }
          } else {
            warnings.push(timeoutLine);
            warnings.push(...diagnostics);
          }
          fail("Gateway stop --force failed to terminate lingering processes.", [
            formatCliCommand("openclaw gateway status --deep"),
            formatCliCommand("openclaw doctor"),
          ]);
        }
      : undefined,
  });
}

/**
 * Restart the gateway service service.
 * @returns `true` if restart succeeded, `false` if the service was not loaded.
 * Throws/exits on check or restart failures.
 */
export async function runDaemonRestart(opts: DaemonLifecycleOptions = {}): Promise<boolean> {
  const json = Boolean(opts.json);
  const service = resolveGatewayService();
  const restartPort = await resolveGatewayServicePort().catch(() =>
    resolveGatewayPort(loadConfig(), process.env),
  );
  const restartWaitMs = POST_RESTART_HEALTH_ATTEMPTS * POST_RESTART_HEALTH_DELAY_MS;
  const restartWaitSeconds = Math.round(restartWaitMs / 1000);

  return await runServiceRestart({
    serviceNoun: "Gateway",
    service,
    renderStartHints: renderGatewayServiceStartHints,
    opts,
    checkTokenDrift: true,
    postRestartCheck: async ({ warnings, fail, stdout }) => {
      let health = await waitForGatewayHealthyRestart({
        service,
        port: restartPort,
        attempts: POST_RESTART_HEALTH_ATTEMPTS,
        delayMs: POST_RESTART_HEALTH_DELAY_MS,
      });

      if (!health.healthy && health.staleGatewayPids.length > 0) {
        const staleMsg = `Found stale gateway process(es): ${health.staleGatewayPids.join(", ")}.`;
        warnings.push(staleMsg);
        if (!json) {
          defaultRuntime.log(theme.warn(staleMsg));
          defaultRuntime.log(theme.muted("Stopping stale process(es) and retrying restart..."));
        }

        await terminateStaleGatewayPids(health.staleGatewayPids);
        await service.restart({ env: process.env, stdout });
        health = await waitForGatewayHealthyRestart({
          service,
          port: restartPort,
          attempts: POST_RESTART_HEALTH_ATTEMPTS,
          delayMs: POST_RESTART_HEALTH_DELAY_MS,
        });
      }

      if (health.healthy) {
        return;
      }

      const diagnostics = renderRestartDiagnostics(health);
      const timeoutLine = `Timed out after ${restartWaitSeconds}s waiting for gateway port ${restartPort} to become healthy.`;
      const runningNoPortLine =
        health.runtime.status === "running" && health.portUsage.status === "free"
          ? `Gateway process is running but port ${restartPort} is still free (startup hang/crash loop or very slow VM startup).`
          : null;
      if (!json) {
        defaultRuntime.log(theme.warn(timeoutLine));
        if (runningNoPortLine) {
          defaultRuntime.log(theme.warn(runningNoPortLine));
        }
        for (const line of diagnostics) {
          defaultRuntime.log(theme.muted(line));
        }
      } else {
        warnings.push(timeoutLine);
        if (runningNoPortLine) {
          warnings.push(runningNoPortLine);
        }
        warnings.push(...diagnostics);
      }

      fail(`Gateway restart timed out after ${restartWaitSeconds}s waiting for health checks.`, [
        formatCliCommand("openclaw gateway status --deep"),
        formatCliCommand("openclaw doctor"),
      ]);
    },
  });
}
