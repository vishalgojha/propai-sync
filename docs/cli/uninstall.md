---
summary: "CLI reference for `propai uninstall` (remove gateway service + local data)"
read_when:
  - You want to remove the gateway service and/or local state
  - You want a dry-run first
title: "uninstall"
---

# `propai uninstall`

Uninstall the gateway service + local data (CLI remains).

```bash
propai backup create
propai uninstall
propai uninstall --all --yes
propai uninstall --dry-run
```

Run `propai backup create` first if you want a restorable snapshot before removing state or workspaces.


