# PropAi Sync — Personal AI Assistant

PropAi Sync is a personal AI assistant you run on your own devices. It answers you on the channels you already use — **WhatsApp** and **Telegram** — and is built to feel local, fast, and always‑on.

Website · Docs · Getting Started · Updating · FAQ

Preferred setup: run the onboarding wizard (`propai onboard`) in your terminal. The wizard guides you step by step through setting up the gateway, workspace, channels, and skills. The CLI wizard works on **macOS, Linux, and Windows (via WSL2)**. Works with npm, pnpm, or bun.

## Install (recommended)

Runtime: **Node ≥22**.

```bash
npm install -g propai@latest
# or: pnpm add -g propai@latest

propai onboard --install-daemon
```

The wizard installs the Gateway daemon (launchd/systemd user service) so it stays running.

## Quick start (TL;DR)

Runtime: **Node ≥22**.

```bash
propai onboard --install-daemon

propai gateway --port 18789 --verbose

# Send a message
propai message send --to +1234567890 --message "Hello from PropAi Sync"

# Talk to the assistant
propai agent --message "Ship checklist" --thinking high
```

Upgrading? Run `propai update` and `propai doctor`.

## Security defaults (DM access)

PropAi Sync connects to real messaging surfaces. Treat inbound DMs as **untrusted input**.

Default behavior on WhatsApp/Telegram:

- **DM pairing** (`dmPolicy="pairing"`): unknown senders receive a short pairing code and the bot does not process their message.
- Approve with: `propai pairing approve <channel> <code>` (then the sender is added to a local allowlist store).
- Public inbound DMs require an explicit opt‑in: set `dmPolicy="open"` and include `"*"` in the channel allowlist (`allowFrom`).

Run `propai doctor` to surface risky/misconfigured DM policies.

## Highlights

- **Local‑first Gateway** — single control plane for sessions, channels, tools, and events.
- **Multi‑agent routing** — route inbound peers to isolated agents (workspaces + per‑agent sessions).
- **Live Canvas + Web UI** — agent‑driven visual workspace and web dashboard.
- **First‑class tools** — browser, canvas, nodes, cron, sessions.
- **Onboarding + skills** — wizard‑driven setup with bundled/managed/workspace skills.

## How it works (short)

```
WhatsApp / Telegram
        │
        ▼
┌───────────────────────────────┐
│            Gateway            │
│       (control plane)         │
│     ws://127.0.0.1:18789      │
└──────────────┬────────────────┘
               │
               ├─ Pi agent (RPC)
               ├─ CLI (propai …)
               ├─ Web UI
               ├─ macOS app (optional)
               └─ iOS / Android nodes (optional)
```

## Channels

### WhatsApp

- Link the device: `propai channels login` (stores creds in `~/.propai/credentials`).
- Allowlist who can talk to the assistant via `channels.whatsapp.allowFrom`.
- If `channels.whatsapp.groups` is set, it becomes a group allowlist; include `"*"` to allow all.

### Telegram

- Set `TELEGRAM_BOT_TOKEN` or `channels.telegram.botToken` (env wins).
- Optional: set `channels.telegram.groups` (with `channels.telegram.groups."*".requireMention`) for group allowlist; include `"*"` to allow all.

Example:

```json
{
  "channels": {
    "telegram": {
      "botToken": "123456:ABCDEF"
    }
  }
}
```

## Chat commands

Send these in WhatsApp/Telegram (group commands are owner‑only):

- `/status` — compact session status
- `/new` or `/reset` — reset the session
- `/compact` — compact session context (summary)
- `/think <level>` — off|minimal|low|medium|high|xhigh
- `/verbose on|off`
- `/usage off|tokens|full`
- `/restart` — restart the gateway
- `/activation mention|always` — group activation toggle

## Docs

- Getting started
- Configuration reference
- Gateway runbook
- Security guide
- Troubleshooting

## Credits

PropAi Sync is built on the propai codebase, refined for WhatsApp + Telegram only.
