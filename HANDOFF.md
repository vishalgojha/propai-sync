# HANDOFF

Date: 2026-03-02
Branch: main

## Update (2026-03-05) - Hosted Platform BYOK (pass 1)

### Done

1. Hosted platform backend slice

- Added hosted-platform runtime modules:
  - `src/hosted-platform/rest-handler.ts`
  - `src/hosted-platform/runtime.ts`
  - `src/hosted-platform/store.ts`
  - `src/hosted-platform/crypto.ts`
  - `src/hosted-platform/paths.ts`
  - `src/hosted-platform/types.ts`
- Exposed hosted API surface for bootstrap/auth, keys, agents, tools, recipes, triggers, orchestration, CLI passthrough, and logs.

2. Gateway integration

- Wired hosted API handler into main HTTP server request flow:
  - `src/gateway/server-http.ts`

3. Studio integration

- Added hosted control screens in studio:
  - `propai-studio/src/HostedPlatformScreens.tsx`
- Added hosted nav entries and route rendering:
  - `propai-studio/src/App.tsx`

4. Deployment + docs

- Added hosted deployment artifacts:
  - `Dockerfile.hosted`
  - `railway.toml`
- Added architecture and endpoint doc:
  - `docs/hosted-platform.md`

5. Env/config documentation

- Added hosted env guidance:
  - `PROPAI_HOSTED_ADMIN_TOKEN`
  - `PROPAI_VAULT_MASTER_KEY`
- File:
  - `.env.example`

### Pending

1. Coverage and reliability

- Add automated tests for hosted runtime/store/rest API behaviors.
- Add negative-path tests for authz/authn, malformed payloads, and per-user isolation guarantees.

2. Security hardening

- Add production guardrails (rate limiting, stricter bootstrap policy defaults, and audit log review pass).
- Validate secret/key rotation and recovery flows.

3. Deployment verification

- Run end-to-end Railway deploy validation and operational smoke checks.

### Verification

- Not run in this handoff pass (tests/build/deploy verification still pending).

## Done

1. Propaiclaw wrapper and command surface

- Added/updated `propai`/`propaiclaw` wrapper flows over OpenClaw.
- Added command mappings for `dashboard`/`ui`/`web`, `tui`/`chat`, and realtor-oriented helpers.
- Added tenant-aware WhatsApp group allowlist commands:
  - `groups list`
  - `groups allow`
  - `groups allow-all`
- Added account/agent scoping resolution for allowlist operations.
- Added name-based WhatsApp group discovery and resolver utilities.

2. Multi-tenant group allowlist safety

- Allowlist writes are now account-scoped.
- Group resolution supports explicit IDs, wildcard, exact-name, and contains-name matching.
- Added tests for allowlist and discovery behavior.

3. UI rebrand for realtor language

- Rebranded user-facing “Cron/Cron Jobs” wording to “Agent Tasks” in key dashboard surfaces.
- Updated visible session labels from `Cron:` to `Agent Task:` and normalized legacy labels.

4. Agent Tasks usability

- Added quick task templates for realtor use cases in the Agent Tasks form:
  - Listing Broadcast
  - Buyer Match Alerts
  - Lead Follow-up Plan
  - Group Engagement Pulse
  - Stale Lead Rescue
  - Weekly Broker Digest
- Templates prefill schedule, payload, and delivery defaults for fast setup.

5. Background open/close flicker mitigation

- Fixed duplicate history reload trigger from the Agent Tasks “History” button.
- Added debounced cron-event refresh (`300ms`) in gateway event handling.
- Switched cron-event refresh path to lightweight mode (skip channel/model suggestion refresh on event bursts).
- Made runs list ordering deterministic by current sort direction.

## Pending

Goal: staged path from wrapper model to a Propaiclaw-first runtime for realtor workflows (WhatsApp + Browser + Canvas + plugins), while preserving tenant continuity.

### Stage 0 - Scope lock and migration policy

1. Confirm bounded scope

- Channels/features in scope for independence: WhatsApp, Browser tools, Canvas host, plugin runtime.
- Out of scope for first cutover: non-realtor channels and non-essential platform surfaces.

2. Define compatibility policy

- Keep backward read compatibility for existing `.openclaw` state during migration.
- Keep legacy command/protocol aliases active until staged cutover is complete.

3. Establish acceptance gates

- No tenant data loss.
- No broker-facing command regression.
- Existing sessions/config continue to load.

### Stage 1 - User-facing rebrand completion (no runtime break)

1. Remove remaining user-facing `openclaw` text in Propaiclaw flows

- Help, examples, error hints, and wrapper diagnostics should show `propai`/`propaiclaw`.

2. Keep runtime internals unchanged for now

- Continue using current OpenClaw internals under the hood during this stage.

3. Add regression tests

- Tests for command output/help/error paths to ensure no user-facing brand leaks.

Stage 1 progress update (2026-03-02)

- done
  - Stage 1.1 first slice completed for user-facing wording in:
    - `README.md`
    - `src/propaiclaw-entry.ts`
    - `src/propai/mapper.ts`
    - `src/propai/mapper.test.ts`
  - Updated help/examples/error/debug-facing wording to use Propaiclaw/runtime terms (no user-facing `openclaw` text in this slice).
  - Kept wrapper execution path unchanged (`propaiclaw-entry` still launches `openclaw.mjs` internally).
  - Added mapper regression coverage to prevent help/failure brand leaks.

- pending
  - Stage 1 follow-up slices outside this first file set (if any additional user-facing surfaces are identified).
  - Later stages (Stage 2+) remain pending by plan.

- verification
  - Command: `pnpm exec vitest run src/propai/mapper.test.ts src/propai/packaging.test.ts`
    - Result: passed (`2` test files, `47` tests).
  - Command: `pnpm exec oxfmt --check README.md src/propaiclaw-entry.ts src/propai/mapper.ts src/propai/mapper.test.ts`
    - Result: passed (all matched files correctly formatted).

Stage 1 progress update (2026-03-02, pass 2)

- done
  - Ran a wider Stage 1.1 leak pass across Propaiclaw-facing command/help/error surfaces in `README.md`, `src/propaiclaw-entry.ts`, and `src/propai/*`.
  - No additional user-facing `openclaw` leaks found in Propaiclaw command flows beyond first-slice fixes.
  - Added focused entrypoint message helpers and regression tests for:
    - debug runtime line
    - runtime launch failure line
    - runtime signal-exit line
    - config-invalid hint line
  - Wrapper execution path remains unchanged (still resolves and runs `openclaw.mjs`).

- pending
  - Any future Stage 1 text leaks outside currently scanned Propaiclaw surfaces (none identified in this pass).
  - Stage 2+ migration and identity work remains pending by plan.

- verification
  - Command: `pnpm exec vitest run src/propai/mapper.test.ts src/propai/packaging.test.ts src/propaiclaw-entry.messages.test.ts`
    - Result: passed (`3` test files, `51` tests).
  - Command: `pnpm exec vitest run src/propai/mapper.test.ts src/propai/packaging.test.ts`
    - Result: passed (`2` test files, `47` tests).
  - Command: `pnpm exec oxfmt --check README.md src/propaiclaw-entry.ts src/propai/mapper.ts src/propai/mapper.test.ts`
    - Result: passed (all matched files correctly formatted).
  - Command: `pnpm exec oxfmt --check README.md src/propaiclaw-entry.ts src/propai/mapper.ts src/propai/mapper.test.ts src/propaiclaw-entry.messages.ts src/propaiclaw-entry.messages.test.ts`
    - Result: passed (all matched files correctly formatted).

Stage 1 progress update (2026-03-02, pass 3)

- done
  - Completed an additional Stage 1 doc slice for Propaiclaw-facing skill guidance:
    - `docs/tools/skills.md`
  - Reworded user-facing brand references from OpenClaw to Propaiclaw in that document while preserving technical/runtime identifiers (for example `openclaw.json`, `metadata.openclaw`, and `~/.openclaw` paths).
  - No runtime behavior changes.

- pending
  - One remaining mixed-brand doc string was detected in `docs/channels/index.md` (`Propaiclaw/OpenClaw`) during the broader scan.
  - Runtime/internal compatibility identifiers containing `OPENCLAW_*` remain intentionally unchanged for Stage 2 compatibility policy.

- verification
  - Command: `pnpm exec vitest run src/propai/mapper.test.ts src/propai/packaging.test.ts src/propaiclaw-entry.messages.test.ts`
    - Result: passed (`3` test files, `51` tests).
  - Command: `pnpm exec oxfmt --check docs/tools/skills.md README.md src/propaiclaw-entry.ts src/propai/mapper.ts src/propai/mapper.test.ts src/propaiclaw-entry.messages.ts src/propaiclaw-entry.messages.test.ts`
    - Result: passed (all matched files correctly formatted).

Stage 1 progress update (2026-03-02, pass 4)

- done
  - Removed remaining mixed-brand summary text in `docs/channels/index.md`:
    - `Propaiclaw/OpenClaw` -> `Propaiclaw`

- pending
  - Runtime/internal compatibility identifiers with `OPENCLAW_*` and `.openclaw` paths remain intentionally unchanged for Stage 2 compatibility policy.

- verification
  - Command: `pnpm exec oxfmt --check docs/channels/index.md`
    - Result: passed (file correctly formatted).

Stage 1 progress update (2026-03-02, pass 5, closeout)

- done
  - Completed an additional repo-wide Propaiclaw-facing brand scan for mixed `propai`/`propaiclaw` + `openclaw` strings.
  - No additional user-facing Stage 1 brand leaks were found in Propaiclaw command/help/error surfaces; remaining `openclaw` mentions are technical compatibility identifiers or internal wrapper references.
  - Stage 1 acceptance criteria remain satisfied:
    - Help/examples/errors in Propaiclaw flows do not leak `openclaw` user-facing text.
    - Wrapper execution path remains intact.
    - Regression tests remain green.

- pending
  - Stage 2+ bridge and migration work.

- verification
  - Command: `pnpm exec vitest run src/propai/mapper.test.ts src/propai/packaging.test.ts src/propaiclaw-entry.messages.test.ts`
    - Result: passed (`3` test files, `51` tests).
  - Command: `pnpm exec oxfmt --check README.md docs/channels/index.md docs/tools/skills.md src/propaiclaw-entry.ts src/propai/mapper.ts src/propai/mapper.test.ts src/propaiclaw-entry.messages.ts src/propaiclaw-entry.messages.test.ts`
    - Result: passed (all matched files correctly formatted).
  - Command: `pnpm test:install:smoke`
    - Result: failed in local environment (Docker unavailable: `docker` command not found in WSL distro).

### Stage 2 - Config and state namespace bridge

1. Introduce Propaiclaw canonical paths/envs

- Add canonical Propaiclaw config/state paths for new installs.
- Add Propaiclaw env aliases while continuing to honor legacy `OPENCLAW_*`.

2. Dual-read, single-write migration strategy

- Read both legacy and new locations.
- Write canonical Propaiclaw locations after migration.

3. Migration tooling

- Add explicit migration command flow (dry-run + apply).
- Emit clear per-tenant migration report.

Stage 2 progress update (2026-03-02, pass 1)

- done
  - Added Propaiclaw canonical env aliases with dual-read behavior while preserving legacy compatibility:
    - Home/state/config overrides now accept `PROPAICLAW_*` and legacy `OPENCLAW_*`.
    - Propaiclaw mode (`PROPAICLAW_MODE` / `OPENCLAW_PROPAICLAW_MODE`) now resolves canonical defaults under:
      - state dir: `~/.propaiclaw`
      - config file: `propaiclaw.json`
  - Added compatibility bridging in Propaiclaw wrapper child env:
    - Mirrors Propaiclaw and OpenClaw path/profile/port/channel envs to keep legacy code paths functional.
  - Added/updated tests for:
    - path resolution (`src/config/paths.test.ts`)
    - home dir aliasing (`src/infra/home-dir.test.ts`)
    - CLI profile env population (`src/cli/profile.test.ts`)
    - default realtor workspace resolution in Propaiclaw mode (`src/propai/realtor-workspace.test.ts`)
    - channel allowlist env precedence (`src/channels/registry.helpers.test.ts`)

- pending
  - Stage 2.2 dual-read/single-write migration write-path behavior.
  - Stage 2.3 explicit migration tooling and reporting.

