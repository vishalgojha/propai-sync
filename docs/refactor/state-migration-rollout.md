---
summary: "Operator runbook for staged tenant migration rollout using migrate-state audit reporting"
read_when:
  - Running pilot or batch tenant migration
  - Defining rollout gates for state migration
title: "State Migration Rollout Runbook"
---

# State Migration Rollout Runbook

This runbook defines the **Stage 7 full rollout** process after pilot validation.
It uses `openclaw migrate-state` with JSON reporting and append-only JSONL audit logs.

## Rollout policy

1. Pilot first

- Run 1-3 low-risk tenants/profiles.
- Require zero critical migration warnings before batch expansion.

2. Batch expansion

- Expand in fixed-size batches (recommended: 5-10 tenants per batch).
- Stop batch rollout on first warning/failure and investigate before continuing.

3. Gate criteria for progressing to next batch

- Every tenant in the current batch completed `--apply` successfully.
- No warning records in strict runs (`--fail-on-warnings`).
- Audit log has one apply record per tenant with expected rollout tag.

## Required command flags

- `--json`: machine-readable migration report.
- `--audit-log <path>`: append JSONL record for each run.
- `--rollout-tag <tag>`: identify pilot/batch membership.
- `--fail-on-warnings`: enforce strict gate (non-zero exit on warnings).

## Pilot sequence

```bash
openclaw migrate-state --dry-run --json --audit-log ./.artifacts/migration-audit.jsonl --rollout-tag pilot-a
openclaw migrate-state --apply --json --audit-log ./.artifacts/migration-audit.jsonl --rollout-tag pilot-a --fail-on-warnings
```

## Batch sequence (per tenant/profile)

```bash
openclaw migrate-state --apply --json --audit-log ./.artifacts/migration-audit.jsonl --rollout-tag batch-001 --fail-on-warnings
```

If you isolate tenants via profiles, set profile env before each run:

```bash
OPENCLAW_PROFILE=<tenant-profile> openclaw migrate-state --apply --json --audit-log ./.artifacts/migration-audit.jsonl --rollout-tag batch-001 --fail-on-warnings
```

## Audit verification checklist

- Audit log contains valid JSON per line.
- `mode` is `apply` for rollout runs.
- `rolloutTag` matches the active pilot/batch id.
- `applyWarnings` is an empty array for strict-gated runs.
- `targetAgentId` and `targetMainKey` match expected tenant defaults.

## Rollback note

Legacy directories are preserved or moved to timestamped legacy paths when needed by migration internals.
If a batch is halted, keep the audit log as source-of-truth and resume only after warning root-cause analysis.

For explicit rollback steps and validation checkpoints, use:
[State Migration Rollback Runbook](/refactor/state-migration-rollback)
