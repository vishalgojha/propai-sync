import { html, nothing } from "lit";
import type { LicenseEntitlement, LicenseStatus } from "../license.ts";

export type LicensePanelProps = {
  token: string;
  apiUrl: string;
  adminKey: string;
  busy: boolean;
  status: LicenseStatus;
  entitlement: LicenseEntitlement | null;
  error: string | null;
  notice: string | null;
  onTokenChange: (value: string) => void;
  onApiUrlChange: (value: string) => void;
  onAdminKeyChange: (value: string) => void;
  onSubmit: () => void;
  onRequest: () => void;
  onApprove: () => void;
};

function renderStatus(props: LicensePanelProps) {
  if (props.busy) {
    return html`<div class="muted">Checking activation...</div>`;
  }
  if (props.status === "active") {
    const plan = props.entitlement?.plan ? props.entitlement.plan.toUpperCase() : null;
    const ends = props.entitlement?.expiresAt
      ? new Date(props.entitlement.expiresAt).toLocaleDateString()
      : null;
    return html`<div class="callout ok">
      ${plan ? `${plan} active` : "License active"}${ends ? ` until ${ends}` : ""}
    </div>`;
  }
  if (props.status === "grace") {
    const graceUntil = props.entitlement?.graceUntil
      ? new Date(props.entitlement.graceUntil).toLocaleDateString()
      : null;
    return html`<div class="callout warn">
      Offline grace mode${graceUntil ? ` until ${graceUntil}` : ""}.
    </div>`;
  }
  if (props.status === "expired") {
    return html`<div class="callout warn">License expired.</div>`;
  }
  if (props.status === "pending") {
    return html`<div class="callout warn">Activation key generated. Waiting for admin approval.</div>`;
  }
  if (props.status === "invalid") {
    return html`<div class="callout warn">Activation key invalid.</div>`;
  }
  return nothing;
}

export function renderLicensePanel(props: LicensePanelProps) {
  const seats =
    typeof props.entitlement?.devicesUsed === "number" && typeof props.entitlement?.deviceLimit === "number"
      ? `${props.entitlement.devicesUsed} / ${props.entitlement.deviceLimit} devices in use`
      : null;
  return html`
    <section class="card">
      <div class="card-title">Activation</div>
      <div class="card-sub">
        Activate this desktop to unlock chat, setup, and configuration.
      </div>
      <label class="field" style="margin-top: 12px;">
        <span>Activation key</span>
        <input
          type="text"
          placeholder="propai_sync_****"
          .value=${props.token}
          ?disabled=${props.busy}
          @input=${(event: Event) =>
            props.onTokenChange((event.target as HTMLInputElement).value)}
        />
      </label>
      <div class="row" style="gap: 8px; justify-content: flex-end; margin-top: 8px;">
        <button class="btn" ?disabled=${props.busy} @click=${props.onRequest}>
          ${props.busy ? "Working..." : "Generate key"}
        </button>
        <button class="btn primary" ?disabled=${props.busy} @click=${props.onSubmit}>
          ${props.busy ? "Checking..." : "Activate desktop"}
        </button>
      </div>
      ${renderStatus(props)}
      ${props.entitlement?.activationId
        ? html`<div class="muted" style="margin-top: 10px;">
            ${props.entitlement.plan ? `${props.entitlement.plan} plan` : "Licensed"}
            ${seats ? html`<span> · ${seats}</span>` : nothing}
          </div>`
        : nothing}
      ${props.notice ? html`<div class="callout ok">${props.notice}</div>` : nothing}
      ${props.error ? html`<div class="callout danger">${props.error}</div>` : nothing}
      <details style="margin-top: 10px;">
        <summary>Admin approval</summary>
        <div class="muted" style="margin-top: 8px;">
          Admin can approve the current key here. The key stays unusable until approval.
        </div>
        <label class="field" style="margin-top: 8px;">
          <span>Admin key</span>
          <input
            type="password"
            placeholder="Enter admin key"
            .value=${props.adminKey}
            ?disabled=${props.busy}
            @input=${(event: Event) =>
              props.onAdminKeyChange((event.target as HTMLInputElement).value)}
          />
        </label>
        <div class="row" style="gap: 8px; justify-content: flex-end; margin-top: 8px;">
          <button class="btn" ?disabled=${props.busy} @click=${props.onApprove}>
            ${props.busy ? "Working..." : "Approve key"}
          </button>
        </div>
      </details>
      <details style="margin-top: 10px;">
        <summary>Advanced</summary>
        <label class="field" style="margin-top: 8px;">
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
  `;
}
