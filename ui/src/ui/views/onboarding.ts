import { html, nothing } from "lit";
import {
  ONBOARDING_WIZARD_PRESETS,
  ONBOARDING_WIZARD_PRESET_GROUPS,
  type OnboardingWizardPresetId,
  resolveOnboardingWizardPreset,
} from "../onboarding-presets.ts";
import type { LicenseEntitlement, LicenseStatus } from "../license.ts";
import { renderLicensePanel } from "./license-panel.ts";

type WizardStepOption = {
  value: unknown;
  label: string;
  hint?: string;
};

type WizardStep = {
  id: string;
  type: "note" | "select" | "text" | "confirm" | "multiselect" | "progress" | "action";
  title?: string;
  message?: string;
  options?: WizardStepOption[];
  initialValue?: unknown;
  placeholder?: string;
  sensitive?: boolean;
};

export type OnboardingWizardProps = {
  connected: boolean;
  busy: boolean;
  error: string | null;
  sessionId: string | null;
  status: string | null;
  step: WizardStep | null;
  draft: unknown;
  presetId: OnboardingWizardPresetId;
  autoAdvance: boolean;
  isTauri: boolean;
  licenseLocked: boolean;
  licenseToken: string;
  licenseApiUrl: string;
  licenseAdminKey: string;
  licenseStatus: LicenseStatus;
  licenseEntitlement: LicenseEntitlement | null;
  licenseError: string | null;
  licenseNotice: string | null;
  licenseBusy: boolean;
  ollamaStatus: { installed: boolean; running: boolean } | null;
  ollamaStatusLoading: boolean;
  onPresetChange: (value: OnboardingWizardPresetId) => void;
  onAutoAdvanceChange: (value: boolean) => void;
  onLicenseTokenChange: (value: string) => void;
  onLicenseApiUrlChange: (value: string) => void;
  onLicenseAdminKeyChange: (value: string) => void;
  onLicenseSubmit: () => void;
  onLicenseRequest: () => void;
  onLicenseApprove: () => void;
  onStart: () => void;
  onCancel: () => void;
  onExitSetup: () => void;
  onDraftChange: (value: unknown) => void;
  onSubmit: () => void;
  onOllamaDownload: () => void;
  onOllamaRecheck: () => void;
};

type SetupPathCard = {
  id: OnboardingWizardPresetId;
  eyebrow: string;
  title: string;
  summary: string;
  detail: string;
  actionLabel: string;
  tone?: "default" | "accent";
};

function wizardOptionKey(value: unknown): string {
  if (value === null) {
    return "null";
  }
  const valueType = typeof value;
  if (valueType === "string") {
    return `s:${value}`;
  }
  if (valueType === "number") {
    return `n:${value}`;
  }
  if (valueType === "boolean") {
    return `b:${value}`;
  }
  if (valueType === "bigint") {
    return `bi:${String(value)}`;
  }
  try {
    return `j:${JSON.stringify(value)}`;
  } catch {
    return `u:${String(value)}`;
  }
}

function renderStepMessage(step: WizardStep) {
  const message = step.message?.trim();
  if (!message) {
    return nothing;
  }
  const lines = message.split("\n");
  return html`
    <div>
      ${lines.map((line) => html`<div>${line}</div>`)}
    </div>
  `;
}

function normalizeMultiSelection(value: unknown): unknown[] {
  if (Array.isArray(value)) {
    return value;
  }
  return [];
}

function onboardingStepLabel(step: WizardStep | null): string {
  if (!step) {
    return "Setup ready";
  }
  switch (step.type) {
    case "confirm":
      return "Confirm this choice";
    case "multiselect":
      return "Choose what you want";
    case "note":
      return "One quick note";
    case "progress":
      return "Preparing your desktop";
    case "select":
      return "Pick one option";
    case "text":
      return "Enter details";
    default:
      return "Continue setup";
  }
}

