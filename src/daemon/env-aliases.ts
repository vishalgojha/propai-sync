type DaemonEnv = Record<string, string | undefined>;

function readTrimmed(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed || undefined;
}

export function resolveDaemonProfileEnv(env: DaemonEnv): string | undefined {
  return readTrimmed(env.PROPAICLAW_PROFILE);
}

export function resolveDaemonStateDirEnv(env: DaemonEnv): string | undefined {
  return readTrimmed(env.PROPAICLAW_STATE_DIR);
}

export function resolveDaemonConfigPathEnv(env: DaemonEnv): string | undefined {
  return readTrimmed(env.PROPAICLAW_CONFIG_PATH);
}

export function resolveDaemonLaunchdLabelEnv(env: DaemonEnv): string | undefined {
  return readTrimmed(env.PROPAICLAW_LAUNCHD_LABEL);
}

export function resolveDaemonSystemdUnitEnv(env: DaemonEnv): string | undefined {
  return readTrimmed(env.PROPAICLAW_SYSTEMD_UNIT);
}

export function resolveDaemonWindowsTaskNameEnv(env: DaemonEnv): string | undefined {
  return readTrimmed(env.PROPAICLAW_WINDOWS_TASK_NAME);
}

export function resolveDaemonTaskScriptEnv(env: DaemonEnv): string | undefined {
  return readTrimmed(env.PROPAICLAW_TASK_SCRIPT);
}

export function resolveDaemonTaskScriptNameEnv(env: DaemonEnv): string | undefined {
  return readTrimmed(env.PROPAICLAW_TASK_SCRIPT_NAME);
}

export function resolveDaemonLogPrefixEnv(env: DaemonEnv): string | undefined {
  return readTrimmed(env.PROPAICLAW_LOG_PREFIX);
}

export function resolveDaemonServiceMarkerEnv(env: DaemonEnv): string | undefined {
  return readTrimmed(env.PROPAICLAW_SERVICE_MARKER);
}

export function resolveDaemonServiceKindEnv(env: DaemonEnv): string | undefined {
  return readTrimmed(env.PROPAICLAW_SERVICE_KIND);
}

export function resolveDaemonServiceVersionEnv(env: DaemonEnv): string | undefined {
  return readTrimmed(env.PROPAICLAW_SERVICE_VERSION);
}
