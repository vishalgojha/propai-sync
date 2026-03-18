---
summary: "Fast channel level troubleshooting with per channel failure signatures and fixes"
read_when:
  - Channel transport says connected but replies fail
  - You need channel specific checks before deep provider docs
title: "Channel Troubleshooting"
---

# Channel troubleshooting

Use this page when a channel connects but behavior is wrong.

## Command ladder

Start here:

- Control Console → **Overview**: confirm Runtime and RPC show healthy.
- Control Console → **Channels**: confirm the channel is configured and connected.
- Control Console → **Logs**: filter by channel name or error substring.
- Control Console → **Config**: verify `channels.<id>` settings and allowlists.

Healthy baseline:

- `Runtime: running`
- `RPC probe: ok`
- Channel probe shows connected/ready

## WhatsApp

### WhatsApp failure signatures

| Symptom                         | Fastest check                                       | Fix                                                     |
| ------------------------------- | --------------------------------------------------- | ------------------------------------------------------- |
| Connected but no DM replies     | Control Console → Config (`channels.whatsapp.dmPolicy`, `channels.whatsapp.allowFrom`) | Add sender to allowlist or relax DM policy. |
| Group messages ignored          | Check `requireMention` + mention patterns in config | Mention the bot or relax mention policy for that group. |
| Random disconnect/relogin loops | Control Console → Channels + Logs                   | Re-link and verify credentials directory is healthy.    |

Full troubleshooting: [/channels/whatsapp#troubleshooting-quick](/channels/whatsapp#troubleshooting-quick)

## Telegram

### Telegram failure signatures

| Symptom                           | Fastest check                                   | Fix                                                                         |
| --------------------------------- | ----------------------------------------------- | --------------------------------------------------------------------------- |
| `/start` but no usable reply flow | Control Console → Config (`channels.telegram.dmPolicy`, `channels.telegram.allowFrom`) | Add sender IDs or relax DM policy. |
| Bot online but group stays silent | Verify mention requirement and bot privacy mode | Disable privacy mode for group visibility or mention bot.                   |
| Send failures with network errors | Inspect logs for Telegram API call failures     | Fix DNS/IPv6/proxy routing to `api.telegram.org`.                           |
| Upgraded and allowlist blocks you | Control Console → Config allowlists             | Replace `@username` entries with numeric sender IDs.                        |

Full troubleshooting: [/channels/telegram#troubleshooting](/channels/telegram#troubleshooting)

## Discord

### Discord failure signatures

| Symptom                         | Fastest check                       | Fix                                                       |
| ------------------------------- | ----------------------------------- | --------------------------------------------------------- |
| Bot online but no guild replies | Control Console → Channels + Logs   | Allow guild/channel and verify message content intent.    |
| Group messages ignored          | Check logs for mention gating drops | Mention bot or set guild/channel `requireMention: false`. |
| DM replies missing              | Control Console → Config (`channels.discord.dmPolicy`, `channels.discord.allowFrom`) | Add sender IDs or relax DM policy. |

Full troubleshooting: [/channels/discord#troubleshooting](/channels/discord#troubleshooting)

## Slack

### Slack failure signatures

| Symptom                                | Fastest check                             | Fix                                               |
| -------------------------------------- | ----------------------------------------- | ------------------------------------------------- |
| Socket mode connected but no responses | Control Console → Channels + Logs         | Verify app token + bot token and required scopes. |
| DMs blocked                            | Control Console → Config (`channels.slack.dmPolicy`, `channels.slack.allowFrom`) | Add sender IDs or relax DM policy. |
| Channel message ignored                | Check `groupPolicy` and channel allowlist | Allow the channel or switch policy to `open`.     |

Full troubleshooting: [/channels/slack#troubleshooting](/channels/slack#troubleshooting)

## iMessage and BlueBubbles

### iMessage and BlueBubbles failure signatures

| Symptom                          | Fastest check                                                           | Fix                                                   |
| -------------------------------- | ----------------------------------------------------------------------- | ----------------------------------------------------- |
| No inbound events                | Verify webhook/server reachability and app permissions                  | Fix webhook URL or BlueBubbles server state.          |
| Can send but no receive on macOS | Check macOS privacy permissions for Messages automation                 | Re-grant TCC permissions and restart channel process. |
| DM sender blocked                | Control Console → Config (`channels.imessage.allowFrom` / `channels.bluebubbles.allowFrom`) | Add sender IDs or relax DM policy. |

Full troubleshooting:

- [/channels/imessage#troubleshooting-macos-privacy-and-security-tcc](/channels/imessage#troubleshooting-macos-privacy-and-security-tcc)
- [/channels/bluebubbles#troubleshooting](/channels/bluebubbles#troubleshooting)

## Signal

### Signal failure signatures

| Symptom                         | Fastest check                              | Fix                                                      |
| ------------------------------- | ------------------------------------------ | -------------------------------------------------------- |
| Daemon reachable but bot silent | Control Console → Channels + Logs          | Verify `signal-cli` daemon URL/account and receive mode. |
| DM blocked                      | Control Console → Config (`channels.signal.dmPolicy`, `channels.signal.allowFrom`) | Add sender IDs or relax DM policy. |
| Group replies do not trigger    | Check group allowlist and mention patterns | Add sender/group or loosen gating.                       |

Full troubleshooting: [/channels/signal#troubleshooting](/channels/signal#troubleshooting)

## Matrix

### Matrix failure signatures

| Symptom                             | Fastest check                                | Fix                                             |
| ----------------------------------- | -------------------------------------------- | ----------------------------------------------- |
| Logged in but ignores room messages | Control Console → Channels + Logs            | Check `groupPolicy` and room allowlist.         |
| DMs do not process                  | Control Console → Config (`channels.matrix.dmPolicy`, `channels.matrix.allowFrom`) | Add sender IDs or relax DM policy. |
| Encrypted rooms fail                | Verify crypto module and encryption settings | Enable encryption support and rejoin/sync room. |

Full troubleshooting: [/channels/matrix#troubleshooting](/channels/matrix#troubleshooting)


