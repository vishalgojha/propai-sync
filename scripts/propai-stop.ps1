[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"

$patterns = @(
  "*\\openclaw.mjs gateway*",
  "*\\propai.mjs start*",
  "*\\propaiclaw.mjs start*",
  "*\\openclaw.mjs tui*",
  "*\\propai.mjs tui*",
  "*\\propaiclaw.mjs tui*",
  "*\\dist\\index.js gateway*",
  "*\\node_modules\\propaiclaw\\openclaw.mjs gateway*",
  "*\\node_modules\\propaiclaw\\propai.mjs start*",
  "*\\node_modules\\propaiclaw\\propai.mjs tui*",
  "*\\node_modules\\propaiclaw\\propaiclaw.mjs start*",
  "*\\node_modules\\propaiclaw\\propaiclaw.mjs tui*",
  "*\\node_modules\\propaiclaw\\dist\\index.js gateway*"
)

function Get-GatewayLockPids {
  $lockDir = Join-Path ([System.IO.Path]::GetTempPath()) "openclaw"
  if (-not (Test-Path $lockDir)) {
    return @()
  }

  $lockFiles = Get-ChildItem -Path $lockDir -Filter "gateway.*.lock" -File -ErrorAction SilentlyContinue
  if (-not $lockFiles -or $lockFiles.Count -eq 0) {
    return @()
  }

  $pids = @()
  foreach ($lockFile in $lockFiles) {
    try {
      $payload = Get-Content -Path $lockFile.FullName -Raw -ErrorAction Stop | ConvertFrom-Json -ErrorAction Stop
      $candidatePid = [int]$payload.pid
      if ($candidatePid -gt 0) {
        $pids += $candidatePid
      }
    } catch {
      continue
    }
  }
  return $pids | Select-Object -Unique
}

$targetsByPid = @{}
try {
  $cmdlineMatches = Get-CimInstance Win32_Process | Where-Object {
    if ($_.Name -ne "node.exe") {
      return $false
    }
    $cmd = $_.CommandLine
    if ([string]::IsNullOrWhiteSpace($cmd)) {
      return $false
    }
    foreach ($pattern in $patterns) {
      if ($cmd -like $pattern) {
        return $true
      }
    }
    return $false
  }
  foreach ($proc in $cmdlineMatches) {
    $targetsByPid[[string]$proc.ProcessId] = $proc
  }
} catch {
  Write-Warning "Could not inspect command lines; falling back to gateway lock PID lookup."
}

$lockPids = Get-GatewayLockPids
foreach ($candidatePid in $lockPids) {
  try {
    $proc = Get-CimInstance Win32_Process -Filter "ProcessId=$candidatePid" -ErrorAction Stop
    if (-not $proc) {
      continue
    }
    if ($proc.Name -ne "node.exe" -and $proc.Name -ne "bun.exe") {
      continue
    }
    $targetsByPid[[string]$proc.ProcessId] = $proc
  } catch {
    continue
  }
}

$targets = @($targetsByPid.Values | Sort-Object -Property ProcessId -Unique)
if (-not $targets -or $targets.Count -eq 0) {
  Write-Host "No PropAI/OpenClaw gateway or TUI node processes found."
  exit 0
}

Write-Host "Stopping $($targets.Count) PropAI/OpenClaw process(es)..."
foreach ($proc in $targets) {
  try {
    Stop-Process -Id $proc.ProcessId -Force -ErrorAction Stop
    Write-Host "  stopped PID $($proc.ProcessId)"
  } catch {
    Write-Warning "  failed to stop PID $($proc.ProcessId): $($_.Exception.Message)"
  }
}

exit 0
