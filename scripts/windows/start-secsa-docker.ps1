# Waits for Docker Desktop, then starts SECSA compose (used by Windows logon task).
$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
Set-Location $repoRoot

if (-not (Test-Path (Join-Path $repoRoot ".env"))) {
  Write-Error "Missing $repoRoot\.env — copy .env.example and set JWT_SECRET."
}

$deadline = (Get-Date).AddMinutes(3)
while ((Get-Date) -lt $deadline) {
  docker info *> $null
  if ($LASTEXITCODE -eq 0) { break }
  Start-Sleep -Seconds 3
}

if ($LASTEXITCODE -ne 0) {
  Write-Error "Docker did not become ready within 3 minutes. Is Docker Desktop set to start on sign-in?"
}

docker compose up -d
