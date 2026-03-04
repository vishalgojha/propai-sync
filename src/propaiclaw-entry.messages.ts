export function formatRuntimeDebugLine(commandName: string, args: string[]): string {
  return `[${commandName} debug] runtime ${args.join(" ")}\n`;
}

export function formatRuntimeLaunchFailure(commandName: string, detail: string): string {
  return `[${commandName}] Failed to launch Propaiclaw runtime: ${detail}\n`;
}

export function formatRuntimeSignalExit(commandName: string, signal: string): string {
  return `[${commandName}] Propaiclaw runtime exited due to signal ${signal}\n`;
}

export function formatConfigInvalidHint(commandName: string): string {
  return `[${commandName}] Config is invalid. Run "${commandName} sync --debug" and retry.\n`;
}