- verification
  - Command: `pnpm exec vitest run src/config/paths.test.ts src/infra/home-dir.test.ts src/cli/profile.test.ts src/propai/realtor-workspace.test.ts src/channels/registry.helpers.test.ts`
    - Result: passed (`5` test files, `56` tests).
  - Command: `pnpm exec vitest run src/propai/mapper.test.ts src/propai/packaging.test.ts src/propaiclaw-entry.messages.test.ts src/config/paths.test.ts src/infra/home-dir.test.ts src/cli/profile.test.ts src/propai/realtor-workspace.test.ts src/channels/registry.helpers.test.ts`
    - Result: passed (`8` test files, `107` tests).
  - Command: `pnpm exec oxfmt --check src/config/paths.ts src/infra/home-dir.ts src/utils.ts src/cli/profile.ts src/propai/realtor-workspace.ts src/propaiclaw-entry.ts src/channels/registry.ts src/config/paths.test.ts src/infra/home-dir.test.ts src/cli/profile.test.ts src/propai/realtor-workspace.test.ts src/channels/registry.helpers.test.ts`
    - Result: passed (all matched files correctly formatted).

Stage 2 progress update (2026-03-02, pass 2)

- done
  - Implemented dual-read/single-write behavior for config I/O in Propaiclaw mode:
    - Config reads still resolve existing legacy/canonical candidates.
    - Config writes now target canonical path resolution by default (while preserving explicit config-path overrides).
  - Added canonical write-state helper path resolution for migration-safe writes.
  - Added regression coverage proving:
    - legacy config remains readable in Propaiclaw mode,
    - write operations persist to canonical `~/.propaiclaw/propaiclaw.json`,
    - legacy source config remains unchanged after canonical write.

- pending
  - Stage 2.3 explicit migration tooling and reporting.

- verification
  - Command: `pnpm exec vitest run src/config/paths.test.ts src/config/io.compat.test.ts src/config/io.write-config.test.ts`
    - Result: passed (`3` test files, `38` tests).
  - Command: `pnpm exec vitest run src/propai/mapper.test.ts src/propai/packaging.test.ts src/propaiclaw-entry.messages.test.ts src/config/paths.test.ts src/config/io.compat.test.ts src/config/io.write-config.test.ts src/infra/home-dir.test.ts src/cli/profile.test.ts src/propai/realtor-workspace.test.ts src/channels/registry.helpers.test.ts`
    - Result: passed (`10` test files, `130` tests).
  - Command: `pnpm exec oxfmt --check README.md src/propaiclaw-entry.ts src/propai/mapper.ts src/propai/mapper.test.ts src/config/paths.ts src/config/paths.test.ts src/config/io.ts src/config/io.compat.test.ts src/infra/home-dir.ts src/infra/home-dir.test.ts src/cli/profile.ts src/cli/profile.test.ts src/propai/realtor-workspace.ts src/propai/realtor-workspace.test.ts src/channels/registry.ts src/channels/registry.helpers.test.ts HANDOFF.md`
    - Result: passed (all matched files correctly formatted).

Stage 2 progress update (2026-03-02, pass 3)

- done
  - Added explicit state migration command flow:
    - `openclaw migrate-state --dry-run` (default behavior if no flags are passed)
    - `openclaw migrate-state --apply`
  - Added per-tenant migration reporting in command output (target agent/main key, state/oauth paths, and planned/applied changes).
  - Wired command into CLI registry and maintenance registration.
  - Updated command-path migration guard so `migrate-state` does not trigger implicit pre-migration via config guard.
  - Added regression tests for:
    - migrate-state command behavior (`src/commands/migrate-state.test.ts`)
    - maintenance command wiring (`src/cli/program/register.maintenance.test.ts`)
    - argv migration-path guard (`src/cli/argv.test.ts`)

- pending
  - Optional enhancement: machine-readable (`--json`) migration report output.
  - Stage 3+ work remains pending by plan.

- verification
  - Command: `pnpm exec vitest run src/commands/migrate-state.test.ts src/cli/program/register.maintenance.test.ts src/cli/argv.test.ts src/config/paths.test.ts src/config/io.compat.test.ts src/config/io.write-config.test.ts`
    - Result: passed (`6` test files, `83` tests).
  - Command: `pnpm exec vitest run src/propai/mapper.test.ts src/propai/packaging.test.ts src/propaiclaw-entry.messages.test.ts src/config/paths.test.ts src/config/io.compat.test.ts src/config/io.write-config.test.ts src/infra/home-dir.test.ts src/cli/profile.test.ts src/propai/realtor-workspace.test.ts src/channels/registry.helpers.test.ts src/commands/migrate-state.test.ts src/cli/program/register.maintenance.test.ts src/cli/argv.test.ts`
    - Result: passed (`13` test files, `175` tests).
  - Command: `pnpm exec oxfmt --check src/commands/migrate-state.ts src/commands/migrate-state.test.ts src/cli/program/register.maintenance.ts src/cli/program/register.maintenance.test.ts src/cli/program/command-registry.ts src/cli/argv.ts src/cli/argv.test.ts src/config/paths.ts src/config/paths.test.ts src/config/io.ts src/config/io.compat.test.ts scripts/test-install-sh-docker.sh HANDOFF.md`
    - Result: passed (all matched files correctly formatted).

### Stage 3 - Service identity bridge (daemon/runtime)

1. Add Propaiclaw service names and labels

- New service labels/names for launchd/systemd/windows task paths.

2. Backward service compatibility

- Status/restart/doctor flows detect and handle both legacy and new service identities.

3. Add cross-platform tests

- Service naming, detection, and restart behavior for profile and default modes.

Stage 3 progress update (2026-03-02, pass 1)

- done
  - CI polish applied for install smoke PR stability:
    - `.github/workflows/install-smoke.yml` now uses `cancel-in-progress: false` to avoid auto-cancelling in-flight smoke runs on new PR commits.

- pending
  - Stage 3 service identity bridge implementation and cross-platform service tests.

Stage 3 progress update (2026-03-02, pass 2)

- done
  - Added local install-smoke Docker preflight in `scripts/test-install-sh-docker.sh`:
    - Fails fast with clear actionable messages when Docker CLI/daemon are unavailable.
    - Prevents opaque smoke failures from long-running build steps when Docker is down.

- pending
  - Stage 3 service identity bridge implementation and cross-platform service tests.

- verification
  - Command: `bash scripts/test-install-sh-docker.sh`
    - Result: fails fast in current environment with preflight message:
      - `ERROR: docker daemon is not reachable.`
      - `Start Docker Desktop (or docker engine) and retry.`

Stage 3 progress update (2026-03-02, pass 3)

- done
  - Long-term smoke workflow split implemented:
    - Local optional smoke: `pnpm test:install:smoke` -> `test:install:smoke:local` (skips cleanly when Docker is unavailable).
    - Strict smoke: `pnpm test:install:smoke:strict` (required Docker; fails fast on missing/unreachable daemon).
  - CI workflow hardened as source-of-truth:
    - `install-smoke.yml` now includes nightly schedule trigger.
    - `workflow_dispatch` now supports `full` input for full installer smoke.
    - CI job now always uses strict smoke command (`pnpm test:install:smoke:strict`).
    - Nightly/manual-full runs enable CLI + previous-version smoke checks (heavier coverage).
  - Added remote smoke control helpers:
    - `pnpm test:install:smoke:ci:dispatch` (dispatch install-smoke workflow).
    - `pnpm test:install:smoke:ci:status` (list recent install-smoke runs).

- pending
  - Optional future CI enhancement: split nightly smoke into a larger explicit matrix job.
  - Branch protection settings are repository-admin configuration (outside codebase).

- verification
  - Command: `pnpm exec vitest run src/cli/program/command-registry.test.ts src/cli/program/register.maintenance.test.ts src/cli/argv.test.ts src/commands/migrate-state.test.ts`
    - Result: passed (`4` test files, `54` tests).
  - Command: `pnpm exec vitest run src/propai/mapper.test.ts src/propai/packaging.test.ts src/propaiclaw-entry.messages.test.ts src/config/paths.test.ts src/config/io.compat.test.ts src/config/io.write-config.test.ts src/infra/home-dir.test.ts src/cli/profile.test.ts src/propai/realtor-workspace.test.ts src/channels/registry.helpers.test.ts src/commands/migrate-state.test.ts src/cli/program/register.maintenance.test.ts src/cli/program/command-registry.test.ts src/cli/argv.test.ts`
    - Result: passed (`14` test files, `184` tests).
  - Command: `bash scripts/test-install-sh-local.sh`
    - Result: passed with expected local-skip message when Docker daemon unavailable.
  - Command: `bash scripts/test-install-sh-docker.sh`
    - Result: failed fast as expected with strict preflight message when Docker daemon unavailable.
  - Command: `node scripts/install-smoke-ci.mjs status --repo vishalgojha/propaiclaw --limit 3`
    - Result: passed; listed recent install-smoke workflow runs.
  - Command: `pnpm exec oxfmt --check src/cli/program/command-registry.ts src/cli/program/command-registry.test.ts src/cli/program/register.maintenance.ts src/cli/program/register.maintenance.test.ts src/cli/argv.ts src/cli/argv.test.ts src/commands/migrate-state.ts src/commands/migrate-state.test.ts scripts/install-smoke-ci.mjs package.json HANDOFF.md`
    - Result: passed (all matched files correctly formatted).

### Stage 4 - External protocol compatibility layer

1. Header/token aliases

- Accept both legacy and new auth headers.
- Prefer Propaiclaw naming in docs/output.

2. Deep-link and canvas aliasing

- Support both legacy and Propaiclaw URI schemes during transition.

3. Transport tests

- Verify webhooks/hooks/control paths across both naming conventions.

Stage 4 progress update (2026-03-02, pass 1)

- done
  - Added gateway header aliases while preserving legacy compatibility:
    - Hook auth accepts `x-propaiclaw-token` and legacy `x-openclaw-token` (`Authorization: Bearer` remains preferred).
    - OpenAI/OpenResponses routing accepts `x-propaiclaw-agent-id` / `x-propaiclaw-session-key` alongside legacy headers.
    - Agent model routing now accepts `propaiclaw:<agentId>` alongside `openclaw:<agentId>` and `agent:<agentId>`.
    - `/tools/invoke` now accepts `x-propaiclaw-message-channel`, `x-propaiclaw-account-id`, `x-propaiclaw-message-to`, and `x-propaiclaw-thread-id` with legacy fallback.
  - Updated webhook query-token rejection text to prefer `X-Propaiclaw-Token` while retaining legacy `X-OpenClaw-Token`.
  - Updated Stage 4 docs to prefer Propaiclaw naming for headers/examples while documenting legacy aliases:
    - `docs/automation/webhook.md`
    - `docs/gateway/openai-http-api.md`
    - `docs/gateway/openresponses-http-api.md`
    - `docs/gateway/configuration-reference.md`
  - Added targeted regression coverage for hook token header alias precedence:
    - `src/gateway/hooks.header-alias.test.ts`

- pending
  - Stage 4.2 deep-link and canvas URI/path aliasing.
  - Stage 4.3 broader transport coverage across remaining compatibility surfaces.
  - Optional docs follow-up: non-English mirror pages for propaiclaw-first header examples.

- verification
  - Command: `pnpm exec vitest run src/gateway/hooks.header-alias.test.ts src/gateway/openai-http.test.ts src/gateway/openresponses-http.test.ts src/gateway/server.hooks.test.ts src/gateway/tools-invoke-http.test.ts`
    - Result: passed (`5` test files, `32` tests).
  - Command: `pnpm exec oxfmt --check docs/automation/webhook.md docs/gateway/configuration-reference.md docs/gateway/openai-http-api.md docs/gateway/openresponses-http-api.md src/gateway/hooks.ts src/gateway/http-utils.ts src/gateway/hooks.header-alias.test.ts src/gateway/openai-http.test.ts src/gateway/openresponses-http.test.ts src/gateway/server-http.ts src/gateway/server.hooks.test.ts src/gateway/tools-invoke-http.ts src/gateway/tools-invoke-http.test.ts`
    - Result: passed (all matched files correctly formatted).

Stage 4 progress update (2026-03-02, pass 2)

