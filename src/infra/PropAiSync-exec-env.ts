export const PROPAI_CLI_ENV_VAR = "PROPAI_CLI";
export const PROPAI_CLI_ENV_VALUE = "1";

export function markPropAiSyncExecEnv<T extends Record<string, string | undefined>>(env: T): T {
  return {
    ...env,
    [PROPAI_CLI_ENV_VAR]: PROPAI_CLI_ENV_VALUE,
  };
}

export function ensurePropAiSyncExecMarkerOnProcess(
  env: NodeJS.ProcessEnv = process.env,
): NodeJS.ProcessEnv {
  env[PROPAI_CLI_ENV_VAR] = PROPAI_CLI_ENV_VALUE;
  return env;
}



