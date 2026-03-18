---
summary: "Poll sending via gateway + tool calls"
read_when:
  - Adding or modifying poll support
  - Debugging poll sends from the gateway or tool calls
title: "Polls"
---

# Polls

## Supported channels

- Telegram
- WhatsApp (web channel)
- Discord
- MS Teams (Adaptive Cards)

Note: CLI poll commands are no longer documented. Use the Gateway RPC method or
the agent tool below.

## Gateway RPC

Method: `poll`

Params:

- `to` (string, required)
- `question` (string, required)
- `options` (string[], required)
- `maxSelections` (number, optional)
- `durationHours` (number, optional)
- `durationSeconds` (number, optional, Telegram-only)
- `isAnonymous` (boolean, optional, Telegram-only)
- `channel` (string, optional, default: `whatsapp`)
- `idempotencyKey` (string, required)

## Channel differences

- Telegram: 2-10 options. Supports forum topics via `threadId` or `:topic:` targets. Uses `durationSeconds` instead of `durationHours`, limited to 5-600 seconds. Supports anonymous and public polls.
- WhatsApp: 2-12 options, `maxSelections` must be within option count, ignores `durationHours`.
- Discord: 2-10 options, `durationHours` clamped to 1-768 hours (default 24). `maxSelections > 1` enables multi-select; Discord does not support a strict selection count.
- MS Teams: Adaptive Card polls (propai-managed). No native poll API; `durationHours` is ignored.

## Agent tool (Message)

Use the `message` tool with `poll` action (`to`, `pollQuestion`, `pollOption`, optional `pollMulti`, `pollDurationHours`, `channel`).

For Telegram, the tool also accepts `pollDurationSeconds`, `pollAnonymous`, and `pollPublic`.

Use `action: "poll"` for poll creation. Poll fields passed with `action: "send"` are rejected.

Note: Discord has no “pick exactly N” mode; `pollMulti` maps to multi-select.
Teams polls are rendered as Adaptive Cards and require the gateway to stay online
to record votes in `~/.propai/msteams-polls.json`.



