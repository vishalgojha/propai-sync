import { formatCliCommand } from "../cli/command-format.js";
import { readConfigFileSnapshot } from "../config/config.js";
import { isTruthyEnvValue } from "../infra/env.js";
import { assertSupportedRuntime } from "../infra/runtime-guard.js";
import type { RuntimeEnv } from "../runtime.js";
import { defaultRuntime } from "../runtime.js";
import { resolveUserPath } from "../utils.js";
import { isDeprecatedAuthChoice, normalizeLegacyOnboardAuthChoice } from "./auth-choice-legacy.js";
import { DEFAULT_WORKSPACE, handleReset } from "./onboard-helpers.js";
import { runInteractiveOnboarding } from "./onboard-interactive.js";
import { runNonInteractiveOnboarding } from "./onboard-non-interactive.js";
import type { OnboardOptions, ResetScope } from "./onboard-types.js";

const VALID_RESET_SCOPES = new Set<ResetScope>(["config", "config+creds+sessions", "full"]);

function resolvePropaiclawWrapperName(env: NodeJS.ProcessEnv): string {
  const raw = env.PROPAICLAW_CLI_NAME;
  if (!raw) {
    return "propaiclaw";
  }
  const trimmed = raw.trim();
  return trimmed || "propaiclaw";
}

function resolveOnboardingDocsReference(
  path: string,
  env: NodeJS.ProcessEnv = process.env,
): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  if (isTruthyEnvValue(env.PROPAICLAW_MODE)) {
    return normalizedPath;
  }
  return `https://docs.openclaw.ai${normalizedPath}`;
}

export async function onboardCommand(opts: OnboardOptions, runtime: RuntimeEnv = defaultRuntime) {
  assertSupportedRuntime(runtime);
  const originalAuthChoice = opts.authChoice;
  const normalizedAuthChoice = normalizeLegacyOnboardAuthChoice(originalAuthChoice);
  if (opts.nonInteractive && isDeprecatedAuthChoice(originalAuthChoice)) {
    runtime.error(
      [
        `Auth choice "${String(originalAuthChoice)}" is deprecated.`,
        'Use "--auth-choice token" (Anthropic setup-token) or "--auth-choice openai-codex".',
      ].join("\n"),
    );
    runtime.exit(1);
    return;
  }
  if (originalAuthChoice === "claude-cli") {
    runtime.log('Auth choice "claude-cli" is deprecated; using setup-token flow instead.');
  }
  if (originalAuthChoice === "codex-cli") {
    runtime.log('Auth choice "codex-cli" is deprecated; using OpenAI Codex OAuth instead.');
  }
  const flow = opts.flow === "manual" ? ("advanced" as const) : opts.flow;
  const normalizedOpts =
    normalizedAuthChoice === opts.authChoice && flow === opts.flow
      ? opts
      : { ...opts, authChoice: normalizedAuthChoice, flow };
  if (
    normalizedOpts.secretInputMode &&
    normalizedOpts.secretInputMode !== "plaintext" &&
    normalizedOpts.secretInputMode !== "ref"
  ) {
    runtime.error('Invalid --secret-input-mode. Use "plaintext" or "ref".');
    runtime.exit(1);
    return;
  }

  if (normalizedOpts.resetScope && !VALID_RESET_SCOPES.has(normalizedOpts.resetScope)) {
    runtime.error('Invalid --reset-scope. Use "config", "config+creds+sessions", or "full".');
    runtime.exit(1);
    return;
  }

  if (normalizedOpts.nonInteractive && normalizedOpts.acceptRisk !== true) {
    const wrapperName = resolvePropaiclawWrapperName(process.env);
    const rerunCommand = isTruthyEnvValue(process.env.PROPAICLAW_MODE)
      ? `${wrapperName} onboard --non-interactive --accept-risk ...`
      : formatCliCommand("openclaw onboard --non-interactive --accept-risk ...");
    const securityDocs = resolveOnboardingDocsReference("/security", process.env);
    runtime.error(
      [
        "Non-interactive onboarding requires explicit risk acknowledgement.",
        `Read: ${securityDocs}`,
        `Re-run with: ${rerunCommand}`,
      ].join("\n"),
    );
    runtime.exit(1);
    return;
  }

  if (normalizedOpts.reset) {
    const snapshot = await readConfigFileSnapshot();
    const baseConfig = snapshot.valid ? snapshot.config : {};
    const workspaceDefault =
      normalizedOpts.workspace ?? baseConfig.agents?.defaults?.workspace ?? DEFAULT_WORKSPACE;
    const resetScope: ResetScope = normalizedOpts.resetScope ?? "config+creds+sessions";
    await handleReset(resetScope, resolveUserPath(workspaceDefault), runtime);
  }

  if (process.platform === "win32") {
    const wslLabel = isTruthyEnvValue(process.env.PROPAICLAW_MODE)
      ? "PropAI runs best on WSL2!"
      : "OpenClaw runs great on WSL2!";
    const windowsGuide = resolveOnboardingDocsReference("/windows", process.env);
    runtime.log(
      [
        `Windows detected — ${wslLabel}`,
        "Native Windows might be trickier.",
        "Quick setup: wsl --install (one command, one reboot)",
        `Guide: ${windowsGuide}`,
      ].join("\n"),
    );
  }

  if (normalizedOpts.nonInteractive) {
    await runNonInteractiveOnboarding(normalizedOpts, runtime);
    return;
  }

  await runInteractiveOnboarding(normalizedOpts, runtime);
}

export type { OnboardOptions } from "./onboard-types.js";