- done
  - Added deep-link dual-scheme compatibility for transition:
    - `DeepLinkParser` now accepts both `openclaw://` and `propaiclaw://`.
    - iOS and macOS canvas WebView delegates now intercept both schemes.
    - iOS and macOS app URL scheme registration now includes `propaiclaw` alongside `openclaw`.
  - Added canvas path alias compatibility while keeping canonical output unchanged:
    - A2UI/canvas/ws request matching now accepts both `__openclaw__` and `__propaiclaw__` path prefixes.
    - Scoped capability URL normalization now accepts both `/__openclaw__/cap/...` and `/__propaiclaw__/cap/...`.
    - Scoped URL generation remains canonical on `/__openclaw__/cap/...` to avoid changing existing output contracts.
  - Added regression coverage for Stage 4.2 aliasing:
    - `src/gateway/canvas-capability.alias.test.ts` (new).
    - Extended `src/canvas-host/server.test.ts` and `src/gateway/server.canvas-auth.test.ts` for `propaiclaw` alias routes.
    - Added `propaiclaw://` deep-link parsing tests in iOS/OpenClawKit test suites.

- pending
  - Stage 4.3 broader transport coverage across remaining compatibility surfaces.
  - Optional docs follow-up: non-English mirror pages for propaiclaw-first header examples.

- verification
  - Command: `pnpm exec vitest run src/canvas-host/server.test.ts src/gateway/server.canvas-auth.test.ts src/gateway/canvas-capability.alias.test.ts src/gateway/server-methods/nodes.canvas-capability-refresh.test.ts`
    - Result: passed (`4` test files, `16` tests).
  - Command: `pnpm exec oxfmt --check src/canvas-host/a2ui.ts src/canvas-host/server.ts src/canvas-host/server.test.ts src/gateway/canvas-capability.ts src/gateway/canvas-capability.alias.test.ts src/gateway/server-http.ts src/gateway/server.canvas-auth.test.ts HANDOFF.md`
    - Result: passed (all matched files correctly formatted).
  - Command: `swift --version`
    - Result: failed (`swift` is not installed in this Windows environment), so Swift/iOS/macOS tests were not run here.

Stage 4 progress update (2026-03-02, pass 3)

- done
  - Expanded external transport compatibility coverage across remaining HTTP surfaces:
    - OpenAI and OpenResponses HTTP tests now cover legacy `x-openclaw-session-key`, preferred `x-propaiclaw-session-key`, and precedence when both are present.
    - Hooks HTTP integration test now verifies token-header precedence when both `x-propaiclaw-token` and `x-openclaw-token` are sent.
    - `/tools/invoke` tests now cover `x-openclaw-message-channel` / `x-openclaw-account-id` legacy behavior and preferred `x-propaiclaw-*` precedence when both aliases are present.
  - Updated gateway transport docs to reflect propaiclaw-first compatibility on remaining surfaces:
    - `docs/gateway/tools-invoke-http-api.md` now documents preferred `x-propaiclaw-*` headers plus legacy aliases.
    - Canvas transport docs now list preferred `__propaiclaw__` paths with legacy `__openclaw__` aliases in:
      - `docs/gateway/network-model.md`
      - `docs/gateway/security/index.md`

- pending
  - Optional docs follow-up: non-English mirror pages for propaiclaw-first transport examples.

- verification
  - Command: `pnpm exec vitest run src/gateway/openai-http.test.ts src/gateway/openresponses-http.test.ts src/gateway/tools-invoke-http.test.ts src/gateway/server.hooks.test.ts`
    - Result: passed (`4` test files, `31` tests).
  - Command: `pnpm exec oxfmt --check src/gateway/openai-http.test.ts src/gateway/openresponses-http.test.ts src/gateway/tools-invoke-http.test.ts src/gateway/server.hooks.test.ts docs/gateway/tools-invoke-http-api.md docs/gateway/configuration-reference.md docs/gateway/network-model.md docs/gateway/security/index.md HANDOFF.md`
    - Result: passed (all matched files correctly formatted).

### Stage 5 - Plugin SDK and extension contract bridge

1. SDK alias strategy

- Provide Propaiclaw SDK import path while preserving existing `openclaw/plugin-sdk` compatibility.

2. Extension loading checks

- Ensure bundled and external plugins load under both import namespaces.

3. Migration notes for plugin authors

- Publish concise compatibility guidance and timeline.

Stage 5 progress update (2026-03-03, pass 1)

- done
  - Added plugin loader SDK alias bridging for both namespaces:
    - `openclaw/plugin-sdk` and `propaiclaw/plugin-sdk`
    - `openclaw/plugin-sdk/account-id` and `propaiclaw/plugin-sdk/account-id`
  - Added extension loading regression coverage in `src/plugins/loader.test.ts`:
    - verifies alias map generation for legacy + Propaiclaw SDK paths
    - verifies plugins importing SDK helpers under both namespaces load successfully
  - Added plugin-author migration guidance and timeline in `docs/refactor/plugin-sdk.md`:
    - prefer `propaiclaw/plugin-sdk*` for new work
    - retain `openclaw/plugin-sdk*` compatibility through Stage 8 transition window

- pending
  - Optional non-English mirror update for Stage 5 migration guidance (`docs/zh-CN/refactor/plugin-sdk.md`).
  - Stage 6+ work remains pending by plan.

- verification
  - Command: `pnpm exec vitest run src/plugins/loader.test.ts src/plugin-sdk/index.test.ts`
    - Result: passed (`2` test files, `26` tests).
  - Command: `pnpm exec oxfmt --check src/plugins/loader.ts src/plugins/loader.test.ts docs/refactor/plugin-sdk.md HANDOFF.md`
    - Result: passed (all matched files correctly formatted).

Stage 5 progress update (2026-03-03, pass 2)

- done
  - Mirrored Stage 5 import-namespace migration guidance into plugin author docs:
    - `docs/tools/plugin.md`
    - `docs/zh-CN/tools/plugin.md`
  - Updated Chinese plugin hook example import to preferred `propaiclaw/plugin-sdk` while documenting legacy compatibility aliases.

- pending
  - Optional mirror of Stage 5 migration timeline in `docs/zh-CN/refactor/plugin-sdk.md`.
  - Stage 6+ work remains pending by plan.

- verification
  - Command: `pnpm exec oxfmt --check docs/tools/plugin.md docs/zh-CN/tools/plugin.md`
    - Result: passed (all matched files correctly formatted).

Stage 6 progress update (2026-03-03, pass 1)

- done
  - Completed Stage 6.1 command-path audit for high-frequency realtor commands in Propaiclaw mapper/help surfaces:
    - `start`
    - `sync`
    - `groups allow`
    - `lead follow-up`
    - `schedule daily`
  - Confirmed these remain minimal-path wrappers (defaults injected where expected, no extra required flags beyond command intent).

- pending
  - Stage 6.2 Agent Tasks polish (tenant presets + safer defaults + i18n coverage).
  - Stage 6.3 UI stability validation under high event throughput.

- verification
  - Command: `pnpm exec vitest run src/propai/mapper.test.ts`
    - Result: passed (`1` test file, `44` tests).

Stage 6 progress update (2026-03-03, pass 2)

- done
  - Completed Stage 6.2 i18n coverage for newly added Agent Task templates/labels in non-English UI locales:
    - `ui/src/i18n/locales/de.ts`
    - `ui/src/i18n/locales/pt-BR.ts`
    - `ui/src/i18n/locales/zh-CN.ts`
    - `ui/src/i18n/locales/zh-TW.ts`
  - Added `cron.templates.*` translation keys for locales that previously fell back to English.
  - Updated core "Agent Tasks" label strings in those locales for tabs/overview/chat session toggles.

- pending
  - Stage 6.3 UI stability validation under high event throughput.

- verification
  - Command: `pnpm --dir ui test -- src/ui/views/cron.test.ts`
    - Result: passed (`1` test file, `28` tests).
  - Command: `pnpm exec oxfmt --check ui/src/i18n/locales/de.ts ui/src/i18n/locales/pt-BR.ts ui/src/i18n/locales/zh-CN.ts ui/src/i18n/locales/zh-TW.ts HANDOFF.md docs/tools/plugin.md docs/zh-CN/tools/plugin.md`
    - Result: passed (all matched files correctly formatted).

Stage 6 progress update (2026-03-03, pass 3)

- done
  - Completed Stage 6.3 UI stability validation pass for Agent Tasks surfaces under gateway event updates.
  - Re-ran focused UI suites covering Agent Tasks list/history rendering and app-gateway event handling path.
  - Stage 6 (6.1 + 6.2 + 6.3) is complete for this slice.

- pending
  - Stage 7 tenant migration rollout remains pending by plan.

- verification
  - Command: `pnpm --dir ui test -- src/ui/views/cron.test.ts src/ui/app-gateway.node.test.ts`
    - Result: passed (`2` test files, `35` tests).

### Stage 6 - Realtor UX hardening and command simplification

1. Simplify high-frequency realtor actions

- Keep `groups allow`, `lead follow-up`, `schedule daily`, `sync`, `start` as minimal-path commands.

2. Agent Tasks polish

- Add tenant presets and safer defaults for account/agent/channel.
- Finish i18n coverage for newly added templates and labels.

3. Stability validation

- Re-test UI under high event throughput to confirm no open/close flicker recurrence.

### Stage 7 - Tenant migration rollout

1. Pilot rollout

- Migrate a small set of realtor tenants first with audit logs enabled.

2. Full rollout

- Expand migration in batches after pilot pass criteria.

3. Rollback path

- Keep reversible mapping for config/service identity in case of live failures.

Stage 7 progress update (2026-03-03, pass 1)

- done
  - Added pilot-rollout support to explicit migration command:
    - `openclaw migrate-state --json` now emits a machine-readable migration report.
    - `openclaw migrate-state --audit-log <path>` appends JSONL audit records for each run.
    - `openclaw migrate-state --rollout-tag <tag>` annotates audit records for pilot/batch tracking.
  - Kept existing runtime behavior unchanged:
    - default remains dry-run,
    - apply path remains wrapper over existing migration internals.
  - Added regression coverage for:
    - JSON dry-run report output,
    - audit log write behavior,
    - maintenance CLI flag passthrough for new options.

- pending
  - Stage 7.2 full rollout batching policy and operator runbook.
  - Stage 7.3 explicit rollback runbook with documented validation checkpoints.

- verification
  - Command: `pnpm exec vitest run src/commands/migrate-state.test.ts src/cli/program/register.maintenance.test.ts`
    - Result: passed (`2` test files, `15` tests).
  - Command: `pnpm exec oxfmt --check src/commands/migrate-state.ts src/commands/migrate-state.test.ts src/cli/program/register.maintenance.ts src/cli/program/register.maintenance.test.ts`
    - Result: passed (all matched files correctly formatted).

Stage 7 progress update (2026-03-03, pass 2)

- done
  - Added strict rollout gate support for full-batch migration:
    - `openclaw migrate-state --fail-on-warnings` now exits non-zero when apply produces warnings.
  - Added Stage 7.2 operator runbook and batching policy:
    - `docs/refactor/state-migration-rollout.md`
  - Added regression coverage for:
    - strict warning gate behavior in migrate-state apply mode,
    - maintenance CLI passthrough for `--fail-on-warnings`.

- pending
  - Stage 7.3 explicit rollback runbook with documented validation checkpoints.

- verification
  - Command: `pnpm exec vitest run src/commands/migrate-state.test.ts src/cli/program/register.maintenance.test.ts`
    - Result: passed (`2` test files, `16` tests).
  - Command: `pnpm exec oxfmt --check src/commands/migrate-state.ts src/commands/migrate-state.test.ts src/cli/program/register.maintenance.ts src/cli/program/register.maintenance.test.ts docs/refactor/state-migration-rollout.md HANDOFF.md`
    - Result: passed (all matched files correctly formatted).

Stage 7 progress update (2026-03-03, pass 3)

- done
  - Added explicit rollback runbook with validation checkpoints:
    - `docs/refactor/state-migration-rollback.md`
  - Linked rollback guidance from rollout runbook:
    - `docs/refactor/state-migration-rollout.md`
  - Stage 7 rollout path is now fully documented across pilot, batch gating, and rollback operations.

- pending
  - Stage 8 cutover/deprecation work remains pending by plan.

- verification
  - Command: `pnpm exec oxfmt --check docs/refactor/state-migration-rollout.md docs/refactor/state-migration-rollback.md HANDOFF.md`
    - Result: passed (all matched files correctly formatted).

### Stage 8 - Cutover and deprecation

1. Default to Propaiclaw runtime identity for new installs

- Legacy names remain accepted for a deprecation window.

2. Deprecation messaging

- Emit warnings for legacy paths/flags with clear migration guidance.

3. Final cleanup

- Remove legacy-only code after deprecation window and stability period.

Stage 8 progress update (2026-03-03, pass 1)

