# Control API (Multi-tenant RBAC)

This service provides basic multi-tenant user management and role-based access control for hosted PropAi Sync deployments.

## Roles
- `owner`: billing, invites, role changes
- `manager`: invites for agents/viewers
- `agent`: operational access only
- `viewer`: read-only access

## Env
- `CONTROL_JWT_SECRET` (required in prod)
- `CONTROL_DB_PATH` (default: `./.data/control.sqlite`)
- `CONTROL_ADMIN_KEY` (optional)
- `CONTROL_JWT_TTL_DAYS` (default: 30)
- `CONTROL_INVITE_TTL_DAYS` (default: 7)
- `SUPABASE_URL` (optional, enables Supabase storage)
- `SUPABASE_SERVICE_ROLE_KEY` (optional, enables Supabase storage)

## Endpoints
- `POST /v1/auth/register` `{ email, password, tenantName }`
- `POST /v1/auth/login` `{ email, password }`
- `GET /v1/me` (bearer)
- `POST /v1/tenants` `{ name }` (bearer)
- `POST /v1/tenants/:tenantId/invites` `{ email, role }` (bearer)
- `POST /v1/invites/accept` `{ token, password? }`
- `GET /v1/tenants/:tenantId/users` (bearer)
- `PATCH /v1/tenants/:tenantId/users/:userId` `{ role }` (bearer, owner)
- `DELETE /v1/tenants/:tenantId/users/:userId` (bearer, owner)

## Notes
- Invites return an `inviteToken`. You can email it or embed in a link.
- This is a minimal RBAC layer; wire it to the hosted UI and gateway for full isolation.

## Supabase migration
1. Apply `supabase-schema.sql` in the Supabase SQL editor.
2. Set `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` on the control-api service.
3. Run migration (one time):
   - `pnpm --filter @propai/control-api migrate:sqlite-to-supabase`
   - Optional envs: `SQLITE_PATH`, `CHUNK_SIZE`, `DRY_RUN=true`, `SKIP_USAGE=true`
