---
summary: "Fast WhatsApp troubleshooting with failure signatures and fixes"
read_when:
  - WhatsApp transport says connected but replies fail
  - You need quick operational checks
title: "Channel Troubleshooting"
---

# Channel troubleshooting

This fork is WhatsApp-only. Use this page when WhatsApp is connected but behavior is wrong.

## Command ladder

Run these in order first:

```bash
openclaw status
openclaw gateway status
openclaw logs --follow
openclaw doctor
openclaw channels status --probe
```

Healthy baseline:

- `Runtime: running`
- `RPC probe: ok`
- Channel probe shows connected/ready

## WhatsApp

### WhatsApp failure signatures

| Symptom                         | Fastest check                                       | Fix                                                     |
| ------------------------------- | --------------------------------------------------- | ------------------------------------------------------- |
| Connected but no DM replies     | `openclaw pairing list whatsapp`                    | Approve sender or switch DM policy/allowlist.           |
| Group messages ignored          | Check `requireMention` + mention patterns in config | Mention the bot or relax mention policy for that group. |
| Random disconnect/relogin loops | `openclaw channels status --probe` + logs           | Re-login and verify credentials directory is healthy.   |

Full troubleshooting: [/channels/whatsapp#troubleshooting](/channels/whatsapp#troubleshooting)
