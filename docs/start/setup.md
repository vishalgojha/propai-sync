---
summary: "Advanced setup and development workflows for propai"
read_when:
  - Setting up a new machine
  - You want “latest + greatest” without breaking your personal setup
title: "Setup"
---

# Setup

<Note>
If you are setting up for the first time, start with [Getting Started](/start/getting-started).
For wizard details, see [Onboarding Wizard](/start/wizard).
</Note>

Last updated: 2026-01-01

## TL;DR

- **Tailoring lives outside the repo:** `~/.propai/workspace` (workspace) + `~/.propai/propai.json` (config).

## Prereqs (from source)

- Node `>=22`
- `pnpm`
- Docker (optional; only for containerized setup/e2e — see [Docker](/install/docker))

## Tailoring strategy (so updates don’t hurt)

If you want “100% tailored to me” _and_ easy updates, keep your customization in:

- **Config:** `~/.propai/propai.json` (JSON/JSON5-ish)
- **Workspace:** `~/.propai/workspace` (skills, prompts, memories; make it a private git repo)

Bootstrap once:

```bash
propai setup
```

From inside this repo, use the local CLI entry:

```bash
propai setup
```

If you don’t have a global install yet, run it via `pnpm propai setup`.

## Run the Gateway from this repo

After `pnpm build`, you can run the packaged CLI directly:

```bash
node propai.mjs gateway --port 18789 --verbose
```


2. Complete the onboarding/permissions checklist (TCC prompts).
3. Ensure Gateway is **Local** and running (the app manages it).
4. Link surfaces (example: WhatsApp):

```bash
propai channels login
```

5. Sanity check:

```bash
propai health
```

If onboarding is not available in your build:

- Run `propai setup`, then `propai channels login`, then start the Gateway manually (`propai gateway`).

## Bleeding edge workflow (Gateway in a terminal)




```bash
./scripts/restart-mac.sh
```

### 1) Start the dev Gateway

```bash
pnpm install
pnpm gateway:watch
```

`gateway:watch` runs the gateway in watch mode and reloads on TypeScript changes.



- Connection Mode: **Local**
  The app will attach to the running gateway on the configured port.

### 3) Verify

- In-app Gateway status should read **“Using existing gateway …”**
- Or via CLI:

```bash
propai health
```

### Common footguns

- **Wrong port:** Gateway WS defaults to `ws://127.0.0.1:18789`; keep app + CLI on the same port.
- **Where state lives:**
  - Credentials: `~/.propai/credentials/`
  - Sessions: `~/.propai/agents/<agentId>/sessions/`
  - Logs: `/tmp/propai/`

## Credential storage map

Use this when debugging auth or deciding what to back up:

- **WhatsApp**: `~/.propai/credentials/whatsapp/<accountId>/creds.json`
- **Telegram bot token**: config/env or `channels.telegram.tokenFile` (regular file only; symlinks rejected)
- **Discord bot token**: config/env or SecretRef (env/file/exec providers)
- **Slack tokens**: config/env (`channels.slack.*`)
- **Pairing allowlists**:
  - `~/.propai/credentials/<channel>-allowFrom.json` (default account)
  - `~/.propai/credentials/<channel>-<accountId>-allowFrom.json` (non-default accounts)
- **Model auth profiles**: `~/.propai/agents/<agentId>/agent/auth-profiles.json`
- **File-backed secrets payload (optional)**: `~/.propai/secrets.json`
- **Legacy OAuth import**: `~/.propai/credentials/oauth.json`
  More detail: [Security](/gateway/security#credential-storage-map).

## Updating (without wrecking your setup)

- Keep `~/.propai/workspace` and `~/.propai/` as “your stuff”; don’t put personal prompts/config into the `propai` repo.
- Updating source: `git pull` + `pnpm install` (when lockfile changed) + keep using `pnpm gateway:watch`.

## Linux (systemd user service)

Linux installs use a systemd **user** service. By default, systemd stops user
services on logout/idle, which kills the Gateway. Onboarding attempts to enable
lingering for you (may prompt for sudo). If it’s still off, run:

```bash
sudo loginctl enable-linger $USER
```

For always-on or multi-user servers, consider a **system** service instead of a
user service (no lingering needed). See [Gateway runbook](/gateway) for the systemd notes.

## Related docs

- [Gateway runbook](/gateway) (flags, supervision, ports)
- [Gateway configuration](/gateway/configuration) (config schema + examples)
- [Discord](/channels/discord) and [Telegram](/channels/telegram) (reply tags + replyToMode settings)
- [propai assistant setup](/start/propai)



