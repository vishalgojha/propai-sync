import { Command } from "commander";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ProgramContext } from "./context.js";

const hasEmittedCliBannerMock = vi.fn(() => false);
const formatCliBannerLineMock = vi.fn(() => "BANNER-LINE");
const formatDocsLinkMock = vi.fn((_path: string, full: string) => `https://${full}`);

vi.mock("../../terminal/links.js", () => ({
  formatDocsLink: formatDocsLinkMock,
}));

vi.mock("../../terminal/theme.js", () => ({
  isRich: () => false,
  theme: {
    heading: (s: string) => s,
    muted: (s: string) => s,
    option: (s: string) => s,
    command: (s: string) => s,
    error: (s: string) => s,
  },
}));

vi.mock("../banner.js", () => ({
  formatCliBannerLine: formatCliBannerLineMock,
  hasEmittedCliBanner: hasEmittedCliBannerMock,
}));

vi.mock("../cli-name.js", () => ({
  resolveCliName: () => "openclaw",
  replaceCliName: (cmd: string) => cmd,
}));

vi.mock("./command-registry.js", () => ({
  getCoreCliCommandsWithSubcommands: () => ["models", "message"],
}));

vi.mock("./register.subclis.js", () => ({
  getSubCliCommandsWithSubcommands: () => ["gateway"],
}));

const { configureProgramHelp } = await import("./help.js");

const testProgramContext: ProgramContext = {
  programVersion: "9.9.9-test",
  channelOptions: ["telegram"],
  messageChannelOptions: "telegram",
  agentChannelOptions: "last|telegram",
};

describe("configureProgramHelp", () => {
  let originalArgv: string[];
  let originalHideBanner: string | undefined;

  beforeEach(() => {
    vi.clearAllMocks();
    originalArgv = [...process.argv];
    originalHideBanner = process.env.OPENCLAW_HIDE_BANNER;
    delete process.env.OPENCLAW_HIDE_BANNER;
    hasEmittedCliBannerMock.mockReturnValue(false);
  });

  afterEach(() => {
    process.argv = originalArgv;
    if (originalHideBanner === undefined) {
      delete process.env.OPENCLAW_HIDE_BANNER;
    } else {
      process.env.OPENCLAW_HIDE_BANNER = originalHideBanner;
    }
  });

  function makeProgramWithCommands() {
    const program = new Command();
    program.command("models").description("models");
    program.command("status").description("status");
    return program;
  }

  function captureHelpOutput(program: Command): string {
    let output = "";
    const writeSpy = vi.spyOn(process.stdout, "write").mockImplementation(((
      chunk: string | Uint8Array,
    ) => {
      output += String(chunk);
      return true;
    }) as typeof process.stdout.write);
    try {
      program.outputHelp();
      return output;
    } finally {
      writeSpy.mockRestore();
    }
  }

  it("adds root help hint and marks commands with subcommands", () => {
    process.argv = ["node", "openclaw", "--help"];
    const program = makeProgramWithCommands();
    configureProgramHelp(program, testProgramContext);

    const help = captureHelpOutput(program);
    expect(help).toContain("Hint: commands suffixed with * have subcommands");
    expect(help).toContain("models *");
    expect(help).toContain("status");
    expect(help).not.toContain("status *");
  });

  it("includes banner and docs/examples in root help output", () => {
    process.argv = ["node", "openclaw", "--help"];
    const program = makeProgramWithCommands();
    configureProgramHelp(program, testProgramContext);

    const help = captureHelpOutput(program);
    expect(help).toContain("BANNER-LINE");
    expect(help).toContain("Examples:");
    expect(help).toContain("https://docs.openclaw.ai/cli");
  });

  it("omits help banner when OPENCLAW_HIDE_BANNER is truthy", () => {
    process.argv = ["node", "openclaw", "--help"];
    process.env.OPENCLAW_HIDE_BANNER = "1";
    const program = makeProgramWithCommands();
    configureProgramHelp(program, testProgramContext);

    const help = captureHelpOutput(program);
    expect(help).not.toContain("BANNER-LINE");
    expect(help).toContain("Examples:");
  });

  it("prints version and exits immediately when version flags are present", () => {
    process.argv = ["node", "openclaw", "--version"];
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(((code?: number) => {
      throw new Error(`exit:${code ?? ""}`);
    }) as typeof process.exit);

    const program = makeProgramWithCommands();
    expect(() => configureProgramHelp(program, testProgramContext)).toThrow("exit:0");
    expect(logSpy).toHaveBeenCalledWith("9.9.9-test");
    expect(exitSpy).toHaveBeenCalledWith(0);

    logSpy.mockRestore();
    exitSpy.mockRestore();
  });
});
