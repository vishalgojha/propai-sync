import { html, nothing } from "lit";
import { renderChannelConfigSection } from "./channels.config.ts";
import type { ChannelsProps } from "./channels.types.ts";

export function renderInstagramCard(params: {
  props: ChannelsProps;
  instagram?: Record<string, unknown> | null;
  accountCountLabel: unknown;
}) {
  const { props, instagram, accountCountLabel } = params;
  const configured =
    instagram && typeof instagram.configured === "boolean" ? instagram.configured : null;
  const running = instagram && typeof instagram.running === "boolean" ? instagram.running : null;
  const connected =
    instagram && typeof instagram.connected === "boolean" ? instagram.connected : null;
  const lastError = instagram && typeof instagram.lastError === "string" ? instagram.lastError : null;

  return html`
    <div class="card">
      <div class="card-title">Instagram</div>
      <div class="card-sub">Instagram DM connector for listings and lead follow-ups.</div>
      ${accountCountLabel}

      <div class="status-list" style="margin-top: 16px;">
        <div>
          <span class="label">Configured</span>
          <span>${configured == null ? "n/a" : configured ? "Yes" : "No"}</span>
        </div>
        <div>
          <span class="label">Running</span>
          <span>${running == null ? "n/a" : running ? "Yes" : "No"}</span>
        </div>
        <div>
          <span class="label">Connected</span>
          <span>${connected == null ? "n/a" : connected ? "Yes" : "No"}</span>
        </div>
      </div>

      <div class="callout" style="margin-top: 12px;">
        Instagram support is being wired in. Use WhatsApp for now, or add credentials once the
        connector is enabled.
      </div>

      ${
        lastError
          ? html`<div class="callout danger" style="margin-top: 12px;">
            ${lastError}
          </div>`
          : nothing
      }

      ${renderChannelConfigSection({ channelId: "instagram", props })}
    </div>
  `;
}