- done
  - Implemented Propaiclaw-first runtime identity bootstrap in wrapper entrypoint:
    - `src/propaiclaw-entry.ts` now applies canonical Propaiclaw env aliases to the current process at startup (not only child runtime spawn).
    - Local Propaiclaw commands now resolve config/state with Propaiclaw mode defaults for new installs while preserving legacy read compatibility.
  - Added legacy env deprecation messaging for Propaiclaw flows:
    - warns when `OPENCLAW_*` env aliases are used without corresponding `PROPAICLAW_*` canonical vars.
  - Added focused tests for runtime env bootstrap and deprecation warning behavior:
    - `src/propaiclaw-entry.env.test.ts`

- pending
  - Stage 8.2 broader deprecation warnings for legacy path/flag surfaces outside Propaiclaw entry wrapper.
  - Stage 8.3 final legacy-only cleanup after deprecation window.

- verification
  - Command: `pnpm exec vitest run src/propaiclaw-entry.env.test.ts src/propaiclaw-entry.messages.test.ts src/propai/mapper.test.ts`
    - Result: passed (`3` test files, `54` tests).
  - Command: `pnpm exec oxfmt --check src/propaiclaw-entry.ts src/propaiclaw-entry.env.ts src/propaiclaw-entry.env.test.ts src/propaiclaw-entry.messages.ts src/propaiclaw-entry.messages.test.ts src/propai/mapper.ts src/propai/mapper.test.ts`
    - Result: passed (all matched files correctly formatted).

Stage 8 progress update (2026-03-03, pass 2)

- done
  - Added broader Stage 8.2 deprecation messaging outside the Propaiclaw wrapper entrypoint:
    - `src/commands/migrate-state.ts` now emits explicit deprecation warnings when legacy `OPENCLAW_*` path/profile env aliases are used without canonical `PROPAICLAW_*` counterparts.
    - `migrate-state --json` now includes these deprecation warnings in the machine-readable audit payload (`deprecationWarnings`).
    - State-dir override skip reason now distinguishes canonical vs legacy aliases and guides users to prefer `PROPAICLAW_STATE_DIR`.
  - Added regression tests for legacy-env warning behavior:
    - `src/commands/migrate-state.test.ts`

- pending
  - Stage 8.3 final legacy-only cleanup after deprecation window.

- verification
  - Command: `pnpm exec vitest run src/commands/migrate-state.test.ts src/propaiclaw-entry.env.test.ts src/propaiclaw-entry.messages.test.ts src/propai/mapper.test.ts`
    - Result: passed (`4` test files, `62` tests).
  - Command: `pnpm exec oxfmt --check src/commands/migrate-state.ts src/commands/migrate-state.test.ts`
    - Result: passed (all matched files correctly formatted).

Stage 8 progress update (2026-03-03, pass 3)

- done
  - Completed first Stage 8.3 legacy-only cleanup slice for path/env compatibility:
    - Removed `CLAWDBOT_*` path env aliases from core config path resolution in `src/config/paths.ts`:
      - `CLAWDBOT_STATE_DIR`
      - `CLAWDBOT_CONFIG_PATH`
      - `CLAWDBOT_GATEWAY_PORT`
    - Removed `CLAWDBOT_STATE_DIR` handling from `migrate-state` state-dir override planning in `src/commands/migrate-state.ts`.
  - Updated regression coverage for removed aliases:
    - `src/config/io.compat.test.ts` now asserts `CLAWDBOT_CONFIG_PATH` is ignored.
    - `src/config/paths.test.ts` now asserts `CLAWDBOT_STATE_DIR` and `CLAWDBOT_GATEWAY_PORT` are ignored.

- pending
  - Remaining Stage 8.3 cleanup slices for non-path legacy aliases/usages (`CLAWDBOT_*` outside path resolution and eventual `OPENCLAW_*` retirement plan).

- verification
  - Command: `pnpm exec vitest run src/config/paths.test.ts src/config/io.compat.test.ts src/commands/migrate-state.test.ts src/propaiclaw-entry.env.test.ts src/propaiclaw-entry.messages.test.ts src/propai/mapper.test.ts`
    - Result: passed (`6` test files, `87` tests).
  - Command: `pnpm exec oxfmt --check src/config/paths.ts src/config/paths.test.ts src/config/io.compat.test.ts src/commands/migrate-state.ts`
    - Result: passed (all matched files correctly formatted).

Stage 8 progress update (2026-03-03, pass 4)

- done
  - Completed second Stage 8.3 legacy-only cleanup slice for gateway env aliases:
    - Removed `CLAWDBOT_GATEWAY_TOKEN` / `CLAWDBOT_GATEWAY_PASSWORD` fallback from:
      - `src/gateway/credentials.ts`
      - `src/browser/extension-relay-auth.ts`
      - `src/pairing/setup-code.ts`
      - `src/cli/daemon-cli/install.ts`
      - `src/commands/doctor-gateway-services.ts`
  - Updated related regression tests to enforce that these aliases are ignored:
    - `src/gateway/credentials.test.ts`
    - `src/gateway/credential-precedence.parity.test.ts`
    - `src/agents/tools/gateway.test.ts`
    - `src/pairing/setup-code.test.ts`
    - `src/cli/qr-cli.test.ts`
    - `src/cli/daemon-cli/lifecycle-core.test.ts`

- pending
  - Remaining Stage 8.3 cleanup slices for non-gateway `CLAWDBOT_*` aliases/usages (`CLAWDBOT_SHELL`, `CLAWDBOT_MDNS_HOSTNAME`, `CLAWDBOT_SHOW_SECRETS`, and helper-only legacy env handling).
  - Eventual staged retirement plan for `OPENCLAW_*` compatibility aliases.

- verification
  - Command: `pnpm exec vitest run src/gateway/credentials.test.ts src/gateway/credential-precedence.parity.test.ts src/pairing/setup-code.test.ts src/cli/qr-cli.test.ts src/cli/daemon-cli/lifecycle-core.test.ts src/agents/tools/gateway.test.ts src/browser/extension-relay-auth.test.ts src/commands/doctor-gateway-services.test.ts src/commands/migrate-state.test.ts src/config/paths.test.ts`
    - Result: passed (`10` test files, `80` tests).
  - Command: `pnpm exec oxfmt --check src/gateway/credentials.ts src/browser/extension-relay-auth.ts src/pairing/setup-code.ts src/cli/daemon-cli/install.ts src/commands/doctor-gateway-services.ts src/gateway/credentials.test.ts src/gateway/credential-precedence.parity.test.ts src/agents/tools/gateway.test.ts src/pairing/setup-code.test.ts src/cli/qr-cli.test.ts src/cli/daemon-cli/lifecycle-core.test.ts`
    - Result: passed (all matched files correctly formatted).

Stage 8 progress update (2026-03-03, pass 5)

- done
  - Completed third Stage 8.3 cleanup slice for remaining non-gateway and helper-only `CLAWDBOT_*` references:
    - `src/agents/shell-utils.ts`: switched shell override from `CLAWDBOT_SHELL` to `OPENCLAW_SHELL`.
    - `src/infra/bonjour.ts`: removed `CLAWDBOT_MDNS_HOSTNAME` fallback.
    - `src/commands/status.scan.ts`: replaced `CLAWDBOT_SHOW_SECRETS` with `OPENCLAW_SHOW_SECRETS`.
    - `src/test-helpers/state-dir-env.ts`: removed `CLAWDBOT_STATE_DIR` snapshot/cleanup handling.
    - `src/commands/doctor-platform-notes.ts`: removed legacy `CLAWDBOT_GATEWAY_*` launchctl checks and retired legacy env scan behavior.
  - Added/updated regression tests for this slice:
    - new `src/agents/shell-utils.test.ts` for `OPENCLAW_SHELL` override behavior.
    - updated:
      - `src/test-helpers/state-dir-env.test.ts`
      - `src/commands/doctor-platform-notes.launchctl-env-overrides.test.ts`

- pending
  - Stage 8.3 follow-up: normalize/reduce legacy-focused test fixtures that still reference `CLAWDBOT_*` only to assert ignored behavior.
  - Eventual staged retirement plan for `OPENCLAW_*` compatibility aliases.

- verification
  - Command: `pnpm exec vitest run src/agents/shell-utils.test.ts src/test-helpers/state-dir-env.test.ts src/commands/doctor-platform-notes.launchctl-env-overrides.test.ts src/commands/status.test.ts src/infra/bonjour.test.ts src/commands/migrate-state.test.ts src/config/paths.test.ts`
    - Result: passed (`7` test files, `57` tests).
  - Command: `pnpm exec oxfmt --check src/agents/shell-utils.ts src/agents/shell-utils.test.ts src/infra/bonjour.ts src/commands/status.scan.ts src/test-helpers/state-dir-env.ts src/test-helpers/state-dir-env.test.ts src/commands/doctor-platform-notes.ts src/commands/doctor-platform-notes.launchctl-env-overrides.test.ts`
    - Result: passed (all matched files correctly formatted).

Stage 8 progress update (2026-03-03, pass 6)

- done
  - Completed Stage 8.3 follow-up to normalize/reduce legacy-only `CLAWDBOT_*` test fixtures:
    - removed redundant legacy-parity matrix case from `src/gateway/credential-precedence.parity.test.ts` (legacy ignore coverage remains in focused gateway tests).
    - removed stale `CLAWDBOT_STATE_DIR` undefined fixture setup from:
      - `src/plugins/discovery.test.ts`
      - `src/plugins/loader.test.ts`
  - Remaining `CLAWDBOT_*` references are now constrained to focused legacy-ignore regression tests (config and gateway auth/credentials).

- pending
  - Eventual staged retirement plan for `OPENCLAW_*` compatibility aliases.

- verification
  - Command: `pnpm exec vitest run src/gateway/credentials.test.ts src/gateway/credential-precedence.parity.test.ts src/gateway/auth.test.ts src/plugins/discovery.test.ts src/plugins/loader.test.ts src/config/paths.test.ts src/config/io.compat.test.ts`
    - Result: passed (`7` test files, `107` tests, `2` skipped).
  - Command: `pnpm exec oxfmt --check src/gateway/credential-precedence.parity.test.ts src/plugins/discovery.test.ts src/plugins/loader.test.ts`
    - Result: passed (all matched files correctly formatted).
  - Command: `rg -n "CLAWDBOT_" src --glob "**/*.test.ts"`
    - Result: narrowed to `4` focused test files (`src/config/paths.test.ts`, `src/config/io.compat.test.ts`, `src/gateway/auth.test.ts`, `src/gateway/credentials.test.ts`).

Stage 8 progress update (2026-03-03, pass 7)

- done
  - Began staged `OPENCLAW_*` gateway-auth alias retirement by introducing canonical `PROPAICLAW_*` env support in shared credential resolution:
    - `src/gateway/credentials.ts` now reads:
      - `PROPAICLAW_GATEWAY_TOKEN` with fallback to `OPENCLAW_GATEWAY_TOKEN`
      - `PROPAICLAW_GATEWAY_PASSWORD` with fallback to `OPENCLAW_GATEWAY_PASSWORD`
  - Updated direct gateway-auth consumers to use shared resolution helpers:
    - `src/browser/extension-relay-auth.ts`
    - `src/pairing/setup-code.ts`
  - Added regression coverage for canonical alias precedence/fallback:
    - `src/gateway/credentials.test.ts`
    - `src/browser/extension-relay-auth.test.ts`
    - `src/pairing/setup-code.test.ts`

- pending
  - Remaining direct `OPENCLAW_GATEWAY_TOKEN` / `OPENCLAW_GATEWAY_PASSWORD` reads outside shared credential helpers (wizard/dashboard/daemon/status/security surfaces) for staged conversion.
  - Eventual staged retirement plan for broader `OPENCLAW_*` compatibility aliases.

- verification
  - Command: `pnpm exec vitest run src/gateway/credentials.test.ts src/gateway/auth.test.ts src/gateway/credential-precedence.parity.test.ts src/browser/extension-relay-auth.test.ts src/pairing/setup-code.test.ts src/cli/qr-cli.test.ts`
    - Result: passed (`6` test files, `71` tests).
  - Command: `pnpm exec oxfmt --check src/gateway/credentials.ts src/gateway/credentials.test.ts src/browser/extension-relay-auth.ts src/browser/extension-relay-auth.test.ts src/pairing/setup-code.ts src/pairing/setup-code.test.ts`
    - Result: passed (all matched files correctly formatted).

Stage 8 progress update (2026-03-03, pass 8)

