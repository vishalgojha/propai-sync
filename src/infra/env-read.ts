export function readPropAiEnvValue(env: NodeJS.ProcessEnv, key: string): string | undefined {
  return env[`PROPAI_${key}`] ?? env[`propai_${key}`];
}
