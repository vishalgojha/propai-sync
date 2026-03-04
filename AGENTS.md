# Repository Guidelines

- Repo: https://github.com/openclaw/openclaw
- In chat replies, file references must be repo-root relative only (example: `extensions/bluebubbles/src/channel.ts:80`); never absolute paths or `~/...`.
- GitHub issues/comments/PR comments: use literal multiline strings or `-F - <<'EOF'` (or $'...') for real newlines; never embed "\\n".
- GitHub comment footgun: never use `gh issue/pr comment -b "..."` when body contains backticks or shell chars. Always use single-quoted heredoc (`-F - <<'EOF'`) so no command substitution/escaping corruption.
- GitHub linking footgun: don’t wrap issue/PR refs like `#24643` in backticks when you want auto-linking. Use plain `#24643` (optionally add full URL).
- Security advisory analysis: before triage/severity decisions, read `SECURITY.md` to align with OpenClaw's trust model and design boundaries.

## Project Structure & Module Organization

- Source code: `src/` (CLI wiring in `src/cli`, commands in `src/commands`, web provider in `src/provider-web.ts`, infra in `src/infra`, media pipeline in `src/media`).
- Tests: colocated `*.test.ts`.
- Docs: `docs/` (images, queue, Pi config). Built output lives in `dist/`.
- Plugins/extensions: live under `extensions/*` (workspace packages). Keep plugin-only deps in the extension `package.json`; do not add them to the root `package.json` unless core uses them.
- Plugins: install runs `npm install --omit=dev` in plugin dir; runtime deps must live in `dependencies`. Avoid `workspace:*` in `dependencies` (npm install breaks); put `openclaw` in `devDependencies` or `peerDependencies` instead (runtime resolves `openclaw/plugin-sdk` via jiti alias).
- Installers served from `https://openclaw.ai/*`: live in the sibling repo `../openclaw.ai` (`public/install.sh`, `public/install-cli.sh`, `public/install.ps1`).
- Messaging channels: always consider **all** built-in + extension channels when refactoring shared logic (routing, allowlists, pairing, command gating, onboarding, docs).
  - Core channel docs: `docs/channels/`
  - Core channel code: `src/telegram`, `src/discord`, `src/slack`, `src/signal`, `src/imessage`, `src/web` (WhatsApp web), `src/channels`, `src/routing`
  - Extensions (channel plugins): `extensions/*` (e.g. `extensions/msteams`, `extensions/matrix`, `extensions/zalo`, `extensions/zalouser`, `extensions/voice-call`)
- When adding channels/extensions/apps/docs, update `.github/labeler.yml` and create matching GitHub labels (use existing channel/extension label colors).

## Docs Linking (Mintlify)

- Docs are hosted on Mintlify (docs.openclaw.ai).
- Internal doc links in `docs/**/*.md`: root-relative, no `.md`/`.mdx` (example: `[Config](/configuration)`).
- When working with documentation, read the mintlify skill.
- Section cross-references: use anchors on root-relative paths (example: `[Hooks](/configuration#hooks)`).
- Doc headings and anchors: avoid em dashes and apostrophes in headings because they break Mintlify anchor links.
- When Peter asks for links, reply with full `https://docs.openclaw.ai/...` URLs (not root-relative).
- When you touch docs, end the reply with the `https://docs.openclaw.ai/...` URLs you referenced.
- README (GitHub): keep absolute docs URLs (`https://docs.openclaw.ai/...`) so links work on GitHub.
- Docs content must be generic: no personal device names/hostnames/paths; use placeholders like `user@gateway-host` and “gateway host”.

## Docs i18n (zh-CN)

- `docs/zh-CN/**` is generated; do not edit unless the user explicitly asks.
- Pipeline: update English docs → adjust glossary (`docs/.i18n/glossary.zh-CN.json`) → run `scripts/docs-i18n` → apply targeted fixes only if instructed.
- Translation memory: `docs/.i18n/zh-CN.tm.jsonl` (generated).
- See `docs/.i18n/README.md`.
- The pipeline can be slow/inefficient; if it’s dragging, ping @jospalmbier on Discord instead of hacking around it.

## exe.dev VM ops (general)

- Access: stable path is `ssh exe.dev` then `ssh vm-name` (assume SSH key already set).
- SSH flaky: use exe.dev web terminal or Shelley (web agent); keep a tmux session for long ops.
- Update: `sudo npm i -g openclaw@latest` (global install needs root on `/usr/lib/node_modules`).
- Config: use `openclaw config set ...`; ensure `gateway.mode=local` is set.
- Discord: store raw token only (no `DISCORD_BOT_TOKEN=` prefix).
- Restart: stop old gateway and run:
  `pkill -9 -f openclaw-gateway || true; nohup openclaw gateway run --bind loopback --port 18789 --force > /tmp/openclaw-gateway.log 2>&1 &`
- Verify: `openclaw channels status --probe`, `ss -ltnp | rg 18789`, `tail -n 120 /tmp/openclaw-gateway.log`.

## Build, Test, and Development Commands

