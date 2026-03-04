import process from "node:process";
import {
  initializeRealtorWorkspaceProfile,
  type RealtorWorkspaceProfileInput,
  type RealtorWorkspaceProfileResult,
} from "./realtor-workspace.js";

type EnvLike = Record<string, string | undefined>;

type InitProfileFn = (
  input: RealtorWorkspaceProfileInput,
) => Promise<RealtorWorkspaceProfileResult>;

export type SetupBootstrapRoute = {
  commandLabel: string;
  args: string[];
  debug: boolean;
};

export type SetupBootstrapOptions = {
  env?: EnvLike;
  initProfile?: InitProfileFn;
  stdoutWrite?: (text: string) => void;
  stderrWrite?: (text: string) => void;
};

function readEnvTrim(env: EnvLike, key: string): string | undefined {
  const value = env[key];
  const normalized = typeof value === "string" ? value.trim() : "";
  return normalized.length > 0 ? normalized : undefined;
}

function readEnvTrimFirst(env: EnvLike, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = readEnvTrim(env, key);
    if (value) {
      return value;
    }
  }
  return undefined;
}

export function readLongOptionValue(tokens: string[], flag: string): string | undefined {
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index] ?? "";
    if (token === flag) {
      const next = tokens[index + 1];
      if (next && !next.startsWith("-")) {
        return next;
      }
      return undefined;
    }
    if (token.startsWith(`${flag}=`)) {
      const value = token.slice(flag.length + 1).trim();
      return value.length > 0 ? value : undefined;
    }
  }
  return undefined;
}

function isSetupLikeCommand(label: string): boolean {
  return label === "setup" || label === "sync";
}

function buildProfileInputFromRoute(
  route: SetupBootstrapRoute,
  env: EnvLike,
): RealtorWorkspaceProfileInput {
  const workspaceDir = readLongOptionValue(route.args, "--workspace");
  return {
    brokerageName: readEnvTrimFirst(env, ["PROPAICLAW_BROKERAGE_NAME", "PROPAI_BROKERAGE_NAME"]),
    ownerName: readEnvTrimFirst(env, ["PROPAICLAW_OWNER_NAME", "PROPAI_OWNER_NAME"]),
    agentName: readEnvTrimFirst(env, ["PROPAICLAW_AGENT_NAME", "PROPAI_AGENT_NAME"]),
    timezone: readEnvTrimFirst(env, ["PROPAICLAW_TIMEZONE", "PROPAI_TIMEZONE"]),
    city: readEnvTrimFirst(env, ["PROPAICLAW_CITY", "PROPAI_CITY"]),
    focus: readEnvTrimFirst(env, ["PROPAICLAW_FOCUS", "PROPAI_FOCUS"]),
    workspaceDir,
    overwrite: false,
  };
}

export async function maybeSeedRealtorWorkspaceBeforeSetup(
  route: SetupBootstrapRoute,
  options: SetupBootstrapOptions = {},
): Promise<void> {
  if (!isSetupLikeCommand(route.commandLabel)) {
    return;
  }

  const env = options.env ?? process.env;
  const initProfile = options.initProfile ?? initializeRealtorWorkspaceProfile;
  const stdoutWrite = options.stdoutWrite ?? ((text: string) => process.stdout.write(text));
  const stderrWrite = options.stderrWrite ?? ((text: string) => process.stderr.write(text));

  try {
    const result = await initProfile(buildProfileInputFromRoute(route, env));
    if (result.writtenFiles.length > 0) {
      stdoutWrite(
        `[propaiclaw] Prepared realtor workspace profile (${result.writtenFiles.length} files).\n`,
      );
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (route.debug) {
      stderrWrite(`[propaiclaw debug] Workspace pre-seed failed (continuing setup): ${message}\n`);
      return;
    }
    stderrWrite("[propaiclaw] Could not pre-seed realtor workspace profile. Continuing setup.\n");
  }
}
