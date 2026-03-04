import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

const RETRYABLE_FS_CODES = new Set(["EPERM", "EACCES", "EBUSY", "ENOTEMPTY"]);
const MAX_RETRIES = 8;
const BASE_RETRY_DELAY_MS = 25;

function getErrnoCode(error: unknown): string | null {
  if (!error || typeof error !== "object" || !("code" in error)) {
    return null;
  }
  const code = (error as { code?: unknown }).code;
  return typeof code === "string" && code ? code : null;
}

function isRetryableFsContention(error: unknown): boolean {
  const code = getErrnoCode(error);
  return code !== null && RETRYABLE_FS_CODES.has(code);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withFsRetry<T>(op: () => Promise<T>): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      return await op();
    } catch (error) {
      lastError = error;
      if (!isRetryableFsContention(error) || attempt >= MAX_RETRIES - 1) {
        throw error;
      }
      await delay(BASE_RETRY_DELAY_MS * (attempt + 1));
    }
  }
  throw lastError;
}

export async function readJsonFile<T>(filePath: string): Promise<T | null> {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function writeJsonAtomic(
  filePath: string,
  value: unknown,
  options?: { mode?: number },
) {
  const mode = options?.mode ?? 0o600;
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });
  const tmp = `${filePath}.${randomUUID()}.tmp`;
  const json = JSON.stringify(value, null, 2);
  try {
    await withFsRetry(async () => {
      await fs.writeFile(tmp, json, "utf8");
    });
    try {
      await fs.chmod(tmp, mode);
    } catch {
      // best-effort; ignore on platforms without chmod
    }
    await withFsRetry(async () => {
      await fs.rename(tmp, filePath);
    });
    try {
      await fs.chmod(filePath, mode);
    } catch {
      // best-effort; ignore on platforms without chmod
    }
  } finally {
    await fs.rm(tmp, { force: true }).catch(() => undefined);
  }
}

export function createAsyncLock() {
  let lock: Promise<void> = Promise.resolve();
  return async function withLock<T>(fn: () => Promise<T>): Promise<T> {
    const prev = lock;
    let release: (() => void) | undefined;
    lock = new Promise<void>((resolve) => {
      release = resolve;
    });
    await prev;
    try {
      return await fn();
    } finally {
      release?.();
    }
  };
}
