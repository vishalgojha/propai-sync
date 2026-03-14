---
summary: "CLI reference for `propai reset` (reset local state/config)"
read_when:
  - You want to wipe local state while keeping the CLI installed
  - You want a dry-run of what would be removed
title: "reset"
---

# `propai reset`

Reset local config/state (keeps the CLI installed).

```bash
propai backup create
propai reset
propai reset --dry-run
propai reset --scope config+creds+sessions --yes --non-interactive
```

Run `propai backup create` first if you want a restorable snapshot before removing local state.


