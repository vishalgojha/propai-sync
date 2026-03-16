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

### Windows notes

- Run `pnpm desktop:build` from Windows (PowerShell/CMD), not from WSL.
- You need the Rust toolchain for Windows (MSVC), plus the usual Tauri prerequisites.
- This repo defaults to building an **NSIS** installer on Windows (`bundle.targets = ["nsis"]`).
  - If you switch to MSI (`"targets": "all"` or `"targets": ["msi"]`), follow Tauri's Windows MSI prerequisites (VBSCRIPT feature + WiX toolchain).
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





