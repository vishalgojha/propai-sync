---
summary: "Operator rollback runbook for tenant state migration with auditable checkpoints"
read_when:
  - Rolling back a tenant migration batch
  - Investigating migration warnings/failures during rollout
title: "State Migration Rollback Runbook"
---

# State Migration Rollback Runbook

This runbook defines **Stage 7.3 rollback operations** for tenant migration rollout.
Use it when pilot/batch migration fails gates or produces unacceptable warnings.

Related: [State Migration Rollout Runbook](/refactor/state-migration-rollout)

## Rollback triggers

Rollback is required when at least one is true:

- `openclaw migrate-state --apply --fail-on-warnings` exits non-zero.
- Post-migration tenant validation fails (missing sessions/auth/state continuity).
- Batch gate criteria in the rollout runbook cannot be satisfied.

## Checkpoint 0: Freeze writes

Before changing files:

- Stop the gateway/service process for the tenant/profile under recovery.
- Pause further rollout for the active batch.
- Record the rollout tag and affected tenant/profile id.

## Checkpoint 1: Capture evidence

Collect immutable evidence before rollback:

```bash
openclaw migrate-state --dry-run --json --audit-log ./.artifacts/migration-audit.jsonl --rollout-tag rollback-check
```

Capture and retain:

- Last successful and failed audit records for the tenant/profile.
- Current `stateDir` and `oauthDir` from JSON output.
- Existing warning messages from apply records (`applyWarnings`).

## Checkpoint 2: Identify rollback source

Use migration artifacts to choose restore source:

- Legacy state dir (when migration created new canonical dir + legacy link/mirror).
- Timestamped legacy folders created by migration internals (for example `*.legacy-<timestamp>`).
- Pre-migration backup/snapshot from your platform backup tooling.

Prefer the most recent source that passed tenant validation.

## Checkpoint 3: Perform rollback

Execute rollback in this order:

1. Restore state/config paths for the affected tenant/profile from selected source.
2. Restore session store and agent state together (do not partially restore one without the other).
3. Restore provider/channel auth artifacts under oauth directory.
4. Ensure tenant/profile path overrides (`OPENCLAW_STATE_DIR`, `PROPAICLAW_STATE_DIR`, profile-specific settings) point to restored state.

If migration created legacy-to-new symlink/junction layouts, keep only one authoritative writable state tree after rollback.

## Checkpoint 4: Validate rollback

Run after restore, before resuming traffic:

```bash
openclaw migrate-state --dry-run --json --audit-log ./.artifacts/migration-audit.jsonl --rollout-tag rollback-verify
```

Validation requirements:

- Tenant can start and report healthy status in normal operations.
- Expected sessions and auth assets are present.
- Dry-run report shows no new unexpected destructive actions.
- Audit log contains rollback verification record with matching rollout tag.

## Checkpoint 5: Resume policy

Resume rollout only when all are true:

- Root cause for original warning/failure is documented.
- Rollback validation passed for affected tenant/profile.
- Next batch gate is explicitly re-approved by operator.

Otherwise, keep rollout paused and continue remediation.

## Audit log expectations

For each rollback incident, audit trail should include:

- failing apply record,
- rollback-check dry-run record,
- rollback-verify dry-run record,
- operator note referencing incident id/ticket.
