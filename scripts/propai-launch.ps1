[CmdletBinding()]
param(
  [switch]$NoTui,
  [int]$TimeoutSeconds = 25
)

$ErrorActionPreference = "Stop"

function Test-GatewayTcpReady {
  param(
    [string]$TargetHost = "127.0.0.1",
    [int]$Port = 18789,
    [int]$TimeoutMs = 700
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

$repoRoot = Split-Path -Parent $PSScriptRoot
$node = (Get-Command node -ErrorAction Stop).Source
$entry = Join-Path $repoRoot "propai.mjs"
$stopScript = Join-Path $PSScriptRoot "propai-stop.ps1"

if (-not (Test-Path $entry)) {
  throw "Cannot find propai.mjs at $entry"
}

& $stopScript

$gatewayReady = Test-GatewayTcpReady
if (-not $gatewayReady) {
  Write-Host "Starting PropAI gateway..."
  $gatewayProc = Start-Process -FilePath $node -ArgumentList @($entry, "start", "--debug") -WorkingDirectory $repoRoot -WindowStyle Minimized -PassThru
  Write-Host "  gateway PID $($gatewayProc.Id)"

  $startedAt = Get-Date
  $deadline = $startedAt.AddSeconds([Math]::Max(5, $TimeoutSeconds))
  while ((Get-Date) -lt $deadline) {
    if (Test-GatewayTcpReady) {
      $gatewayReady = $true
      break
    }
    Start-Sleep -Milliseconds 500
  }
}

if (-not $gatewayReady) {
  throw "Gateway did not become reachable on ws://127.0.0.1:18789 within $TimeoutSeconds seconds."
}

Write-Host "Gateway ready at ws://127.0.0.1:18789"

if ($NoTui) {
  Write-Host "Skipping TUI launch (--NoTui)."
  exit 0
}

Write-Host "Opening TUI..."
& $node $entry tui
exit $LASTEXITCODE
