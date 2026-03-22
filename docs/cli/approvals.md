---
summary: "CLI reference for `propai approvals` (exec approvals for gateway or node hosts)"
read_when:
  - You want to edit exec approvals from the CLI
  - You need to manage allowlists on gateway or node hosts
title: "approvals"
---

# `propai approvals`

Manage exec approvals for the **local host**, **gateway host**, or a **node host**.
By default, commands target the local approvals file on disk. Use `--gateway` to target the gateway, or `--node` to target a specific node.

Related:

- Exec approvals: [Exec approvals](/tools/exec-approvals)
- Nodes: [Nodes](/nodes)

## Common commands

```bash
propai approvals get
propai approvals get --node <id|name|ip>
propai approvals get --gateway
```

## Replace approvals from a file

```bash
propai approvals set --file ./exec-approvals.json
propai approvals set --node <id|name|ip> --file ./exec-approvals.json
propai approvals set --gateway --file ./exec-approvals.json
```

## Allowlist helpers

```bash
propai approvals allowlist add "~/Projects/**/bin/rg"
propai approvals allowlist add --agent main --node <id|name|ip> "/usr/bin/uptime"
propai approvals allowlist add --agent "*" "/usr/bin/uname"

propai approvals allowlist remove "~/Projects/**/bin/rg"
```

## Notes

- `--node` uses the same resolver as `propai nodes` (id, name, ip, or id prefix).
- `--agent` defaults to `"*"`, which applies to all agents.
- Approvals files are stored per host at `~/.propai/exec-approvals.json`.



