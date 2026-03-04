import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { OpenClawConfig } from "../config/config.js";
import { loadConfig } from "../config/config.js";
import { resolveLegacyStateDirs, resolveNewStateDir } from "../config/paths.js";
import type { RuntimeEnv } from "../runtime.js";
import {
  autoMigrateLegacyStateDir,
  detectLegacyStateMigrations,
  runLegacyStateMigrations,
} from "./doctor-state-migrations.js";

export type MigrateStateOptions = {
  dryRun?: boolean;
  apply?: boolean;
  json?: boolean;
  auditLogPath?: string;
  rolloutTag?: string;
  failOnWarnings?: boolean;
};

type StateDirPlan = {
  legacyDir: string;
  targetDir: string;
  status: "planned" | "skipped-target-exists" | "skipped-env-override";
  reason?: string;
};

type EnvKey = keyof NodeJS.ProcessEnv;

type ResolvedStateDirOverride = {
  value: string;
};

type MigrateStateAuditRecord = {
  timestamp: string;
  mode: "dry-run" | "apply";
  rolloutTag: string | null;
  deprecationWarnings: string[];
  targetAgentId: string;
  targetMainKey: string;
  sessionScope: string;
  stateDir: string;
  oauthDir: string;
  stateDirPlan: StateDirPlan | null;
  previewActions: string[];
  applyChanges: string[];
  applyWarnings: string[];
};

function readTrimmed(env: NodeJS.ProcessEnv, key: EnvKey): string | undefined {
  const raw = env[key];
  if (typeof raw !== "string") {
    return undefined;
  }
  const trimmed = raw.trim();
  return trimmed || undefined;
}

function resolveStateDirOverride(env: NodeJS.ProcessEnv): ResolvedStateDirOverride | null {
  const value = readTrimmed(env, "PROPAICLAW_STATE_DIR");
  if (value) {
    return { value };
  }
  return null;
}

function formatStateDirOverrideReason(override: ResolvedStateDirOverride): string {
  return `PROPAICLAW_STATE_DIR is set to ${override.value}.`;
}

function resolveDryRun(opts: MigrateStateOptions): boolean {
  if (opts.apply && opts.dryRun) {
    throw new Error("Use either --dry-run or --apply, not both.");
  }
  if (opts.apply) {
    return false;
  }
  return true;
}

function resolveStateDirPlan(
  env: NodeJS.ProcessEnv = process.env,
  homedir: () => string = os.homedir,
): StateDirPlan | null {
  const stateOverride = resolveStateDirOverride(env);
  const targetDir = resolveNewStateDir(homedir, env);
  const legacyDir = resolveLegacyStateDirs(homedir, env).find((dir) => {
    try {
      return fs.existsSync(dir);
    } catch {
      return false;
    }
  });

  if (!legacyDir) {
    return null;
  }
  if (stateOverride) {
    return {
      legacyDir,
      targetDir,
      status: "skipped-env-override",
      reason: formatStateDirOverrideReason(stateOverride),
    };
  }
  if (path.resolve(legacyDir) === path.resolve(targetDir)) {
    return null;
  }
  if (fs.existsSync(targetDir)) {
    return {
      legacyDir,
      targetDir,
      status: "skipped-target-exists",
      reason: `target already exists: ${targetDir}`,
    };
  }
  return {
    legacyDir,
    targetDir,
    status: "planned",
  };
}

function reportDetectionSummary(params: {
  runtime: RuntimeEnv;
  cfg: OpenClawConfig;
  stateDirPlan: StateDirPlan | null;
  detection: Awaited<ReturnType<typeof detectLegacyStateMigrations>>;
}) {
  const { runtime, cfg, stateDirPlan, detection } = params;
  const scope = cfg.session?.scope ?? "dm";
  runtime.log("Legacy state migration report:");
  runtime.log(`- target agent: ${detection.targetAgentId}`);
  runtime.log(`- target main key: ${detection.targetMainKey}`);
  runtime.log(`- session scope: ${scope}`);
  runtime.log(`- state dir: ${detection.stateDir}`);
  runtime.log(`- oauth dir: ${detection.oauthDir}`);
  if (stateDirPlan) {
    if (stateDirPlan.status === "planned") {
      runtime.log(
        `- state dir move planned: ${stateDirPlan.legacyDir} -> ${stateDirPlan.targetDir}`,
      );
    } else {
      runtime.log(
        `- state dir move skipped: ${stateDirPlan.legacyDir} -> ${stateDirPlan.targetDir} (${stateDirPlan.reason ?? stateDirPlan.status})`,
      );
    }
  }
}

