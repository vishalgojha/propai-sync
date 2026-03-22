## PropAI Sync Android App

Status: **extremely alpha**. We’re iterating quickly and focusing on real broker workflows.

PropAI Sync is a cloud‑first real estate assistant for Mumbai brokers. It’s chat‑first, minimal, and optimized for fast reading, quick replies, and WhatsApp follow‑ups.

### What It Does

- Chat‑first assistant (text + mic in the chat composer)
- Provider‑based cloud AI (Claude/Anthropic default)
- WhatsApp sync via notification listener (when enabled)
- Screen / Auto modes remain available for advanced workflows

## Open in Android Studio

- Open the repository root folder.

## Build / Run

```bash
./gradlew :app:assembleDebug
./gradlew :app:installDebug
./gradlew :app:testDebugUnitTest
```

## Configure AI Provider

1) Open **Settings → AI Provider**.
2) Select your provider (Claude/Anthropic default).
3) Paste API key and model (if required).

The app is cloud‑only and requires network access for responses.

## Permissions (Optional but Recommended)

- **Microphone** for voice input inside chat.
- **Notification access** for WhatsApp sync.
- **Accessibility** if Auto mode needs it.

## Run on a Real Android Phone (USB)

1) On phone, enable **Developer options** + **USB debugging**.
2) Connect by USB and accept the debugging trust prompt on phone.
3) Verify ADB can see the device:

```bash
adb devices -l
```

4) Install + launch debug build:

```bash
pnpm android:install
pnpm android:run
```

If `adb devices -l` shows `unauthorized`, re‑plug and accept the trust prompt again.

## Hot Reload / Fast Iteration

This app is native Kotlin + Jetpack Compose.

- For Compose UI edits: use Android Studio **Live Edit** on a debug build.
- For many non‑structural code/resource changes: use Android Studio **Apply Changes**.
- For structural/native/manifest/Gradle changes: do a full reinstall (`pnpm android:run`).

## Kotlin Lint + Format

```bash
pnpm android:lint
pnpm android:format
```

Android framework/resource lint (separate pass):

```bash
pnpm android:lint:android
```

Direct Gradle tasks:

```bash
./gradlew :app:ktlintCheck :benchmark:ktlintCheck
./gradlew :app:ktlintFormat :benchmark:ktlintFormat
./gradlew :app:lintDebug
```
- If `androidassistant qr` fails with `Gateway is only bound to loopback`, rerun it with a reachable URL:

```bash
androidassistant qr --public-url wss://gateway.example.com
```

Or persist the same value under `plugins.entries["device-pair"].config.publicUrl`, or expose the gateway on LAN/Tailscale.

3) Approve pairing (on the gateway machine):

```bash
androidassistant devices list
androidassistant devices approve <requestId>
```

More details: `docs/platforms/android.md`.

## Permissions

- Discovery:
  - Android 13+ (`API 33+`): `NEARBY_WIFI_DEVICES`
  - Android 12 and below: `ACCESS_FINE_LOCATION` (required for NSD scanning)
- Foreground service notification (Android 13+): `POST_NOTIFICATIONS`
- Camera:
  - `CAMERA` for `camera.snap` and `camera.clip`
  - `RECORD_AUDIO` for `camera.clip` when `includeAudio=true`

## Integration Capability Test (Preconditioned)

This suite assumes setup is already done manually. It does **not** install/run/pair automatically.

Pre-req checklist:

1) Gateway is running and reachable from the Android app.
2) Android app is connected to that gateway and `androidassistant nodes status` shows it as paired + connected.
3) App stays unlocked and in foreground for the whole run.
4) Open the app **Screen** tab and keep it active during the run (canvas/A2UI commands require the canvas WebView attached there).
5) Grant runtime permissions for capabilities you expect to pass (camera/mic/location/notification listener/location, etc.).
6) No interactive system dialogs should be pending before test start.
7) Canvas host is enabled and reachable from the device (do not run gateway with `ANDROID_ASSISTANT_SKIP_CANVAS_HOST=1`; startup logs should include `canvas host mounted at .../__androidassistant__/`).
8) Local operator test client pairing is approved. If first run fails with `pairing required`, approve latest pending device pairing request, then rerun:
9) For A2UI checks, keep the app on **Screen** tab; the node now auto-refreshes canvas capability once on first A2UI reachability failure (TTL-safe retry).

```bash
androidassistant devices list
androidassistant devices approve --latest
```

Run:

```bash
pnpm android:test:integration
```

Optional overrides:

- `ANDROID_ASSISTANT_ANDROID_GATEWAY_URL=ws://...` (default: from your local AndroidAssistant config)
- `ANDROID_ASSISTANT_ANDROID_GATEWAY_TOKEN=...`
- `ANDROID_ASSISTANT_ANDROID_GATEWAY_PASSWORD=...`
- `ANDROID_ASSISTANT_ANDROID_NODE_ID=...` or `ANDROID_ASSISTANT_ANDROID_NODE_NAME=...`

What it does:

- Reads `node.describe` command list from the selected Android node.
- Invokes advertised non-interactive commands.
- Skips `screen.record` in this suite (Android requires interactive per-invocation screen-capture consent).
- Asserts command contracts (success or expected deterministic error for safe-invalid calls like `sms.send` and `notifications.actions`).

Common failure quick-fixes:

- `pairing required` before tests start:
  - approve pending device pairing (`androidassistant devices approve --latest`) and rerun.
- `A2UI host not reachable` / `A2UI_HOST_NOT_CONFIGURED`:
  - ensure gateway canvas host is running and reachable, keep the app on the **Screen** tab. The app will auto-refresh canvas capability once; if it still fails, reconnect app and rerun.
- `NODE_BACKGROUND_UNAVAILABLE: canvas unavailable`:
  - app is not effectively ready for canvas commands; keep app foregrounded and **Screen** tab active.

## Contributions

This Android app is currently being rebuilt.
Maintainer: @obviyus. For issues/questions/contributions, please open an issue or reach out on Discord.

