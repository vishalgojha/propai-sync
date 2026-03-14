---
summary: "CLI reference for `propai logs` (tail gateway logs via RPC)"
read_when:
  - You need to tail Gateway logs remotely (without SSH)
  - You want JSON log lines for tooling
title: "logs"
---

# `propai logs`

Tail Gateway file logs over RPC (works in remote mode).

Related:

- Logging overview: [Logging](/logging)

## Examples

```bash
propai logs
propai logs --follow
propai logs --json
propai logs --limit 500
propai logs --local-time
propai logs --follow --local-time
```

Use `--local-time` to render timestamps in your local timezone.