- Runtime baseline: Node **22+** (keep Node + Bun paths working).
- Install deps: `pnpm install`
- If deps are missing (for example `node_modules` missing, `vitest not found`, or `command not found`), run the repo’s package-manager install command (prefer lockfile/README-defined PM), then rerun the exact requested command once. Apply this to test/build/lint/typecheck/dev commands; if retry still fails, report the command and first actionable error.
- Pre-commit hooks: `prek install` (runs same checks as CI)
- Also supported: `bun install` (keep `pnpm-lock.yaml` + Bun patching in sync when touching deps/patches).
- Prefer Bun for TypeScript execution (scripts, dev, tests): `bun <file.ts>` / `bunx <tool>`.
- Run CLI in dev: `pnpm openclaw ...` (bun) or `pnpm dev`.
- Node remains supported for running built output (`dist/*`) and production installs.
- Mac packaging (dev): `scripts/package-mac-app.sh` defaults to current arch. Release checklist: `docs/platforms/mac/release.md`.
- Type-check/build: `pnpm build`
- TypeScript checks: `pnpm tsgo`
- Lint/format: `pnpm check`
- Format check: `pnpm format` (oxfmt --check)
- Format fix: `pnpm format:fix` (oxfmt --write)
- Tests: `pnpm test` (vitest); coverage: `pnpm test:coverage`

## Coding Style & Naming Conventions

- Language: TypeScript (ESM). Prefer strict typing; avoid `any`.
- Formatting/linting via Oxlint and Oxfmt; run `pnpm check` before commits.
- Never add `@ts-nocheck` and do not disable `no-explicit-any`; fix root causes and update Oxlint/Oxfmt config only when required.
- Never share class behavior via prototype mutation (`applyPrototypeMixins`, `Object.defineProperty` on `.prototype`, or exporting `Class.prototype` for merges). Use explicit inheritance/composition (`A extends B extends C`) or helper composition so TypeScript can typecheck.
- If this pattern is needed, stop and get explicit approval before shipping; default behavior is to split/refactor into an explicit class hierarchy and keep members strongly typed.
- In tests, prefer per-instance stubs over prototype mutation (`SomeClass.prototype.method = ...`) unless a test explicitly documents why prototype-level patching is required.
- Add brief code comments for tricky or non-obvious logic.
- Keep files concise; extract helpers instead of “V2” copies. Use existing patterns for CLI options and dependency injection via `createDefaultDeps`.
- Aim to keep files under ~700 LOC; guideline only (not a hard guardrail). Split/refactor when it improves clarity or testability.
- Naming: use **OpenClaw** for product/app/docs headings; use `openclaw` for CLI command, package/binary, paths, and config keys.

## Release Channels (Naming)

- stable: tagged releases only (e.g. `vYYYY.M.D`), npm dist-tag `latest`.
- beta: prerelease tags `vYYYY.M.D-beta.N`, npm dist-tag `beta` (may ship without macOS app).
- beta naming: prefer `-beta.N`; do not mint new `-1/-2` betas. Legacy `vYYYY.M.D-<patch>` and `vYYYY.M.D.beta.N` remain recognized.
- dev: moving head on `main` (no tag; git checkout main).

## Testing Guidelines

- Framework: Vitest with V8 coverage thresholds (70% lines/branches/functions/statements).
- Naming: match source names with `*.test.ts`; e2e in `*.e2e.test.ts`.
- Run `pnpm test` (or `pnpm test:coverage`) before pushing when you touch logic.
- Do not set test workers above 16; tried already.
- If local Vitest runs cause memory pressure (common on non-Mac-Studio hosts), use `OPENCLAW_TEST_PROFILE=low OPENCLAW_TEST_SERIAL_GATEWAY=1 pnpm test` for land/gate runs.
- Live tests (real keys): `CLAWDBOT_LIVE_TEST=1 pnpm test:live` (OpenClaw-only) or `LIVE=1 pnpm test:live` (includes provider live tests). Docker: `pnpm test:docker:live-models`, `pnpm test:docker:live-gateway`. Onboarding Docker E2E: `pnpm test:docker:onboard`.
- Full kit + what’s covered: `docs/testing.md`.
- Changelog: user-facing changes only; no internal/meta notes (version alignment, appcast reminders, release process).
- Pure test additions/fixes generally do **not** need a changelog entry unless they alter user-facing behavior or the user asks for one.
- Mobile: before using a simulator, check for connected real devices (iOS + Android) and prefer them when available.

## Commit & Pull Request Guidelines

**Full maintainer PR workflow (optional):** If you want the repo's end-to-end maintainer workflow (triage order, quality bar, rebase rules, commit/changelog conventions, co-contributor policy, and the `review-pr` > `prepare-pr` > `merge-pr` pipeline), see `.agents/skills/PR_WORKFLOW.md`. Maintainers may use other workflows; when a maintainer specifies a workflow, follow that. If no workflow is specified, default to PR_WORKFLOW.

