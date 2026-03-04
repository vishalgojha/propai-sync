import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export const POSIX_OPENCLAW_TMP_DIR = "/tmp/openclaw";
export const POSIX_PROPAICLAW_TMP_DIR = "/tmp/propaiclaw";
const TMP_DIR_ACCESS_MODE = fs.constants.W_OK | fs.constants.X_OK;

type ResolvePreferredOpenClawTmpDirOptions = {
  accessSync?: (path: string, mode?: number) => void;
  chmodSync?: (path: string, mode: number) => void;
  lstatSync?: (path: string) => {
    isDirectory(): boolean;
    isSymbolicLink(): boolean;
    mode?: number;
    uid?: number;
  };
  mkdirSync?: (path: string, opts: { recursive: boolean; mode?: number }) => void;
  getuid?: () => number | undefined;
  tmpdir?: () => string;
  warn?: (message: string) => void;
  env?: NodeJS.ProcessEnv;
};

type MaybeNodeError = { code?: string };

function isNodeErrorWithCode(err: unknown, code: string): err is MaybeNodeError {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as MaybeNodeError).code === code
  );
}

function isTruthyEnvValue(value: string | undefined): boolean {
  const normalized = value?.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}

function isPropaiclawMode(env: NodeJS.ProcessEnv): boolean {
  return isTruthyEnvValue(env.PROPAICLAW_MODE);
}

export function resolvePreferredOpenClawTmpDir(
  options: ResolvePreferredOpenClawTmpDirOptions = {},
): string {
  const env = options.env ?? process.env;
  const propaiclawMode = isPropaiclawMode(env);
  const preferredPosixTmpDir = propaiclawMode ? POSIX_PROPAICLAW_TMP_DIR : POSIX_OPENCLAW_TMP_DIR;
  const fallbackBaseName = propaiclawMode ? "propaiclaw" : "openclaw";
  const bannerPrefix = propaiclawMode ? "[propaiclaw]" : "[openclaw]";
  const productName = propaiclawMode ? "PropAI" : "OpenClaw";

  const accessSync = options.accessSync ?? fs.accessSync;
  const chmodSync = options.chmodSync ?? fs.chmodSync;
  const lstatSync = options.lstatSync ?? fs.lstatSync;
  const mkdirSync = options.mkdirSync ?? fs.mkdirSync;
  const warn = options.warn ?? ((message: string) => console.warn(message));
  const getuid =
    options.getuid ??
    (() => {
      try {
        return typeof process.getuid === "function" ? process.getuid() : undefined;
      } catch {
        return undefined;
      }
    });
  const tmpdir = options.tmpdir ?? os.tmpdir;
  const uid = getuid();

  const isSecureDirForUser = (st: { mode?: number; uid?: number }): boolean => {
    if (uid === undefined) {
      return true;
    }
    if (typeof st.uid === "number" && st.uid !== uid) {
      return false;
    }
    // Avoid group/other writable dirs when running on multi-user hosts.
    if (typeof st.mode === "number" && (st.mode & 0o022) !== 0) {
      return false;
    }
    return true;
  };

  const fallback = (): string => {
    const base = tmpdir();
    const suffix = uid === undefined ? fallbackBaseName : `${fallbackBaseName}-${uid}`;
    return path.join(base, suffix);
  };

  const isTrustedTmpDir = (st: {
    isDirectory(): boolean;
    isSymbolicLink(): boolean;
    mode?: number;
    uid?: number;
  }): boolean => {
    return st.isDirectory() && !st.isSymbolicLink() && isSecureDirForUser(st);
  };

  const resolveDirState = (candidatePath: string): "available" | "missing" | "invalid" => {
    try {
      const candidate = lstatSync(candidatePath);
      if (!isTrustedTmpDir(candidate)) {
        return "invalid";
      }
      accessSync(candidatePath, TMP_DIR_ACCESS_MODE);
      return "available";
    } catch (err) {
      if (isNodeErrorWithCode(err, "ENOENT")) {
        return "missing";
      }
      return "invalid";
    }
  };

  const tryRepairWritableBits = (candidatePath: string): boolean => {
    try {
      const st = lstatSync(candidatePath);
      if (!st.isDirectory() || st.isSymbolicLink()) {
        return false;
      }
      if (uid !== undefined && typeof st.uid === "number" && st.uid !== uid) {
        return false;
      }
      if (typeof st.mode !== "number" || (st.mode & 0o022) === 0) {
        return false;
      }
      chmodSync(candidatePath, 0o700);
      warn(`${bannerPrefix} tightened permissions on temp dir: ${candidatePath}`);
      return resolveDirState(candidatePath) === "available";
    } catch {
      return false;
    }
  };

  const ensureTrustedFallbackDir = (): string => {
    const fallbackPath = fallback();
    const state = resolveDirState(fallbackPath);
    if (state === "available") {
      return fallbackPath;
    }
    if (state === "invalid") {
      if (tryRepairWritableBits(fallbackPath)) {
        return fallbackPath;
      }
      throw new Error(`Unsafe fallback ${productName} temp dir: ${fallbackPath}`);
    }
    try {
      mkdirSync(fallbackPath, { recursive: true, mode: 0o700 });
      chmodSync(fallbackPath, 0o700);
    } catch {
      throw new Error(`Unable to create fallback ${productName} temp dir: ${fallbackPath}`);
    }
    if (resolveDirState(fallbackPath) !== "available" && !tryRepairWritableBits(fallbackPath)) {
      throw new Error(`Unsafe fallback ${productName} temp dir: ${fallbackPath}`);
    }
    return fallbackPath;
  };

  const existingPreferredState = resolveDirState(preferredPosixTmpDir);
  if (existingPreferredState === "available") {
    return preferredPosixTmpDir;
  }
  if (existingPreferredState === "invalid") {
    if (tryRepairWritableBits(preferredPosixTmpDir)) {
      return preferredPosixTmpDir;
    }
    return ensureTrustedFallbackDir();
  }

  try {
    accessSync("/tmp", TMP_DIR_ACCESS_MODE);
    // Create with a safe default; subsequent callers expect it exists.
    mkdirSync(preferredPosixTmpDir, { recursive: true, mode: 0o700 });
    chmodSync(preferredPosixTmpDir, 0o700);
    if (
      resolveDirState(preferredPosixTmpDir) !== "available" &&
      !tryRepairWritableBits(preferredPosixTmpDir)
    ) {
      return ensureTrustedFallbackDir();
    }
    return preferredPosixTmpDir;
  } catch {
    return ensureTrustedFallbackDir();
  }
}
