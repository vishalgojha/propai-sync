Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Write-Step([string]$Message) {
  Write-Host ("[propai-desktop] " + $Message)
}

function Invoke-Checked([scriptblock]$Action, [string]$FailureMessage) {
  & $Action
  if ($LASTEXITCODE -ne 0) {
    throw $FailureMessage
  }
}

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..\..")
$msiDir = Join-Path $repoRoot "apps\tauri\src-tauri\target\release\bundle\msi"

Write-Step ("Repo root: " + $repoRoot)

$signingKey = $env:TAURI_SIGNING_PRIVATE_KEY
$hasSigningKey = $signingKey -and $signingKey.Trim()

Write-Step "Installing desktop app deps..."
Invoke-Checked { pnpm -C (Join-Path $repoRoot "apps\tauri") install } "Desktop dependency install failed."

Write-Step "Building desktop MSI (this can take a while)..."
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
  Invoke-Checked {
    pnpm -C (Join-Path $repoRoot "apps\tauri") build:verbose -- --no-sign --config $overridePath
  } "Desktop MSI build failed."
} else {
  Invoke-Checked { pnpm -C (Join-Path $repoRoot "apps\tauri") build:verbose } "Desktop MSI build failed."
}

if (Test-Path $msiDir) {
  $installer = Get-ChildItem -Path $msiDir -Filter "*.msi" -ErrorAction SilentlyContinue |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 1
  if ($installer) {
    Write-Step ("MSI ready: " + $installer.FullName)
    Write-Step "Run it to install/update the app."
    exit 0
  }
}

throw ("Build finished but MSI not found under: " + $msiDir)



