import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { expandHomePrefix, resolveRequiredHomeDir } from "../infra/home-dir.js";
import type { OpenClawConfig } from "./types.js";

/**
 * Nix mode detection: When OPENCLAW_NIX_MODE=1, the gateway is running under Nix.
 * In this mode:
 * - No auto-install flows should be attempted
 * - Missing dependencies should produce actionable Nix-specific error messages
 * - Config is managed externally (read-only from Nix perspective)
 */
export function resolveIsNixMode(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.OPENCLAW_NIX_MODE === "1";
}

export const isNixMode = resolveIsNixMode();

const OPENCLAW_STATE_DIRNAME = ".openclaw";
const PROPAICLAW_STATE_DIRNAME = ".propaiclaw";
const LEGACY_STATE_DIRNAMES = [".clawdbot", ".moldbot", ".moltbot"] as const;
const OPENCLAW_CONFIG_FILENAME = "openclaw.json";
const PROPAICLAW_CONFIG_FILENAME = "propaiclaw.json";
const LEGACY_CONFIG_FILENAMES = ["clawdbot.json", "moldbot.json", "moltbot.json"] as const;

function envFirst(...values: Array<string | undefined>): string | undefined {
  for (const value of values) {
    const trimmed = value?.trim();
    if (trimmed) {
      return trimmed;
    }
  }
  return undefined;
}

function isTruthyEnvValue(value: string | undefined): boolean {
  const normalized = value?.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}

function isPropaiclawMode(env: NodeJS.ProcessEnv): boolean {
  return isTruthyEnvValue(env.PROPAICLAW_MODE);
}

function resolveCanonicalStateDirName(env: NodeJS.ProcessEnv): string {
  return isPropaiclawMode(env) ? PROPAICLAW_STATE_DIRNAME : OPENCLAW_STATE_DIRNAME;
}

function resolveCanonicalConfigFilename(env: NodeJS.ProcessEnv): string {
  return isPropaiclawMode(env) ? PROPAICLAW_CONFIG_FILENAME : OPENCLAW_CONFIG_FILENAME;
}

function resolveStateDirOverride(env: NodeJS.ProcessEnv): string | undefined {
  return envFirst(env.PROPAICLAW_STATE_DIR);
}

function resolveConfigPathOverride(env: NodeJS.ProcessEnv): string | undefined {
  return envFirst(env.PROPAICLAW_CONFIG_PATH);
}

function resolveGatewayPortOverride(env: NodeJS.ProcessEnv): string | undefined {
  return envFirst(env.PROPAICLAW_GATEWAY_PORT);
}

function resolveConfigCandidateFilenames(env: NodeJS.ProcessEnv): string[] {
  const candidates = [
    resolveCanonicalConfigFilename(env),
    OPENCLAW_CONFIG_FILENAME,
    ...LEGACY_CONFIG_FILENAMES,
  ];
  const deduped: string[] = [];
  for (const name of candidates) {
    if (!deduped.includes(name)) {
      deduped.push(name);
    }
  }
  return deduped;
}

function resolveDefaultHomeDir(): string {
  return resolveRequiredHomeDir(process.env, os.homedir);
}

/** Build a homedir thunk that respects PROPAICLAW_HOME for the given env. */
function envHomedir(env: NodeJS.ProcessEnv): () => string {
  return () => resolveRequiredHomeDir(env, os.homedir);
}

function legacyStateDirs(
  homedir: () => string = resolveDefaultHomeDir,
  env: NodeJS.ProcessEnv = process.env,
): string[] {
  const names = isPropaiclawMode(env)
    ? [OPENCLAW_STATE_DIRNAME, ...LEGACY_STATE_DIRNAMES]
    : [...LEGACY_STATE_DIRNAMES];
  return names.map((dir) => path.join(homedir(), dir));
}

function newStateDir(
  homedir: () => string = resolveDefaultHomeDir,
  env: NodeJS.ProcessEnv = process.env,
): string {
  return path.join(homedir(), resolveCanonicalStateDirName(env));
}

export function resolveLegacyStateDir(
  homedir: () => string = resolveDefaultHomeDir,
  env: NodeJS.ProcessEnv = process.env,
): string {
  return legacyStateDirs(homedir, env)[0] ?? newStateDir(homedir, env);
}

