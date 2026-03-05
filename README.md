# PropAI Sync

PropAI is a WhatsApp-first realtor CLI built as a clean wrapper with realtor-focused defaults.

It translates business-focused commands into runtime commands, keeps defaults tuned for realtor workflows, and ships with bundled lead-management skills.

## Install

Runtime: Node 22+

```bash
npm install -g propai-sync@latest
# or
pnpm add -g propai-sync@latest
```

## Quick Start

```bash
propai profile init "Acme Realty" --owner "Vishal" --city "Mumbai"
propai sync
propai start
propai stop
propai connect whatsapp
propai status
```

One command for setup + onboarding + UI launch (Windows):

```powershell
npm run propai:up
# fast path (skip sync/onboarding)
npm run propai:up:fast
```

## Daily Workflow Examples

```bash
propai ui
propai dashboard
propai tui
propai lead follow-up +15555550123 "Just checking in on the listing you asked about."
propai schedule daily "Good morning check-in" --to +15555550123
propai history +15555550123
```

- `propai ui` opens the PropAI UI (`http://127.0.0.1:18789/`).
- `propai dashboard` is an alias of `propai ui`.

## Windows One-Click TUI Launcher

If TUI shows `not connected to gateway`, use the launcher from the repo root:

```powershell
.\start-propai-tui.bat
```

It automatically:

- stops stale PropAI/OpenClaw TUI and gateway node processes
- starts one fresh gateway on `ws://127.0.0.1:18789`
- opens TUI after the gateway is reachable

Manual cleanup:

```bash
propai stop
```

Windows PowerShell fallback:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\propai-stop.ps1
```

## Windows One-Command Full Launch

Single command alternative to manual Terminal A/B:

```powershell
npm run propai:up
```

It automatically:

- stops stale PropAI/OpenClaw processes
- runs `propai sync` (setup/onboarding)
- starts gateway on `ws://127.0.0.1:18789`
- opens `http://127.0.0.1:18789/`

Desktop shortcut option:

```powershell
.\start-propai-up.bat
```

## WhatsApp Group Allowlist (Simple)

```bash
propai groups list --account tenant-a --agent main
propai groups allow "Family Investors" --account tenant-a --agent main
propai groups allow 120000000000001@g.us 120000000000002@g.us --account tenant-a --agent main
propai groups allow-all --account tenant-a --agent main
```

Run `propai --help` for the complete command list.

Use `propai --debug ...` to print the underlying runtime command and full diagnostics.
`propaiclaw` is also available as a compatibility alias.

## What PropAI Wraps

PropAI keeps the wrapper-based runtime path under the hood and maps commands like:

- `propai start` -> `gateway run`
- `propai sync` -> `onboard --flow quickstart --skip-ui`
- `propai connect whatsapp` -> `channels login --channel whatsapp`
- `propai lead follow-up ...` -> `message send ... --channel whatsapp`

## Bundled Skills (Realtor Context)

When PropAI mode is enabled, bundled skill loading defaults to:

- `message-parser`
- `lead-extractor`
- `india-location-normalizer`
- `summary-generator`
- `action-suggester`
- `lead-storage`

## Configuration and Docs

PropAI uses the current configuration/runtime model.

- Getting started: docs/start/getting-started.md
- Gateway configuration: docs/gateway/configuration.md
- WhatsApp channel docs: docs/channels/whatsapp.md
- Skills docs: docs/tools/skills.md
- Hosted platform (BYOK multi-agent): docs/hosted-platform.md

## Development

```bash
git clone https://github.com/vishalgojha/propai-sync.git
cd propai-sync
pnpm install
pnpm build
pnpm test
```

## License

MIT
