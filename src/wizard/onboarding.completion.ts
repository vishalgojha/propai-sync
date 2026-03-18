import type { WizardFlow } from "./onboarding.types.js";
import type { WizardPrompter } from "./prompts.js";

export async function setupOnboardingShellCompletion(params: {
  flow: WizardFlow;
  prompter: Pick<WizardPrompter, "confirm" | "note">;
}): Promise<void> {
  void params;
}