export function resolveLegacyStateDirs(
  homedir: () => string = resolveDefaultHomeDir,
  env: NodeJS.ProcessEnv = process.env,
): string[] {
  return legacyStateDirs(homedir, env);
}

export function resolveNewStateDir(
  homedir: () => string = resolveDefaultHomeDir,
  env: NodeJS.ProcessEnv = process.env,
): string {
  return newStateDir(homedir, env);
}

/**
 * State directory for mutable data (sessions, logs, caches).
 * Can be overridden via PROPAICLAW_STATE_DIR.
 * Default: ~/.openclaw
 */
export function resolveStateDir(
  env: NodeJS.ProcessEnv = process.env,
  homedir: () => string = envHomedir(env),
): string {
  const effectiveHomedir = () => resolveRequiredHomeDir(env, homedir);
  const override = resolveStateDirOverride(env);
  if (override) {
    return resolveUserPath(override, env, effectiveHomedir);
  }
  const newDir = newStateDir(effectiveHomedir, env);
  const legacyDirs = legacyStateDirs(effectiveHomedir, env);
  const hasNew = fs.existsSync(newDir);
  if (hasNew) {
    return newDir;
  }
  const existingLegacy = legacyDirs.find((dir) => {
    try {
      return fs.existsSync(dir);
    } catch {
      return false;
    }
  });
  if (existingLegacy) {
    return existingLegacy;
  }
  return newDir;
}

/**
 * State directory for write operations.
 *
 * Unlike resolveStateDir(), this does not fall back to existing legacy dirs
 * when no explicit override is set. It always returns the canonical namespace
 * for the current mode.
 */
export function resolveStateDirForWrite(
  env: NodeJS.ProcessEnv = process.env,
  homedir: () => string = envHomedir(env),
): string {
  const effectiveHomedir = () => resolveRequiredHomeDir(env, homedir);
  const override = resolveStateDirOverride(env);
  if (override) {
    return resolveUserPath(override, env, effectiveHomedir);
  }
  return newStateDir(effectiveHomedir, env);
}

function resolveUserPath(
  input: string,
  env: NodeJS.ProcessEnv = process.env,
  homedir: () => string = envHomedir(env),
): string {
  const trimmed = input.trim();
  if (!trimmed) {
    return trimmed;
  }
  if (trimmed.startsWith("~")) {
    const expanded = expandHomePrefix(trimmed, {
      home: resolveRequiredHomeDir(env, homedir),
      env,
      homedir,
    });
    return path.resolve(expanded);
  }
  return path.resolve(trimmed);
}

export const STATE_DIR = resolveStateDir();

/**
 * Config file path (JSON5).
 * Can be overridden via PROPAICLAW_CONFIG_PATH.
 * Default: ~/.openclaw/openclaw.json (or $PROPAICLAW_STATE_DIR/openclaw.json)
 */
export function resolveCanonicalConfigPath(
  env: NodeJS.ProcessEnv = process.env,
  stateDir: string = resolveStateDirForWrite(env, envHomedir(env)),
): string {
  const override = resolveConfigPathOverride(env);
  if (override) {
    return resolveUserPath(override, env, envHomedir(env));
  }
  return path.join(stateDir, resolveCanonicalConfigFilename(env));
}

/**
 * Resolve the active config path by preferring existing config candidates
 * before falling back to the canonical path.
 */
export function resolveConfigPathCandidate(
  env: NodeJS.ProcessEnv = process.env,
  homedir: () => string = envHomedir(env),
): string {
  const candidates = resolveDefaultConfigCandidates(env, homedir);
  const existing = candidates.find((candidate) => {
    try {
      return fs.existsSync(candidate);
    } catch {
      return false;
    }
  });
  if (existing) {
    return existing;
  }
  return resolveCanonicalConfigPath(env, resolveStateDir(env, homedir));
}

/**
 * Active config path (prefers existing config files).
 */
