---
summary: "Updating propai safely (global install or source), plus rollback strategy"
read_when:
  - Updating propai
  - Something breaks after an update
title: "Updating"
---

# Updating

propai is moving fast (pre “1.0”). Treat updates like shipping infra: update →
run checks → restart → verify.

## Recommended: re-run the website installer (upgrade in place)

The **preferred** update path is to re-run the installer from the website. It
detects existing installs and upgrades in place.

```bash
curl -fsSL https://propai.live/install.sh | bash
```

Notes:

- Add `--no-onboard` if you don’t want the onboarding wizard to run again.
- For **source installs**, use:

  ```bash
  curl -fsSL https://propai.live/install.sh | bash -s -- --install-method git --no-onboard
  ```

  The installer will `git pull --rebase` **only** if the repo is clean.

- For **global installs**, the script uses `npm install -g propai@latest` under the hood.
- Legacy note: `clawdbot` remains available as a compatibility shim.

## Before you update

- Know how you installed: **global** (npm/pnpm) vs **from source** (git clone).
- Know how your Gateway is running: **foreground terminal** vs **supervised service** (launchd/systemd).
- Snapshot your tailoring:
  - Config: `~/.propai/propai.json`
  - Credentials: `~/.propai/credentials/`
  - Workspace: `~/.propai/workspace`

## Update (global install)

Global install (pick one):

```bash
npm i -g propai@latest
```

```bash
pnpm add -g propai@latest
```

We do **not** recommend Bun for the Gateway runtime (WhatsApp/Telegram bugs).

To switch update channels, set `update.channel` in config and use the Control
Console **Update & Restart** action (or re-run the installer script).

See [Development channels](/install/development-channels) for channel semantics and release notes.

Note: on npm installs, the gateway logs an update hint on startup (checks the current channel tag). Disable via `update.checkOnStart: false`.

### Core auto-updater (optional)

Auto-updater is **off by default** and is a core Gateway feature (not a plugin).

```json
{
  "update": {
    "channel": "stable",
    "auto": {
      "enabled": true,
      "stableDelayHours": 6,
      "stableJitterHours": 12,
      "betaCheckIntervalHours": 1
    }
  }
}
```

Behavior:

- `stable`: when a new version is seen, propai waits `stableDelayHours` and then applies a deterministic per-install jitter in `stableJitterHours` (spread rollout).
- `beta`: checks on `betaCheckIntervalHours` cadence (default: hourly) and applies when an update is available.
- `dev`: no automatic apply; use a manual update.

After an update, verify in Control Console → **Overview** and **Logs**.

Notes:

- If your Gateway runs as a service, restart it via the service manager instead of killing PIDs.
- If you’re pinned to a specific version, see “Rollback / pinning” below.

## Update (Control UI / RPC)

The Control UI has **Update & Restart** (RPC: `update.run`). It:

1. Runs the same source-update flow as a manual source update (git checkout only).
2. Writes a restart sentinel with a structured report (stdout/stderr tail).
3. Restarts the gateway and pings the last active session with the report.

If the rebase fails, the gateway aborts and restarts without applying the update.

## Update (from source)

From the repo checkout:

Manual (equivalent-ish):

```bash
git pull
pnpm install
pnpm build
pnpm ui:build # auto-installs UI deps on first run
```

Notes:

- `pnpm build` matters when you run the packaged `propai` binary ([`propai.mjs`](https://github.com/propai/propai/blob/main/propai.mjs)) or use Node to run `dist/`.
- If you run directly from TypeScript, a rebuild is usually unnecessary, but config migrations still apply.
- Switching between global and git installs is easy: install the other flavor, then restart the Gateway so the service entrypoint is rewritten to the current install.

## Post-update checks

After updating, verify:

- Control Console → **Overview** shows Gateway + RPC as healthy.
- Control Console → **Logs** shows no startup errors.
- Control Console → **Config** has no validation warnings.

## Start / stop / restart the Gateway

If you’re supervised:

- macOS launchd (app-bundled LaunchAgent): `launchctl kickstart -k gui/$UID/ai.propai.gateway` (use `ai.propai.<profile>`; legacy `com.propai.*` still works)
- Linux systemd user service: `systemctl --user restart propai-gateway[-<profile>].service`
- Windows (WSL2): `systemctl --user restart propai-gateway[-<profile>].service`
  - `launchctl`/`systemctl` only work if the service is installed.

Runbook + exact service labels: [Gateway runbook](/gateway)

## Rollback / pinning (when something breaks)

### Pin (global install)

Install a known-good version (replace `<version>` with the last working one):

```bash
npm i -g propai@<version>
```

```bash
pnpm add -g propai@<version>
```

Tip: to see the current published version, run `npm view propai version`.

Then restart + re-run doctor:

Restart the Gateway using your service manager and confirm health in Control
Console → **Overview**.

### Pin (source) by date

Pick a commit from a date (example: “state of main as of 2026-01-01”):

```bash
git fetch origin
git checkout "$(git rev-list -n 1 --before=\"2026-01-01\" origin/main)"
```

Then reinstall deps + restart:

```bash
pnpm install
pnpm build
```

If you want to go back to latest later:

```bash
git checkout main
git pull
```

## If you’re stuck

- Re-run the post-update checks above and read the output carefully.
- Check Control Console → **Logs** for error details.
- Check: [Troubleshooting](/gateway/troubleshooting)
- Ask in Discord: [https://discord.gg/clawd](https://discord.gg/clawd)




