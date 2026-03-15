# Handoff

## Summary
- Base used: `C:\Users\visha\propai-sync` (fully rebranded) with WA/TG-only cleanup ported from `C:\Users\visha\openclaw`.
- Removed Discord/Slack/etc channel surface usage where appropriate; WA/TG are the only required channels now.
- Implemented WA/TG-only CLI and config cleanups, and removed `discord-preview-streaming` in favor of `streaming-modes`.
- `/session` lifecycle command is Telegram-only (matches openclaw); WhatsApp continues to use standard session reset/idle policies.
- Removed Discord community link from system prompt.

## Key Changes
- Added `src/config/streaming-modes.ts`; replaced `discord-preview-streaming` imports in config/doctor/telegram helper.
- CLI cleanups for WA/TG only in:
  - `src/cli/channels-cli.ts`
  - `src/cli/program/register.message.ts`
  - `src/cli/program/register.agent.ts`
  - `src/cli/directory-cli.ts`
  - `src/cli/program/register.status-health-sessions.ts`
- Removed `allowSignalInstall` from onboarding.
- Updated/replaced a large set of outbound/secrets/audit files with WA/TG-safe versions from openclaw + rebrand mapping.
- `src/auto-reply/reply/commands-session.ts` now Telegram-only for `/session` idle/max-age; restart uses `triggerPropAiSyncRestart`.

## Pending / Open Questions
- If you want `/session` to affect WhatsApp, it will require a WhatsApp session-binding adapter or a separate WA-specific interpretation.
- Optional cleanup: remove remaining non-WA/TG references in comments/test harnesses if desired (currently left to avoid unintended behavior changes).

## Notes
- Many channel extensions and docs were removed as part of WA/TG-only cleanup.
- WhatsApp sessions still operate via `session` policies and `/new`/`/reset`.
