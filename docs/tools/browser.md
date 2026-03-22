---
summary: "Integrated browser control service + action commands"
read_when:
  - Adding agent-controlled browser automation
  - Debugging why propai is interfering with your own Chrome
title: "Browser (propai-managed)"
---

# Browser (propai-managed)

propai can run a **dedicated Chrome/Brave/Edge/Chromium profile** that the agent controls.
It is isolated from your personal browser and is managed through a small local
control service inside the Gateway (loopback only).

Beginner view:

- Think of it as a **separate, agent-only browser**.
- The `propai` profile does **not** touch your personal browser profile.
- The agent can **open tabs, read pages, click, and type** in a safe lane.
- The default `chrome` profile uses the **system default Chromium browser** via the
  extension relay; switch to `propai` for the isolated managed browser.

## What you get

- A separate browser profile named **propai** (orange accent by default).
- Deterministic tab control (list/open/focus/close).
- Agent actions (click/type/drag/select), snapshots, screenshots, PDFs.
- Optional multi-profile support (`propai`, `work`, `remote`, ...).

This browser is **not** your daily driver. It is a safe, isolated surface for
agent automation and verification.

## Quick start

```bash
propai browser --browser-profile propai status
propai browser --browser-profile propai start
propai browser --browser-profile propai open https://example.com
propai browser --browser-profile propai snapshot
```

If you get “Browser disabled”, enable it in config (see below) and restart the
Gateway.

## Profiles: `propai` vs `chrome`

- `propai`: managed, isolated browser (no extension required).
- `chrome`: extension relay to your **system browser** (requires the propai
  extension to be attached to a tab).

Set `browser.defaultProfile: "propai"` if you want managed mode by default.

## Configuration

Browser settings live in `~/.propai/propai.json`.

```json5
{
  browser: {
    enabled: true, // default: true
    ssrfPolicy: {
      dangerouslyAllowPrivateNetwork: true, // default trusted-network mode
      // allowPrivateNetwork: true, // legacy alias
      // hostnameAllowlist: ["*.example.com", "example.com"],
      // allowedHostnames: ["localhost"],
    },
    // cdpUrl: "http://127.0.0.1:18792", // legacy single-profile override
    remoteCdpTimeoutMs: 1500, // remote CDP HTTP timeout (ms)
    remoteCdpHandshakeTimeoutMs: 3000, // remote CDP WebSocket handshake timeout (ms)
    defaultProfile: "chrome",
    color: "#FF4500",
    headless: false,
    noSandbox: false,
    attachOnly: false,
    executablePath: "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
    profiles: {
      propai: { cdpPort: 18800, color: "#FF4500" },
      work: { cdpPort: 18801, color: "#0066CC" },
      remote: { cdpUrl: "http://10.0.0.42:9222", color: "#00AA00" },
    },
  },
}
```

Notes:

- The browser control service binds to loopback on a port derived from `gateway.port`
  (default: `18791`, which is gateway + 2). The relay uses the next port (`18792`).
- If you override the Gateway port (`gateway.port` or `PROPAI_GATEWAY_PORT`),
  the derived browser ports shift to stay in the same “family”.
- `cdpUrl` defaults to the relay port when unset.
- `remoteCdpTimeoutMs` applies to remote (non-loopback) CDP reachability checks.
- `remoteCdpHandshakeTimeoutMs` applies to remote CDP WebSocket reachability checks.
- Browser navigation/open-tab is SSRF-guarded before navigation and best-effort re-checked on final `http(s)` URL after navigation.
- `browser.ssrfPolicy.dangerouslyAllowPrivateNetwork` defaults to `true` (trusted-network model). Set it to `false` for strict public-only browsing.
- `browser.ssrfPolicy.allowPrivateNetwork` remains supported as a legacy alias for compatibility.
- `attachOnly: true` means “never launch a local browser; only attach if it is already running.”
- `color` + per-profile `color` tint the browser UI so you can see which profile is active.
- Default profile is `propai` (propai-managed standalone browser). Use `defaultProfile: "chrome"` to opt into the Chrome extension relay.
- Auto-detect order: system default browser if Chromium-based; otherwise Chrome → Brave → Edge → Chromium → Chrome Canary.
- Local `propai` profiles auto-assign `cdpPort`/`cdpUrl` — set those only for remote CDP.

## Use Brave (or another Chromium-based browser)