- done
  - Continued staged gateway env alias migration across daemon/status/security/wizard surfaces by replacing direct `OPENCLAW_GATEWAY_*` reads with shared alias-aware helpers:
    - `src/cli/daemon-cli/install.ts`
    - `src/cli/daemon-cli/lifecycle-core.ts`
    - `src/cli/daemon-cli/status.gather.ts`
    - `src/commands/doctor-gateway-daemon-flow.ts`
    - `src/commands/doctor-gateway-services.ts`
    - `src/daemon/service-audit.ts`
    - `src/security/audit-extra.sync.ts`
  - Added alias-aware daemon status env filtering for gateway port (`PROPAICLAW` preferred, `OPENCLAW` fallback):
    - `src/cli/daemon-cli/shared.ts`
  - Added deprecation messaging for legacy-only gateway env usage:
    - implemented `noteDeprecatedLegacyEnvVars(...)` in `src/commands/doctor-platform-notes.ts` to warn when `OPENCLAW_GATEWAY_{TOKEN|PASSWORD|PORT}` is set without the corresponding `PROPAICLAW_*` var.
    - expanded macOS launchctl override checks to support both alias families with canonical precedence.
  - Updated wizard token messaging to canonical env naming with legacy alias note:
    - `src/wizard/onboarding.finalize.ts`
  - Added/updated regression tests for alias precedence + deprecation notes:
    - `src/commands/doctor-platform-notes.launchctl-env-overrides.test.ts`
    - `src/commands/doctor-gateway-services.test.ts`
    - `src/cli/daemon-cli/lifecycle-core.test.ts`
    - `src/daemon/service-audit.test.ts`

- pending
  - Remaining `OPENCLAW_GATEWAY_*` usages outside this staged surface scope (for example `gateway-cli` docs/messages and explicit env write paths) for follow-up pass conversion/deprecation cleanup.
  - Eventual staged retirement plan for broader `OPENCLAW_*` compatibility aliases.

- verification
  - Command: `pnpm exec vitest run src/commands/doctor-platform-notes.launchctl-env-overrides.test.ts src/commands/doctor-gateway-services.test.ts src/daemon/service-audit.test.ts src/cli/daemon-cli/lifecycle-core.test.ts src/cli/daemon-cli/status.gather.test.ts`
    - Result: passed (`5` test files, `29` tests).
  - Command: `pnpm exec vitest run src/security/audit.test.ts -t "hooks token"`
    - Result: passed (`1` test file, `2` tests; `77` skipped).
  - Command: `pnpm exec oxfmt --check src/cli/daemon-cli/install.ts src/commands/doctor-gateway-daemon-flow.ts src/commands/doctor-gateway-services.ts src/cli/daemon-cli/status.gather.ts src/cli/daemon-cli/lifecycle-core.ts src/daemon/service-audit.ts src/security/audit-extra.sync.ts src/commands/doctor-platform-notes.ts src/commands/doctor-platform-notes.launchctl-env-overrides.test.ts src/commands/doctor-gateway-services.test.ts src/cli/daemon-cli/lifecycle-core.test.ts src/daemon/service-audit.test.ts src/cli/daemon-cli/shared.ts src/wizard/onboarding.finalize.ts`
    - Result: passed (all matched files correctly formatted).
  - Command: `rg -n "(process\\.env\\.|env\\.|mergedDaemonEnv\\.)OPENCLAW_GATEWAY_(TOKEN|PASSWORD|PORT)" src/cli/daemon-cli src/daemon src/security src/wizard src/commands/dashboard.ts src/commands/configure.wizard.ts src/commands/gateway-status src/commands/doctor-gateway-daemon-flow.ts src/commands/doctor-gateway-services.ts src/commands/doctor-platform-notes.ts -S --glob "!**/*.test.ts" --glob "!**/*.live.test.ts"`
    - Result: no matches.

Stage 8 progress update (2026-03-03, pass 9)

- done
  - Continued staged gateway env alias migration in remaining runtime surfaces:
    - `src/node-host/runner.ts`: switched gateway token/password env reads to shared alias-aware helpers (`readGatewayTokenEnv` / `readGatewayPasswordEnv`).
    - `src/pairing/setup-code.ts`: made gateway port env resolution canonical-first (`PROPAICLAW_GATEWAY_PORT` fallback to `OPENCLAW_GATEWAY_PORT`).
    - `src/cli/profile.ts`: made dev-profile gateway port defaults canonical-first with bidirectional alias backfill (`PROPAICLAW_*` and `OPENCLAW_*` stay in sync).
  - Canonicalized user-facing gateway auth env guidance (with explicit legacy alias note):
    - `src/cli/gateway-cli/run.ts`
    - `src/gateway/auth.ts`
    - `src/gateway/server-runtime-config.ts`
    - `src/acp/server.ts`
    - `src/browser/extension-relay-auth.ts`
  - Canonicalized runtime env export plumbing while retaining compatibility:
    - `src/cli/gateway-cli/run.ts`: `--token` now exports both `PROPAICLAW_GATEWAY_TOKEN` and `OPENCLAW_GATEWAY_TOKEN`.
    - `src/daemon/service-env.ts`: service env now includes `PROPAICLAW_GATEWAY_PORT`/`PROPAICLAW_GATEWAY_TOKEN` in addition to existing `OPENCLAW_*`.
    - `src/gateway/server.impl.ts`: runtime port export now sets both `PROPAICLAW_GATEWAY_PORT` and `OPENCLAW_GATEWAY_PORT`.
    - `src/config/io.ts`: shell-env fallback expected keyset now includes `PROPAICLAW_GATEWAY_TOKEN` and `PROPAICLAW_GATEWAY_PASSWORD`.
  - Added/updated regression coverage:
    - `src/cli/profile.test.ts`
    - `src/pairing/setup-code.test.ts`
    - `src/daemon/service-env.test.ts`
    - `src/gateway/server-runtime-config.test.ts`
    - `src/cli/gateway-cli/run.option-collisions.test.ts`

- pending
  - Remaining non-test `OPENCLAW_GATEWAY_*` references are now primarily compatibility aliases, helper fallback paths, and legacy-label messaging/docs; staged cleanup can continue by subsystem once deprecation timeline is finalized.
  - Eventual staged retirement plan for broader `OPENCLAW_*` compatibility aliases.

- verification
  - Command: `pnpm exec vitest run src/cli/profile.test.ts src/pairing/setup-code.test.ts src/daemon/service-env.test.ts src/gateway/server-runtime-config.test.ts src/cli/gateway-cli/run.option-collisions.test.ts src/cli/acp-cli.option-collisions.test.ts src/gateway/auth.test.ts src/acp/server.startup.test.ts src/config/io.compat.test.ts`
    - Result: passed (`9` test files, `137` tests).
  - Command: `pnpm exec vitest run src/browser/extension-relay-auth.test.ts`
    - Result: passed (`1` test file, `6` tests).
  - Command: `pnpm exec oxfmt --check src/node-host/runner.ts src/cli/profile.ts src/pairing/setup-code.ts src/cli/gateway-cli/run.ts src/gateway/auth.ts src/gateway/server-runtime-config.ts src/acp/server.ts src/config/io.ts src/daemon/service-env.ts src/gateway/server.impl.ts src/gateway/server-runtime-config.test.ts src/daemon/service-env.test.ts src/cli/profile.test.ts src/pairing/setup-code.test.ts src/cli/gateway-cli/run.option-collisions.test.ts`
    - Result: passed (all matched files correctly formatted).

Stage 8 progress update (2026-03-03, pass 10)

- done
  - Extended shared gateway env alias helpers to include gateway port resolution:
    - added `readGatewayPortEnv(...)` to `src/gateway/credentials.ts` (`PROPAICLAW_GATEWAY_PORT` first, `OPENCLAW_GATEWAY_PORT` fallback).
    - added regression coverage in `src/gateway/credentials.test.ts` for canonical precedence, legacy fallback, and empty-value behavior.
  - Converted remaining non-`.test.ts` gateway helper/harness direct env reads to alias-aware shared helpers:
    - `src/gateway/test-helpers.server.ts` now uses `readGatewayTokenEnv` / `readGatewayPasswordEnv` for default connect auth and snapshots both token env aliases.
    - `src/gateway/server.e2e-ws-harness.ts` now snapshots/clears both gateway token env aliases.
    - `src/browser/server.control-server.test-harness.ts` now uses `readGatewayTokenEnv` / `readGatewayPasswordEnv` / `readGatewayPortEnv` and mirrors set/restore/clear across both `PROPAICLAW_*` and `OPENCLAW_*` gateway env keys.
  - Switched remaining canonical-first gateway port env reads to shared helper:
    - `src/pairing/setup-code.ts`
    - `src/cli/profile.ts` (dev-profile gateway port default/backfill remains dual-alias compatible).

- pending
  - Remaining non-test `OPENCLAW_GATEWAY_*` references are now primarily intentional compatibility writes and fallback plumbing (runtime env export/write paths plus alias readers).
  - Eventual staged retirement plan for broader `OPENCLAW_*` compatibility aliases.

- verification
  - Command: `pnpm exec vitest run src/gateway/credentials.test.ts src/pairing/setup-code.test.ts src/cli/profile.test.ts src/gateway/server.health.test.ts src/gateway/server.sessions.gateway-server-sessions-a.test.ts src/browser/server.agent-contract-form-layout-act-commands.test.ts src/browser/server.agent-contract-snapshot-endpoints.test.ts src/browser/server.post-tabs-open-profile-unknown-returns-404.test.ts`
    - Result: passed (`8` test files, `92` tests, `3` skipped).
  - Command: `pnpm exec vitest run src/cli/profile.test.ts`
    - Result: passed (`1` test file, `21` tests).
  - Command: `pnpm exec oxfmt --check src/gateway/credentials.ts src/gateway/credentials.test.ts src/pairing/setup-code.ts src/cli/profile.ts src/gateway/test-helpers.server.ts src/gateway/server.e2e-ws-harness.ts src/browser/server.control-server.test-harness.ts`
    - Result: passed (all matched files correctly formatted).
  - Command: `rg -n "(process\\.env\\.|env\\.)OPENCLAW_GATEWAY_(TOKEN|PASSWORD|PORT)" src/gateway/test-helpers.server.ts src/gateway/server.e2e-ws-harness.ts src/browser/server.control-server.test-harness.ts src/pairing/setup-code.ts src/cli/profile.ts -S`
    - Result: matched only compatibility writes/deletes in harness/setup paths; no direct legacy-only reads remain in these files.

Stage 8 progress update (2026-03-03, pass 11)

- done
  - Completed canonical-only gateway env test migration for the last failing regression surfaces:
    - `src/gateway/auth.test.ts`: switched env fixtures and assertion label to `PROPAICLAW_GATEWAY_{TOKEN|PASSWORD}`.
    - `src/security/audit.test.ts`: switched env setup/restore/probe fixture reads+writes to `PROPAICLAW_GATEWAY_{TOKEN|PASSWORD}`.
  - Stabilized security-audit native-command expectations by making command exposure explicit in targeted tests (decoupled from runtime channel allowlist defaults):
    - set `commands.native=true` in Discord native-command allowlist coverage cases.
    - set `commands.nativeSkills=true` in the extension allowlist severity case.
  - Re-verified non-test `OPENCLAW_GATEWAY_*` footprint:
    - only `src/commands/doctor-platform-notes.ts` retains references for legacy alias diagnostic messaging.

- pending
  - Remaining `OPENCLAW_GATEWAY_*` references are intentional legacy-alias detection/deprecation messaging in doctor notes; broader `OPENCLAW_*` retirement remains staged.

- verification
  - Command: `pnpm exec vitest run src/gateway/auth.test.ts src/security/audit.test.ts`
    - Result: passed (`2` test files, `110` tests).
  - Command: `pnpm exec vitest run src/config/io.compat.test.ts src/cli/daemon-cli/status.gather.test.ts src/cli/daemon-cli.coverage.test.ts src/commands/migrate-state.test.ts src/gateway/auth.test.ts src/acp/server.startup.test.ts src/security/audit.test.ts`
    - Result: passed (`7` test files, `135` tests).
  - Command: `pnpm exec oxfmt --check src/gateway/auth.test.ts src/security/audit.test.ts`
    - Result: passed (all matched files correctly formatted).
  - Command: `rg -n "OPENCLAW_GATEWAY_(TOKEN|PASSWORD|PORT)" src -S --glob "!**/*.test.ts" --glob "!**/*.live.test.ts"`
    - Result: matched only `src/commands/doctor-platform-notes.ts` legacy alias diagnostics.

