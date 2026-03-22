# BUILD_LOG

## 2026-03-17 — CLI deprecation audit (Step 1)

Scope: scanned all CLI source files under `src/cli/**` and `src/commands/**` for domain logic (lead parsing, WhatsApp message processing, broker data formatting, property listing extraction, data transforms).

Findings:
- No CLI-local domain logic functions for lead parsing, broker formatting, property listing extraction, or WhatsApp message processing.
- References to "lead" appear only in tests or skill names (e.g., `src/commands/onboard-config.ts`) and are not domain logic implementations.
- WhatsApp message processing logic lives outside CLI (e.g., `src/web/**`, `src/whatsapp/**`) and is not duplicated in CLI files.
 - Verified via `git grep -i -E "lead|broker|listing|property|whatsapp" -- src/cli` (no matches).

Conclusion: No domain logic functions to migrate from CLI files.