If your **system default** browser is Chromium-based (Chrome/Brave/Edge/etc),
propai uses it automatically. Set `browser.executablePath` to override
auto-detection:

CLI example:

```bash
propai config set browser.executablePath "/usr/bin/google-chrome"
```

```json5
// macOS
{
  browser: {
    executablePath: "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser"
  }
}

// Windows
{
  browser: {
    executablePath: "C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe"
  }
}

// Linux
{
  browser: {
    executablePath: "/usr/bin/brave-browser"
  }
}
```

## Local vs remote control

- **Local control (default):** the Gateway starts the loopback control service and can launch a local browser.
- **Remote control (node host):** run a node host on the machine that has the browser; the Gateway proxies browser actions to it.
- **Remote CDP:** set `browser.profiles.<name>.cdpUrl` (or `browser.cdpUrl`) to
  attach to a remote Chromium-based browser. In this case, propai will not launch a local browser.

Remote CDP URLs can include auth:

- Query tokens (e.g., `https://provider.example?token=<token>`)
- HTTP Basic auth (e.g., `https://user:pass@provider.example`)

propai preserves the auth when calling `/json/*` endpoints and when connecting
to the CDP WebSocket. Prefer environment variables or secrets managers for
tokens instead of committing them to config files.

## Node browser proxy (zero-config default)

If you run a **node host** on the machine that has your browser, propai can
auto-route browser tool calls to that node without any extra browser config.
This is the default path for remote gateways.

Notes:

- The node host exposes its local browser control server via a **proxy command**.
- Profiles come from the node’s own `browser.profiles` config (same as local).
- Disable if you don’t want it:
  - On the node: `nodeHost.browserProxy.enabled=false`
  - On the gateway: `gateway.nodes.browser.mode="off"`

## Browserless (hosted remote CDP)

