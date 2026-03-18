import type { RuntimeEnv } from "../runtime.js";
import type { DoctorPrompter } from "./doctor-prompter.js";

type CompletionShell = "zsh" | "bash" | "fish" | "powershell";

export type ShellCompletionStatus = {
  shell: CompletionShell;
  profileInstalled: boolean;
  cacheExists: boolean;
  cachePath: string;
  /** True if profile uses slow dynamic pattern like `source <(PropAi Sync completion ...)` */
  usesSlowPattern: boolean;
};

/** Check the status of shell completion for the current shell. */
export async function checkShellCompletionStatus(
  binName = "PropAi Sync",
): Promise<ShellCompletionStatus> {
  void binName;
  return {
    shell: "powershell",
    profileInstalled: false,
    cacheExists: false,
    cachePath: "",
    usesSlowPattern: false,
  };
}

export type DoctorCompletionOptions = {
  nonInteractive?: boolean;
};

/**
 * Shell completion is a CLI-only feature. Kept as a no-op to avoid breaking call sites.
 */
export async function doctorShellCompletion(
  runtime: RuntimeEnv,
  prompter: DoctorPrompter,
  options: DoctorCompletionOptions = {},
): Promise<void> {
  void runtime;
  void prompter;
  void options;
}
