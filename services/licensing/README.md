# PropAI Sync Licensing Service

Minimal licensing API for PropAI Sync. Issues trial entitlements, validates tokens, and returns a
signed entitlement JWT.

## Quick start

```bash
pnpm --dir services/licensing install
pnpm --dir services/licensing dev
```

Environment:

- `LICENSE_JWT_SECRET` (required)
- `ADMIN_KEY` (required for admin endpoints)
- `DATABASE_URL` (default: `./data/licensing.db`)
- `TRIAL_DAYS` (default: `7`)
- `PORT` (default: `8787`)

## Endpoints

- `GET /v1/health`
- `POST /v1/license/verify`
- `POST /v1/admin/licenses` (requires `x-admin-key`)

## Create a license token

```bash
pnpm --dir services/licensing create-license -- --plan pro --max-devices 2
```
