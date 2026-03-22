<img width="893" height="125" alt="ascii-art-text (1)" src="https://github.com/user-attachments/assets/0d5a9684-9d8b-4d0b-818f-d346bba68080" />






# PropAi Sync — Personal AI Assistant

PropAi Sync is a personal AI assistant you run on your own devices. It answers you on the channels you already use — **WhatsApp** and **Telegram** — and is built to feel local, fast, and always‑on.

Website · Docs · Getting Started · Updating · FAQ

Preferred setup: use the hosted PropAi Sync web app. It guides you step by step through connecting WhatsApp, configuring your workspace, and inviting your team.

## Install (recommended)

Use the hosted PropAi Sync web app at app.propai.live.

## Quick start (TL;DR)

1. Open app.propai.live.
2. Run onboarding to configure WhatsApp, channels, and skills.
3. Invite your team and start chatting.


## Model providers

Set at least one provider key in your environment:

- `GROQ_API_KEY`
- `OPENROUTER_API_KEY`
- `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` / `GEMINI_API_KEY`
- `ELEVENLABS_API_KEY` (or `XI_API_KEY`) + `ELEVENLABS_AGENT_ID` (Conversational AI agent id)

## Hosted setup (Railway)

- Web app: set `VITE_PROPAI_LICENSE_API` only if you want to override the default licensing URL.
- Control API: set `CONTROL_JWT_SECRET` and optionally `CONTROL_ADMIN_KEY` (persist `CONTROL_DB_PATH` on a volume).
- Gateway/worker: set your model provider keys (above) and any channel tokens you enable.

## Security defaults (DM access)

PropAi Sync connects to real messaging surfaces. Treat inbound DMs as **untrusted input**.

Default behavior on WhatsApp/Telegram:

- **DM pairing** (`dmPolicy="pairing"`): unknown senders receive a short pairing code and the bot does not process their message.
- Approve pairing requests from the PropAi Sync app (senders are added to the local allowlist store).
- Public inbound DMs require an explicit opt‑in: set `dmPolicy="open"` and include `"*"` in the channel allowlist (`allowFrom`).

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
               ├─ Hosted Web UI
               ├─ Web UI
               └─ iOS / Android nodes (optional)
```

## Channels

### WhatsApp

- Connect WhatsApp from the hosted app (credentials are stored securely).
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

PropAi Sync is built on the propai codebase, with a WhatsApp + Telegram focus.
