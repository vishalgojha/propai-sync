import { html, nothing } from "lit";
import {
  ONBOARDING_WIZARD_PRESETS,
  ONBOARDING_WIZARD_PRESET_GROUPS,
  type OnboardingWizardPresetId,
  resolveOnboardingWizardPreset,
} from "../onboarding-presets.ts";

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
  onPresetChange: (value: OnboardingWizardPresetId) => void;
  onAutoAdvanceChange: (value: boolean) => void;
  onStart: () => void;
  onCancel: () => void;
  onExitSetup: () => void;
  onDraftChange: (value: unknown) => void;
  onSubmit: () => void;
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
    return `bi:${value.toString()}`;
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

export function renderOnboardingWizard(props: OnboardingWizardProps) {
  const step = props.step;
  const canStart = props.connected && !props.busy && !props.sessionId;
  const canSubmit = props.connected && !props.busy && Boolean(step && props.sessionId);
  const stepOptionLookup =
    step?.options && Array.isArray(step.options)
      ? new Map(step.options.map((opt) => [wizardOptionKey(opt.value), opt]))
      : null;
  const selectedOptionKey = wizardOptionKey(props.draft);
  const preset = resolveOnboardingWizardPreset(props.presetId);

  return html`
    <div class="page onboarding">
      <div class="onboarding__hero">
        <div class="onboarding__eyebrow">PropAi</div>
        <div class="onboarding__title">Setup</div>
        <div class="onboarding__subtitle">
          ${props.connected ? "Connected to gateway" : "Connecting to gateway..."}
        </div>
        <div class="onboarding__status ${props.connected ? "ok" : "warn"}">
          <span class="onboarding__status-dot"></span>
          ${props.connected ? "Gateway online" : "Gateway connecting"}
        </div>
      </div>

      ${props.error ? html`<div class="alert alert--error">${props.error}</div>` : nothing}

      ${!props.sessionId
        ? html`
            <div class="card onboarding-card">
              <div class="onboarding-card__intro">
                This runs the same onboarding flow as the CLI, but inside the desktop app.
              </div>
              <label class="field mt">
                <span>Preset</span>
                <select
                  .value=${props.presetId}
                  ?disabled=${props.busy || Boolean(props.sessionId)}
                  @change=${(e: Event) =>
                    props.onPresetChange((e.target as HTMLSelectElement).value as OnboardingWizardPresetId)}
                >
                  ${ONBOARDING_WIZARD_PRESETS.filter((entry) => entry.id === "none").map(
                    (entry) => html`<option value=${entry.id}>${entry.label}</option>`,
                  )}
                  ${ONBOARDING_WIZARD_PRESET_GROUPS.map(
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
                <span class="ml">Auto-advance preset steps</span>
              </label>
              <div class="actions mt onboarding-actions">
                <button class="btn btn--primary" ?disabled=${!canStart} @click=${props.onStart}>
                  Start onboarding
                </button>
                <button class="btn" ?disabled=${props.busy} @click=${props.onExitSetup}>
                  Skip and open dashboard
                </button>
              </div>
            </div>
          `
        : nothing}

      ${props.sessionId
        ? html`
            <div class="card onboarding-card onboarding-card--status">
              <div class="row row--space">
                <div>
                  <div class="muted">Wizard</div>
                  <div class="onboarding-card__status">${props.status ?? "running"}</div>
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
              <div class="muted">${step.title?.trim() ? step.title : "Step"}</div>
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
                <button class="btn btn--primary" ?disabled=${!canSubmit} @click=${props.onSubmit}>
                  ${step.type === "note" ? "Continue" : "Next"}
                </button>
              </div>
            </div>
          `
        : nothing}
    </div>
  `;
}

