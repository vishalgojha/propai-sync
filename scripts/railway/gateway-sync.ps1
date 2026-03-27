$ErrorActionPreference = "Stop"

$root = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$dest = Join-Path $root ".railway-gateway"

if (Test-Path $dest) {
  Remove-Item -Recurse -Force $dest
}

New-Item -ItemType Directory -Path $dest | Out-Null

$excludeDirs = @(
  ".git",
  ".agent",
  ".agents",
  "_incoming",
  "node_modules",
  "dist",
  "docs",
  "docs-i18n.out.log",
  "docs-i18n.err.log",
  "apps\\ios",
  "apps\\android",
  "test",
  "test-fixtures",
  "Swabble",
  "vendor",
  ".railway-gateway"
)

$excludeDirArgs = @()
foreach ($dir in $excludeDirs) {
  $excludeDirArgs += "/XD"
  $excludeDirArgs += (Join-Path $root $dir)
}

robocopy $root $dest /MIR /NFL /NDL /NJH /NJS /NP /R:1 /W:1 @excludeDirArgs | Out-Null

Write-Host "Gateway deploy context ready at $dest"
