param(
  [string]$Repo = "vishalgojha/propai-sync",
  [string]$Branch = "main",
  [string]$RequiredCheck = "validate",
  [switch]$NoRequiredChecks
)

$token = $env:GH_TOKEN
if ([string]::IsNullOrWhiteSpace($token)) {
  $token = $env:GITHUB_TOKEN
}

if ([string]::IsNullOrWhiteSpace($token)) {
  throw "Set GH_TOKEN or GITHUB_TOKEN first (must include repo admin permission)."
}

$headers = @{
  Authorization = "Bearer $token"
  Accept = "application/vnd.github+json"
  "X-GitHub-Api-Version" = "2022-11-28"
}

$uri = "https://api.github.com/repos/$Repo/branches/$Branch/protection"

$requiredStatus = $null
if (-not $NoRequiredChecks) {
  $requiredStatus = @{
    strict = $true
    checks = @(@{ context = $RequiredCheck; app_id = $null })
  }
}

$payload = @{
  required_status_checks = $requiredStatus
  enforce_admins = $true
  required_pull_request_reviews = @{
    dismiss_stale_reviews = $true
    require_code_owner_reviews = $false
    required_approving_review_count = 1
    require_last_push_approval = $false
  }
  restrictions = $null
  required_linear_history = $false
  allow_force_pushes = $false
  allow_deletions = $false
  block_creations = $false
  required_conversation_resolution = $true
  lock_branch = $false
  allow_fork_syncing = $true
} | ConvertTo-Json -Depth 10 -Compress

$result = Invoke-RestMethod -Method Put -Uri $uri -Headers $headers -ContentType "application/json" -Body $payload

Write-Host "Branch protection updated for ${Repo}:${Branch}"
if ($NoRequiredChecks) {
  Write-Host "Required status checks: disabled"
} else {
  Write-Host "Required status check: $RequiredCheck"
}
$result | Select-Object url,required_pull_request_reviews,enforce_admins,allow_force_pushes,allow_deletions | Format-List
