Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Write-Step([string]$Message) {
  Write-Host ("[propai-desktop] " + $Message)
}

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..\..")
$installer = Join-Path $repoRoot "apps\tauri\src-tauri\target\release\bundle\nsis\PROPAI_0.1.0_x64-setup.exe"

Write-Step ("Repo root: " + $repoRoot)

$signingKey = $env:TAURI_SIGNING_PRIVATE_KEY
$hasSigningKey = $signingKey -and $signingKey.Trim()

Write-Step "Installing desktop app deps..."
pnpm -C (Join-Path $repoRoot "apps\tauri") install

Write-Step "Building desktop installer (this can take a while)..."
if (-not $hasSigningKey) {
  Write-Step "No TAURI_SIGNING_PRIVATE_KEY found; skipping updater artifacts + code signing."
  $overrideConfig = @'
{
  "bundle": { "createUpdaterArtifacts": false },
  "plugins": { "updater": { "pubkey": "" } }
}
'@
  $overridePath = Join-Path $env:TEMP "tauri.windows.local.json"
  $overrideConfig | Set-Content -Path $overridePath -Encoding UTF8
  if ($env:TAURI_SIGNING_PUBLIC_KEY) {
    Remove-Item Env:TAURI_SIGNING_PUBLIC_KEY -ErrorAction SilentlyContinue
  }
  pnpm -C (Join-Path $repoRoot "apps\tauri") build:verbose -- --no-sign --config $overridePath
} else {
  pnpm -C (Join-Path $repoRoot "apps\tauri") build:verbose
}

if (Test-Path $installer) {
  Write-Step ("Installer ready: " + $installer)
  Write-Step "Run it to install/update the app."
  exit 0
}

throw ("Build finished but installer not found at: " + $installer)



