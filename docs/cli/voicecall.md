---
summary: "CLI reference for `propai voicecall` (voice-call plugin command surface)"
read_when:
  - You use the voice-call plugin and want the CLI entry points
  - You want quick examples for `voicecall call|continue|status|tail|expose`
title: "voicecall"
---

# `propai voicecall`

`voicecall` is a plugin-provided command. It only appears if the voice-call plugin is installed and enabled.

Primary doc:

- Voice-call plugin: [Voice Call](/plugins/voice-call)

## Common commands

```bash
propai voicecall status --call-id <id>
propai voicecall call --to "+15555550123" --message "Hello" --mode notify
propai voicecall continue --call-id <id> --message "Any questions?"
propai voicecall end --call-id <id>
```

## Exposing webhooks (Tailscale)

```bash
propai voicecall expose --mode serve
propai voicecall expose --mode funnel
propai voicecall expose --mode off
```

Security note: only expose the webhook endpoint to networks you trust. Prefer Tailscale Serve over Funnel when possible.


