# PropAI Sync Licensing Service

Production licensing service for PropAI Sync. This service persists licenses, activation keys, and per-device activations in SQLite and issues signed activation tokens for desktop refresh flows.

## What it does

- Stores licenses in SQLite instead of treating JWTs as the source of truth
- Issues opaque activation keys such as `propai_sync_...`
- Tracks device activations by `deviceId`
- Enforces `maxDevices`
- Returns signed activation tokens for refresh and deactivate flows
- Supports offline desktop grace windows through cached entitlements
- Keeps `POST /verify` and `POST /issue` for backward compatibility

## Quick start

```bash
pnpm --dir services/licensing install
pnpm --dir services/licensing dev
```

Environment:

- `LICENSE_JWT_SECRET`
  Required in production. Used to sign activation tokens and legacy JWT checks.
- `ADMIN_KEY`
  Required for admin issuance endpoints.
- `LICENSE_DB_PATH`
  Optional SQLite path. Defaults to `.data/licensing.sqlite`.
- `LICENSE_ACTIVATION_TOKEN_TTL_DAYS`
  Optional. Defaults to `30`.
- `LICENSE_GRACE_DAYS`
  Optional offline grace window for cached entitlements. Defaults to `7`.
- `LICENSE_PENDING_APPROVAL_TRIAL_DAYS`
  Optional. Pending activation keys approved through the admin approval flow default to this many trial days when no explicit `expiresAt` is supplied. Defaults to `7`.
- `PORT`
  Optional. Defaults to `8787`.

## Data model

- `licenses`
  Canonical commercial record: plan, status, entitlements, expiry, device cap.
- `activation_keys`
  Opaque user-facing keys. Only the hash is stored.
- `activations`
  Per-device activation records with validation timestamps and device metadata.

## Runtime endpoints

- `GET /health`
- `POST /v1/activations/activate`
- `POST /v1/activations/refresh`
- `POST /v1/activations/deactivate`

`POST /v1/activations/activate`

```json
{
  "token": "propai_sync_xxx",
  "deviceId": "desktop-device-id",
  "appVersion": "1.0.0",
  "client": {
    "platform": "win32",
    "deviceName": "DESKTOP-01"
  }
}
```

Success returns the current entitlement plus an `activationToken`.

`POST /v1/activations/refresh`

```json
{
  "activationToken": "jwt",
  "deviceId": "desktop-device-id",
  "appVersion": "1.0.0"
}
```

Use this on app boot and periodically while the app is running.

`POST /v1/activations/deactivate`

```json
{
  "activationToken": "jwt"
}
```

## Admin issuance

- `POST /v1/admin/licenses`
  Requires `x-admin-key`
- `POST /v1/admin/licenses/approve`
  Requires `x-admin-key`. Approving a pending activation key defaults it to a 7-day trial unless an explicit `expiresAt` is provided.
- `POST /issue`
  Legacy alias that only returns `{ token }`

Example:

```bash
LICENSE_ADMIN_KEY=... pnpm --dir services/licensing issue-license -- --plan pro --max-devices 2 --expires-at 2026-12-31
```

Direct local issuance against the SQLite DB:

```bash
pnpm --dir services/licensing create-license -- --plan pro --max-devices 2 --expires-at 2026-12-31
```

## Compatibility

- `POST /verify`
  Accepts either an activation key, an activation token, or a legacy JWT token.
- `POST /issue`
  Maintained for older tooling.

The production desktop flow should use `activate`, `refresh`, and `deactivate` instead of relying on `verify`.