Stage 8 progress update (2026-03-03, pass 12)

- done
  - Ran a repo-wide `OPENCLAW_*` inventory and reduced it to Stage 8.3 retirement scope.
  - Confirmed gateway-env runtime cutover status:
    - non-test `OPENCLAW_GATEWAY_{TOKEN|PASSWORD|PORT}` references are now only in `src/commands/doctor-platform-notes.ts` for legacy alias diagnostics.
  - Identified shared alias families still spanning both `PROPAICLAW_*` and `OPENCLAW_*`:
    - `STATE_DIR`, `CONFIG_PATH`, `HOME`, `PROFILE`, `OAUTH_DIR`, `CHANNELS_ONLY`, `GATEWAY_TOKEN`, `GATEWAY_PASSWORD`, `GATEWAY_PORT`.
  - Quantified Stage 8.3 migration surface:
    - Shared-alias family matches in `src` non-test: `140` matches across `48` files (`36` core files after excluding test helper/harness paths).
    - Legacy gateway env refs in tests: `161` matches across `37` test files.
    - Legacy env docs refs (`docs/` non-`zh-CN`): `182` matches across `55` files.

- Stage 8.3 retirement checklist
  1. Finalize gateway alias retirement (runtime): remove `OPENCLAW_GATEWAY_*` legacy diagnostics in `doctor-platform-notes` after deprecation cutoff is declared.
  2. Remove shared path/profile alias fallbacks: cut `OPENCLAW_*` fallback reads in core path/profile resolution (`config/paths`, `infra/home-dir`, `channels/registry`, `propai/realtor-workspace`).
  3. Remove mirrored legacy writes in wrappers/env bootstraps: stop writing `OPENCLAW_*` copies in `propaiclaw-entry.env`, `cli/profile`, and daemon env assembly once cutoff is active.
  4. Service supervisor env normalization: migrate service label/unit/task/profile plumbing to canonical-only reads (`daemon/{launchd,systemd,schtasks,paths,inspect,constants}`, `cli/daemon-cli/{shared,status.print}`, `cli/update-cli/restart-helper`, related doctor formatting/status surfaces).
  5. Docs canonicalization pass (English first): replace `OPENCLAW_GATEWAY_*` and shared alias mentions with `PROPAICLAW_*` + explicit legacy note where needed; then regenerate `docs/zh-CN` via i18n pipeline.
  6. Test suite normalization strategy: convert non-compat tests to canonical env keys; keep only dedicated compatibility tests that explicitly assert legacy alias handling until final removal.
  7. Broader `OPENCLAW_*` key policy decision: there are `136` unique `OPENCLAW_*` keys in `src` non-test; most are product/runtime flags (not alias shims). Split “rebrand alias retirement” from “global env namespace rename” to avoid accidental scope creep.

- pending
  - Product/maintainer decision needed on Stage 8.3 deprecation cutoff date for removing legacy diagnostics/fallbacks.
  - Execute checklist slices in order (`1` -> `7`) once cutoff is approved.

- verification
  - Command: `rg -n "OPENCLAW_[A-Z0-9_]+" src -S --glob "!**/*.test.ts" --glob "!**/*.live.test.ts"`
    - Result: inventory captured (`136` unique keys in non-test `src`).
  - Command: `rg -n "OPENCLAW_GATEWAY_(TOKEN|PASSWORD|PORT)" src -S --glob "!**/*.test.ts" --glob "!**/*.live.test.ts"`
    - Result: matched only `src/commands/doctor-platform-notes.ts`.
  - Command: `rg -n "OPENCLAW_(HOME|STATE_DIR|CONFIG_PATH|PROFILE|OAUTH_DIR|CHANNELS_ONLY|GATEWAY_TOKEN|GATEWAY_PASSWORD|GATEWAY_PORT)" src -S --glob "!**/*.test.ts" --glob "!**/*.live.test.ts"`
    - Result: `140` matches across `48` files; `36` core files after excluding test helper/harness paths.
  - Command: `rg -n "OPENCLAW_GATEWAY_(TOKEN|PASSWORD|PORT)" src -S --glob "**/*.test.ts" --glob "**/*.live.test.ts"`
    - Result: `161` matches across `37` test files.
  - Command: `rg -n "OPENCLAW_(HOME|STATE_DIR|CONFIG_PATH|PROFILE|OAUTH_DIR|CHANNELS_ONLY|GATEWAY_TOKEN|GATEWAY_PASSWORD|GATEWAY_PORT)" docs -S --glob "!docs/zh-CN/**"`
    - Result: `182` matches across `55` non-`zh-CN` docs files.

Stage 8 progress update (2026-03-03, pass 13)

- done
  - Local workspace rename to reduce naming confusion:
    - renamed repo folder from `C:\\Users\\visha\\openclaw` to `C:\\Users\\visha\\propaiclaw`.
    - repaired dependency links after rename with `pnpm install` (required because `node_modules` executable paths referenced the old folder path).
  - Removed the last non-test `OPENCLAW_GATEWAY_*` runtime references by deleting legacy gateway env alias diagnostics from doctor platform notes:
    - removed `noteDeprecatedLegacyEnvVars(...)` from `src/commands/doctor-platform-notes.ts`.
    - removed call/import in `src/commands/doctor.ts`.
    - removed obsolete mock export in `src/commands/doctor.fast-path-mocks.ts`.
    - removed legacy-alias test block from `src/commands/doctor-platform-notes.launchctl-env-overrides.test.ts`.
  - Canonicalized remaining doctor tests to `PROPAICLAW_GATEWAY_*` env expectations:
    - `src/commands/doctor-security.test.ts`
    - `src/commands/doctor.warns-state-directory-is-missing.test.ts`

- pending
  - Stage 8.3 broader alias retirement remains open for shared path/profile aliases (`OPENCLAW_{STATE_DIR,CONFIG_PATH,HOME,PROFILE,OAUTH_DIR,CHANNELS_ONLY}`) and docs/test normalization.

- verification
  - Command: `rg -n "OPENCLAW_GATEWAY_(TOKEN|PASSWORD|PORT)" src -S --glob "!**/*.test.ts" --glob "!**/*.live.test.ts"`
    - Result: no matches.
  - Command: `pnpm exec vitest run src/commands/doctor-platform-notes.launchctl-env-overrides.test.ts src/commands/doctor-security.test.ts src/commands/doctor.warns-state-directory-is-missing.test.ts`
    - Result: passed (`3` test files, `13` tests).
  - Command: `pnpm exec oxfmt --check src/commands/doctor-platform-notes.ts src/commands/doctor.ts src/commands/doctor.fast-path-mocks.ts src/commands/doctor-platform-notes.launchctl-env-overrides.test.ts src/commands/doctor-security.test.ts src/commands/doctor.warns-state-directory-is-missing.test.ts`
    - Result: passed (all matched files correctly formatted).

Stage 8 progress update (2026-03-03, pass 14)

- done
  - Completed Stage 8.3 checklist item 2 (core path/profile alias fallback removal) by switching key runtime resolution paths to canonical-only env reads:
    - `src/config/paths.ts`
      - `resolveStateDirOverride(...)` now reads `PROPAICLAW_STATE_DIR` only.
      - `resolveConfigPathOverride(...)` now reads `PROPAICLAW_CONFIG_PATH` only.
      - `resolveOAuthDir(...)` override now reads `PROPAICLAW_OAUTH_DIR` only.
    - `src/infra/home-dir.ts`
      - home override now reads `PROPAICLAW_HOME` only.
    - `src/channels/registry.ts`
      - runtime channel allowlist now reads `PROPAICLAW_CHANNELS_ONLY` only.
    - `src/propai/realtor-workspace.ts`
      - default workspace profile suffix now reads `PROPAICLAW_PROFILE` only.
  - Updated impacted regression tests to canonical env behavior:
    - `src/config/paths.test.ts`
    - `src/infra/home-dir.test.ts`
    - `src/channels/registry.helpers.test.ts`
    - `src/channels/plugins/plugins-core.test.ts`
    - `src/propai/realtor-workspace.test.ts`
    - `src/config/config.nix-integration-u3-u5-u9.test.ts`
    - `src/config/io.compat.test.ts`
    - `src/config/agent-dirs.test.ts`
  - Fixed adjacent integration tests impacted by canonical path env reads:
    - `src/cli/daemon-cli.coverage.test.ts`
    - `src/security/audit.test.ts`

- pending
  - Remaining Stage 8.3 slices from the checklist:
    - service supervisor env normalization (`OPENCLAW_PROFILE`/path-label plumbing) across daemon/CLI surfaces.
    - docs/test normalization beyond this core runtime slice.

- verification
  - Command: `rg -n "(process\\.env\\.|env\\.)OPENCLAW_(STATE_DIR|CONFIG_PATH|HOME|PROFILE|OAUTH_DIR|CHANNELS_ONLY)" src/config/paths.ts src/infra/home-dir.ts src/channels/registry.ts src/propai/realtor-workspace.ts -S`
    - Result: no matches.
  - Command: `pnpm exec vitest run src/config/paths.test.ts src/infra/home-dir.test.ts src/channels/registry.helpers.test.ts src/channels/plugins/plugins-core.test.ts src/propai/realtor-workspace.test.ts src/config/config.nix-integration-u3-u5-u9.test.ts src/config/io.compat.test.ts src/config/agent-dirs.test.ts`
    - Result: passed (`8` test files, `95` tests).
  - Command: `pnpm exec vitest run src/config/io.compat.test.ts src/cli/daemon-cli/status.gather.test.ts src/cli/daemon-cli.coverage.test.ts src/commands/migrate-state.test.ts src/gateway/auth.test.ts src/acp/server.startup.test.ts src/security/audit.test.ts`
    - Result: passed (`7` test files, `135` tests).
  - Command: `pnpm exec oxfmt --check src/config/paths.ts src/infra/home-dir.ts src/channels/registry.ts src/propai/realtor-workspace.ts src/config/paths.test.ts src/infra/home-dir.test.ts src/channels/registry.helpers.test.ts src/channels/plugins/plugins-core.test.ts src/propai/realtor-workspace.test.ts src/config/config.nix-integration-u3-u5-u9.test.ts src/config/io.compat.test.ts src/config/agent-dirs.test.ts src/cli/daemon-cli.coverage.test.ts src/security/audit.test.ts`
    - Result: passed (all matched files correctly formatted).

Stage 8 progress update (2026-03-03, pass 15)

- done
  - Added a non-technical forced cleanup flow for lingering gateway PIDs:
    - `openclaw gateway stop --force` now triggers automated post-stop process cleanup.
    - Implemented in `src/cli/daemon-cli/lifecycle.ts` using service port resolution + restart-health inspection.
    - If lingering gateway processes are detected, CLI now kills them automatically via `terminateStaleGatewayPids(...)`.
    - Added explicit diagnostics + actionable hints when forced cleanup still cannot terminate lingering processes.
  - Extended daemon stop plumbing:
    - `src/cli/daemon-cli/register-service-commands.ts`: added `stop --force`.
    - `src/cli/daemon-cli/register-service-commands.ts`: fixed parent/child option collision by inheriting parent `--force` for stop action.
    - `src/cli/daemon-cli/lifecycle-core.ts`: added `postStopCheck` hook + stop warnings emission in JSON mode.
    - `src/cli/daemon-cli/types.ts`: introduced `DaemonStopOptions` (`json`, `force`).
    - `src/cli/daemon-cli/restart-health.ts`: added `collectGatewayProcessPids(...)` helper for force-stop cleanup targeting.
  - Continued Stage 8.3 alias retirement in runtime/bootstrap/profile surfaces:
    - `src/propaiclaw-entry.env.ts`
      - runtime identity env resolution now reads canonical-only `PROPAICLAW_{STATE_DIR,CONFIG_PATH,HOME,PROFILE,CHANNELS_ONLY,OAUTH_DIR}`.
      - removed legacy `OPENCLAW_*` mirroring from resolved runtime env payload.
      - added deprecation warnings for legacy `OPENCLAW_GATEWAY_{PORT,TOKEN,PASSWORD}` when canonical aliases are unset.
    - `src/cli/profile.ts`
      - made profile env apply mode-aware and non-mirrored:
        - Propaiclaw mode writes/reads only `PROPAICLAW_{PROFILE,STATE_DIR,CONFIG_PATH}`.
        - OpenClaw mode writes/reads only `OPENCLAW_{PROFILE,STATE_DIR,CONFIG_PATH}`.
      - preserves canonical `PROPAICLAW_GATEWAY_PORT` handling for dev profile defaults.
    - `src/daemon/service-env.ts`
      - service env assembly now resolves `PROFILE/STATE_DIR/CONFIG_PATH` with canonical-first reads (`PROPAICLAW_*` preferred over `OPENCLAW_*`).
      - emits canonical `PROPAICLAW_*` keys alongside legacy keys to keep existing daemon supervisor consumers stable while advancing canonicalization.
  - Updated regression tests:
    - `src/propaiclaw-entry.env.test.ts`
    - `src/cli/profile.test.ts`
    - `src/daemon/service-env.test.ts`
    - `src/cli/daemon-cli/restart-health.test.ts`
    - `src/cli/daemon-cli/lifecycle.test.ts`
    - `src/cli/daemon-cli/register-service-commands.test.ts`

