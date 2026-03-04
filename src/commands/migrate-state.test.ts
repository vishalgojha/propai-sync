import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const loadConfig = vi.fn(() => ({}));
const autoMigrateLegacyStateDir = vi.fn();
const detectLegacyStateMigrations = vi.fn();
const runLegacyStateMigrations = vi.fn();

vi.mock("../config/config.js", () => ({
  loadConfig,
}));

vi.mock("./doctor-state-migrations.js", () => ({
  autoMigrateLegacyStateDir,
  detectLegacyStateMigrations,
  runLegacyStateMigrations,
}));

const { migrateStateCommand } = await import("./migrate-state.js");

function createRuntime() {
  return {
    log: vi.fn(),
    error: vi.fn(),
    exit: vi.fn(),
  };
}

function createDetection() {
  return {
    targetAgentId: "main",
    targetMainKey: "main",
    targetScope: "dm",
    stateDir: "/tmp/state",
    oauthDir: "/tmp/state/credentials",
    sessions: {
      legacyDir: "/tmp/state/sessions",
      legacyStorePath: "/tmp/state/sessions/sessions.json",
      targetDir: "/tmp/state/agents/main/sessions",
      targetStorePath: "/tmp/state/agents/main/sessions/sessions.json",
      hasLegacy: true,
      legacyKeys: [],
    },
    agentDir: {
      legacyDir: "/tmp/state/agent",
      targetDir: "/tmp/state/agents/main/agent",
      hasLegacy: true,
    },
    whatsappAuth: {
      legacyDir: "/tmp/state/credentials",
      targetDir: "/tmp/state/credentials/whatsapp/default",
      hasLegacy: true,
    },
    pairingAllowFrom: {
      legacyTelegramPath: "/tmp/state/credentials/telegram-allowFrom.json",
      targetTelegramPath: "/tmp/state/credentials/telegram-default-allowFrom.json",
      hasLegacyTelegram: true,
    },
    preview: [
      "- Sessions: /tmp/state/sessions -> /tmp/state/agents/main/sessions",
      "- Agent dir: /tmp/state/agent -> /tmp/state/agents/main/agent",
    ],
  };
}

describe("migrateStateCommand", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    loadConfig.mockReturnValue({});
    detectLegacyStateMigrations.mockResolvedValue(createDetection());
    autoMigrateLegacyStateDir.mockResolvedValue({
      migrated: false,
      skipped: false,
      changes: [],
      warnings: [],
    });
    runLegacyStateMigrations.mockResolvedValue({
      changes: [],
      warnings: [],
    });
  });

  it("runs dry-run by default and does not apply mutations", async () => {
    const runtime = createRuntime();
    await migrateStateCommand(runtime);

    expect(detectLegacyStateMigrations).toHaveBeenCalledTimes(1);
    expect(autoMigrateLegacyStateDir).not.toHaveBeenCalled();
    expect(runLegacyStateMigrations).not.toHaveBeenCalled();
    const output = runtime.log.mock.calls.map((call) => String(call[0])).join("\n");
    expect(output).toContain("Legacy state migration report:");
    expect(output).toContain("Dry run actions:");
  });

  it("emits machine-readable report for dry-run json mode", async () => {
    const runtime = createRuntime();
    await migrateStateCommand(runtime, { json: true });

    const payload = String(runtime.log.mock.calls[0]?.[0] ?? "");
    const parsed = JSON.parse(payload) as {
      mode: string;
      targetAgentId: string;
      previewActions: string[];
      applyChanges: string[];
      applyWarnings: string[];
    };
    expect(parsed.mode).toBe("dry-run");
    expect(parsed.targetAgentId).toBe("main");
    expect(parsed.previewActions.length).toBeGreaterThan(0);
    expect(parsed.applyChanges).toEqual([]);
    expect(parsed.applyWarnings).toEqual([]);
  });

  it("applies migration when --apply is set", async () => {
    const runtime = createRuntime();
    autoMigrateLegacyStateDir.mockResolvedValue({
      migrated: true,
      skipped: false,
      changes: ["State dir: /tmp/.openclaw -> /tmp/.propaiclaw"],
      warnings: [],
    });
    runLegacyStateMigrations.mockResolvedValue({
      changes: ["Merged sessions store -> /tmp/state/agents/main/sessions/sessions.json"],
      warnings: ["Left legacy sessions at /tmp/state/sessions.legacy-123"],
    });

    await migrateStateCommand(runtime, { apply: true });

    expect(detectLegacyStateMigrations).toHaveBeenCalledTimes(2);
    expect(autoMigrateLegacyStateDir).toHaveBeenCalledTimes(1);
    expect(runLegacyStateMigrations).toHaveBeenCalledTimes(1);
    const output = runtime.log.mock.calls.map((call) => String(call[0])).join("\n");
    expect(output).toContain("Apply changes:");
    expect(output).toContain("Apply warnings:");
  });

  it("writes audit log record when audit path is provided", async () => {
    const runtime = createRuntime();
    const auditDir = fs.mkdtempSync(path.join(os.tmpdir(), "migrate-state-audit-"));
    const auditLogPath = path.join(auditDir, "migration-audit.jsonl");
    try {
      autoMigrateLegacyStateDir.mockResolvedValue({
        migrated: true,
        skipped: false,
        changes: ["State dir: /tmp/.openclaw -> /tmp/.propaiclaw"],
        warnings: [],
      });
      runLegacyStateMigrations.mockResolvedValue({
        changes: ["Merged sessions store -> /tmp/state/agents/main/sessions/sessions.json"],
        warnings: [],
      });
      await migrateStateCommand(runtime, {
        apply: true,
        json: true,
        auditLogPath,
        rolloutTag: "pilot-tenant-a",
      });

      expect(fs.existsSync(auditLogPath)).toBe(true);
      const content = fs.readFileSync(auditLogPath, "utf-8").trim();
      const lines = content.split(/\r?\n/);
      expect(lines.length).toBe(1);
      const parsed = JSON.parse(lines[0] ?? "{}") as {
        mode: string;
        rolloutTag: string | null;
        applyChanges: string[];
      };
      expect(parsed.mode).toBe("apply");
      expect(parsed.rolloutTag).toBe("pilot-tenant-a");
      expect(parsed.applyChanges.length).toBeGreaterThan(0);
    } finally {
      fs.rmSync(auditDir, { recursive: true, force: true });
    }
  });

  it("fails apply in strict rollout mode when warnings are present", async () => {
    const runtime = createRuntime();
    autoMigrateLegacyStateDir.mockResolvedValue({
      migrated: false,
      skipped: false,
      changes: [],
      warnings: [],
    });
    runLegacyStateMigrations.mockResolvedValue({
      changes: [],
      warnings: ["Left legacy sessions at /tmp/state/sessions.legacy-123"],
    });

    await expect(
      migrateStateCommand(runtime, {
        apply: true,
        failOnWarnings: true,
      }),
    ).rejects.toThrow("Migration produced 1 warning(s).");
  });

  it("rejects conflicting --dry-run and --apply flags", async () => {
    const runtime = createRuntime();
    await expect(migrateStateCommand(runtime, { dryRun: true, apply: true })).rejects.toThrow(
      "Use either --dry-run or --apply, not both.",
    );
  });
});
