# PropAi Sync Handoff

Date: 2026-03-19  
Repo: `C:\Users\visha\propai-sync`

## Status
Work completed across:
- licensing
- marketing website
- realtor-friendly hosted UI copy

Main branch is current.

## Commits
- `9345c1956` — `chore: checkpoint licensing and desktop onboarding work`
- `3817f0041` — `feat: add propai sync marketing website`
- `4ac222726` — `feat: simplify desktop copy for real estate users`

## Completed

### Licensing
Implemented admin-approved trial behavior so approvals default to a 7-day trial unless an explicit expiry is supplied.

Changed:
- `C:\Users\visha\propai-sync\services\licensing\src\index.ts`
- `C:\Users\visha\propai-sync\ui\src\ui\license.ts`
- `C:\Users\visha\propai-sync\ui\src\ui\app.ts`
- `C:\Users\visha\propai-sync\services\licensing\README.md`

Behavior:
- pending request approved by admin
- if `expiresAt` is omitted, backend sets expiry to `now + 7 days`
- env var added:
  - `LICENSE_PENDING_APPROVAL_TRIAL_DAYS`
  - default `7`
- UI success state can show trial end date

Validation:
```powershell
pnpm --dir C:\Users\visha\propai-sync\services\licensing exec tsc --noEmit
```
Passed.

### Marketing Website
Added a new marketing website to the monorepo.

Location:
- `C:\Users\visha\propai-sync\apps\website`

Key files:
- `C:\Users\visha\propai-sync\apps\website\src\App.tsx`
- `C:\Users\visha\propai-sync\apps\website\src\index.css`
- `C:\Users\visha\propai-sync\apps\website\package.json`
- `C:\Users\visha\propai-sync\apps\website\vite.config.ts`
- `C:\Users\visha\propai-sync\apps\website\index.html`

Completed:
- kept overall design structure
- rewrote copy for realtors and staff
- used branding:
  - `Built by Chaos Craft Labs`
- avoided adding green-gradient-heavy styling
- wired public links:
  - installer/docs: `https://docs.propai.live/install/installer`
  - getting started: `https://docs.propai.live/start/getting-started`
  - FAQ: `https://docs.propai.live/help/faq`
  - company: `https://www.chaoscraftlabs.com`

Validation:
```powershell
pnpm --dir C:\Users\visha\propai-sync\apps\website run build
pnpm --dir C:\Users\visha\propai-sync\apps\website run lint
```
Both passed.

### Hosted Control API (RBAC)
Added a new hosted control API for multi-tenant RBAC.

Location:
- `C:\Users\visha\propai-sync\services\control-api`

Key features:
- tenants, users, memberships, invites
- roles: owner, manager, agent, viewer
- JWT auth + invite flow

Files:
- `C:\Users\visha\propai-sync\services\control-api\src\index.ts`
- `C:\Users\visha\propai-sync\services\control-api\README.md`
- `C:\Users\visha\propai-sync\.env.example`

### Product Language Direction
Agreed app language should be fully non-technical.

User constraints:
- only realtors and their employees use this
- no dev language
- WhatsApp is primary
- Telegram is optional
- keep design direction mostly intact
- do not add green gradients by default
- keep branding line:
  - `Built by Chaos Craft Labs`

Naming direction:
- `Cron` → `Auto Tasks`
- `Config` → `Settings`
- `Channels` → `WhatsApp & Apps`
- `Sessions` → `Conversations`
- `Usage` → `Reports`
- debug/support content should be hidden or secondary

### Realtor-Friendly Hosted UI Copy Pass
A large wording pass was implemented in the hosted UI.