- Create commits with `scripts/committer "<msg>" <file...>`; avoid manual `git add`/`git commit` so staging stays scoped.
- Follow concise, action-oriented commit messages (e.g., `CLI: add verbose flag to send`).
- Group related changes; avoid bundling unrelated refactors.
- PR submission template (canonical): `.github/pull_request_template.md`
- Issue submission templates (canonical): `.github/ISSUE_TEMPLATE/`

## Shorthand Commands

- `sync`: if working tree is dirty, commit all changes (pick a sensible Conventional Commit message), then `git pull --rebase`; if rebase conflicts and cannot resolve, stop; otherwise `git push`.

## Git Notes

- If `git branch -d/-D <branch>` is policy-blocked, delete the local ref directly: `git update-ref -d refs/heads/<branch>`.
- Bulk PR close/reopen safety: if a close action would affect more than 5 PRs, first ask for explicit user confirmation with the exact PR count and target scope/query.

## GitHub Search (`gh`)

- Prefer targeted keyword search before proposing new work or duplicating fixes.
- Use `--repo openclaw/openclaw` + `--match title,body` first; add `--match comments` when triaging follow-up threads.
- PRs: `gh search prs --repo openclaw/openclaw --match title,body --limit 50 -- "auto-update"`
- Issues: `gh search issues --repo openclaw/openclaw --match title,body --limit 50 -- "auto-update"`
- Structured output example:
  `gh search issues --repo openclaw/openclaw --match title,body --limit 50 --json number,title,state,url,updatedAt -- "auto update" --jq '.[] | "\(.number) | \(.state) | \(.title) | \(.url)"'`

## Security & Configuration Tips

- Web provider stores creds at `~/.openclaw/credentials/`; rerun `openclaw login` if logged out.
- Pi sessions live under `~/.openclaw/sessions/` by default; the base directory is not configurable.
- Environment variables: see `~/.profile`.
- Never commit or publish real phone numbers, videos, or live configuration values. Use obviously fake placeholders in docs, tests, and examples.
- Release flow: always read `docs/reference/RELEASING.md` and `docs/platforms/mac/release.md` before any release work; do not ask routine questions once those docs answer them.

## GHSA (Repo Advisory) Patch/Publish

- Before reviewing security advisories, read `SECURITY.md`.
- Fetch: `gh api /repos/openclaw/openclaw/security-advisories/<GHSA>`
- Latest npm: `npm view openclaw version --userconfig "$(mktemp)"`
- Private fork PRs must be closed:
  `fork=$(gh api /repos/openclaw/openclaw/security-advisories/<GHSA> | jq -r .private_fork.full_name)`
  `gh pr list -R "$fork" --state open` (must be empty)
- Description newline footgun: write Markdown via heredoc to `/tmp/ghsa.desc.md` (no `"\\n"` strings)
- Build patch JSON via jq: `jq -n --rawfile desc /tmp/ghsa.desc.md '{summary,severity,description:$desc,vulnerabilities:[...]}' > /tmp/ghsa.patch.json`
- GHSA API footgun: cannot set `severity` and `cvss_vector_string` in the same PATCH; do separate calls.
- Patch + publish: `gh api -X PATCH /repos/openclaw/openclaw/security-advisories/<GHSA> --input /tmp/ghsa.patch.json` (publish = include `"state":"published"`; no `/publish` endpoint)
- If publish fails (HTTP 422): missing `severity`/`description`/`vulnerabilities[]`, or private fork has open PRs
- Verify: re-fetch; ensure `state=published`, `published_at` set; `jq -r .description | rg '\\\\n'` returns nothing

## Troubleshooting

- Rebrand/migration issues or legacy config/service warnings: run `openclaw doctor` (see `docs/gateway/doctor.md`).

## Agent-Specific Notes

