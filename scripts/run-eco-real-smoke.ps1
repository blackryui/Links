#Requires -Version 5.1
param(
  [Parameter(Mandatory = $true)][string]$Root
)

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
$resolvedRoot = (Resolve-Path -LiteralPath $Root -ErrorAction Stop).Path
$artifactDir = Join-Path $repoRoot '.local-artifacts\eco-real-smoke'
$artifactPath = Join-Path $artifactDir 'local-stdio.json'

if (-not (Test-Path -LiteralPath $resolvedRoot -PathType Container)) {
  throw "Smoke root is not a directory: $resolvedRoot"
}

Push-Location $repoRoot
try {
  $nodeCommand = Get-Command node -ErrorAction Stop
  $nodeVersion = (& node --version).Trim()
  if ($LASTEXITCODE -ne 0) { throw 'node --version failed' }
  if ($nodeVersion -notmatch '^v24\.') {
    throw "ECO real smoke requires system Node.js 24.x; got $nodeVersion at $($nodeCommand.Source)"
  }

  $corepackCommand = Get-Command corepack -ErrorAction Stop
  Write-Host "System Node: $($nodeCommand.Source) $nodeVersion"
  Write-Host "Corepack: $($corepackCommand.Source)"
  Write-Host "Workspace root: $resolvedRoot"

  & corepack enable
  if ($LASTEXITCODE -ne 0) { throw "corepack enable failed with exit code $LASTEXITCODE" }

  & corepack prepare pnpm@10.15.0 --activate
  if ($LASTEXITCODE -ne 0) { throw "corepack prepare failed with exit code $LASTEXITCODE" }

  & corepack pnpm@10.15.0 install --frozen-lockfile
  if ($LASTEXITCODE -ne 0) { throw "install --frozen-lockfile failed with exit code $LASTEXITCODE" }

  & corepack pnpm@10.15.0 build:eco
  if ($LASTEXITCODE -ne 0) { throw "build:eco failed with exit code $LASTEXITCODE" }

  New-Item -ItemType Directory -Force -Path $artifactDir | Out-Null
  $smokeOutput = & corepack pnpm@10.15.0 smoke:eco:local -- --root $resolvedRoot
  if ($LASTEXITCODE -ne 0) { throw "smoke:eco:local failed with exit code $LASTEXITCODE" }

  $smokeText = ($smokeOutput -join "`n").Trim()
  if ([string]::IsNullOrWhiteSpace($smokeText)) { throw 'smoke:eco:local returned no JSON output' }

  try {
    $smokeResult = $smokeText | ConvertFrom-Json
  }
  catch {
    throw "smoke:eco:local did not return valid JSON: $($_.Exception.Message)"
  }

  if ($smokeResult.ok -ne $true) {
    throw 'smoke:eco:local JSON did not report ok=true'
  }

  [IO.File]::WriteAllText($artifactPath, $smokeText + "`r`n", [Text.UTF8Encoding]::new($false))
  Write-Host "ECO local stdio smoke PASS"
  Write-Host "Evidence: $artifactPath"
  Write-Output $smokeText
}
finally {
  Pop-Location
}
