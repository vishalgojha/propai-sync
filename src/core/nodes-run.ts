import { parseDurationMs } from "./parse-duration.js";

export function parseEnvPairs(raw?: unknown): Record<string, string> {
  const env: Record<string, string> = {};
  if (!Array.isArray(raw)) {
    return env;
  }
  for (const entry of raw) {
    if (typeof entry !== "string") {
      continue;
    }
    const idx = entry.indexOf("=");
    if (idx <= 0) {
      continue;
    }
    const key = entry.slice(0, idx).trim();
    const value = entry.slice(idx + 1);
    if (key) {
      env[key] = value;
    }
  }
  return env;
}

export function parseTimeoutMs(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim()) {
    return parseDurationMs(value);
  }
  return undefined;
}