export function resolveConfigPath(
  env: NodeJS.ProcessEnv = process.env,
  stateDir: string = resolveStateDir(env, envHomedir(env)),
  homedir: () => string = envHomedir(env),
): string {
  const override = resolveConfigPathOverride(env);
  if (override) {
    return resolveUserPath(override, env, homedir);
  }
  const stateOverride = resolveStateDirOverride(env);
  const candidateNames = resolveConfigCandidateFilenames(env);
  const candidates = candidateNames.map((name) => path.join(stateDir, name));
  const existing = candidates.find((candidate) => {
    try {
      return fs.existsSync(candidate);
    } catch {
      return false;
    }
  });
  if (existing) {
    return existing;
  }
  if (stateOverride) {
    return path.join(stateDir, resolveCanonicalConfigFilename(env));
  }
  const defaultStateDir = resolveStateDir(env, homedir);
  if (path.resolve(stateDir) === path.resolve(defaultStateDir)) {
    return resolveConfigPathCandidate(env, homedir);
  }
  return path.join(stateDir, resolveCanonicalConfigFilename(env));
}

export const CONFIG_PATH = resolveConfigPathCandidate();

/**
 * Resolve default config path candidates across default locations.
 * Order: explicit config path → state-dir-derived paths → new default.
 */
export function resolveDefaultConfigCandidates(
  env: NodeJS.ProcessEnv = process.env,
  homedir: () => string = envHomedir(env),
): string[] {
  const effectiveHomedir = () => resolveRequiredHomeDir(env, homedir);
  const explicit = resolveConfigPathOverride(env);
  if (explicit) {
    return [resolveUserPath(explicit, env, effectiveHomedir)];
  }

  const candidates: string[] = [];
  const stateDirOverride = resolveStateDirOverride(env);
  const configNames = resolveConfigCandidateFilenames(env);
  if (stateDirOverride) {
    const resolved = resolveUserPath(stateDirOverride, env, effectiveHomedir);
    candidates.push(...configNames.map((name) => path.join(resolved, name)));
  }

  const defaultDirs = [
    newStateDir(effectiveHomedir, env),
    ...legacyStateDirs(effectiveHomedir, env),
  ];
  for (const dir of defaultDirs) {
    candidates.push(...configNames.map((name) => path.join(dir, name)));
  }
  return candidates;
}

export const DEFAULT_GATEWAY_PORT = 18789;

/**
 * Gateway lock directory (ephemeral).
 * Default: os.tmpdir()/openclaw-<uid> (uid suffix when available).
 */
export function resolveGatewayLockDir(tmpdir: () => string = os.tmpdir): string {
  const base = tmpdir();
  const uid = typeof process.getuid === "function" ? process.getuid() : undefined;
  const suffix = uid != null ? `openclaw-${uid}` : "openclaw";
  return path.join(base, suffix);
}

const OAUTH_FILENAME = "oauth.json";

/**
 * OAuth credentials storage directory.
 *
 * Precedence:
 * - `PROPAICLAW_OAUTH_DIR` (explicit override)
 * - `$*_STATE_DIR/credentials` (canonical server/default)
 */
export function resolveOAuthDir(
  env: NodeJS.ProcessEnv = process.env,
  stateDir: string = resolveStateDir(env, envHomedir(env)),
): string {
  const override = envFirst(env.PROPAICLAW_OAUTH_DIR);
  if (override) {
    return resolveUserPath(override, env, envHomedir(env));
  }
  return path.join(stateDir, "credentials");
}

export function resolveOAuthPath(
  env: NodeJS.ProcessEnv = process.env,
  stateDir: string = resolveStateDir(env, envHomedir(env)),
): string {
  return path.join(resolveOAuthDir(env, stateDir), OAUTH_FILENAME);
}

export function resolveGatewayPort(
  cfg?: OpenClawConfig,
  env: NodeJS.ProcessEnv = process.env,
): number {
  const envRaw = resolveGatewayPortOverride(env);
  if (envRaw) {
    const parsed = Number.parseInt(envRaw, 10);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }
  const configPort = cfg?.gateway?.port;
  if (typeof configPort === "number" && Number.isFinite(configPort)) {
    if (configPort > 0) {
      return configPort;
    }
  }
  return DEFAULT_GATEWAY_PORT;
}
