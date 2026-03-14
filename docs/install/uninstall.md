---
summary: "Uninstall propai completely (CLI, service, state, workspace)"
read_when:
  - You want to remove propai from a machine
  - The gateway service is still running after uninstall
title: "Uninstall"
---

# Uninstall

Two paths:

- **Easy path** if `propai` is still installed.
- **Manual service removal** if the CLI is gone but the service is still running.

## Easy path (CLI still installed)

Recommended: use the built-in uninstaller:

```bash
propai uninstall
```

Non-interactive (automation / npx):

```bash
propai uninstall --all --yes --non-interactive
npx -y propai uninstall --all --yes --non-interactive
```

Manual steps (same result):

1. Stop the gateway service:

```bash
propai gateway stop
```

2. Uninstall the gateway service (launchd/systemd/schtasks):

```bash
propai gateway uninstall
```

3. Delete state + config:

```bash
rm -rf "${PROPAI_STATE_DIR:-$HOME/.propai}"
```

If you set `PROPAI_CONFIG_PATH` to a custom location outside the state dir, delete that file too.

4. Delete your workspace (optional, removes agent files):

```bash
rm -rf ~/.propai/workspace
```

5. Remove the CLI install (pick the one you used):

```bash
npm rm -g propai
pnpm remove -g propai
bun remove -g propai
```

6. If you installed the macOS app:

```bash
rm -rf /Applications/propai.app
```

Notes:

- If you used profiles (`--profile` / `PROPAI_PROFILE`), repeat step 3 for each state dir (defaults are `~/.propai-<profile>`).
- In remote mode, the state dir lives on the **gateway host**, so run steps 1-4 there too.

## Manual service removal (CLI not installed)

Use this if the gateway service keeps running but `propai` is missing.

### macOS (launchd)

Default label is `ai.propai.gateway` (or `ai.propai.<profile>`; legacy `com.propai.*` may still exist):

```bash
launchctl bootout gui/$UID/ai.propai.gateway
rm -f ~/Library/LaunchAgents/ai.propai.gateway.plist
```

If you used a profile, replace the label and plist name with `ai.propai.<profile>`. Remove any legacy `com.propai.*` plists if present.

### Linux (systemd user unit)

Default unit name is `propai-gateway.service` (or `propai-gateway-<profile>.service`):

```bash
systemctl --user disable --now propai-gateway.service
rm -f ~/.config/systemd/user/propai-gateway.service
systemctl --user daemon-reload
```

### Windows (Scheduled Task)

Default task name is `propai Gateway` (or `propai Gateway (<profile>)`).
The task script lives under your state dir.

```powershell
schtasks /Delete /F /TN "propai Gateway"
Remove-Item -Force "$env:USERPROFILE\.propai\gateway.cmd"
```

If you used a profile, delete the matching task name and `~\.propai-<profile>\gateway.cmd`.

## Normal install vs source checkout

### Normal install (install.sh / npm / pnpm / bun)

If you used `https://propai.ai/install.sh` or `install.ps1`, the CLI was installed with `npm install -g propai@latest`.
Remove it with `npm rm -g propai` (or `pnpm remove -g` / `bun remove -g` if you installed that way).

### Source checkout (git clone)

If you run from a repo checkout (`git clone` + `propai ...` / `bun run propai ...`):

1. Uninstall the gateway service **before** deleting the repo (use the easy path above or manual service removal).
2. Delete the repo directory.
3. Remove state + workspace as shown above.



