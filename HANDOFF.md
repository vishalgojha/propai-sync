# Handoff (2026-03-17)

## Project Snapshot

PropAi Sync is being treated as a production desktop + mobile product. The current repo state is centered on:

- desktop-first onboarding with product-style setup flow
- production-oriented licensing with persistent activations
- licensing now framed around activation keys, device activations, and refresh tokens instead of a minimal JWT-only gate

## Completed

### Onboarding and Product UX

- Desktop onboarding was reshaped into a consumer-facing first-run flow in [`ui/src/ui/views/onboarding.ts`](/mnt/c/Users/visha/propai-sync/ui/src/ui/views/onboarding.ts).
- The onboarding visual system was shifted to a jet-black background and mint-green text treatment in [`ui/src/styles/components.css`](/mnt/c/Users/visha/propai-sync/ui/src/styles/components.css).
- Onboarding choices were simplified in [`ui/src/ui/onboarding-presets.ts`](/mnt/c/Users/visha/propai-sync/ui/src/ui/onboarding-presets.ts).

### Licensing Backend

- The licensing service was rebuilt around persistent SQLite state in [`services/licensing/src/index.ts`](/mnt/c/Users/visha/propai-sync/services/licensing/src/index.ts).
- New production paths exist for:
  - `POST /v1/activations/activate`
  - `POST /v1/activations/refresh`
  - `POST /v1/activations/deactivate`
  - `POST /v1/admin/licenses`
- The service now tracks:
  - licenses
  - activation keys
  - per-device activations
  - device caps via `maxDevices`
  - activation token refresh lifecycle
- Legacy compatibility remains for `/verify` and `/issue`.

### Desktop Licensing Flow

- The Tauri bridge now exposes explicit activation lifecycle commands in [`apps/tauri/src-tauri/src/gateway_ipc.rs`](/mnt/c/Users/visha/propai-sync/apps/tauri/src-tauri/src/gateway_ipc.rs) and wires them in [`apps/tauri/src-tauri/src/main.rs`](/mnt/c/Users/visha/propai-sync/apps/tauri/src-tauri/src/main.rs).
- The UI licensing client now stores:
  - activation key
  - activation token
  - entitlement cache
  - stable device ID
- Desktop boot now supports:
  - cached entitlement startup
  - silent refresh using activation token
  - offline grace handling
  - silent re-activation fallback
- Relevant files:
  - [`ui/src/ui/license.ts`](/mnt/c/Users/visha/propai-sync/ui/src/ui/license.ts)
  - [`ui/src/ui/app.ts`](/mnt/c/Users/visha/propai-sync/ui/src/ui/app.ts)
  - [`ui/src/ui/views/license-panel.ts`](/mnt/c/Users/visha/propai-sync/ui/src/ui/views/license-panel.ts)
  - [`ui/src/ui/views/landing.ts`](/mnt/c/Users/visha/propai-sync/ui/src/ui/views/landing.ts)

### Licensing Tooling and Docs

- Licensing docs were rewritten to describe the production activation model in [`services/licensing/README.md`](/mnt/c/Users/visha/propai-sync/services/licensing/README.md).
- Local issuance helpers were aligned to the DB-backed model in:
  - [`services/licensing/scripts/create-license.ts`](/mnt/c/Users/visha/propai-sync/services/licensing/scripts/create-license.ts)
  - [`services/licensing/scripts/issue-license.ts`](/mnt/c/Users/visha/propai-sync/services/licensing/scripts/issue-license.ts)
  - [`apps/tauri/scripts/issue-activation-key.mjs`](/mnt/c/Users/visha/propai-sync/apps/tauri/scripts/issue-activation-key.mjs)

## Verification

- `pnpm --dir services/licensing exec tsc --noEmit` passes.
- `pnpm --dir services/licensing build` is currently blocked by the repo's mixed Windows/WSL dependency state. Rollup's native optional package is missing in WSL.
- Full desktop `cargo check` was started and progressed through the Tauri dependency graph, but a complete clean finish was not captured in-session.

## Environment Rule

Use PowerShell on Windows for installs and builds, not WSL.

Reason:

- the repo uses native Node and Tauri dependencies
- WSL currently has a mismatched `node_modules` state
- build/install work should run from [`C:\Users\visha\propai-sync`](/mnt/c/Users/visha/propai-sync)

Recommended install path:

```powershell
cd C:\Users\visha\propai-sync
pnpm install
```

## Known Gaps

- Desktop licensing is now production-shaped, but there is no mobile activation flow yet.
- There is no mobile pairing UX that consumes the licensing model.
- There is no mobile device-management UI in desktop yet.
- The service does not yet expose end-user activation listing or admin revocation UI.
- Full Windows-side clean build verification still needs to be rerun after a fresh native install.

## Next Track: Mobile Support

Mobile support is the next implementation phase.

### Objective

Ship a real desktop + mobile activation and pairing model where mobile is a first-class licensed device, not an afterthought or borrowed desktop session.

### Required Product Outcome

- User activates desktop with an activation key.
- Desktop offers mobile pairing immediately after setup.
- Mobile app receives its own activation record.
- Desktop and mobile both refresh entitlements independently.
- Device limits apply across desktop + mobile according to plan.

### Required Backend Work

Add the next licensing and pairing APIs:

- `POST /v1/pairing/session`
- `POST /v1/pairing/complete`
- `GET /v1/licenses/me`
- `GET /v1/activations`
- `POST /v1/activations/revoke`

Persist:

- pairing sessions
- mobile activation metadata
- activation revoke history
- optional account ownership metadata if mobile sign-in is account-backed

### Required Desktop Work

- Add a dedicated mobile-pairing step after onboarding completion.
- Show pairing state in desktop:
  - waiting
  - code generated
  - mobile connected
  - activation complete
- Add device-management UI for current plan and used seats.
- Add revoke/deactivate actions for stale devices.

### Required Mobile Work

- Create activation bootstrap flow for mobile:
  - scan QR or enter pairing code
  - bind mobile device ID
  - fetch entitlement
  - store activation token locally
- Support refresh and grace behavior mirroring desktop.
- Show license and device state inside mobile settings.

### Recommended Execution Order

1. Finalize Windows-native install and rerun desktop verification from PowerShell.
2. Add backend pairing/session schema and endpoints.
3. Add desktop pairing step and device-management surfaces.
4. Implement mobile activation bootstrap against the new APIs.
5. Add revoke/deactivate handling and device-limit enforcement tests across desktop + mobile.

## Immediate Next Command Set

Run from PowerShell:

```powershell
cd C:\Users\visha\propai-sync
pnpm install
pnpm --dir services/licensing dev
pnpm desktop:dev
```

Issue an activation key from a second PowerShell window:

```powershell
cd C:\Users\visha\propai-sync
$env:LICENSE_ADMIN_KEY=$env:ADMIN_KEY
pnpm --dir services/licensing issue-license -- --plan pro --max-devices 2 --expires-at 2026-12-31
```

## Decision

Do not build any minimal or mock mobile path. The next phase should implement first-class mobile licensing and pairing on top of the production activation model now in the repo.
