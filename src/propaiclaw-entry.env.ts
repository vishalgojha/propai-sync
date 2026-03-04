import fs from "node:fs";
import os from "node:os";
import path from "node:path";

function readTrimmed(
  env: NodeJS.ProcessEnv,
  ...keys: Array<keyof NodeJS.ProcessEnv>
): string | undefined {
  for (const key of keys) {
    const raw = env[key];
    if (typeof raw !== "string") {
      continue;
    }
    const trimmed = raw.trim();
    if (trimmed) {
      return trimmed;
    }
  }
  return undefined;
}

type ResolveEnvOptions = {
  existsSync?: (targetPath: string) => boolean;
  homedir?: () => string;
};

function resolveLegacyStateDirFallback(
  env: NodeJS.ProcessEnv,
  options: ResolveEnvOptions,
): string | undefined {
  const homeDir = readTrimmed(env, "PROPAICLAW_HOME", "OPENCLAW_HOME") ?? options.homedir?.();
  if (!homeDir) {
    return undefined;
  }
  const legacyStateDir = path.join(homeDir, ".openclaw");
  const canonicalStateDir = path.join(homeDir, ".propaiclaw");
  const existsSync = options.existsSync ?? fs.existsSync;
  try {
    if (existsSync(canonicalStateDir)) {
      return undefined;
    }
    if (existsSync(legacyStateDir)) {
      return legacyStateDir;
    }
  } catch {
    return undefined;
  }
  return undefined;
}

export function resolvePropaiclawRuntimeEnv(
  env: NodeJS.ProcessEnv = process.env,
  options: ResolveEnvOptions = {},
): NodeJS.ProcessEnv {
  const stateDir =
    readTrimmed(env, "PROPAICLAW_STATE_DIR") ??
    resolveLegacyStateDirFallback(env, {
      existsSync: options.existsSync,
      homedir: options.homedir ?? os.homedir,
    });
  const configPath = readTrimmed(env, "PROPAICLAW_CONFIG_PATH");
  const homeDir = readTrimmed(env, "PROPAICLAW_HOME");
  const profile = readTrimmed(env, "PROPAICLAW_PROFILE");
  const gatewayPort = readTrimmed(env, "PROPAICLAW_GATEWAY_PORT");
  const channelsOnly = readTrimmed(env, "PROPAICLAW_CHANNELS_ONLY") ?? "whatsapp";
  const oauthDir = readTrimmed(env, "PROPAICLAW_OAUTH_DIR");
  const rootDir = readTrimmed(env, "PROPAICLAW_ROOT");
  const hideBanner = readTrimmed(env, "OPENCLAW_HIDE_BANNER") ?? "1";

  return {
    ...env,
    PROPAICLAW_MODE: "1",
    PROPAICLAW_CHANNELS_ONLY: channelsOnly,
    ...(stateDir ? { PROPAICLAW_STATE_DIR: stateDir } : {}),
    ...(configPath ? { PROPAICLAW_CONFIG_PATH: configPath } : {}),
    ...(homeDir ? { PROPAICLAW_HOME: homeDir } : {}),
    ...(profile ? { PROPAICLAW_PROFILE: profile } : {}),
    ...(gatewayPort ? { PROPAICLAW_GATEWAY_PORT: gatewayPort } : {}),
    ...(oauthDir ? { PROPAICLAW_OAUTH_DIR: oauthDir } : {}),
    ...(rootDir ? { PROPAICLAW_ROOT: rootDir } : {}),
    OPENCLAW_HIDE_BANNER: hideBanner,
  };
}

export function applyProcessEnvValues(
  source: NodeJS.ProcessEnv,
  target: NodeJS.ProcessEnv = process.env,
): void {
  for (const [key, value] of Object.entries(source)) {
    if (typeof value === "string") {
      target[key] = value;
    }
  }
}
