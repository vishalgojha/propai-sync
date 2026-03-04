import { Command } from "commander";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const doctorCommand = vi.fn();
const dashboardCommand = vi.fn();
const migrateStateCommand = vi.fn();
const resetCommand = vi.fn();
const uninstallCommand = vi.fn();

const runtime = {
  log: vi.fn(),
  error: vi.fn(),
  exit: vi.fn(),
};

vi.mock("../../commands/doctor.js", () => ({
  doctorCommand,
}));

vi.mock("../../commands/dashboard.js", () => ({
  dashboardCommand,
}));

vi.mock("../../commands/migrate-state.js", () => ({
  migrateStateCommand,
}));

vi.mock("../../commands/reset.js", () => ({
  resetCommand,
}));

vi.mock("../../commands/uninstall.js", () => ({
  uninstallCommand,
}));

vi.mock("../../runtime.js", () => ({
  defaultRuntime: runtime,
}));

let registerMaintenanceCommands: typeof import("./register.maintenance.js").registerMaintenanceCommands;

beforeAll(async () => {
  ({ registerMaintenanceCommands } = await import("./register.maintenance.js"));
});

describe("registerMaintenanceCommands doctor action", () => {
  async function runMaintenanceCli(args: string[]) {
    const program = new Command();
    registerMaintenanceCommands(program);
    await program.parseAsync(args, { from: "user" });
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("exits with code 0 after successful doctor run", async () => {
    doctorCommand.mockResolvedValue(undefined);

    await runMaintenanceCli(["doctor", "--non-interactive", "--yes"]);

    expect(doctorCommand).toHaveBeenCalledWith(
      runtime,
      expect.objectContaining({
        nonInteractive: true,
        yes: true,
      }),
    );
    expect(runtime.exit).toHaveBeenCalledWith(0);
  });

  it("exits with code 1 when doctor fails", async () => {
    doctorCommand.mockRejectedValue(new Error("doctor failed"));

    await runMaintenanceCli(["doctor"]);

    expect(runtime.error).toHaveBeenCalledWith("Error: doctor failed");
    expect(runtime.exit).toHaveBeenCalledWith(1);
    expect(runtime.exit).not.toHaveBeenCalledWith(0);
  });

  it("maps --fix to repair=true", async () => {
    doctorCommand.mockResolvedValue(undefined);

    await runMaintenanceCli(["doctor", "--fix"]);

    expect(doctorCommand).toHaveBeenCalledWith(
      runtime,
      expect.objectContaining({
        repair: true,
      }),
    );
  });

  it("passes noOpen to dashboard command", async () => {
    dashboardCommand.mockResolvedValue(undefined);

    await runMaintenanceCli(["dashboard", "--no-open"]);

    expect(dashboardCommand).toHaveBeenCalledWith(
      runtime,
      expect.objectContaining({
        noOpen: true,
      }),
    );
  });

  it("passes dry-run/apply options to migrate-state command", async () => {
    migrateStateCommand.mockResolvedValue(undefined);

    await runMaintenanceCli(["migrate-state", "--dry-run"]);
    await runMaintenanceCli(["migrate-state", "--apply"]);

    expect(migrateStateCommand).toHaveBeenNthCalledWith(
      1,
      runtime,
      expect.objectContaining({
        dryRun: true,
        apply: false,
      }),
    );
    expect(migrateStateCommand).toHaveBeenNthCalledWith(
      2,
      runtime,
      expect.objectContaining({
        dryRun: false,
        apply: true,
      }),
    );
    expect(runtime.exit).toHaveBeenCalledWith(0);
  });

  it("passes json/audit/rollout options to migrate-state command", async () => {
    migrateStateCommand.mockResolvedValue(undefined);

    await runMaintenanceCli([
      "migrate-state",
      "--apply",
      "--json",
      "--audit-log",
      "./migration-audit.jsonl",
      "--rollout-tag",
      "pilot-tenant-a",
      "--fail-on-warnings",
    ]);

    expect(migrateStateCommand).toHaveBeenCalledWith(
      runtime,
      expect.objectContaining({
        dryRun: false,
        apply: true,
        json: true,
        auditLogPath: "./migration-audit.jsonl",
        rolloutTag: "pilot-tenant-a",
        failOnWarnings: true,
      }),
    );
  });

  it("passes reset options to reset command", async () => {
    resetCommand.mockResolvedValue(undefined);

    await runMaintenanceCli([
      "reset",
      "--scope",
      "full",
      "--yes",
      "--non-interactive",
      "--dry-run",
    ]);

    expect(resetCommand).toHaveBeenCalledWith(
      runtime,
      expect.objectContaining({
        scope: "full",
        yes: true,
        nonInteractive: true,
        dryRun: true,
      }),
    );
  });

  it("passes uninstall options to uninstall command", async () => {
    uninstallCommand.mockResolvedValue(undefined);

    await runMaintenanceCli([
      "uninstall",
      "--service",
      "--state",
      "--workspace",
      "--app",
      "--all",
      "--yes",
      "--non-interactive",
      "--dry-run",
    ]);

    expect(uninstallCommand).toHaveBeenCalledWith(
      runtime,
      expect.objectContaining({
        service: true,
        state: true,
        workspace: true,
        app: true,
        all: true,
        yes: true,
        nonInteractive: true,
        dryRun: true,
      }),
    );
  });

  it("exits with code 1 when dashboard fails", async () => {
    dashboardCommand.mockRejectedValue(new Error("dashboard failed"));

    await runMaintenanceCli(["dashboard"]);

    expect(runtime.error).toHaveBeenCalledWith("Error: dashboard failed");
    expect(runtime.exit).toHaveBeenCalledWith(1);
  });

  it("exits with code 1 when migrate-state fails", async () => {
    migrateStateCommand.mockRejectedValue(new Error("migrate-state failed"));

    await runMaintenanceCli(["migrate-state", "--apply"]);

    expect(runtime.error).toHaveBeenCalledWith("Error: migrate-state failed");
    expect(runtime.exit).toHaveBeenCalledWith(1);
  });
});
