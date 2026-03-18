---
summary: "Monitor OAuth expiry for model providers"
read_when:
  - Setting up auth expiry monitoring or alerts
  - Automating Claude Code / Codex OAuth refresh checks
title: "Auth Monitoring"
---

# Auth monitoring

propai exposes OAuth expiry health in its auth profile store. Use the Control
Console to review configured providers and watch gateway logs for expiry
warnings. For automation, read the auth profile store directly and alert when
tokens are missing or past expiry.

## Manual check (recommended)

1. Open the Control Console.
2. Go to **Config → Authentication** to see configured auth profiles and
   provider keys.
3. Check **Logs** for expiry warnings during startup or provider probes.

## Automation options

- Read `~/.propai/credentials/` and `~/.propai/propai.json` on the gateway host.
- Alert when an OAuth profile is missing or a stored expiry timestamp has
  passed.
- Keep phone/ops scripts, but update them to read the auth profile store instead
  of calling the removed CLI.



