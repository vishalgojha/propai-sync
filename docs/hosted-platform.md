# Hosted Multi-Agent Platform (BYOK)

This document describes the hosted architecture layered on top of the existing PropAI CLI runtime.

## Filled Targets

- Tool name: `propai-sync` (PropAI)
- BYOK services: `openai`, `anthropic`, `openrouter`, `gemini`, `slack`, `twilio`
- Agent set: `sync-agent`, `channel-agent`, `lead-agent`, `workflow-agent`, `ops-agent`
- Service action groups:
  - `openai`: `chat_completions_create`
  - `propai-cli`: `sync`, `start`, `stop`, `status`, `connect_whatsapp`, `raw`
- Hosting platform: Railway
- Tier 2 price: `$39/mo`

## Implemented API Surface

- `POST /api/auth/bootstrap`
- `GET /api/health`
- `GET /api/users/me`
- `POST /api/orchestrate`
- `GET /api/agents`
- `GET /api/tools`
- `GET /api/keys`
- `POST /api/keys`
- `DELETE /api/keys/:id`
- `GET /api/recipes`
- `POST /api/recipes`
- `DELETE /api/recipes/:slug`
- `POST /api/recipes/:slug/run`
- `GET /api/triggers`
- `POST /api/triggers`
- `DELETE /api/triggers/:id`
- `POST /api/triggers/events/:eventName`
- `POST /api/triggers/webhook/:token`
- `POST /api/cli/run`
- `POST /api/cli/sync`
- `POST /api/cli/start`
- `POST /api/cli/stop`
- `POST /api/cli/status`
- `POST /api/cli/connect-whatsapp`
- `GET /api/logs`

## Security Model

- API surface uses per-user API auth via `X-API-Key`.
- BYOK service keys are encrypted at rest with `AES-256-GCM`.
- Runtime execution isolation is per user under:
  - `hosted-platform/users/<userId>/workspace`
  - `hosted-platform/users/<userId>/runtime-state`
- Hosted auth endpoints now include in-memory auth throttling for:
  - invalid/missing `X-API-Key` requests
  - bootstrap token failures on `POST /api/auth/bootstrap`
- Security audit events are appended to:
  - `hosted-platform/security-audit.ndjson`

## Bootstrap Policy

- `PROPAI_HOSTED_ADMIN_TOKEN` is required by default in production (`NODE_ENV=production`).
- Tokenless bootstrap can be enabled only with explicit override:
  - `PROPAI_HOSTED_ALLOW_INSECURE_BOOTSTRAP=1`
- Development/non-production defaults still allow local bootstrap without an admin token.

## Auth Throttling Controls

- `PROPAI_HOSTED_AUTH_RATE_LIMIT_MAX_ATTEMPTS` (default `30`)
- `PROPAI_HOSTED_AUTH_RATE_LIMIT_WINDOW_MS` (default `60000`)
- `PROPAI_HOSTED_AUTH_RATE_LIMIT_LOCKOUT_MS` (default `300000`)
- `PROPAI_HOSTED_AUTH_RATE_LIMIT_EXEMPT_LOOPBACK` (default `1`)

## Recipe + Trigger Model

- Recipes stored as JSON or YAML in user-scoped recipe folders.
- `$prev` and `$input` interpolation supported across recipe steps.
- Trigger types:
  - `cron`: schedule expression + optional timezone
  - `webhook`: unique URL token per trigger
  - `event`: internal event dispatch (`orchestrate.completed`)

## Migration Path (CLI -> Hosted)

1. Bootstrap an API user with `POST /api/auth/bootstrap`.
2. Save BYOK provider keys with `POST /api/keys`.
3. Move manual CLI flows into recipes using `POST /api/recipes`.
4. Add triggers for automation with `POST /api/triggers`.
5. Move direct command execution to `POST /api/cli/run` and orchestrated jobs to `POST /api/orchestrate`.
6. Keep legacy CLI users unchanged; hosted layer is additive.

## Build Order

1. Key vault + API key auth + per-user storage
2. Tool registry + agent registry + CLI wrapper endpoints
3. Orchestrator routing + recipe runner + trigger engine
4. Dashboard pages (Keys, Agents, Tools, Recipes, Triggers, Logs)
5. Hosted deployment packaging (Docker + Railway)

## Distribution Tiers

- Tier 1: CLI + self-hosted gateway, free/open source
- Tier 2: Cloud hosted with BYOK, `$39/mo`
- Tier 3: Enterprise white-label/on-prem, custom pricing