- Vocabulary: "makeup" = "mac app".
- Never edit `node_modules` (global/Homebrew/npm/git installs too). Updates overwrite. Skill notes go in `tools.md` or `AGENTS.md`.
- When adding a new `AGENTS.md` anywhere in the repo, also add a `CLAUDE.md` symlink pointing to it (example: `ln -s AGENTS.md CLAUDE.md`).
- Signal: "update fly" => `fly ssh console -a flawd-bot -C "bash -lc 'cd /data/clawd/openclaw && git pull --rebase origin main'"` then `fly machines restart e825232f34d058 -a flawd-bot`.
- When working on a GitHub Issue or PR, print the full URL at the end of the task.
- When answering questions, respond with high-confidence answers only: verify in code; do not guess.
- Never update the Carbon dependency.
- Any dependency with `pnpm.patchedDependencies` must use an exact version (no `^`/`~`).
- Patching dependencies (pnpm patches, overrides, or vendored changes) requires explicit approval; do not do this by default.
- CLI progress: use `src/cli/progress.ts` (`osc-progress` + `@clack/prompts` spinner); don’t hand-roll spinners/bars.
- Status output: keep tables + ANSI-safe wrapping (`src/terminal/table.ts`); `status --all` = read-only/pasteable, `status --deep` = probes.
- Gateway currently runs only as the menubar app; there is no separate LaunchAgent/helper label installed. Restart via the OpenClaw Mac app or `scripts/restart-mac.sh`; to verify/kill use `launchctl print gui/$UID | grep openclaw` rather than assuming a fixed label. **When debugging on macOS, start/stop the gateway via the app, not ad-hoc tmux sessions; kill any temporary tunnels before handoff.**
- macOS logs: use `./scripts/clawlog.sh` to query unified logs for the OpenClaw subsystem; it supports follow/tail/category filters and expects passwordless sudo for `/usr/bin/log`.
- If shared guardrails are available locally, review them; otherwise follow this repo's guidance.
- SwiftUI state management (iOS/macOS): prefer the `Observation` framework (`@Observable`, `@Bindable`) over `ObservableObject`/`@StateObject`; don’t introduce new `ObservableObject` unless required for compatibility, and migrate existing usages when touching related code.
- Connection providers: when adding a new connection, update every UI surface and docs (macOS app, web UI, mobile if applicable, onboarding/overview docs) and add matching status + configuration forms so provider lists and settings stay in sync.
- Version locations: `package.json` (CLI), `apps/android/app/build.gradle.kts` (versionName/versionCode), `apps/ios/Sources/Info.plist` + `apps/ios/Tests/Info.plist` (CFBundleShortVersionString/CFBundleVersion), `apps/macos/Sources/OpenClaw/Resources/Info.plist` (CFBundleShortVersionString/CFBundleVersion), `docs/install/updating.md` (pinned npm version), `docs/platforms/mac/release.md` (APP_VERSION/APP_BUILD examples), Peekaboo Xcode projects/Info.plists (MARKETING_VERSION/CURRENT_PROJECT_VERSION).
- "Bump version everywhere" means all version locations above **except** `appcast.xml` (only touch appcast when cutting a new macOS Sparkle release).
- **Restart apps:** “restart iOS/Android apps” means rebuild (recompile/install) and relaunch, not just kill/launch.
- **Device checks:** before testing, verify connected real devices (iOS/Android) before reaching for simulators/emulators.
- iOS Team ID lookup: `security find-identity -p codesigning -v` → use Apple Development (…) TEAMID. Fallback: `defaults read com.apple.dt.Xcode IDEProvisioningTeamIdentifiers`.
- A2UI bundle hash: `src/canvas-host/a2ui/.bundle.hash` is auto-generated; ignore unexpected changes, and only regenerate via `pnpm canvas:a2ui:bundle` (or `scripts/bundle-a2ui.sh`) when needed. Commit the hash as a separate commit.
- Release signing/notary keys are managed outside the repo; follow internal release docs.
- Notary auth env vars (`APP_STORE_CONNECT_ISSUER_ID`, `APP_STORE_CONNECT_KEY_ID`, `APP_STORE_CONNECT_API_KEY_P8`) are expected in your environment (per internal release docs).
- **Multi-agent safety:** do **not** create/apply/drop `git stash` entries unless explicitly requested (this includes `git pull --rebase --autostash`). Assume other agents may be working; keep unrelated WIP untouched and avoid cross-cutting state changes.
- **Multi-agent safety:** when the user says "push", you may `git pull --rebase` to integrate latest changes (never discard other agents' work). When the user says "commit", scope to your changes only. When the user says "commit all", commit everything in grouped chunks.
- **Multi-agent safety:** do **not** create/remove/modify `git worktree` checkouts (or edit `.worktrees/*`) unless explicitly requested.
- **Multi-agent safety:** do **not** switch branches / check out a different branch unless explicitly requested.
- **Multi-agent safety:** running multiple agents is OK as long as each agent has its own session.
- **Multi-agent safety:** when you see unrecognized files, keep going; focus on your changes and commit only those.
- Lint/format churn:
  - If staged+unstaged diffs are formatting-only, auto-resolve without asking.
  - If commit/push already requested, auto-stage and include formatting-only follow-ups in the same commit (or a tiny follow-up commit if needed), no extra confirmation.
  - Only ask when changes are semantic (logic/data/behavior).
- Lobster seam: use the shared CLI palette in `src/terminal/palette.ts` (no hardcoded colors); apply palette to onboarding/config prompts and other TTY UI output as needed.
- **Multi-agent safety:** focus reports on your edits; avoid guard-rail disclaimers unless truly blocked; when multiple agents touch the same file, continue if safe; end with a brief “other files present” note only if relevant.
- Bug investigations: read source code of relevant npm dependencies and all related local code before concluding; aim for high-confidence root cause.
- Code style: add brief comments for tricky logic; keep files under ~500 LOC when feasible (split/refactor as needed).
- Tool schema guardrails (google-antigravity): avoid `Type.Union` in tool input schemas; no `anyOf`/`oneOf`/`allOf`. Use `stringEnum`/`optionalStringEnum` (Type.Unsafe enum) for string lists, and `Type.Optional(...)` instead of `... | null`. Keep top-level tool schema as `type: "object"` with `properties`.
- Tool schema guardrails: avoid raw `format` property names in tool schemas; some validators treat `format` as a reserved keyword and reject the schema.
- When asked to open a “session” file, open the Pi session logs under `~/.openclaw/agents/<agentId>/sessions/*.jsonl` (use the `agent=<id>` value in the Runtime line of the system prompt; newest unless a specific ID is given), not the default `sessions.json`. If logs are needed from another machine, SSH via Tailscale and read the same path there.
- Do not rebuild the macOS app over SSH; rebuilds must be run directly on the Mac.
- Never send streaming/partial replies to external messaging surfaces (WhatsApp, Telegram); only final replies should be delivered there. Streaming/tool events may still go to internal UIs/control channel.
- Voice wake forwarding tips:
  - Command template should stay `openclaw-mac agent --message "${text}" --thinking low`; `VoiceWakeForwarder` already shell-escapes `${text}`. Don’t add extra quotes.
  - launchd PATH is minimal; ensure the app’s launch agent PATH includes standard system paths plus your pnpm bin (typically `$HOME/Library/pnpm`) so `pnpm`/`openclaw` binaries resolve when invoked via `openclaw-mac`.
- For manual `openclaw message send` messages that include `!`, use the heredoc pattern noted below to avoid the Bash tool’s escaping.
- Release guardrails: do not change version numbers without operator’s explicit consent; always ask permission before running any npm publish/release step.
- Beta release guardrail: when using a beta Git tag (for example `vYYYY.M.D-beta.N`), publish npm with a matching beta version suffix (for example `YYYY.M.D-beta.N`) rather than a plain version on `--tag beta`; otherwise the plain version name gets consumed/blocked.

## NPM + 1Password (publish/verify)

- Use the 1password skill; all `op` commands must run inside a fresh tmux session.
- Sign in: `eval "$(op signin --account my.1password.com)"` (app unlocked + integration on).
- OTP: `op read 'op://Private/Npmjs/one-time password?attribute=otp'`.
- Publish: `npm publish --access public --otp="<otp>"` (run from the package dir).
- Verify without local npmrc side effects: `npm view <pkg> version --userconfig "$(mktemp)"`.
- Kill the tmux session after publish.

## Plugin Release Fast Path (no core `openclaw` publish)

- Release only already-on-npm plugins. Source list is in `docs/reference/RELEASING.md` under "Current npm plugin list".
- Run all CLI `op` calls and `npm publish` inside tmux to avoid hangs/interruption:
  - `tmux new -d -s release-plugins-$(date +%Y%m%d-%H%M%S)`
  - `eval "$(op signin --account my.1password.com)"`
- 1Password helpers:
  - password used by `npm login`:
    `op item get Npmjs --format=json | jq -r '.fields[] | select(.id=="password").value'`
  - OTP:
    `op read 'op://Private/Npmjs/one-time password?attribute=otp'`
- Fast publish loop (local helper script in `/tmp` is fine; keep repo clean):
  - compare local plugin `version` to `npm view <name> version`
  - only run `npm publish --access public --otp="<otp>"` when versions differ
  - skip if package is missing on npm or version already matches.
- Keep `openclaw` untouched: never run publish from repo root unless explicitly requested.
- Post-check for each release:
  - per-plugin: `npm view @openclaw/<name> version --userconfig "$(mktemp)"` should be `2026.2.17`
  - core guard: `npm view openclaw version --userconfig "$(mktemp)"` should stay at previous version unless explicitly requested.

## Changelog Release Notes

- When cutting a mac release with beta GitHub prerelease:
  - Tag `vYYYY.M.D-beta.N` from the release commit (example: `v2026.2.15-beta.1`).
  - Create prerelease with title `openclaw YYYY.M.D-beta.N`.
  - Use release notes from `CHANGELOG.md` version section (`Changes` + `Fixes`, no title duplicate).
  - Attach at least `OpenClaw-YYYY.M.D.zip` and `OpenClaw-YYYY.M.D.dSYM.zip`; include `.dmg` if available.

- Keep top version entries in `CHANGELOG.md` sorted by impact:
  - `### Changes` first.
  - `### Fixes` deduped and ranked with user-facing fixes first.
- Before tagging/publishing, run:
  - `node --import tsx scripts/release-check.ts`
  - `pnpm release:check`
  - `pnpm test:install:smoke` or `OPENCLAW_INSTALL_SMOKE_SKIP_NONROOT=1 pnpm test:install:smoke` for non-root smoke path.

---

# Agent Operating Rules

This file defines quality rules that ANY AI agent (Codex, Claude, Cursor, etc.) must follow when modifying this codebase.

**Version:** 1.0
**Last Updated:** 2026-03-02
**Project Type:** agent-system

---

## Core Principle

**Guardrails first. No code change is "done" until it meets ALL applicable rules below.**

---

## UNIVERSAL RULES (Apply to ALL Projects)

### 1. TEST COVERAGE RULE

**Rule:** Every behavior change MUST include tests in the same commit.

**What this means:**
- New feature -> Add test
- Bug fix -> Add test that would have caught it
- Changed behavior -> Update tests
- Refactor -> Ensure tests still pass

**How to verify:**
```bash
npm test
# or: pytest / go test / cargo test / etc.
```

**Agent responsibility:**
- Generate test alongside code
- Run tests before suggesting "done"
- If tests fail, fix them
- Don't mark task complete without tests

**Test quality checklist:**
- [ ] Tests cover happy path
- [ ] Tests cover error cases
- [ ] Tests cover edge cases (empty input, null, boundaries)
- [ ] Tests are deterministic (no flaky tests)

---

### 2. ERROR HANDLING RULE

**Rule:** All code must handle errors gracefully and informatively.

**Requirements:**
- Catch errors at appropriate boundaries
- Log errors with context (what failed, why, how to fix)
- Show user-friendly messages (not stack traces)
- Clean up resources in error cases
- Don't swallow errors silently

**Agent responsibility:**
- Add try/catch to all async operations
- Include helpful error messages
- Log errors with full context
- Implement fallback behavior where appropriate

**Error handling template:**
```typescript
try {
  const result = await riskyOperation();
  return { success: true, data: result };
} catch (error) {
  logError(error, { operation: 'riskyOperation', context });

  // User-friendly message
  throw new Error(`Failed to complete operation: ${getUserMessage(error)}`);
}
```

---

### 3. DOCUMENTATION SYNC RULE

**Rule:** Code changes MUST include corresponding documentation updates.

**When to update docs:**
- New feature -> README + inline docs
- Changed API -> Update API docs
- Breaking change -> Migration guide
- Bug fix -> Update known issues (if documented)
- Configuration -> Update config docs

**Agent responsibility:**
- Update docs in same commit as code
- Keep examples working
- Update version in package.json/setup.py/Cargo.toml for releases

**Documentation checklist:**
- [ ] README reflects current functionality
- [ ] Code comments explain WHY, not WHAT
- [ ] Public APIs have JSDoc/docstrings
- [ ] Examples are tested and working

---

### 4. NO TODO ACCUMULATION RULE

**Rule:** Don't leave TODOs, FIXMEs, HACK comments in code.

**What to do instead:**
- Fix it immediately (if small, <30 min)
- Create GitHub issue with context (if large)
- Remove the TODO (if not actually needed)

**Agent responsibility:**
- Don't generate code with TODO comments
- If marking incomplete work, create issue and link it
- Before finishing: scan for `TODO|FIXME|HACK|XXX`

**Exception:** Architecture decisions in docs/ are fine, but not in source code.

---

### 5. DEPENDENCY HYGIENE RULE

**Rule:** Add dependencies only when necessary. Question every new dependency.

**Before adding a dependency:**
- Can built-in standard library do this?
- Can existing dependencies do this?
- Is this dependency actively maintained?
- What's the security/size impact?
- How many transitive dependencies does it add?

**Agent responsibility:**
- Justify new dependencies in commit message
- Check maintenance status (last update, weekly downloads, open issues)
- Flag abandoned packages (no updates in 1+ year)
- Run security audit: `npm audit` / `pip check` / etc.

**Dependency review checklist:**
```bash
# Check health:
npm ls --depth=0    # or: pip list, cargo tree
npm audit           # or: safety check, cargo audit
npm outdated        # or: pip list --outdated
```

---

### 6. FILE ORGANIZATION RULE

**Rule:** Keep repository organized and predictable.

**Allowed at root:**
- Configuration files (package.json, tsconfig.json, etc.)
- Essential docs (README.md, LICENSE, CHANGELOG.md)
- HANDOFF.md (single handoff file, never versioned)
- agents.md (this file)
- CI config (.github/, .gitlab-ci.yml, etc.)

**Not allowed at root:**
- Versioned handoffs (HANDOFF_v2.md, HANDOFF_FINAL.md)
- Test outputs, logs, temp files
- Random scripts (organize into scripts/ or tools/)

**Agent responsibility:**
- Follow established directory structure
- Archive old handoffs to docs/archive/
- Use .gitignore for generated files
- Keep root clean and scannable

---

### 7. TYPE SAFETY RULE

**Rule:** Use type systems properly. No `any`/`unknown` without justification.

**Requirements:**
- Function parameters: explicit types
- Return values: explicit types
- Data structures: defined interfaces/types
- External data: validate before trusting

**Agent responsibility:**
- Use strict type checking
- Don't use `any` unless unavoidable (external APIs)
- Add type guards for external data
- Run type checker before finishing

**Language-specific:**
- TypeScript: `npm run type-check`
- Python: `mypy .`
- Go: Built-in
- Rust: Built-in

---

### 8. COMMIT DISCIPLINE RULE

**Rule:** Commits must describe WHAT changed and WHY.

**Good commit messages:**
- "Add retry logic to API client for transient failures"
- "Fix race condition in concurrent state updates"
- "Remove unused dependency: moment (use native Date)"

**Bad commit messages:**
- "fix stuff"
- "updates"
- "wip"
- "asdf"

**Agent responsibility:**
- Generate descriptive commit messages
- Split unrelated changes into separate commits
- Follow conventional commits if project uses it

**Commit structure:**
```
<type>: <short summary>

<optional longer description explaining WHY>

<optional breaking change notice>
```

---

### 9. SECURITY BASELINE RULE

**Rule:** Handle sensitive data and inputs securely.

**Requirements:**
- Never log secrets, tokens, passwords
- Use environment variables for credentials
- Validate all external inputs
- Sanitize user input before use
- Run security scanners

**Agent responsibility:**
- Redact sensitive data from logs
- Use secure credential storage
- Add input validation
- Check for injection vulnerabilities
- Run: `npm audit` / `safety check` / `cargo audit`

**Security checklist:**
- [ ] No secrets in code or logs
- [ ] Input validation on external data
- [ ] No known high/critical vulnerabilities
- [ ] Proper authentication/authorization

---

### 10. HANDOFF DISCIPLINE RULE

**Rule:** ONE handoff file. Update it in place.

**Current handoff:** `HANDOFF.md`

**When updating:**
- Overwrite HANDOFF.md (never create versions)
- Git preserves history if you need it
- Archive ancient handoffs to docs/archive/

**Agent responsibility:**
- Never create HANDOFF_v2.md, HANDOFF_FINAL.md, etc.
- Keep handoff focused on current state
- Update when architecture changes

---

## PROJECT-TYPE SPECIFIC RULES

**Instructions for agent:** Only apply sections that match the project type declared at the top of this file.

### FOR CLI TOOLS (if project_type === 'cli')

#### CLI.1: USER EXPERIENCE RULE

**Rule:** CLI must be intuitive and helpful.

**Requirements:**
- Every command has `--help`
- Error messages show how to fix
- Use spinners/progress for long operations
- Use colors semantically (red=error, green=success, yellow=warning)
- Support both interactive and scriptable modes

**Agent responsibility:**
- Add `--help` to all commands
- Show examples in help text
- Use consistent flag naming
- Support `--json` output for scripting

#### CLI.2: INPUT VALIDATION RULE

**Rule:** Validate inputs, provide helpful prompts.

**Requirements:**
- Validate flags and arguments
- Prompt for missing required inputs (if interactive)
- Support `--yes` to skip prompts (for scripting)
- Show clear validation errors

---

### FOR WORKFLOWS/FLOWS (if project_type === 'workflow')

#### FLOW.1: STATE MANAGEMENT RULE

**Rule:** All state changes must be atomic, logged, and recoverable.

**Requirements:**
- Use atomic file operations
- Support state recovery after crashes
- Handle concurrent access safely
- Log all state transitions

**Agent responsibility:**
- Use locking for state writes
- Implement state versioning
- Add rollback logic

**State transition checklist:**
```typescript
// 1. Acquire lock
// 2. Read current state
// 3. Validate transition is legal
// 4. Write atomically
// 5. Release lock
```

#### FLOW.2: ERROR RECOVERY RULE

**Rule:** Flows must handle failures gracefully and support recovery.

**Requirements:**
- Retry with exponential backoff
- Graceful degradation
- Support manual recovery/restart
- Circuit breaker for repeated failures

#### FLOW.3: OBSERVABILITY RULE

**Rule:** Flows must be debuggable with logs and metrics.

**Requirements:**
- Structured logging at each step
- Trace IDs for correlation
- Metrics (duration, success rate)
- State snapshots

---

### FOR APIs (if project_type === 'api')

#### API.1: ENDPOINT CONSISTENCY RULE

**Rule:** API endpoints must be consistent and well-documented.

**Requirements:**
- RESTful conventions (or GraphQL best practices)
- Consistent error responses
- Versioning strategy
- OpenAPI/GraphQL schema

**Agent responsibility:**
- Follow REST conventions (GET/POST/PUT/DELETE)
- Return consistent error format
- Document all endpoints
- Update API schema

#### API.2: RATE LIMITING RULE

**Rule:** APIs must implement rate limiting.

**Requirements:**
- Per-user/per-IP limits
- Return 429 with Retry-After header
- Document limits
- Implement tiered limits if needed

#### API.3: INPUT VALIDATION RULE

**Rule:** Validate all API inputs strictly.

**Requirements:**
- Schema validation on request body
- Sanitize all inputs
- Return 400 with clear error messages
- Don't trust client data

---

### FOR WEB APPS (if project_type === 'web')

#### WEB.1: ACCESSIBILITY RULE

**Rule:** Web interfaces must be accessible.

**Requirements:**
- Semantic HTML
- ARIA labels where needed
- Keyboard navigation
- Screen reader friendly

**Agent responsibility:**
- Use semantic tags (<nav>, <main>, <button>)
- Add alt text to images
- Ensure keyboard navigation works
- Test with screen reader

#### WEB.2: PERFORMANCE RULE

**Rule:** Web apps must be performant.

**Requirements:**
- Code splitting
- Lazy loading
- Image optimization
- Minimize bundle size

---

### FOR AGENT SYSTEMS (if project_type === 'agent-system')

#### AGENT.1: COORDINATION RULE

**Rule:** Multi-agent systems must coordinate safely.

**Requirements:**
- Agents don't interfere with each other
- Use message passing, not shared state
- Handle agent failures
- Support partial completion

**Agent responsibility:**
- Document inter-agent dependencies
- Use explicit synchronization
- Handle timeouts
- Test concurrent agent execution

#### AGENT.2: AGENT OBSERVABILITY RULE

**Rule:** Agent behavior must be traceable.

**Requirements:**
- Log agent decisions
- Record agent interactions
- Track agent performance
- Support debugging agent chains

---

### FOR LIBRARIES (if project_type === 'library')

#### LIB.1: API STABILITY RULE

**Rule:** Library APIs must be stable and well-versioned.

**Requirements:**
- Semantic versioning
- Deprecation warnings before removal
- Migration guides for breaking changes
- Backward compatibility

**Agent responsibility:**
- Follow semver strictly
- Deprecate before removing
- Document breaking changes
- Maintain CHANGELOG.md

#### LIB.2: ZERO DEPENDENCIES GOAL

**Rule:** Libraries should minimize dependencies.

**Requirements:**
- Peer dependencies for common packages
- No dependencies for simple utilities
- Bundle size monitoring
- Tree-shakeable exports

---

## ENFORCEMENT PRIORITY

### Critical (Block Shipping):
- Rule 1: Test coverage
- Rule 2: Error handling
- Rule 9: Security baseline
- Project-specific critical rules (state management, input validation, etc.)

### Important (Fix Before Release):
- Rule 3: Documentation sync
- Rule 5: Dependency hygiene
- Rule 7: Type safety
- Project-specific important rules

### Nice to Have:
- Rule 4: No TODOs
- Rule 6: File organization
- Rule 8: Commit discipline
- Rule 10: Handoff discipline

---

## HOW TO USE THIS FILE

### For AI Agents (Codex, Claude, etc.):

1. **At session start:**
   - Read this entire file
   - Note the project type at the top
   - Apply universal rules + project-type rules

2. **Before generating code:**
   - Review applicable rules
   - Plan implementation to satisfy rules
   - Include tests, docs, error handling from the start

3. **Before suggesting "done":**
   - Verify all applicable rules satisfied
   - Run tests
   - Run type checker
   - Check for TODOs
   - Suggest "done" only if all pass

4. **When in doubt:**
   - Ask human which rules apply
   - Err on side of more quality, not less

### For Humans (Vishal):

1. **On new project:**
   - Copy this file to project root as `agents.md`
   - Update project type at top
   - Remove inapplicable project-type sections
   - Customize rules for domain-specific needs

2. **When reviewing agent output:**
   - Check against applicable rules
   - Treat violations as bugs
   - Update agents.md if you discover new patterns

3. **When architecture changes:**
   - Update project type if needed
   - Add new rules if new patterns emerge
   - Remove obsolete rules

---

## CUSTOMIZING FOR NEW PROJECT TYPES

### When starting a new project category:

1. **Identify core challenges:**
   - What makes this project type unique?
   - What are common failure modes?
   - What patterns matter most?

2. **Add new section:**
```markdown
### FOR [YOUR_PROJECT_TYPE] (if project_type === 'your-type')

#### TYPE.1: DESCRIPTIVE_RULE_NAME

**Rule:** Clear statement of requirement

**Requirements:**
- Specific requirement 1
- Specific requirement 2

**Agent responsibility:**
- What agent must do
- What agent must check
```

3. **Examples to learn from:**
   - Study similar projects
   - What do they enforce?
   - What prevents their common bugs?

4. **Keep it specific:**
   - "Use atomic operations" [OK]
   - "Write good code" [NOT OK]

---

## META-RULES (About This File)

### agents.md EVOLUTION RULE

**Rule:** This file is living documentation. Update it as you learn.

**When to update:**
- You discover a new failure pattern
- You want to enforce a new standard
- Existing rules don't work
- Project type changes
- Architecture evolves

**How to update:**
1. Identify the pattern/problem
2. Write specific, verifiable rule
3. Add to appropriate section
4. Commit with clear message
5. Tell agent to re-read agents.md

### agents.md SIMPLICITY RULE

**Rule:** Don't add rules for theoretical problems. Add rules for actual pain.

**Good reasons to add rule:**
- Same bug happened 3 times
- Production incident could have been prevented
- Review keeps catching same issue

**Bad reasons to add rule:**
- "Best practice" from blog post
- Theoretical edge case
- Personal preference without data

**Keep rules:**
- Specific (not vague)
- Verifiable (can be checked)
- Justified (solves real problem)

---

## VERSION HISTORY

### 1.0 (2026-03-02)
- Initial universal template
- Core rules apply to all projects
- Project-type specific sections
- Meta-rules for evolution

---

## QUICK START CHECKLIST

**When agent starts work on this project:**

- [ ] Read entire agents.md file
- [ ] Note project type at top
- [ ] Identify which rules apply
- [ ] Before generating code: plan to satisfy rules
- [ ] After generating code: verify rules satisfied
- [ ] Run tests, type checker, linters
- [ ] Suggest "done" only if all applicable rules pass

**This is your quality contract. Follow it every time.**
