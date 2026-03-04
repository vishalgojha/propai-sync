import { Command } from "commander";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const onboardCommandMock = vi.fn();

const runtime = {
  log: vi.fn(),
  error: vi.fn(),
  exit: vi.fn(),
};

vi.mock("../../commands/auth-choice-options.js", () => ({
  formatAuthChoiceChoicesForCli: () => "token|oauth",
}));

vi.mock("../../commands/onboard-provider-auth-flags.js", () => ({
  ONBOARD_PROVIDER_AUTH_FLAGS: [
    {
      cliOption: "--mistral-api-key <key>",
      description: "Mistral API key",
    },
  ] as Array<{ cliOption: string; description: string }>,
}));

vi.mock("../../commands/onboard.js", () => ({
  onboardCommand: onboardCommandMock,
}));

vi.mock("../../runtime.js", () => ({
  defaultRuntime: runtime,
}));

let registerOnboardCommand: typeof import("./register.onboard.js").registerOnboardCommand;

beforeAll(async () => {
  ({ registerOnboardCommand } = await import("./register.onboard.js"));
});

describe("registerOnboardCommand", () => {
  const originalPropaiclawMode = process.env.PROPAICLAW_MODE;

  async function runCli(args: string[]) {
    const program = new Command();
    registerOnboardCommand(program);
    await program.parseAsync(args, { from: "user" });
  }

  function renderOnboardHelp() {
    const program = new Command();
    registerOnboardCommand(program);
    const onboard = program.commands.find((cmd) => cmd.name() === "onboard");
    return onboard?.helpInformation() ?? "";
  }

  beforeEach(() => {
    vi.clearAllMocks();
    onboardCommandMock.mockResolvedValue(undefined);
    delete process.env.PROPAICLAW_MODE;
  });

  afterEach(() => {
    if (originalPropaiclawMode === undefined) {
      delete process.env.PROPAICLAW_MODE;
    } else {
      process.env.PROPAICLAW_MODE = originalPropaiclawMode;
    }
  });

  it("defaults installDaemon to undefined when no daemon flags are provided", async () => {
    await runCli(["onboard"]);

    expect(onboardCommandMock).toHaveBeenCalledWith(
      expect.objectContaining({
        installDaemon: undefined,
      }),
      runtime,
    );
  });

  it("sets installDaemon from explicit install flags and prioritizes --skip-daemon", async () => {
    await runCli(["onboard", "--install-daemon"]);
    expect(onboardCommandMock).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        installDaemon: true,
      }),
      runtime,
    );

    await runCli(["onboard", "--no-install-daemon"]);
    expect(onboardCommandMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        installDaemon: false,
      }),
      runtime,
    );

    await runCli(["onboard", "--install-daemon", "--skip-daemon"]);
    expect(onboardCommandMock).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({
        installDaemon: false,
      }),
      runtime,
    );
  });

  it("parses numeric gateway port and drops invalid values", async () => {
    await runCli(["onboard", "--gateway-port", "18789"]);
    expect(onboardCommandMock).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        gatewayPort: 18789,
      }),
      runtime,
    );

    await runCli(["onboard", "--gateway-port", "nope"]);
    expect(onboardCommandMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        gatewayPort: undefined,
      }),
      runtime,
    );
  });

  it("forwards --reset-scope to onboard command options", async () => {
    await runCli(["onboard", "--reset", "--reset-scope", "full"]);
    expect(onboardCommandMock).toHaveBeenCalledWith(
      expect.objectContaining({
        reset: true,
        resetScope: "full",
      }),
      runtime,
    );
  });

  it("parses --mistral-api-key and forwards mistralApiKey", async () => {
    await runCli(["onboard", "--mistral-api-key", "sk-mistral-test"]);
    expect(onboardCommandMock).toHaveBeenCalledWith(
      expect.objectContaining({
        mistralApiKey: "sk-mistral-test",
      }),
      runtime,
    );
  });

  it("reports errors via runtime on onboard command failures", async () => {
    onboardCommandMock.mockRejectedValueOnce(new Error("onboard failed"));

    await runCli(["onboard"]);

    expect(runtime.error).toHaveBeenCalledWith("Error: onboard failed");
    expect(runtime.exit).toHaveBeenCalledWith(1);
  });

  it("uses openclaw defaults in onboard help when wrapper mode is disabled", () => {
    const help = renderOnboardHelp();
    expect(help).toContain("default: ~/.openclaw/workspace");
    expect(help).toContain("Skip Control UI/TUI prompts");
  });

  it("uses propaiclaw defaults in onboard help when wrapper mode is enabled", () => {
    process.env.PROPAICLAW_MODE = "1";
    const help = renderOnboardHelp();
    expect(help).toContain("default: ~/.propaiclaw/workspace");
    expect(help).toContain("Skip PropAI Studio/TUI prompts");
  });
});
