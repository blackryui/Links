<#Requires -Version 5.1
.SYNOPSIS
Runs the local Windows ECO Headless verification that can be proven without a live ChatGPT connector.

.DESCRIPTION
Requires Windows and Node 24, proves lnwjud Desktop is not running, executes the
full repository `verify:eco` gate, checks the direct ECO runtime artifacts, and
captures non-secret status/evidence as JSON. It does not fabricate ChatGPT or
Codex live acceptance; those remain separate evidence entries.
#>

[CmdletBinding()]
param(
  [string]$OutputPath,
  [switch]$SkipRepositoryGate
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$repositoryRoot = Split-Path -Parent $PSScriptRoot
$commonPath = Join-Path $PSScriptRoot 'lib\eco-headless-common.ps1'
if (-not (Test-Path -LiteralPath $commonPath -PathType Leaf)) { throw "Missing ECO headless helper: $commonPath" }
. $commonPath

if ($env:OS -ne 'Windows_NT') { throw "ECO Windows acceptance requires Windows; OS=$($env:OS)" }
$nodeVersion = (& node --version 2>$null)
if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($nodeVersion)) { throw 'Node.js is required for ECO source verification.' }
if ($nodeVersion -notmatch '^v24\.') { throw "ECO source verification requires Node.js 24.x; got $nodeVersion" }

$desktopProcesses = @(Get-Process -Name 'lnwjud' -ErrorAction SilentlyContinue)
if ($desktopProcesses.Count -gt 0) {
  throw "lnwjud Desktop process is running (PID(s): $($desktopProcesses.Id -join ', ')). Stop it before ECO Headless acceptance."
}

$headSha = (& git -C $repositoryRoot rev-parse HEAD).Trim()
if ($LASTEXITCODE -ne 0 -or $headSha -notmatch '^[a-f0-9]{40}$') { throw 'Could not resolve current repository HEAD.' }
$rootPackage = Get-Content -LiteralPath (Join-Path $repositoryRoot 'package.json') -Raw | ConvertFrom-Json

$gateStatus = 'skipped'
if (-not $SkipRepositoryGate) {
  Push-Location $repositoryRoot
  try {
    & corepack pnpm@10.15.0 verify:eco
    if ($LASTEXITCODE -ne 0) { throw "verify:eco failed with exit code $LASTEXITCODE" }
    $gateStatus = 'pass'
  }
  finally {
    Pop-Location
  }
}

$runtimePaths = Resolve-EcoMcpRuntimePaths
$profileDir = Get-EcoProfileDirectory
$config = Read-EcoConfig -ProfileDirectory $profileDir
$statusScript = Join-Path $PSScriptRoot 'status-eco-tunnel.ps1'
$status = $null
if (Test-Path -LiteralPath $statusScript -PathType Leaf) {
  $statusJson = & powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -File $statusScript -Json
  if ($LASTEXITCODE -ne 0) { throw "status-eco-tunnel.ps1 failed with exit code $LASTEXITCODE" }
  $status = ($statusJson -join "`n" | ConvertFrom-Json)
}

$evidence = [ordered]@{
  schemaVersion = 1
  capturedAt = (Get-Date).ToUniversalTime().ToString('o')
  repository = 'blackryui/Links'
  commit = $headSha
  version = [string]$rootPackage.version
  windows = [ordered]@{
    platform = [Environment]::OSVersion.VersionString
    nodeVersion = $nodeVersion
    desktopProcessAbsent = $true
    repositoryGate = $gateStatus
    nodeRuntime = $runtimePaths.nodePath
    mcpBundle = $runtimePaths.bundlePath
    convenienceLauncher = $runtimePaths.launcherPath
  }
  tunnel = if ($null -eq $status) { $null } else { [ordered]@{
    configured = $status.configured
    secretPresent = $status.secretPresent
    directRuntimePresent = $status.bundlePresent
    trustedHostApproval = $status.trustedHostApproval
    ownerLive = $status.ownerLive
    tunnelLive = $status.tunnelLive
    permissionProfile = $status.permissionProfile
    allowedRoots = @($status.allowedRoots)
    logPath = $status.logPath
    lastDiagnostic = $status.lastDiagnostic
  }}
  liveAcceptance = [ordered]@{
    chatgpt = 'NOT_RUN'
    codex = 'NOT_RUN'
    browser = 'NOT_RUN'
    windowsUi = 'NOT_RUN'
    wsl = 'NOT_RUN'
    office = 'NOT_RUN'
  }
}

if ([string]::IsNullOrWhiteSpace($OutputPath)) {
  $OutputPath = Join-Path $repositoryRoot 'artifacts\eco-headless-windows-local-evidence.json'
}
$resolvedOutput = [IO.Path]::GetFullPath($OutputPath)
$parent = Split-Path -Parent $resolvedOutput
if (-not [string]::IsNullOrWhiteSpace($parent)) { New-Item -ItemType Directory -Force -Path $parent | Out-Null }
$evidence | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $resolvedOutput -Encoding UTF8

Write-Host 'ECO Headless local Windows verification completed.'
Write-Host ("Evidence: {0}" -f $resolvedOutput)
Write-Host 'Live ChatGPT/Codex/capability acceptance remains NOT_RUN until exercised through the real clients.'