- pending
  - Stage 8.3 service supervisor canonicalization remains for daemon internals still keyed on `OPENCLAW_*` (`daemon/{paths,launchd,systemd,schtasks,...}` and dependent CLI status/doctor surfaces).
  - Broader docs/test namespace normalization remains open.

- verification
  - Command: `pnpm vitest src/propaiclaw-entry.env.test.ts src/cli/profile.test.ts src/daemon/service-env.test.ts src/cli/daemon-cli/restart-health.test.ts src/cli/daemon-cli/lifecycle.test.ts src/cli/daemon-cli/register-service-commands.test.ts`
    - Result: passed (`6` test files, `76` tests).
  - Command: `pnpm vitest src/cli/daemon-cli/lifecycle-core.test.ts`
    - Result: passed (`1` test file, `4` tests).
  - Command: `pnpm exec oxfmt --check src/propaiclaw-entry.env.ts src/propaiclaw-entry.env.test.ts src/cli/profile.ts src/cli/profile.test.ts src/daemon/service-env.ts src/daemon/service-env.test.ts src/cli/daemon-cli/types.ts src/cli/daemon-cli/lifecycle-core.ts src/cli/daemon-cli/restart-health.ts src/cli/daemon-cli/restart-health.test.ts src/cli/daemon-cli/lifecycle.ts src/cli/daemon-cli/lifecycle.test.ts src/cli/daemon-cli/register-service-commands.ts src/cli/daemon-cli/register-service-commands.test.ts`
    - Result: passed (all matched files correctly formatted).
  - Command: `rg -n 'readTrimmed\\(env, \"PROPAICLAW_(STATE_DIR|CONFIG_PATH|HOME|PROFILE|CHANNELS_ONLY|OAUTH_DIR)\", \"OPENCLAW_' src/propaiclaw-entry.env.ts src/cli/profile.ts -S`
    - Result: no matches.

Stage 8 progress update (2026-03-03, pass 16)

- done
  - Continued Stage 8.3 service-supervisor normalization (checklist item 4) by introducing shared daemon env alias helpers and applying them across daemon + CLI status/doctor surfaces.
  - Added shared canonical-first helper module:
    - `src/daemon/env-aliases.ts`
      - `resolveDaemonProfileEnv(...)`
      - `resolveDaemonStateDirEnv(...)`
      - `resolveDaemonConfigPathEnv(...)`
      - behavior: prefer `PROPAICLAW_*`, fallback to `OPENCLAW_*`.
  - Migrated daemon internals from direct `OPENCLAW_{PROFILE,STATE_DIR,CONFIG_PATH}` reads to shared helper:
    - `src/daemon/paths.ts`
    - `src/daemon/launchd.ts`
    - `src/daemon/systemd.ts`
    - `src/daemon/schtasks.ts`
    - `src/daemon/inspect.ts`
    - `src/daemon/constants.ts`
    - `src/daemon/service-env.ts` (removed local duplicate alias resolver; now uses shared helper)
  - Extended home resolution for daemon state-dir derivation:
    - `src/daemon/paths.ts` now prefers `PROPAICLAW_HOME`, then `OPENCLAW_HOME`, then `HOME/USERPROFILE`.
  - Migrated daemon CLI + doctor status formatting surfaces to shared helper:
    - `src/cli/daemon-cli/shared.ts`
      - status env sanitization now emits canonical `PROPAICLAW_{PROFILE,STATE_DIR,CONFIG_PATH}` values.
      - runtime/start hints now resolve profile via helper.
    - `src/cli/daemon-cli/status.print.ts`
      - profile-based labels/units now canonical-first.
      - operator hint text updated from `OPENCLAW_STATE_DIR` to `PROPAICLAW_STATE_DIR`.
    - `src/commands/daemon-install-helpers.ts`
    - `src/commands/doctor-format.ts`
    - `src/commands/doctor-gateway-daemon-flow.ts`
  - Added/updated regression tests for canonical-first daemon alias behavior:
    - new: `src/daemon/env-aliases.test.ts`
    - updated:
      - `src/daemon/constants.test.ts`
      - `src/daemon/launchd.test.ts`
      - `src/daemon/systemd.test.ts`
      - `src/daemon/schtasks.test.ts`
      - `src/daemon/service-env.test.ts`
      - `src/cli/daemon-cli/shared.test.ts`

- pending
  - Remaining Stage 8.3 service normalization is still open for non-profile/path internal service env keys (`OPENCLAW_LAUNCHD_LABEL`, `OPENCLAW_SYSTEMD_UNIT`, task-script/service marker keys) and broader docs/test namespace cleanup.
  - Non-daemon surfaces outside this slice still contain `OPENCLAW_*` compatibility references by design (compat tests + migration/legacy paths).

- verification
  - Command: `rg -n "(env|process\\.env)\\.OPENCLAW_(PROFILE|STATE_DIR|CONFIG_PATH)" src/daemon/paths.ts src/daemon/launchd.ts src/daemon/systemd.ts src/daemon/schtasks.ts src/daemon/inspect.ts src/daemon/constants.ts src/cli/daemon-cli/shared.ts src/cli/daemon-cli/status.print.ts src/commands/daemon-install-helpers.ts src/commands/doctor-format.ts src/commands/doctor-gateway-daemon-flow.ts -S`
    - Result: no matches.
  - Command: `pnpm vitest src/daemon/env-aliases.test.ts src/daemon/constants.test.ts src/daemon/launchd.test.ts src/daemon/systemd.test.ts src/daemon/schtasks.test.ts src/daemon/service-env.test.ts src/cli/daemon-cli/shared.test.ts src/cli/daemon-cli/status.gather.test.ts src/commands/doctor-gateway-services.test.ts`
    - Result: passed (`9` test files, `123` tests).
  - Command: `pnpm vitest src/propaiclaw-entry.env.test.ts src/cli/profile.test.ts src/cli/daemon-cli/lifecycle.test.ts src/cli/daemon-cli/register-service-commands.test.ts src/cli/daemon-cli/lifecycle-core.test.ts`
    - Result: passed (`5` test files, `38` tests).
  - Command: `pnpm exec oxfmt --check src/daemon/env-aliases.ts src/daemon/env-aliases.test.ts src/daemon/paths.ts src/daemon/launchd.ts src/daemon/systemd.ts src/daemon/schtasks.ts src/daemon/inspect.ts src/daemon/constants.ts src/daemon/service-env.ts src/daemon/service-env.test.ts src/daemon/systemd.test.ts src/daemon/schtasks.test.ts src/daemon/launchd.test.ts src/daemon/constants.test.ts src/cli/daemon-cli/shared.ts src/cli/daemon-cli/shared.test.ts src/cli/daemon-cli/status.print.ts src/commands/daemon-install-helpers.ts src/commands/doctor-format.ts src/commands/doctor-gateway-daemon-flow.ts`
    - Result: passed (all matched files correctly formatted).

Stage 8 progress update (2026-03-03, pass 17)

- done
  - Completed canonical-first normalization for remaining internal service env key reads in infra/update/status-version surfaces.
  - Extended daemon shared env helper coverage in `src/daemon/env-aliases.ts` for:
    - `LAUNCHD_LABEL`, `SYSTEMD_UNIT`, `WINDOWS_TASK_NAME`, `TASK_SCRIPT`, `TASK_SCRIPT_NAME`, `LOG_PREFIX`, `SERVICE_MARKER`, `SERVICE_KIND`, `SERVICE_VERSION`.
  - Migrated remaining direct read sites to shared canonical-first helpers:
    - `src/infra/restart.ts`
      - systemd unit/profile resolution now uses `resolveDaemonSystemdUnitEnv(...)` + `resolveDaemonProfileEnv(...)`.
      - launchd label/profile resolution now uses `resolveDaemonLaunchdLabelEnv(...)` + canonical profile fallback.
    - `src/infra/process-respawn.ts`
      - launchd restart gating now uses `resolveDaemonLaunchdLabelEnv(...)`.
    - `src/cli/update-cli/restart-helper.ts`
      - launchd/systemd/windows task/profile resolution now uses daemon alias helpers (canonical-first).
    - `src/cli/node-cli/daemon.ts`
      - node runtime hint env now seeds `PROPAICLAW_LOG_PREFIX` and keeps legacy `OPENCLAW_LOG_PREFIX` fallback for compatibility.
    - `src/version.ts`
      - runtime service version resolution now prefers `PROPAICLAW_{VERSION,SERVICE_VERSION}` before legacy aliases.
      - bundled version resolution now accepts `PROPAICLAW_BUNDLED_VERSION` before `OPENCLAW_BUNDLED_VERSION`.
    - `src/infra/supervisor-markers.ts`
      - supervisor hint detection now includes canonical `PROPAICLAW_{LAUNCHD_LABEL,SYSTEMD_UNIT,SERVICE_MARKER}` markers.
  - Expanded regression coverage for canonical-first behavior:
    - `src/cli/update-cli/restart-helper.test.ts`
    - `src/infra/process-respawn.test.ts`
    - `src/version.test.ts`
    - `src/infra/system-presence.version.test.ts`
    - plus pass-17 daemon helper/read-path tests:
      - `src/daemon/env-aliases.test.ts`
      - `src/daemon/constants.test.ts`
      - `src/daemon/launchd.test.ts`
      - `src/daemon/systemd.test.ts`
      - `src/daemon/schtasks.test.ts`
      - `src/daemon/service-env.test.ts`
      - `src/infra/infra-runtime.test.ts`

- pending
  - Remaining `OPENCLAW_*` matches for this internal-service-key family in non-test code are intentional compatibility bridges:
    - legacy key emission in service env writers (`src/daemon/service-env.ts`, `src/daemon/node-service.ts`),
    - legacy marker constants (`src/infra/supervisor-markers.ts`),
    - explicit legacy fallback in alias helper and version resolver.
  - If Stage 8.3 cutoff is declared, next pass can remove legacy emissions/constants and keep canonical-only keys.

- verification
  - Command: `pnpm exec oxfmt --check src/cli/update-cli/restart-helper.ts src/infra/restart.ts src/infra/process-respawn.ts src/infra/supervisor-markers.ts src/cli/node-cli/daemon.ts src/version.ts src/cli/update-cli/restart-helper.test.ts src/infra/process-respawn.test.ts src/version.test.ts src/infra/system-presence.version.test.ts src/daemon/env-aliases.ts src/daemon/env-aliases.test.ts src/daemon/constants.ts src/daemon/launchd.ts src/daemon/systemd.ts src/daemon/schtasks.ts src/daemon/service-env.ts src/daemon/node-service.ts src/commands/doctor-gateway-daemon-flow.ts src/commands/node-daemon-install-helpers.ts`
    - Result: passed (all matched files correctly formatted).
  - Command: `pnpm vitest src/daemon/env-aliases.test.ts src/daemon/constants.test.ts src/daemon/launchd.test.ts src/daemon/systemd.test.ts src/daemon/schtasks.test.ts src/daemon/service-env.test.ts src/cli/update-cli/restart-helper.test.ts src/infra/process-respawn.test.ts src/infra/infra-runtime.test.ts src/version.test.ts src/infra/system-presence.version.test.ts`
    - Result: passed (`11` test files, `171` tests).
  - Command: `rg -n "OPENCLAW_(LAUNCHD_LABEL|SYSTEMD_UNIT|WINDOWS_TASK_NAME|TASK_SCRIPT|TASK_SCRIPT_NAME|LOG_PREFIX|SERVICE_MARKER|SERVICE_KIND|SERVICE_VERSION)" src --glob "!**/*.test.ts"`
    - Result: remaining matches are only alias helper fallbacks, compatibility key writers, version fallback, and supervisor marker constants.

Stage 8 progress update (2026-03-03, pass 18)

