# Legacy OpenClaw Workflows

These workflows were inherited from the upstream OpenClaw codebase and disabled in `propai-sync`.

Reason:
- They depend on OpenClaw-specific infrastructure (custom runners, app tokens, or org secrets).
- In this repo they create queued/failed checks and noisy CI status.

Only `.github/workflows/ci.yml` is active by default.