[Browserless](https://browserless.io) is a hosted Chromium service that exposes
CDP endpoints over HTTPS. You can point a propai browser profile at a
Browserless region endpoint and authenticate with your API key.

Example:

```json5
{
  browser: {
    enabled: true,
    defaultProfile: "browserless",
    remoteCdpTimeoutMs: 2000,
    remoteCdpHandshakeTimeoutMs: 4000,
    profiles: {
      browserless: {
        cdpUrl: "https://production-sfo.browserless.io?token=<BROWSERLESS_API_KEY>",
        color: "#00AA00",
      },
    },
  },
}
```

Notes:

- Replace `<BROWSERLESS_API_KEY>` with your real Browserless token.
- Choose the region endpoint that matches your Browserless account (see their docs).

## Direct WebSocket CDP providers

Some hosted browser services expose a **direct WebSocket** endpoint rather than
the standard HTTP-based CDP discovery (`/json/version`). propai supports both:

- **HTTP(S) endpoints** (e.g. Browserless) — propai calls `/json/version` to
  discover the WebSocket debugger URL, then connects.
- **WebSocket endpoints** (`ws://` / `wss://`) — propai connects directly,
  skipping `/json/version`. Use this for services like
  [Browserbase](https://www.browserbase.com) or any provider that hands you a
  WebSocket URL.

### Browserbase

[Browserbase](https://www.browserbase.com) is a cloud platform for running
headless browsers with built-in CAPTCHA solving, stealth mode, and residential
proxies.

```json5
{
  browser: {
    enabled: true,
    defaultProfile: "browserbase",
    remoteCdpTimeoutMs: 3000,
    remoteCdpHandshakeTimeoutMs: 5000,
    profiles: {
      browserbase: {
        cdpUrl: "wss://connect.browserbase.com?apiKey=<BROWSERBASE_API_KEY>",
        color: "#F97316",
      },
    },
  },
}
```

Notes:

- [Sign up](https://www.browserbase.com/sign-up) and copy your **API Key**
  from the [Overview dashboard](https://www.browserbase.com/overview).
- Replace `<BROWSERBASE_API_KEY>` with your real Browserbase API key.
- Browserbase auto-creates a browser session on WebSocket connect, so no
  manual session creation step is needed.
- The free tier allows one concurrent session and one browser hour per month.
  See [pricing](https://www.browserbase.com/pricing) for paid plan limits.
- See the [Browserbase docs](https://docs.browserbase.com) for full API
  reference, SDK guides, and integration examples.

## Security

Key ideas:

- Browser control is loopback-only; access flows through the Gateway’s auth or node pairing.
- If browser control is enabled and no auth is configured, propai auto-generates `gateway.auth.token` on startup and persists it to config.
- Keep the Gateway and any node hosts on a private network (Tailscale); avoid public exposure.
- Treat remote CDP URLs/tokens as secrets; prefer env vars or a secrets manager.

Remote CDP tips:

- Prefer encrypted endpoints (HTTPS or WSS) and short-lived tokens where possible.
- Avoid embedding long-lived tokens directly in config files.

## Profiles (multi-browser)

propai supports multiple named profiles (routing configs). Profiles can be:

- **propai-managed**: a dedicated Chromium-based browser instance with its own user data directory + CDP port
- **remote**: an explicit CDP URL (Chromium-based browser running elsewhere)
- **extension relay**: your existing Chrome tab(s) via the local relay + Chrome extension

Defaults:

- The `propai` profile is auto-created if missing.
- The `chrome` profile is built-in for the Chrome extension relay (points at `http://127.0.0.1:18792` by default).
- Local CDP ports allocate from **18800–18899** by default.
- Deleting a profile moves its local data directory to Trash.

All control endpoints accept `?profile=<name>`; the CLI uses `--browser-profile`.

## Chrome extension relay (use your existing Chrome)

propai can also drive **your existing Chrome tabs** (no separate “propai” Chrome instance) via a local CDP relay + a Chrome extension.

Full guide: [Chrome extension](/tools/chrome-extension)

Flow:

- The Gateway runs locally (same machine) or a node host runs on the browser machine.
- A local **relay server** listens at a loopback `cdpUrl` (default: `http://127.0.0.1:18792`).
- You click the **propai Browser Relay** extension icon on a tab to attach (it does not auto-attach).
- The agent controls that tab via the normal `browser` tool, by selecting the right profile.

If the Gateway runs elsewhere, run a node host on the browser machine so the Gateway can proxy browser actions.

### Sandboxed sessions

If the agent session is sandboxed, the `browser` tool may default to `target="sandbox"` (sandbox browser).
Chrome extension relay takeover requires host browser control, so either:

- run the session unsandboxed, or
- set `agents.defaults.sandbox.browser.allowHostControl: true` and use `target="host"` when calling the tool.

### Setup

1. Load the extension (dev/unpacked):

```bash
propai browser extension install
```

- Chrome → `chrome://extensions` → enable “Developer mode”
- “Load unpacked” → select the directory printed by `propai browser extension path`
- Pin the extension, then click it on the tab you want to control (badge shows `ON`).

2. Use it:

- CLI: `propai browser --browser-profile chrome tabs`
- Agent tool: `browser` with `profile="chrome"`

Optional: if you want a different name or relay port, create your own profile:

```bash
propai browser create-profile \
  --name my-chrome \
  --driver extension \
  --cdp-url http://127.0.0.1:18792 \
  --color "#00AA00"
```

Notes:

- This mode relies on Playwright-on-CDP for most operations (screenshots/snapshots/actions).
- Detach by clicking the extension icon again.
- Leave the relay loopback-only by default. If the relay must be reachable from a different network namespace (for example Gateway in WSL2, Chrome on Windows), set `browser.relayBindHost` to an explicit bind address such as `0.0.0.0` while keeping the surrounding network private and authenticated.

WSL2 / cross-namespace example:

```json5
{
  browser: {
    enabled: true,
    relayBindHost: "0.0.0.0",
    defaultProfile: "chrome",
  },
}
```

## Isolation guarantees

- **Dedicated user data dir**: never touches your personal browser profile.
- **Dedicated ports**: avoids `9222` to prevent collisions with dev workflows.
- **Deterministic tab control**: target tabs by `targetId`, not “last tab”.

## Browser selection

When launching locally, propai picks the first available:

1. Chrome
2. Brave
3. Edge
4. Chromium
5. Chrome Canary

You can override with `browser.executablePath`.

Platforms:

- macOS: checks `/Applications` and `~/Applications`.
- Linux: looks for `google-chrome`, `brave`, `microsoft-edge`, `chromium`, etc.
- Windows: checks common install locations.

## Control API (optional)

For local integrations only, the Gateway exposes a small loopback HTTP API:

- Status/start/stop: `GET /`, `POST /start`, `POST /stop`
- Tabs: `GET /tabs`, `POST /tabs/open`, `POST /tabs/focus`, `DELETE /tabs/:targetId`
- Snapshot/screenshot: `GET /snapshot`, `POST /screenshot`
- Actions: `POST /navigate`, `POST /act`
- Hooks: `POST /hooks/file-chooser`, `POST /hooks/dialog`
- Downloads: `POST /download`, `POST /wait/download`
- Debugging: `GET /console`, `POST /pdf`
- Debugging: `GET /errors`, `GET /requests`, `POST /trace/start`, `POST /trace/stop`, `POST /highlight`
- Network: `POST /response/body`
- State: `GET /cookies`, `POST /cookies/set`, `POST /cookies/clear`
- State: `GET /storage/:kind`, `POST /storage/:kind/set`, `POST /storage/:kind/clear`
- Settings: `POST /set/offline`, `POST /set/headers`, `POST /set/credentials`, `POST /set/geolocation`, `POST /set/media`, `POST /set/timezone`, `POST /set/locale`, `POST /set/device`

All endpoints accept `?profile=<name>`.

If gateway auth is configured, browser HTTP routes require auth too:

- `Authorization: Bearer <gateway token>`
- `x-propai-password: <gateway password>` or HTTP Basic auth with that password

### Playwright requirement

Some features (navigate/act/AI snapshot/role snapshot, element screenshots, PDF) require
Playwright. If Playwright isn’t installed, those endpoints return a clear 501
error. ARIA snapshots and basic screenshots still work for propai-managed Chrome.
For the Chrome extension relay driver, ARIA snapshots and screenshots require Playwright.

If you see `Playwright is not available in this gateway build`, install the full
Playwright package (not `playwright-core`) and restart the gateway, or reinstall
propai with browser support.

#### Docker Playwright install

If your Gateway runs in Docker, avoid `npx playwright` (npm override conflicts).
Use the bundled CLI instead:

```bash
docker compose run --rm propai-cli \
  node /app/node_modules/playwright-core/cli.js install chromium
```

To persist browser downloads, set `PLAYWRIGHT_BROWSERS_PATH` (for example,
`/home/node/.cache/ms-playwright`) and make sure `/home/node` is persisted via
`PROPAI_HOME_VOLUME` or a bind mount. See [Docker](/install/docker).

## How it works (internal)

High-level flow:

- A small **control server** accepts HTTP requests.
- It connects to Chromium-based browsers (Chrome/Brave/Edge/Chromium) via **CDP**.
- For advanced actions (click/type/snapshot/PDF), it uses **Playwright** on top
  of CDP.
- When Playwright is missing, only non-Playwright operations are available.

This design keeps the agent on a stable, deterministic interface while letting
you swap local/remote browsers and profiles.

## CLI quick reference

All commands accept `--browser-profile <name>` to target a specific profile.
All commands also accept `--json` for machine-readable output (stable payloads).

Basics:

- `propai browser status`
- `propai browser start`
- `propai browser stop`
- `propai browser tabs`
- `propai browser tab`
- `propai browser tab new`
- `propai browser tab select 2`
- `propai browser tab close 2`
- `propai browser open https://example.com`
- `propai browser focus abcd1234`
- `propai browser close abcd1234`

Inspection:

- `propai browser screenshot`
- `propai browser screenshot --full-page`
- `propai browser screenshot --ref 12`
- `propai browser screenshot --ref e12`
- `propai browser snapshot`
- `propai browser snapshot --format aria --limit 200`
- `propai browser snapshot --interactive --compact --depth 6`
- `propai browser snapshot --efficient`
- `propai browser snapshot --labels`
- `propai browser snapshot --selector "#main" --interactive`
- `propai browser snapshot --frame "iframe#main" --interactive`
- `propai browser console --level error`
- `propai browser errors --clear`
- `propai browser requests --filter api --clear`
- `propai browser pdf`
- `propai browser responsebody "**/api" --max-chars 5000`

Actions:

- `propai browser navigate https://example.com`
- `propai browser resize 1280 720`
- `propai browser click 12 --double`
- `propai browser click e12 --double`
- `propai browser type 23 "hello" --submit`
- `propai browser press Enter`
- `propai browser hover 44`
- `propai browser scrollintoview e12`
- `propai browser drag 10 11`
- `propai browser select 9 OptionA OptionB`
- `propai browser download e12 report.pdf`
- `propai browser waitfordownload report.pdf`
- `propai browser upload /tmp/propai/uploads/file.pdf`
- `propai browser fill --fields '[{"ref":"1","type":"text","value":"Ada"}]'`
- `propai browser dialog --accept`
- `propai browser wait --text "Done"`
- `propai browser wait "#main" --url "**/dash" --load networkidle --fn "window.ready===true"`
- `propai browser evaluate --fn '(el) => el.textContent' --ref 7`
- `propai browser highlight e12`
- `propai browser trace start`
- `propai browser trace stop`

State:

- `propai browser cookies`
- `propai browser cookies set session abc123 --url "https://example.com"`
- `propai browser cookies clear`
- `propai browser storage local get`
- `propai browser storage local set theme dark`
- `propai browser storage session clear`
- `propai browser set offline on`
- `propai browser set headers --headers-json '{"X-Debug":"1"}'`
- `propai browser set credentials user pass`
- `propai browser set credentials --clear`
- `propai browser set geo 37.7749 -122.4194 --origin "https://example.com"`
- `propai browser set geo --clear`
- `propai browser set media dark`
- `propai browser set timezone America/New_York`
- `propai browser set locale en-US`
- `propai browser set device "iPhone 14"`

Notes:

- `upload` and `dialog` are **arming** calls; run them before the click/press
  that triggers the chooser/dialog.
- Download and trace output paths are constrained to propai temp roots:
  - traces: `/tmp/propai` (fallback: `${os.tmpdir()}/propai`)
  - downloads: `/tmp/propai/downloads` (fallback: `${os.tmpdir()}/propai/downloads`)
- Upload paths are constrained to an propai temp uploads root:
  - uploads: `/tmp/propai/uploads` (fallback: `${os.tmpdir()}/propai/uploads`)
- `upload` can also set file inputs directly via `--input-ref` or `--element`.
- `snapshot`:
  - `--format ai` (default when Playwright is installed): returns an AI snapshot with numeric refs (`aria-ref="<n>"`).
  - `--format aria`: returns the accessibility tree (no refs; inspection only).
  - `--efficient` (or `--mode efficient`): compact role snapshot preset (interactive + compact + depth + lower maxChars).
  - Config default (tool/CLI only): set `browser.snapshotDefaults.mode: "efficient"` to use efficient snapshots when the caller does not pass a mode (see [Gateway configuration](/gateway/configuration#browser-propai-managed-browser)).
  - Role snapshot options (`--interactive`, `--compact`, `--depth`, `--selector`) force a role-based snapshot with refs like `ref=e12`.
  - `--frame "<iframe selector>"` scopes role snapshots to an iframe (pairs with role refs like `e12`).
  - `--interactive` outputs a flat, easy-to-pick list of interactive elements (best for driving actions).
  - `--labels` adds a viewport-only screenshot with overlayed ref labels (prints `MEDIA:<path>`).
- `click`/`type`/etc require a `ref` from `snapshot` (either numeric `12` or role ref `e12`).
  CSS selectors are intentionally not supported for actions.

## Snapshots and refs

propai supports two “snapshot” styles:

- **AI snapshot (numeric refs)**: `propai browser snapshot` (default; `--format ai`)
  - Output: a text snapshot that includes numeric refs.
  - Actions: `propai browser click 12`, `propai browser type 23 "hello"`.
  - Internally, the ref is resolved via Playwright’s `aria-ref`.

- **Role snapshot (role refs like `e12`)**: `propai browser snapshot --interactive` (or `--compact`, `--depth`, `--selector`, `--frame`)
  - Output: a role-based list/tree with `[ref=e12]` (and optional `[nth=1]`).
  - Actions: `propai browser click e12`, `propai browser highlight e12`.
  - Internally, the ref is resolved via `getByRole(...)` (plus `nth()` for duplicates).
  - Add `--labels` to include a viewport screenshot with overlayed `e12` labels.

Ref behavior:

- Refs are **not stable across navigations**; if something fails, re-run `snapshot` and use a fresh ref.
- If the role snapshot was taken with `--frame`, role refs are scoped to that iframe until the next role snapshot.

## Wait power-ups

You can wait on more than just time/text:

- Wait for URL (globs supported by Playwright):
  - `propai browser wait --url "**/dash"`
- Wait for load state:
  - `propai browser wait --load networkidle`
- Wait for a JS predicate:
  - `propai browser wait --fn "window.ready===true"`
- Wait for a selector to become visible:
  - `propai browser wait "#main"`

These can be combined:

```bash
propai browser wait "#main" \
  --url "**/dash" \
  --load networkidle \
  --fn "window.ready===true" \
  --timeout-ms 15000
```

## Debug workflows

When an action fails (e.g. “not visible”, “strict mode violation”, “covered”):

1. `propai browser snapshot --interactive`
2. Use `click <ref>` / `type <ref>` (prefer role refs in interactive mode)
3. If it still fails: `propai browser highlight <ref>` to see what Playwright is targeting
4. If the page behaves oddly:
   - `propai browser errors --clear`
   - `propai browser requests --filter api --clear`
5. For deep debugging: record a trace:
   - `propai browser trace start`
   - reproduce the issue
   - `propai browser trace stop` (prints `TRACE:<path>`)

## JSON output

`--json` is for scripting and structured tooling.

Examples:

```bash
propai browser status --json
propai browser snapshot --interactive --json
propai browser requests --filter api --json
propai browser cookies --json
```

Role snapshots in JSON include `refs` plus a small `stats` block (lines/chars/refs/interactive) so tools can reason about payload size and density.

## State and environment knobs

These are useful for “make the site behave like X” workflows:

- Cookies: `cookies`, `cookies set`, `cookies clear`
- Storage: `storage local|session get|set|clear`
- Offline: `set offline on|off`
- Headers: `set headers --headers-json '{"X-Debug":"1"}'` (legacy `set headers --json '{"X-Debug":"1"}'` remains supported)
- HTTP basic auth: `set credentials user pass` (or `--clear`)
- Geolocation: `set geo <lat> <lon> --origin "https://example.com"` (or `--clear`)
- Media: `set media dark|light|no-preference|none`
- Timezone / locale: `set timezone ...`, `set locale ...`
- Device / viewport:
  - `set device "iPhone 14"` (Playwright device presets)
  - `set viewport 1280 720`

## Security & privacy

- The propai browser profile may contain logged-in sessions; treat it as sensitive.
- `browser act kind=evaluate` / `propai browser evaluate` and `wait --fn`
  execute arbitrary JavaScript in the page context. Prompt injection can steer
  this. Disable it with `browser.evaluateEnabled=false` if you do not need it.
- For logins and anti-bot notes (X/Twitter, etc.), see [Browser login + X/Twitter posting](/tools/browser-login).
- Keep the Gateway/node host private (loopback or tailnet-only).
- Remote CDP endpoints are powerful; tunnel and protect them.

Strict-mode example (block private/internal destinations by default):

```json5
{
  browser: {
    ssrfPolicy: {
      dangerouslyAllowPrivateNetwork: false,
      hostnameAllowlist: ["*.example.com", "example.com"],
      allowedHostnames: ["localhost"], // optional exact allow
    },
  },
}
```

## Troubleshooting

For Linux-specific issues (especially snap Chromium), see
[Browser troubleshooting](/tools/browser-linux-troubleshooting).

For WSL2 Gateway + Windows Chrome split-host setups, see
[WSL2 + Windows + remote Chrome CDP troubleshooting](/tools/browser-wsl2-windows-remote-cdp-troubleshooting).

## Agent tools + how control works

The agent gets **one tool** for browser automation:

- `browser` — status/start/stop/tabs/open/focus/close/snapshot/screenshot/navigate/act

How it maps:

- `browser snapshot` returns a stable UI tree (AI or ARIA).
- `browser act` uses the snapshot `ref` IDs to click/type/drag/select.
- `browser screenshot` captures pixels (full page or element).
- `browser` accepts:
  - `profile` to choose a named browser profile (propai, chrome, or remote CDP).
  - `target` (`sandbox` | `host` | `node`) to select where the browser lives.
  - In sandboxed sessions, `target: "host"` requires `agents.defaults.sandbox.browser.allowHostControl=true`.
  - If `target` is omitted: sandboxed sessions default to `sandbox`, non-sandbox sessions default to `host`.
  - If a browser-capable node is connected, the tool may auto-route to it unless you pin `target="host"` or `target="node"`.

This keeps the agent deterministic and avoids brittle selectors.



