import { html, nothing } from "lit";
import type { LicenseEntitlement, LicenseStatus } from "../license.ts";

export type LandingProps = {
  token: string;
  apiUrl: string;
  busy: boolean;
  status: LicenseStatus;
  entitlement: LicenseEntitlement | null;
  error: string | null;
  onTokenChange: (value: string) => void;
  onApiUrlChange: (value: string) => void;
  onSubmit: () => void;
};

function renderStatus(props: LandingProps) {
  if (props.busy) {
    return html`<div class="landing-status">Verifying license...</div>`;
  }
  if (props.status === "active") {
    return html`<div class="landing-status ok">License active</div>`;
  }
  if (props.status === "trial") {
    const ends = props.entitlement?.trialEndsAt
      ? new Date(props.entitlement.trialEndsAt).toLocaleDateString()
      : "soon";
    return html`<div class="landing-status ok">Trial active - ends ${ends}</div>`;
  }
  if (props.status === "expired") {
    return html`<div class="landing-status warn">Trial expired</div>`;
  }
  if (props.status === "invalid") {
    return html`<div class="landing-status warn">Invalid token</div>`;
  }
  return nothing;
}

export function renderLanding(props: LandingProps) {
  return html`
    <div class="landing">
      <div class="landing__backdrop"></div>
      <div class="landing__grid"></div>
      <div class="landing__content">
        <section class="landing__hero">
          <div class="landing__brand">
            <span class="landing__brand-mark">S</span>
            <div>
              <div class="landing__brand-name">
                <span>PropAI</span>
                <span class="landing__brand-sync">Sync</span>
              </div>
              <div class="landing__brand-tag">AI ops for realtors</div>
            </div>
          </div>
          <h1>Pipeline follow-ups, listing intake, and client nudges - unified.</h1>
          <p>
            PropAI Sync automates lead capture, messaging workflows, and follow-up timelines so
            your team closes faster with fewer manual steps.
          </p>
          <div class="landing__pill-row">
            <span class="landing__pill">WhatsApp + Instagram DMs</span>
            <span class="landing__pill">Lead scoring</span>
            <span class="landing__pill">Team-wide sync</span>
          </div>
          <div class="landing__stats">
            <div>
              <div class="landing__stat-value">7-day</div>
              <div class="landing__stat-label">free trial</div>
            </div>
            <div>
              <div class="landing__stat-value">24/7</div>
              <div class="landing__stat-label">follow-up cadence</div>
            </div>
            <div>
              <div class="landing__stat-value">1 hub</div>
              <div class="landing__stat-label">for every channel</div>
            </div>
          </div>
        </section>

        <section class="landing__panel">
          <div class="landing__panel-header">
            <div>
              <div class="landing__panel-title">Activate your workspace</div>
              <div class="landing__panel-subtitle">
                Enter your license token to unlock your 7-day trial.
              </div>
            </div>
          </div>
          <label class="landing__field">
            <span>License token</span>
            <input
              type="text"
              placeholder="propai_sync_****"
              .value=${props.token}
              ?disabled=${props.busy}
              @input=${(event: Event) =>
                props.onTokenChange((event.target as HTMLInputElement).value)}
            />
          </label>
          <div class="landing__actions">
            <button class="btn primary" ?disabled=${props.busy} @click=${props.onSubmit}>
              ${props.busy ? "Checking..." : "Activate"}
            </button>
            <button class="btn" ?disabled=${props.busy} @click=${props.onSubmit}>Retry</button>
          </div>
          ${renderStatus(props)}
          ${props.error ? html`<div class="landing__error">${props.error}</div>` : nothing}

          <details class="landing__advanced">
            <summary>Advanced</summary>
            <label class="landing__field">
              <span>License API</span>
              <input
                type="text"
                placeholder="https://license.propai.ai"
                .value=${props.apiUrl}
                ?disabled=${props.busy}
                @input=${(event: Event) =>
                  props.onApiUrlChange((event.target as HTMLInputElement).value)}
              />
            </label>
          </details>
        </section>
      </div>
    </div>
  `;
}
