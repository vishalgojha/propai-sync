import path from "node:path";
import { resolveStateDirForWrite } from "../config/paths.js";

const USER_ID_RE = /^[a-zA-Z0-9][a-zA-Z0-9_-]{1,63}$/;

export function assertValidUserId(userId: string): string {
  const trimmed = userId.trim();
  if (!USER_ID_RE.test(trimmed)) {
    throw new Error(
      "invalid userId: use 2-64 chars [a-zA-Z0-9_-] and start with an alphanumeric character",
    );
  }
  return trimmed;
}

export function resolveHostedPlatformRoot(env: NodeJS.ProcessEnv = process.env): string {
  return path.join(resolveStateDirForWrite(env), "hosted-platform");
}

export function resolveHostedUsersRoot(env: NodeJS.ProcessEnv = process.env): string {
  return path.join(resolveHostedPlatformRoot(env), "users");
}

export function resolveHostedUserRoot(
  userId: string,
  env: NodeJS.ProcessEnv = process.env,
): string {
  const normalized = assertValidUserId(userId);
  return path.join(resolveHostedUsersRoot(env), normalized);
}

export function resolveHostedUserWorkspaceRoot(
  userId: string,
  env: NodeJS.ProcessEnv = process.env,
): string {
  return path.join(resolveHostedUserRoot(userId, env), "workspace");
}

export function resolveHostedUserRuntimeStateRoot(
  userId: string,
  env: NodeJS.ProcessEnv = process.env,
): string {
  return path.join(resolveHostedUserRoot(userId, env), "runtime-state");
}

export function resolveHostedApiKeysPath(env: NodeJS.ProcessEnv = process.env): string {
  return path.join(resolveHostedPlatformRoot(env), "api-keys.json");
}

export function resolveHostedVaultMasterKeyPath(env: NodeJS.ProcessEnv = process.env): string {
  return path.join(resolveHostedPlatformRoot(env), "vault-master-key");
}

export function resolveHostedServiceKeysPath(
  userId: string,
  env: NodeJS.ProcessEnv = process.env,
): string {
  return path.join(resolveHostedUserRoot(userId, env), "service-keys.json");
}

export function resolveHostedRecipesRoot(
  userId: string,
  env: NodeJS.ProcessEnv = process.env,
): string {
  return path.join(resolveHostedUserRoot(userId, env), "recipes");
}

export function resolveHostedTriggersPath(
  userId: string,
  env: NodeJS.ProcessEnv = process.env,
): string {
  return path.join(resolveHostedUserRoot(userId, env), "triggers.json");
}

export function resolveHostedLogsPath(
  userId: string,
  env: NodeJS.ProcessEnv = process.env,
): string {
  return path.join(resolveHostedUserRoot(userId, env), "logs.ndjson");
}

export function resolveHostedSecurityAuditLogPath(env: NodeJS.ProcessEnv = process.env): string {
  return path.join(resolveHostedPlatformRoot(env), "security-audit.ndjson");
}

export function resolveHostedUserAgentsPath(
  userId: string,
  env: NodeJS.ProcessEnv = process.env,
): string {
  return path.join(resolveHostedUserRoot(userId, env), "agents.json");
}
