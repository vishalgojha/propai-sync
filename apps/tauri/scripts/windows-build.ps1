Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Write-Step([string]$Message) {
  Write-Host ("[propai-desktop] " + $Message)
}

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$installer = Join-Path $repoRoot "apps\tauri\src-tauri\target\release\bundle\nsis\PROPAI_0.1.0_x64-setup.exe"

Write-Step ("Repo root: " + $repoRoot)

Write-Step "Installing desktop app deps..."
pnpm -C (Join-Path $repoRoot "apps\tauri") install

Write-Step "Building desktop installer (this can take a while)..."
pnpm -C (Join-Path $repoRoot "apps\tauri") build:verbose

if (Test-Path $installer) {
  Write-Step ("Installer ready: " + $installer)
  Write-Step "Run it to install/update the app."
  exit 0
}

throw ("Build finished but installer not found at: " + $installer)



