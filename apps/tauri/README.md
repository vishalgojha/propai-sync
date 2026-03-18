# PropAi Sync Desktop (Tauri)

This is a minimal Tauri desktop wrapper around the existing PropAi Sync control UI (`ui/`).

## Dev

Prereqs (ordered):
1. Node 22+ (see root `package.json` engines)
2. pnpm (via Corepack: `corepack enable`)
3. Rust toolchain (stable; Windows needs the MSVC toolchain)
4. Tauri system dependencies for your OS (per Tauri docs)

From repo root:

```bash
pnpm install
pnpm --dir apps/tauri dev
```

Notes:
- The UI is served by `ui`'s Vite dev server.
- The desktop app exposes a small Tauri IPC surface to start/stop a local `propai gateway` process.

## Build (redistributable)

From repo root:

```bash
pnpm install
pnpm desktop:build
```

Notes:
- The build pipeline automatically runs the root `pnpm build` and UI build to stage a self-contained runtime.
- If you only changed UI or backend code, you still just run `pnpm desktop:build`.

## Custom icon

From repo root:

```bash
pnpm --dir apps/tauri icon -- -i path/to/icon.png
```

This writes updated icons into `apps/tauri/src-tauri/icons/`. Commit those files after updating.

## Activation keys

From repo root:

```bash
LICENSE_ADMIN_KEY=... pnpm --dir apps/tauri issue-activation-key -- --plan pro --max-devices 2
```

Defaults to the local licensing service at `http://localhost:8787`. Override with
`--api-url` or `LICENSE_API_URL`.

On Windows you can also double-click
`apps/tauri/scripts/issue-activation-key.bat`; it will prompt for the admin key,
plan, and max devices, then keep the window open so you can read the result.

Inside the desktop onboarding UI, a user can now generate a real activation key in
`pending` state. That key will not activate the desktop until an admin approves it.
The same license gate exposes an admin approval field so an operator can approve the
current key and immediately unlock the desktop.

To configure the required licensing environment variables on Windows, double-click
`apps/tauri/scripts/set-licensing-keys.bat`. It saves `ADMIN_KEY`,
`LICENSE_ADMIN_KEY`, `LICENSE_JWT_SECRET`, and `LICENSE_API_URL` with `setx`.

Builds automatically skip updater artifacts when `TAURI_SIGNING_PRIVATE_KEY` is not set.

### Windows notes

- Run `pnpm desktop:build` from Windows (PowerShell/CMD), not from WSL.
- You need the Rust toolchain for Windows (MSVC), plus the usual Tauri prerequisites.
- This repo defaults to building an **MSI** package on Windows (`bundle.targets = ["msi"]`).
- The MSI uses a custom WiX template so same-version MSI upgrades are allowed and legacy NSIS install paths are ignored.
- Installing the MSI is still a Windows per-machine install, so expect an admin/UAC prompt.
- If you have an older NSIS install under `%LOCALAPPDATA%\PropAi Sync`, uninstall that legacy build before switching to MSI.
- Tauri does not bundle directly to **MSIX** in this setup; MSI is the supported Windows package target here.
- Shortcut: `powershell -ExecutionPolicy Bypass -File apps/tauri/scripts/windows-build.ps1`

The build pipeline:
- Stages a self-contained PropAi Sync runtime (JS + `node_modules`) into `apps/tauri/src-tauri/resources/propai/`.
- Downloads a pinned Node runtime into `apps/tauri/src-tauri/resources/node/`.
- Bundles both into the final Tauri application so end-users do not need Node or pnpm installed.

## Auto updates

The desktop app can auto-check for updates on launch (release builds only). Configure it with:
- `PROPAI_TAURI_UPDATE_ENDPOINTS` (comma-separated update URLs that include `{{target}}`, `{{arch}}`, and `{{current_version}}`)
- `PROPAI_TAURI_UPDATE_PUBKEY` (the public key used to validate update signatures)

These map directly to the Tauri updater plugin configuration; the updater requires signed artifacts. See the Tauri updater docs for the update feed format and signing steps.
