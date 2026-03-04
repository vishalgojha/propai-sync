import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { RuntimeEnv } from "../runtime.js";

const mocks = vi.hoisted(() => ({
  runInteractiveOnboarding: vi.fn(async () => {}),
  runNonInteractiveOnboarding: vi.fn(async () => {}),
  readConfigFileSnapshot: vi.fn(async () => ({ exists: false, valid: false, config: {} })),
  handleReset: vi.fn(async () => {}),
}));

vi.mock("./onboard-interactive.js", () => ({
  runInteractiveOnboarding: mocks.runInteractiveOnboarding,
}));

vi.mock("./onboard-non-interactive.js", () => ({
  runNonInteractiveOnboarding: mocks.runNonInteractiveOnboarding,
}));

vi.mock("../config/config.js", () => ({
  readConfigFileSnapshot: mocks.readConfigFileSnapshot,
}));

vi.mock("./onboard-helpers.js", () => ({
  DEFAULT_WORKSPACE: "~/.openclaw/workspace",
  handleReset: mocks.handleReset,
}));

const { onboardCommand } = await import("./onboard.js");

function makeRuntime(): RuntimeEnv {
  return {
    log: vi.fn(),
    error: vi.fn(),
    exit: vi.fn() as unknown as RuntimeEnv["exit"],
  };
}

describe("onboardCommand", () => {
  const originalPropaiclawMode = process.env.PROPAICLAW_MODE;
  const originalPropaiclawCliName = process.env.PROPAICLAW_CLI_NAME;

  afterEach(() => {
    vi.clearAllMocks();
    mocks.readConfigFileSnapshot.mockResolvedValue({ exists: false, valid: false, config: {} });
    if (originalPropaiclawMode === undefined) {
      delete process.env.PROPAICLAW_MODE;
    } else {
      process.env.PROPAICLAW_MODE = originalPropaiclawMode;
    }
    if (originalPropaiclawCliName === undefined) {
      delete process.env.PROPAICLAW_CLI_NAME;
    } else {
      process.env.PROPAICLAW_CLI_NAME = originalPropaiclawCliName;
    }
  });

  it("fails fast for invalid secret-input-mode before onboarding starts", async () => {
    const runtime = makeRuntime();

    await onboardCommand(
      {
        secretInputMode: "invalid" as never,
      },
      runtime,
    );

    expect(runtime.error).toHaveBeenCalledWith(
      'Invalid --secret-input-mode. Use "plaintext" or "ref".',
    );
    expect(runtime.exit).toHaveBeenCalledWith(1);
    expect(mocks.runInteractiveOnboarding).not.toHaveBeenCalled();
    expect(mocks.runNonInteractiveOnboarding).not.toHaveBeenCalled();
  });

  it("defaults --reset to config+creds+sessions scope", async () => {
    const runtime = makeRuntime();

    await onboardCommand(
      {
        reset: true,
      },
      runtime,
    );

    expect(mocks.handleReset).toHaveBeenCalledWith(
      "config+creds+sessions",
      expect.any(String),
      runtime,
    );
  });

  it("uses configured default workspace for --reset when --workspace is not provided", async () => {
    const runtime = makeRuntime();
    mocks.readConfigFileSnapshot.mockResolvedValue({
      exists: true,
      valid: true,
      config: {
        agents: {
          defaults: {
            workspace: "/tmp/openclaw-custom-workspace",
          },
        },
      },
    });

    await onboardCommand(
      {
        reset: true,
      },
      runtime,
    );

    expect(mocks.handleReset).toHaveBeenCalledWith(
      "config+creds+sessions",
      path.resolve("/tmp/openclaw-custom-workspace"),
      runtime,
    );
  });

  it("accepts explicit --reset-scope full", async () => {
    const runtime = makeRuntime();

    await onboardCommand(
      {
        reset: true,
        resetScope: "full",
      },
      runtime,
    );

    expect(mocks.handleReset).toHaveBeenCalledWith("full", expect.any(String), runtime);
  });

  it("fails fast for invalid --reset-scope", async () => {
    const runtime = makeRuntime();

    await onboardCommand(
      {
        reset: true,
        resetScope: "invalid" as never,
      },
      runtime,
    );

    expect(runtime.error).toHaveBeenCalledWith(
      'Invalid --reset-scope. Use "config", "config+creds+sessions", or "full".',
    );
    expect(runtime.exit).toHaveBeenCalledWith(1);
    expect(mocks.handleReset).not.toHaveBeenCalled();
    expect(mocks.runInteractiveOnboarding).not.toHaveBeenCalled();
    expect(mocks.runNonInteractiveOnboarding).not.toHaveBeenCalled();
  });

  it("uses propaiclaw rerun command hint in non-interactive mode when wrapper mode is enabled", async () => {
    const runtime = makeRuntime();
    process.env.PROPAICLAW_MODE = "1";

    await onboardCommand(
      {
        nonInteractive: true,
      },
      runtime,
    );

    expect(runtime.error).toHaveBeenCalledWith(
      expect.stringContaining("Re-run with: propaiclaw onboard --non-interactive --accept-risk ..."),
    );
    expect(runtime.error).toHaveBeenCalledWith(expect.stringContaining("Read: /security"));
    expect(runtime.exit).toHaveBeenCalledWith(1);
  });

  it("uses wrapper alias name in rerun hint when provided", async () => {
    const runtime = makeRuntime();
    process.env.PROPAICLAW_MODE = "1";
    process.env.PROPAICLAW_CLI_NAME = "propai";

    await onboardCommand(
      {
        nonInteractive: true,
      },
      runtime,
    );

    expect(runtime.error).toHaveBeenCalledWith(
      expect.stringContaining("Re-run with: propai onboard --non-interactive --accept-risk ..."),
    );
  });

  it("prints PropAI WSL hint on Windows in wrapper mode", async () => {
    const runtime = makeRuntime();
    process.env.PROPAICLAW_MODE = "1";
    const platformSpy = vi.spyOn(process, "platform", "get").mockReturnValue("win32");

    try {
      await onboardCommand({}, runtime);
    } finally {
      platformSpy.mockRestore();
    }

    expect(runtime.log).toHaveBeenCalledWith(
      expect.stringContaining("Windows detected — PropAI runs best on WSL2!"),
    );
    expect(runtime.log).toHaveBeenCalledWith(expect.stringContaining("Guide: /windows"));
  });
});
