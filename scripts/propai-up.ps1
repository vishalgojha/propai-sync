[CmdletBinding()]
param(
  [switch]$SkipSync,
  [switch]$NoOpen,
  [int]$GatewayTimeoutSeconds = 35
)

$ErrorActionPreference = "Stop"

function Test-TcpReady {
  param(
    [string]$TargetHost = "127.0.0.1",
    [int]$Port,
    [int]$TimeoutMs = 900
  )
  try {
    $client = New-Object System.Net.Sockets.TcpClient
    $iar = $client.BeginConnect($TargetHost, $Port, $null, $null)
    $ok = $iar.AsyncWaitHandle.WaitOne($TimeoutMs, $false)
    if (-not $ok) {
      $client.Close()
      return $false
    }
    $null = $client.EndConnect($iar)
    $client.Close()
    return $true
  } catch {
    return $false
  }
}

function Wait-TcpReady {
  param(
    [string]$TargetHost = "127.0.0.1",
    [int]$Port,
    [int]$TimeoutSeconds,
    [string]$Label
  )
  $deadline = (Get-Date).AddSeconds([Math]::Max(5, $TimeoutSeconds))
  while ((Get-Date) -lt $deadline) {
    if (Test-TcpReady -TargetHost $TargetHost -Port $Port) {
      return $true
    }
    Start-Sleep -Milliseconds 500
  }
  throw "$Label did not become reachable on ${TargetHost}:$Port within $TimeoutSeconds seconds."
}

$repoRoot = Split-Path -Parent $PSScriptRoot
$node = (Get-Command node -ErrorAction Stop).Source
$entry = Join-Path $repoRoot "propai.mjs"
$stopScript = Join-Path $PSScriptRoot "propai-stop.ps1"

if (-not (Test-Path $entry)) {
  throw "Cannot find propai.mjs at $entry"
}

Write-Host "Stopping stale PropAI/OpenClaw sessions..."
& $stopScript

if (-not $SkipSync) {
  Write-Host "Running setup/onboarding (propai sync)..."
  & $node $entry sync
  if ($LASTEXITCODE -ne 0) {
    throw "propai sync failed with exit code $LASTEXITCODE"
  }
} else {
  Write-Host "Skipping setup/onboarding (--SkipSync)."
}

Write-Host "Starting PropAI gateway..."
$gatewayProc = Start-Process -FilePath $node -ArgumentList @($entry, "start", "--debug") -WorkingDirectory $repoRoot -WindowStyle Minimized -PassThru
Write-Host "  gateway PID $($gatewayProc.Id)"
$null = Wait-TcpReady -Port 18789 -TimeoutSeconds $GatewayTimeoutSeconds -Label "Gateway"
Write-Host "Gateway ready at ws://127.0.0.1:18789"

$uiUrl = "http://127.0.0.1:18789/"

Write-Host ""
Write-Host "Ready:"
Write-Host "  UI: $uiUrl"

if (-not $NoOpen) {
  Start-Process $uiUrl | Out-Null
}