Changed files:
- `C:\Users\visha\propai-sync\ui\src\i18n\locales\en.ts`
- `C:\Users\visha\propai-sync\ui\src\ui\app-render.ts`
- `C:\Users\visha\propai-sync\ui\src\ui\views\onboarding.ts`
- `C:\Users\visha\propai-sync\ui\src\ui\views\license-panel.ts`
- `C:\Users\visha\propai-sync\ui\src\ui\views\config.ts`
- `C:\Users\visha\propai-sync\ui\src\ui\views\debug.ts`
- `C:\Users\visha\propai-sync\ui\src\ui\views\instances.ts`
- `C:\Users\visha\propai-sync\ui\src\ui\views\nodes.ts`

Completed:
- onboarding now reads like a simple business setup flow
- activation panel now reads as trial-first instead of licensing jargon
- top app chrome says `Real Estate Assistant`
- settings uses `Guided` and `Advanced` instead of `Form` and `Raw`
- support/device screens use softer language like:
  - `Phone Access`
  - `Connected Devices`
  - `Active Connections`
  - `Allow / Deny / Refresh / Turn off`
- more internal terms replaced with plain wording:
  - website link instead of webhook in user-facing strings
  - connection instead of gateway where practical
  - conversation instead of session in user-facing copy

Focused validation:
```powershell
git -C C:\Users\visha\propai-sync diff --check -- ui/src/i18n/locales/en.ts ui/src/ui/app-render.ts ui/src/ui/views/onboarding.ts ui/src/ui/views/license-panel.ts ui/src/ui/views/config.ts ui/src/ui/views/debug.ts ui/src/ui/views/instances.ts ui/src/ui/views/nodes.ts
```
Passed aside from line-ending warnings on some files.

## Pending

### 1. Continue Copy Cleanup in Remaining User Screens
Still worth reviewing:
- `C:\Users\visha\propai-sync\ui\src\ui\views\channels.ts`
- `C:\Users\visha\propai-sync\ui\src\ui\views\overview.ts`
- `C:\Users\visha\propai-sync\ui\src\ui\views\sessions.ts`
- any schema-generated labels inside settings forms

Goal:
- keep app language aligned with the marketing site
- remove remaining support/dev phrasing visible to end users

### 2. Hosted App Home Polish
A final visual + copy polish pass may still be wanted for the hosted home/onboarding.

Desired direction:
- activate trial
- connect WhatsApp
- finish setup
- keep leads and follow-ups in one place
- keep branding line:
  - `Built by Chaos Craft Labs`

### 4. UI Typecheck Has Existing Unrelated Failures
Not addressed in this pass.

Known failing areas from earlier run:
- `C:\Users\visha\propai-sync\src\wizard\onboarding.ts`
- `C:\Users\visha\propai-sync\ui\src\ui\app-render.ts`
- `C:\Users\visha\propai-sync\ui\src\ui\controllers\agents.test.ts`
- `C:\Users\visha\propai-sync\ui\src\ui\controllers\config.test.ts`

These need a separate follow-up pass.

## Notes
- Tauri app removed (hosted-only)
- builds/checks are better run from Windows PowerShell than WSL for this repo
- keep user-facing language simple enough for non-technical staff
- WhatsApp-first is core positioning
- Telegram should be framed as optional

## Resume Commands

Website:
```powershell
pnpm --dir C:\Users\visha\propai-sync\apps\website run build
pnpm --dir C:\Users\visha\propai-sync\apps\website run lint
```

Licensing service:
```powershell
pnpm --dir C:\Users\visha\propai-sync\services\licensing exec tsc --noEmit
```

UI typecheck:
```powershell
pnpm --dir C:\Users\visha\propai-sync\ui exec tsc --noEmit
```

## Recommended Resume Point
Start with:
- `C:\Users\visha\propai-sync\ui\src\ui\views\channels.ts`
- `C:\Users\visha\propai-sync\ui\src\ui\views\overview.ts`
- `C:\Users\visha\propai-sync\ui\src\ui\views\sessions.ts`

Primary goal:
- make the remaining app screens sound like the website:
  - clear
  - human
  - WhatsApp-first
  - realtor-friendly