function createAuditRecord(params: {
  mode: "dry-run" | "apply";
  rolloutTag?: string;
  deprecationWarnings?: string[];
  cfg: OpenClawConfig;
  stateDirPlan: StateDirPlan | null;
  detection: Awaited<ReturnType<typeof detectLegacyStateMigrations>>;
  previewActions?: string[];
  applyChanges?: string[];
  applyWarnings?: string[];
}): MigrateStateAuditRecord {
  return {
    timestamp: new Date().toISOString(),
    mode: params.mode,
    rolloutTag: params.rolloutTag?.trim() ? params.rolloutTag.trim() : null,
    deprecationWarnings: params.deprecationWarnings ?? [],
    targetAgentId: params.detection.targetAgentId,
    targetMainKey: params.detection.targetMainKey,
    sessionScope: params.cfg.session?.scope ?? "dm",
    stateDir: params.detection.stateDir,
    oauthDir: params.detection.oauthDir,
    stateDirPlan: params.stateDirPlan,
    previewActions: params.previewActions ?? [],
    applyChanges: params.applyChanges ?? [],
    applyWarnings: params.applyWarnings ?? [],
  };
}

function writeAuditRecord(params: { auditLogPath: string; record: MigrateStateAuditRecord }): void {
  const auditLogPath = params.auditLogPath.trim();
  if (!auditLogPath) {
    return;
  }
  const resolvedPath = path.resolve(auditLogPath);
  fs.mkdirSync(path.dirname(resolvedPath), { recursive: true });
  fs.appendFileSync(resolvedPath, `${JSON.stringify(params.record)}\n`, "utf-8");
}

function emitJsonReport(runtime: RuntimeEnv, record: MigrateStateAuditRecord): void {
  runtime.log(JSON.stringify(record, null, 2));
}

export async function migrateStateCommand(
  runtime: RuntimeEnv,
  opts: MigrateStateOptions = {},
): Promise<void> {
  const dryRun = resolveDryRun(opts);
  const deprecationWarnings: string[] = [];
  const cfg = loadConfig();
  const stateDirPlan = resolveStateDirPlan();
  const detected = await detectLegacyStateMigrations({ cfg });
  if (!opts.json) {
    reportDetectionSummary({ runtime, cfg, stateDirPlan, detection: detected });
  }

  if (dryRun) {
    const preview = [];
    if (stateDirPlan?.status === "planned") {
      preview.push(`State dir: ${stateDirPlan.legacyDir} -> ${stateDirPlan.targetDir}`);
    }
    preview.push(...detected.preview);
    if (!opts.json) {
      if (preview.length === 0) {
        runtime.log("Dry run: no migration actions detected.");
      } else {
        runtime.log("Dry run actions:");
        for (const entry of preview) {
          runtime.log(entry.startsWith("- ") ? entry : `- ${entry}`);
        }
      }
    }
    const record = createAuditRecord({
      mode: "dry-run",
      rolloutTag: opts.rolloutTag,
      deprecationWarnings,
      cfg,
      stateDirPlan,
      detection: detected,
      previewActions: preview,
    });
    if (opts.auditLogPath) {
      writeAuditRecord({ auditLogPath: opts.auditLogPath, record });
    }
    if (opts.json) {
      emitJsonReport(runtime, record);
    }
    return;
  }

  const stateDirResult = await autoMigrateLegacyStateDir({ env: process.env });
  const applyDetection = await detectLegacyStateMigrations({ cfg });
  const migrationResult = await runLegacyStateMigrations({
    detected: applyDetection,
  });
  const changes = [...stateDirResult.changes, ...migrationResult.changes];
  const warnings = [...stateDirResult.warnings, ...migrationResult.warnings];

  if (!opts.json) {
    if (changes.length === 0) {
      runtime.log("Apply: no migration changes were required.");
    } else {
      runtime.log("Apply changes:");
      for (const entry of changes) {
        runtime.log(`- ${entry}`);
      }
    }
    if (warnings.length > 0) {
      runtime.log("Apply warnings:");
      for (const entry of warnings) {
        runtime.log(`- ${entry}`);
      }
    }
  }

  const record = createAuditRecord({
    mode: "apply",
    rolloutTag: opts.rolloutTag,
    deprecationWarnings,
    cfg,
    stateDirPlan,
    detection: applyDetection,
    previewActions: applyDetection.preview,
    applyChanges: changes,
    applyWarnings: warnings,
  });
  if (opts.auditLogPath) {
    writeAuditRecord({ auditLogPath: opts.auditLogPath, record });
  }
  if (opts.json) {
    emitJsonReport(runtime, record);
  }
  if (opts.failOnWarnings && warnings.length > 0) {
    throw new Error(
      `Migration produced ${warnings.length} warning(s). Re-run after resolving warnings or omit --fail-on-warnings.`,
    );
  }
}
