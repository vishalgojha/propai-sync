import { beforeEach, describe, expect, it, vi } from "vitest";

type RestartHealthSnapshot = {
  healthy: boolean;
  staleGatewayPids: number[];
  runtime: { status?: string };
  portUsage: { port: number; status: string; listeners: []; hints: []; errors?: string[] };
};

type RestartPostCheckContext = {
  json: boolean;
  stdout: NodeJS.WritableStream;
  warnings: string[];
  fail: (message: string, hints?: string[]) => void;
};

type RestartParams = {
  opts?: { json?: boolean };
  postRestartCheck?: (ctx: RestartPostCheckContext) => Promise<void>;
};

type StopPostCheckContext = {
  json: boolean;
  stdout: NodeJS.WritableStream;
  warnings: string[];
  fail: (message: string, hints?: string[]) => void;
};

type StopParams = {
  opts?: { json?: boolean; force?: boolean };
  postStopCheck?: (ctx: StopPostCheckContext) => Promise<void>;
};

const service = {
  readCommand: vi.fn(),
  restart: vi.fn(),
};

const runServiceStop = vi.fn();
const runServiceRestart = vi.fn();
const inspectGatewayRestart = vi.fn();
const waitForGatewayHealthyRestart = vi.fn();
const collectGatewayProcessPids = vi.fn();
const terminateStaleGatewayPids = vi.fn();
const renderRestartDiagnostics = vi.fn(() => ["diag: unhealthy runtime"]);
const resolveGatewayPort = vi.fn(() => 18789);
const loadConfig = vi.fn(() => ({}));

vi.mock("../../config/config.js", () => ({
  loadConfig: () => loadConfig(),
  resolveGatewayPort,
}));

vi.mock("../../daemon/service.js", () => ({
  resolveGatewayService: () => service,
}));

vi.mock("./restart-health.js", () => ({
  DEFAULT_RESTART_HEALTH_ATTEMPTS: 120,
  DEFAULT_RESTART_HEALTH_DELAY_MS: 500,
  inspectGatewayRestart,
  waitForGatewayHealthyRestart,
  collectGatewayProcessPids,
  terminateStaleGatewayPids,
  renderRestartDiagnostics,
}));

vi.mock("./lifecycle-core.js", () => ({
  runServiceRestart,
  runServiceStart: vi.fn(),
  runServiceStop,
  runServiceUninstall: vi.fn(),
}));

describe("runDaemonRestart health checks", () => {
  beforeEach(() => {
    vi.resetModules();
    service.readCommand.mockClear();
    service.restart.mockClear();
    runServiceStop.mockClear();
    runServiceRestart.mockClear();
    inspectGatewayRestart.mockClear();
    waitForGatewayHealthyRestart.mockClear();
    collectGatewayProcessPids.mockClear();
    terminateStaleGatewayPids.mockClear();
    renderRestartDiagnostics.mockClear();
    resolveGatewayPort.mockClear();
    loadConfig.mockClear();

    service.readCommand.mockResolvedValue({
      programArguments: ["openclaw", "gateway", "--port", "18789"],
      environment: {},
    });

    runServiceRestart.mockImplementation(async (params: RestartParams) => {
      const fail = (message: string, hints?: string[]) => {
        const err = new Error(message) as Error & { hints?: string[] };
        err.hints = hints;
        throw err;
      };
      await params.postRestartCheck?.({
        json: Boolean(params.opts?.json),
        stdout: process.stdout,
        warnings: [],
        fail,
      });
      return true;
    });

    runServiceStop.mockImplementation(async (params: StopParams) => {
      const fail = (message: string, hints?: string[]) => {
        const err = new Error(message) as Error & { hints?: string[] };
        err.hints = hints;
        throw err;
      };
      await params.postStopCheck?.({
        json: Boolean(params.opts?.json),
        stdout: process.stdout,
        warnings: [],
        fail,
      });
      return true;
    });
  });

  it("kills stale gateway pids and retries restart", async () => {
    const unhealthy: RestartHealthSnapshot = {
      healthy: false,
      staleGatewayPids: [1993],
      runtime: { status: "stopped" },
      portUsage: { port: 18789, status: "busy", listeners: [], hints: [] },
    };
    const healthy: RestartHealthSnapshot = {
      healthy: true,
      staleGatewayPids: [],
      runtime: { status: "running" },
      portUsage: { port: 18789, status: "busy", listeners: [], hints: [] },
    };
    waitForGatewayHealthyRestart.mockResolvedValueOnce(unhealthy).mockResolvedValueOnce(healthy);
    terminateStaleGatewayPids.mockResolvedValue([1993]);

    const { runDaemonRestart } = await import("./lifecycle.js");
    const result = await runDaemonRestart({ json: true });

    expect(result).toBe(true);
    expect(terminateStaleGatewayPids).toHaveBeenCalledWith([1993]);
    expect(service.restart).toHaveBeenCalledTimes(1);
    expect(waitForGatewayHealthyRestart).toHaveBeenCalledTimes(2);
  });

  it("fails restart when gateway remains unhealthy", async () => {
    const unhealthy: RestartHealthSnapshot = {
      healthy: false,
      staleGatewayPids: [],
      runtime: { status: "stopped" },
      portUsage: { port: 18789, status: "free", listeners: [], hints: [] },
    };
    waitForGatewayHealthyRestart.mockResolvedValue(unhealthy);

    const { runDaemonRestart } = await import("./lifecycle.js");

    await expect(runDaemonRestart({ json: true })).rejects.toMatchObject({
      message: "Gateway restart timed out after 60s waiting for health checks.",
      hints: ["openclaw gateway status --deep", "openclaw doctor"],
    });
    expect(terminateStaleGatewayPids).not.toHaveBeenCalled();
    expect(renderRestartDiagnostics).toHaveBeenCalledTimes(1);
  });

  it("does not run forced cleanup on stop unless --force is set", async () => {
    const { runDaemonStop } = await import("./lifecycle.js");
    await runDaemonStop({ json: true });

    expect(runServiceStop).toHaveBeenCalledTimes(1);
    const args = runServiceStop.mock.calls[0]?.[0] as StopParams | undefined;
    expect(args?.postStopCheck).toBeUndefined();
    expect(terminateStaleGatewayPids).not.toHaveBeenCalled();
  });

  it("runs forced cleanup for lingering gateway processes on stop --force", async () => {
    const snapshot: RestartHealthSnapshot = {
      healthy: false,
      staleGatewayPids: [4555],
      runtime: { status: "running" },
      portUsage: { port: 18789, status: "busy", listeners: [], hints: [] },
    };
    inspectGatewayRestart.mockResolvedValue(snapshot);
    collectGatewayProcessPids.mockReturnValueOnce([4555]).mockReturnValueOnce([]);
    terminateStaleGatewayPids.mockResolvedValue([4555]);

    const { runDaemonStop } = await import("./lifecycle.js");
    await runDaemonStop({ json: true, force: true });

    expect(runServiceStop).toHaveBeenCalledTimes(1);
    expect(inspectGatewayRestart).toHaveBeenCalledTimes(2);
    expect(terminateStaleGatewayPids).toHaveBeenCalledWith([4555]);
  });
});
