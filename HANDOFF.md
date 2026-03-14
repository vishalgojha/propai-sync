Handoff (2026-03-15)

Summary
- Added WhatsApp read-only mode via `channels.whatsapp.autoReply` (default `false`).
- Gated WhatsApp auto-replies + ack reactions behind the new toggle.
- Updated WhatsApp config schema, labels/help, docs, and examples to document the toggle and ban-risk warning.
- Adjusted web test helpers to default `autoReply: true` in mocks to keep existing auto-reply tests stable.

Code Changes
- Config + schema: `src/config/types.whatsapp.ts`, `src/config/zod-schema.providers-whatsapp.ts`,
  `src/config/schema.help.ts`, `src/config/schema.labels.ts`
- Runtime gating: `src/web/auto-reply/monitor/process-message.ts`
- Account resolution: `src/web/accounts.ts`
- Test helpers: `src/web/test-helpers.ts`, `src/web/auto-reply/monitor/process-message.inbound-contract.test.ts`
- Docs: `docs/channels/whatsapp.md`, `docs/gateway/configuration-reference.md`,
  `docs/gateway/configuration-examples.md`

Behavior Notes
- Read-only mode still ingests messages and records session meta, but skips all auto-replies and ack reactions.
- Enabling `channels.whatsapp.autoReply: true` allows responses; warning added about ban risk.

Pending / Follow-ups
- Decide whether to add tests explicitly covering `autoReply: false` behavior.
- Consider updating any UI/config editors that rely on schema labels/help if they need surfacing for `autoReply`.
- Run test suite (not run in this session).

Git Status
- Large working tree with many files modified/added beyond the WhatsApp changes (rebrand/skills/etc).
- No commits created for the WhatsApp change in this session.