export function renderOnboardingWizard(props: OnboardingWizardProps) {
  const step = props.step;
  const canStart = props.connected && !props.busy && !props.sessionId && !props.licenseLocked;
  const canSubmit = props.connected && !props.busy && Boolean(step && props.sessionId);
  const showLicenseGate = props.licenseLocked && !props.sessionId;
  const stepOptionLookup =
    step?.options && Array.isArray(step.options)
      ? new Map(step.options.map((opt) => [wizardOptionKey(opt.value), opt]))
      : null;
  const selectedOptionKey = wizardOptionKey(props.draft);
  const preset = resolveOnboardingWizardPreset(props.presetId);
  const ollamaStatusKnown = props.ollamaStatus !== null;
  const ollamaInstalled = props.ollamaStatus?.installed ?? false;
  const showOllamaInstall = props.isTauri && ollamaStatusKnown && !ollamaInstalled;
  const showOllamaChecking = props.isTauri && !ollamaStatusKnown;
  const allowOllamaChoice = !props.isTauri || (ollamaStatusKnown && ollamaInstalled);
  const presetGroups = allowOllamaChoice
    ? ONBOARDING_WIZARD_PRESET_GROUPS
    : ONBOARDING_WIZARD_PRESET_GROUPS.filter((group) => group.id !== "ollama");
  const activeStepLabel = onboardingStepLabel(step);
  const featuredPaths: SetupPathCard[] = [
    {
      id: "openai-codex",
      eyebrow: "Recommended",
      title: "Fast guided setup",
      summary: "Get started quickly, then connect WhatsApp right after.",
      detail: "Best first-run option if you want the easiest setup.",
      actionLabel: "Use guided setup",
      tone: "accent",
    },
    {
      id: "ollama",
      eyebrow: "Private",
      title: "Private local setup",
      summary: "Keep everything on this computer and avoid extra online setup.",
      detail: "Requires Ollama on this computer before setup can continue.",
      actionLabel: allowOllamaChoice ? "Use local setup" : "Install Ollama first",
    },
    {
      id: "none",
      eyebrow: "Advanced",
      title: "Choose everything yourself",
      summary: "Pick the exact setup options yourself.",
      detail: "Best if you already know which model stack you want.",
      actionLabel: "More setup options",
    },
  ];
  const advancedOpen = !["openai-codex", "ollama", "none"].includes(props.presetId);

  return html`
    <div class="page onboarding">
      <div class="onboarding__hero">
        <div class="onboarding__eyebrow">PropAi Sync</div>
        <div class="onboarding__title">Get your real estate assistant ready.</div>
        <div class="onboarding__subtitle">
          Finish desktop setup, activate your trial, and connect WhatsApp so your team can work from one place.
        </div>
        <div class="onboarding__status-strip">
          <div class="onboarding__status-pill ok">
            <span class="onboarding__status-dot"></span>
            Desktop ready
          </div>
          <div class="onboarding__status-pill ${props.connected ? "ok" : "warn"}">
            <span class="onboarding__status-dot"></span>
            ${props.connected ? "Setup ready" : "Setup in progress"}
          </div>
          <div class="onboarding__status-pill">
            <span class="onboarding__status-dot"></span>
            WhatsApp comes next
          </div>
        </div>
      </div>

      <div class="onboarding-journey">
        <div class="onboarding-stage onboarding-stage--done">
          <div class="onboarding-stage__index">01</div>
          <div class="onboarding-stage__title">Desktop is ready</div>
          <div class="onboarding-stage__copy">
            You are already inside the app. No technical setup is needed to get started.
          </div>
        </div>
        <div class="onboarding-stage onboarding-stage--active">
          <div class="onboarding-stage__index">02</div>
          <div class="onboarding-stage__title">Choose how you want to start</div>
          <div class="onboarding-stage__copy">
            Pick the setup that fits your business and continue in a few guided steps.
          </div>
        </div>
        <div class="onboarding-stage">
          <div class="onboarding-stage__index">03</div>
          <div class="onboarding-stage__title">Connect WhatsApp</div>
          <div class="onboarding-stage__copy">
            Once setup is complete, connect WhatsApp so conversations and follow-ups stay in one place.
          </div>
        </div>
      </div>

      ${props.error ? html`<div class="alert alert--error">${props.error}</div>` : nothing}
      ${showLicenseGate
        ? html`
            <div class="card onboarding-card onboarding-card--status">
              <div class="muted">Activate your desktop</div>
              <div class="onboarding-card__status">Start your trial and continue setup</div>
              <div class="onboarding-card__intro mt">
                Your desktop needs an activation key before setup can continue. Start your trial here, then continue with the setup that fits your team.
              </div>
            </div>

            ${renderLicensePanel({
              token: props.licenseToken,
              apiUrl: props.licenseApiUrl,
              adminKey: props.licenseAdminKey,
              busy: props.licenseBusy,
              status: props.licenseStatus,
              entitlement: props.licenseEntitlement,
              error: props.licenseError,
              notice: props.licenseNotice,
              onTokenChange: props.onLicenseTokenChange,
              onApiUrlChange: props.onLicenseApiUrlChange,
              onAdminKeyChange: props.onLicenseAdminKeyChange,
              onSubmit: props.onLicenseSubmit,
              onRequest: props.onLicenseRequest,
              onApprove: props.onLicenseApprove,
            })}

            <div class="actions mt onboarding-actions">
              <button class="btn" ?disabled=${props.busy || props.licenseBusy} @click=${props.onExitSetup}>
                Set up later
              </button>
            </div>
          `
        : !props.sessionId
        ? html`
            <div class="onboarding-paths">
              ${featuredPaths.map((path) => {
                const isSelected = props.presetId === path.id;
                const localSetupBlocked = path.id === "ollama" && !allowOllamaChoice;
                const cardClasses = [
                  "card",
                  "onboarding-card",
                  "onboarding-path",
                  isSelected ? "is-selected" : "",
                  path.tone === "accent" ? "onboarding-path--accent" : "",
                  localSetupBlocked ? "onboarding-path--blocked" : "",
                ]
                  .filter(Boolean)
                  .join(" ");
                return html`
                  <div class=${cardClasses}>
                    <div class="onboarding-path__eyebrow">${path.eyebrow}</div>
                    <div class="onboarding-path__title">${path.title}</div>
                    <div class="onboarding-path__summary">${path.summary}</div>
                    <div class="onboarding-path__detail">${path.detail}</div>

                    ${path.id === "ollama" && showOllamaChecking
                      ? html`
                          <div class="onboarding-path__note">
                            ${props.ollamaStatusLoading
                              ? "Checking whether Ollama is already on this machine."
                              : "Local setup needs Ollama. Recheck if you just installed it."}
                          </div>
                        `
                      : nothing}

                    ${path.id === "ollama" && showOllamaInstall
                      ? html`
                          <div class="onboarding-path__note">
                            Install Ollama first, then come back here and continue with private
                            local setup.
                          </div>
                        `
                      : nothing}

                    <div class="actions mt onboarding-actions">
                      ${path.id === "ollama" && !allowOllamaChoice
                        ? html`
                            <button
                              class="btn primary"
                              ?disabled=${props.ollamaStatusLoading}
                              @click=${props.onOllamaDownload}
                            >
                              Install Ollama
                            </button>
                            <button
                              class="btn"
                              ?disabled=${props.ollamaStatusLoading}
                              @click=${props.onOllamaRecheck}
                            >
                              Recheck local setup
                            </button>
                          `
                        : html`
                            <button
                              class="btn ${path.tone === "accent" ? "primary" : ""}"
                              ?disabled=${!canStart}
                              @click=${() => {
                                props.onPresetChange(path.id);
                                props.onStart();
                              }}
                            >
                              ${path.actionLabel}
                            </button>
                          `}
                    </div>
                  </div>
                `;
              })}
            </div>

            <details class="card onboarding-card onboarding-advanced" ?open=${advancedOpen}>
              <summary>More setup options</summary>
              <div class="onboarding-card__intro">
                Need more control? Choose a specific setup path here without leaving the desktop app.
              </div>
              <label class="field mt">
                <span>Setup style</span>
                <select
                  .value=${props.presetId}
                  ?disabled=${props.busy || Boolean(props.sessionId)}
                  @change=${(e: Event) =>
                    props.onPresetChange((e.target as HTMLSelectElement).value as OnboardingWizardPresetId)}
                >
                  ${ONBOARDING_WIZARD_PRESETS.filter((entry) => entry.id === "none").map(
                    (entry) => html`<option value=${entry.id}>${entry.label}</option>`,
                  )}
                  ${presetGroups.map(
                    (group) => html`
                      <optgroup label=${group.label}>
                        ${group.choices.map((choice) => {
                          const preset = ONBOARDING_WIZARD_PRESETS.find(
                            (entry) => entry.id === choice.id,
                          );
                          return preset
                            ? html`<option value=${preset.id}>${preset.choiceLabel ?? preset.label}</option>`
                            : nothing;
                        })}
                      </optgroup>
                    `,
                  )}
                </select>
                <div class="muted mt">${preset.hint}</div>
              </label>
              <label class="mt row onboarding-card__toggle">
                <input
                  type="checkbox"
                  .checked=${props.autoAdvance}
                  ?disabled=${props.busy || Boolean(props.sessionId)}
                  @change=${(e: Event) =>
                    props.onAutoAdvanceChange((e.target as HTMLInputElement).checked)}
                />
                <span class="ml">Fill in the matching setup steps for me</span>
              </label>
              <div class="actions mt onboarding-actions">
                <button class="btn primary" ?disabled=${!canStart} @click=${props.onStart}>
                  Start setup
                </button>
                <button class="btn" ?disabled=${props.busy} @click=${props.onExitSetup}>
                  Set up later
                </button>
              </div>
            </details>
          `
        : nothing}

      ${props.sessionId
        ? html`
            <div class="card onboarding-card onboarding-card--status">
              <div class="row row--space">
                <div>
                  <div class="muted">Desktop setup</div>
                  <div class="onboarding-card__status">${activeStepLabel}</div>
                  <div class="onboarding-card__intro mt">
                    Finish this step here first. WhatsApp connection comes right after setup.
                  </div>
                </div>
                <button class="btn" ?disabled=${props.busy} @click=${props.onCancel}>
                  Cancel
                </button>
              </div>
            </div>
          `
        : nothing}

      ${step
        ? html`
            <div class="card onboarding-card onboarding-card--step">
              <div class="muted">${step.title?.trim() ? step.title : activeStepLabel}</div>
              ${step.message?.trim() ? html`<div class="mt">${renderStepMessage(step)}</div>` : nothing}

              ${step.type === "note"
                ? nothing
                : step.type === "confirm"
                  ? html`
                      <label class="mt row">
                        <input
                          type="checkbox"
                          .checked=${Boolean(props.draft)}
                          ?disabled=${props.busy}
                          @change=${(e: Event) =>
                            props.onDraftChange((e.target as HTMLInputElement).checked)}
                        />
                        <span class="ml">Yes</span>
                      </label>
                        `
                    : step.type === "text"
                      ? html`
                        <input
                          class="mt input"
                          type=${step.sensitive ? "password" : "text"}
                          .value=${typeof props.draft === "string" ? props.draft : ""}
                          placeholder=${step.placeholder ?? ""}
                          ?disabled=${props.busy}
                          @input=${(e: Event) =>
                            props.onDraftChange((e.target as HTMLInputElement).value)}
                        />
                      `
                    : step.type === "select"
                      ? html`
                          <select
                            class="mt select"
                            .value=${stepOptionLookup?.has(selectedOptionKey)
                              ? selectedOptionKey
                              : wizardOptionKey(step.initialValue)}
                            ?disabled=${props.busy}
                            @change=${(e: Event) => {
                              const key = (e.target as HTMLSelectElement).value;
                              const opt = stepOptionLookup?.get(key);
                              props.onDraftChange(opt?.value);
                            }}
                          >
                            ${(step.options ?? []).map(
                              (opt) =>
                                html`
                                  <option value=${wizardOptionKey(opt.value)}>${opt.label}</option>
                                `,
                            )}
                          </select>
                          ${(step.options ?? []).some((opt) => opt.hint)
                            ? html`
                                <div class="mt muted">
                                  ${(step.options ?? [])
                                    .filter((opt) => opt.hint)
                                    .map((opt) => html`<div>${opt.label}: ${opt.hint}</div>`)}
                                </div>
                              `
                            : nothing}
                        `
                      : step.type === "multiselect"
                        ? html`
                            <div class="mt">
                              ${(step.options ?? []).map((opt) => {
                                const selectedKeys = new Set(
                                  normalizeMultiSelection(props.draft).map(wizardOptionKey),
                                );
                                const key = wizardOptionKey(opt.value);
                                const selected = selectedKeys.has(key);
                                return html`
                                  <label class="row">
                                    <input
                                      type="checkbox"
                                      .checked=${selected}
                                      ?disabled=${props.busy}
                                      @change=${(e: Event) => {
                                        const checked = (e.target as HTMLInputElement).checked;
                                        const current = normalizeMultiSelection(props.draft);
                                        const currentByKey = new Map(
                                          current.map((value) => [wizardOptionKey(value), value]),
                                        );
                                        if (checked) {
                                          currentByKey.set(key, opt.value);
                                        } else {
                                          currentByKey.delete(key);
                                        }
                                        const next = Array.from(currentByKey.values());
                                        props.onDraftChange(next);
                                      }}
                                    />
                                    <span class="ml">${opt.label}</span>
                                  </label>
                                  ${opt.hint ? html`<div class="muted ml-lg">${opt.hint}</div>` : nothing}
                                `;
                              })}
                            </div>
                        `
                      : html`<div class="mt muted">Unsupported step type: ${step.type}</div>`}

              <div class="actions mt onboarding-actions">
                <button class="btn primary" ?disabled=${!canSubmit} @click=${props.onSubmit}>
                  ${step.type === "note" ? "Continue" : "Next"}
                </button>
              </div>
            </div>
          `
        : nothing}
    </div>
  `;
}
