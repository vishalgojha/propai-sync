---
summary: "CLI reference for `propai config` (get/set/unset/file/validate)"
read_when:
  - You want to read or edit config non-interactively
title: "config"
---

# `propai config`

Config helpers: get/set/unset/validate values by path and print the active
config file. Run without a subcommand to open
the configure wizard (same as `propai configure`).

## Examples

```bash
propai config file
propai config get browser.executablePath
propai config set browser.executablePath "/usr/bin/google-chrome"
propai config set agents.defaults.heartbeat.every "2h"
propai config set agents.list[0].tools.exec.node "node-id-or-name"
propai config unset tools.web.search.apiKey
propai config validate
propai config validate --json
```

## Paths

Paths use dot or bracket notation:

```bash
propai config get agents.defaults.workspace
propai config get agents.list[0].id
```

Use the agent list index to target a specific agent:

```bash
propai config get agents.list
propai config set agents.list[1].tools.exec.node "node-id-or-name"
```

## Values

Values are parsed as JSON5 when possible; otherwise they are treated as strings.
Use `--strict-json` to require JSON5 parsing. `--json` remains supported as a legacy alias.

```bash
propai config set agents.defaults.heartbeat.every "0m"
propai config set gateway.port 19001 --strict-json
propai config set channels.whatsapp.groups '["*"]' --strict-json
```

## Subcommands

- `config file`: Print the active config file path (resolved from `PROPAI_CONFIG_PATH` or default location).

Restart the gateway after edits.

## Validate

Validate the current config against the active schema without starting the
gateway.

```bash
propai config validate
propai config validate --json
```