- done
  - Executed the hard-cut removal for internal service env compatibility aliases (`OPENCLAW_*`) so runtime/service wiring is now canonical-only for this key family.
  - Removed legacy fallback branches for internal service keys in daemon alias helpers:
    - `src/daemon/env-aliases.ts`
      - `resolveDaemon{LaunchdLabel,SystemdUnit,WindowsTaskName,TaskScript,TaskScriptName,LogPrefix,ServiceMarker,ServiceKind,ServiceVersion}Env(...)` now read only `PROPAICLAW_*` keys.
  - Removed legacy `OPENCLAW_*` service-key emissions from service env writers:
    - `src/daemon/service-env.ts`
      - removed `OPENCLAW_{PROFILE,STATE_DIR,CONFIG_PATH,LAUNCHD_LABEL,SYSTEMD_UNIT,SERVICE_MARKER,SERVICE_KIND,SERVICE_VERSION}` writes from gateway environment assembly.
      - removed `OPENCLAW_{STATE_DIR,CONFIG_PATH,LAUNCHD_LABEL,SYSTEMD_UNIT,WINDOWS_TASK_NAME,TASK_SCRIPT_NAME,LOG_PREFIX,SERVICE_MARKER,SERVICE_KIND,SERVICE_VERSION}` writes from node environment assembly.
    - `src/daemon/node-service.ts`
      - removed mirrored `OPENCLAW_*` writes in node service env/install wrappers.
  - Completed canonical-only cleanup in supporting surfaces:
    - `src/cli/node-cli/daemon.ts`: removed legacy `OPENCLAW_LOG_PREFIX` hint-env seeding.
    - `src/infra/supervisor-markers.ts`: removed `OPENCLAW_*` supervisor marker keys.
    - `src/version.ts`: removed `OPENCLAW_*` fallbacks in runtime service-version and bundled-version resolution.
  - Updated regression coverage for canonical-only behavior:
    - `src/daemon/env-aliases.test.ts`
    - `src/daemon/launchd.test.ts`
    - `src/daemon/launchd.integration.test.ts`
    - `src/daemon/systemd.test.ts`
    - `src/daemon/constants.test.ts`
    - `src/daemon/service-env.test.ts`
    - `src/cli/update-cli/restart-helper.test.ts`
    - `src/infra/process-respawn.test.ts`
    - `src/version.test.ts`
    - `src/infra/system-presence.version.test.ts`
    - `src/gateway/server.auth.test.ts`

- pending
  - This hard cut only covered the internal service-key family from pass 17.
  - Broader `OPENCLAW_*` namespace usage remains in other compatibility areas (for example profile/path/mode surfaces and tests) and needs separate Stage 8 slices if full namespace retirement is required.

- verification
  - Command: `pnpm exec oxfmt --check src/daemon/env-aliases.ts src/daemon/service-env.ts src/daemon/node-service.ts src/cli/node-cli/daemon.ts src/infra/supervisor-markers.ts src/version.ts src/daemon/env-aliases.test.ts src/daemon/launchd.test.ts src/daemon/launchd.integration.test.ts src/daemon/systemd.test.ts src/daemon/constants.test.ts src/daemon/service-env.test.ts src/cli/update-cli/restart-helper.test.ts src/infra/process-respawn.test.ts src/version.test.ts src/infra/system-presence.version.test.ts src/gateway/server.auth.test.ts`
    - Result: passed (all matched files correctly formatted).
  - Command: `pnpm vitest src/daemon/env-aliases.test.ts src/daemon/constants.test.ts src/daemon/launchd.test.ts src/daemon/systemd.test.ts src/daemon/service-env.test.ts src/cli/update-cli/restart-helper.test.ts src/infra/process-respawn.test.ts src/version.test.ts src/infra/system-presence.version.test.ts src/gateway/server.auth.test.ts`
    - Result: passed (`10` test files, `181` tests).
  - Command: `rg -n "OPENCLAW_(LAUNCHD_LABEL|SYSTEMD_UNIT|WINDOWS_TASK_NAME|TASK_SCRIPT|TASK_SCRIPT_NAME|LOG_PREFIX|SERVICE_MARKER|SERVICE_KIND|SERVICE_VERSION|BUNDLED_VERSION)" src --glob "!**/*.test.ts"`
    - Result: no matches.

Stage 8 progress update (2026-03-03, pass 19)

- done
  - Continued canonical-only runtime env retirement for profile/state/oauth migration surfaces.
  - Removed remaining direct runtime reads of legacy state/oauth keys in this slice:
    - `src/commands/doctor-state-integrity.ts`
      - `shouldRequireOAuthDir(...)` now checks `PROPAICLAW_OAUTH_DIR` (no `OPENCLAW_OAUTH_DIR` read).
    - `src/infra/state-migrations.ts`
      - `autoMigrateLegacyStateDir(...)` now only treats `PROPAICLAW_STATE_DIR` as explicit override.
      - rollback guidance now points to `PROPAICLAW_STATE_DIR=...`.
    - `src/agents/subagent-registry.store.ts`
      - explicit state-dir override check now uses `PROPAICLAW_STATE_DIR`.
  - Updated user-facing help/remediation text to canonical env names:
    - `src/cli/completion-cli.ts` (`$PROPAICLAW_STATE_DIR/completions`)
    - `src/cli/program/help.ts` (`PROPAICLAW_STATE_DIR/PROPAICLAW_CONFIG_PATH`, `~/.propaiclaw-<name>`)
    - `src/config/schema.help.ts` (`$PROPAICLAW_STATE_DIR/logs/cache-trace.jsonl`)
    - `src/security/audit-extra.sync.ts` remediation now references `PROPAICLAW_STATE_DIR`.
    - `src/infra/dotenv.ts` and `src/config/io.ts` comments updated to canonical env names.
  - Updated tests for canonical env keys:
    - `src/commands/doctor-state-integrity.test.ts` now uses `PROPAICLAW_{HOME,STATE_DIR,OAUTH_DIR}`.
    - `src/agents/subagent-registry.persistence.test.ts` now uses `PROPAICLAW_STATE_DIR`.

- pending
  - Remaining `OPENCLAW_*` references outside this pass are still present in:
    - explicit legacy/deprecation maps (`src/propaiclaw-entry.env.ts`, `src/commands/migrate-state.ts`),
    - test harness/helper files,
    - broader non-profile/path env namespace that was out of scope for this pass.
  - If full namespace retirement is required, next pass should define a strict cutoff for those remaining compatibility/test-harness surfaces.

- verification
  - Command: `pnpm exec oxfmt --check src/agents/subagent-registry.store.ts src/commands/doctor-state-integrity.ts src/infra/state-migrations.ts src/cli/completion-cli.ts src/cli/program/help.ts src/config/schema.help.ts src/security/audit-extra.sync.ts src/infra/dotenv.ts src/config/io.ts src/commands/doctor-state-integrity.test.ts src/agents/subagent-registry.persistence.test.ts`
    - Result: passed (all matched files correctly formatted).
  - Command: `pnpm vitest src/commands/doctor-state-integrity.test.ts src/infra/state-migrations.state-dir.test.ts src/agents/subagent-registry.persistence.test.ts`
    - Result: passed (`3` test files, `16` tests).
  - Command: `pnpm vitest src/security/audit.test.ts -t "synced folder" src/cli/completion-fish.test.ts`
    - Result: passed (`1` test file) and skipped (`1` test file); `1` test passed, `82` skipped.
  - Command: `rg -n "(env|process\\.env)\\.OPENCLAW_(OAUTH_DIR|STATE_DIR)" src/commands/doctor-state-integrity.ts src/infra/state-migrations.ts src/agents/subagent-registry.store.ts -S`
    - Result: no matches.
  - Command: `rg -n "\\bOPENCLAW_STATE_DIR\\b" src/cli/completion-cli.ts src/cli/program/help.ts src/config/schema.help.ts src/security/audit-extra.sync.ts`
    - Result: no matches.

Stage 8 progress update (2026-03-03, pass 20)

- done
  - Completed the hard-cut canonicalization for shared path/profile/oauth/channels and gateway env aliases across `src` code + tests/harnesses:
    - `OPENCLAW_{HOME,STATE_DIR,CONFIG_PATH,PROFILE,OAUTH_DIR,CHANNELS_ONLY,PROPAICLAW_MODE}`
    - `OPENCLAW_GATEWAY_{TOKEN,PASSWORD,PORT}`
    - all migrated to `PROPAICLAW_*` usage in `src/**/*.ts`.
  - Removed remaining runtime legacy-path alias/deprecation plumbing:
    - `src/propaiclaw-entry.env.ts`
      - removed `resolveLegacyOpenClawEnvDeprecationWarnings(...)`.
    - `src/propaiclaw-entry.ts`
      - removed legacy warning emission call path.
    - `src/commands/migrate-state.ts`
      - removed legacy alias handling/warning branch for `OPENCLAW_STATE_DIR`.
      - state-dir override resolution is now canonical-only.
  - Repaired sweep artifacts (duplicate env keys + stale assertions) and re-aligned affected tests:
    - `src/propaiclaw-entry.env.test.ts`
    - `src/commands/migrate-state.test.ts`
    - `src/infra/home-dir.test.ts`
    - `src/pairing/setup-code.test.ts`
    - `src/cli/daemon-cli/lifecycle-core.test.ts`
    - `src/cli/daemon-cli/shared.test.ts`
    - `src/commands/doctor-gateway-services.test.ts`
    - `src/propai/realtor-workspace.test.ts`
    - `src/config/paths.test.ts`
    - `src/channels/registry.helpers.test.ts`
    - `src/gateway/credentials.test.ts`
    - `src/daemon/constants.test.ts`
  - Minor cleanup:
    - `src/propai/group-allowlist.ts` removed redundant spread fallback flagged by lint.

- pending
  - `docs/` and historical handoff text still include `OPENCLAW_*` references and were not part of this `src` hard-cut pass.
  - Non-target env names like `OPENCLAW_HOME_VOLUME` (Docker-specific) remain by design and were not renamed in this pass.

- verification
  - Command: `rg -n "\\bOPENCLAW_(HOME|STATE_DIR|CONFIG_PATH|PROFILE|OAUTH_DIR|CHANNELS_ONLY|PROPAICLAW_MODE|GATEWAY_TOKEN|GATEWAY_PASSWORD|GATEWAY_PORT)\\b" src --glob "!**/*.live.test.ts"`
    - Result: no matches.
  - Command: `pnpm exec oxlint src --deny no-dupe-keys`
    - Result: passed (`0` warnings, `0` errors).
  - Command: `pnpm exec oxfmt --check src/commands/migrate-state.ts src/commands/migrate-state.test.ts src/propaiclaw-entry.env.ts src/propaiclaw-entry.env.test.ts src/propaiclaw-entry.ts src/infra/home-dir.test.ts src/pairing/setup-code.test.ts src/cli/daemon-cli/lifecycle-core.test.ts src/cli/daemon-cli/shared.test.ts src/commands/doctor-gateway-services.test.ts src/propai/realtor-workspace.test.ts src/config/paths.test.ts src/channels/registry.helpers.test.ts src/gateway/credentials.test.ts src/daemon/constants.test.ts src/propai/group-allowlist.ts`
    - Result: passed (all matched files correctly formatted).
  - Command: `pnpm vitest src/propaiclaw-entry.env.test.ts src/commands/migrate-state.test.ts src/infra/home-dir.test.ts src/pairing/setup-code.test.ts src/cli/daemon-cli/lifecycle-core.test.ts src/cli/daemon-cli/shared.test.ts src/commands/doctor-gateway-services.test.ts src/propai/realtor-workspace.test.ts src/config/paths.test.ts src/channels/registry.helpers.test.ts src/gateway/credentials.test.ts src/daemon/constants.test.ts src/commands/doctor-state-integrity.test.ts src/infra/state-migrations.state-dir.test.ts src/agents/subagent-registry.persistence.test.ts`
    - Result: passed (`15` test files, `123` tests).

## Verification run

- `pnpm --dir ui test -- src/ui/views/cron.test.ts src/ui/app-gateway.node.test.ts`
- `pnpm --dir ui test -- src/ui/views/cron.test.ts`
- `pnpm exec oxfmt --check ui/src/ui/views/cron.ts ui/src/ui/views/cron.test.ts ui/src/i18n/locales/en.ts`
- `pnpm exec oxfmt --check ui/src/ui/app-settings.ts ui/src/ui/app-gateway.ts ui/src/ui/app-gateway.node.test.ts`

All above passed at handoff time.
