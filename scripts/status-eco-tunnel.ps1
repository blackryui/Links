<#Requires -Version 5.1
.SYNOPSIS
Reports ECO Headless tunnel state without decrypting secret material.
#>

[CmdletBinding()]
param(
  [switch]$Json
)

$ErrorActionPreference = 'Stop'
$commonPath = Join-Path $PSScriptRoot 'lib\eco-headless-common.ps1'
if (-not (Test-Path -LiteralPath $commonPath -PathType Leaf)) { throw "Missing ECO headless helper: $commonPath" }
. $commonPath

$profileDir = Get-EcoProfileDirectory
$config = Read-EcoConfig -ProfileDirectory $profileDir
$owner = Read-EcoOwnerRecord -ProfileDirectory $profileDir
$secretPath = Get-EcoSecretPath -ProfileDirectory $profileDir
$logPath = Get-EcoLogPath -ProfileDirectory $profileDir
$secretPresent = Test-Path -LiteralPath $secretPath -PathType Leaf

$ownerLive = $false
$tunnelLive = $false
if ($null -ne $owner) {
  $ownerLive = Test-EcoProcessIdentity -ProcessId ([int]$owner.ownerPid) -ExpectedStartedAt ([string]$owner.ownerStartedAt)
  if ($null -ne $owner.tunnelPid -and $null -ne $owner.tunnelStartedAt) {
    $tunnelLive = Test-EcoProcessIdentity -ProcessId ([int]$owner.tunnelPid) -ExpectedStartedAt ([string]$owner.tunnelStartedAt)
  }
}

$lastDiagnostic = $null
if (Test-Path -LiteralPath $logPath -PathType Leaf) {
  $candidate = Get-Content -LiteralPath $logPath -Tail 120 -ErrorAction SilentlyContinue |
    Where-Object { $_ -match 'error|warn|failed|exit|connected|ready|tunnel|MCP' } |
    Select-Object -Last 1
  if (-not [string]::IsNullOrWhiteSpace([string]$candidate)) {
    $lastDiagnostic = ([regex]::Replace([string]$candidate, '\s+', ' ')).Trim()
    $lastDiagnostic = [regex]::Replace($lastDiagnostic, 'sk-(?:proj-)?[A-Za-z0-9_-]{12,}', '[REDACTED]')
    $lastDiagnostic = [regex]::Replace($lastDiagnostic, '(?i)(api[_ -]?key|authorization|bearer)\s*[:=]\s*\S+', '$1=[REDACTED]')
    if ($lastDiagnostic.Length -gt 240) { $lastDiagnostic = $lastDiagnostic.Substring(0, 237) + '...' }
  }
}

$allowedRoots = if ($null -eq $config) { @() } else { @($config.allowedRoots) }
$nodePresent = $null -ne $config -and -not [string]::IsNullOrWhiteSpace([string]$config.nodePath) -and (Test-Path -LiteralPath ([string]$config.nodePath) -PathType Leaf)
$mcpBundlePresent = $null -ne $config -and -not [string]::IsNullOrWhiteSpace([string]$config.bundlePath) -and (Test-Path -LiteralPath ([string]$config.bundlePath) -PathType Leaf)
$launcherPresent = $null -ne $config -and -not [string]::IsNullOrWhiteSpace([string]$config.launcherPath) -and (Test-Path -LiteralPath ([string]$config.launcherPath) -PathType Leaf)
$status = [pscustomobject][ordered]@{
  profile = $script:EcoProfileName
  configured = ($null -ne $config)
  profileDirectory = $profileDir
  secretPresent = $secretPresent
  nodePresent = $nodePresent
  mcpBundlePresent = $mcpBundlePresent
  bundlePresent = ($nodePresent -and $mcpBundlePresent)
  launcherPresent = $launcherPresent
  tunnelClientPresent = ($null -ne $config -and (Test-Path -LiteralPath ([string]$config.tunnelClientPath) -PathType Leaf))
  trustedHostApproval = ($null -ne $config -and $config.trustedHostApproval -eq $true)
  permissionProfile = if ($null -eq $config) { $null } else { [string]$config.permissionProfile }
  allowedRoots = $allowedRoots
  ownerPid = if ($null -eq $owner) { $null } else { $owner.ownerPid }
  ownerLive = $ownerLive
  tunnelPid = if ($null -eq $owner) { $null } else { $owner.tunnelPid }
  tunnelLive = $tunnelLive
  lastExitCode = if ($null -eq $owner) { $null } else { $owner.lastExitCode }
  logPath = $logPath
  lastDiagnostic = $lastDiagnostic
}

if ($Json) {
  $status | ConvertTo-Json -Depth 6
  return
}

Write-Host ("ECO profile:       {0}" -f $status.profile)
Write-Host ("Configured:        {0}" -f $status.configured)
Write-Host ("Runtime key:       {0}" -f $(if ($status.secretPresent) { 'present (encrypted)' } else { 'missing' }))
Write-Host ("Private Node:      {0}" -f $(if ($status.nodePresent) { 'present' } else { 'missing' }))
Write-Host ("MCP bundle:        {0}" -f $(if ($status.mcpBundlePresent) { 'present' } else { 'missing' }))
Write-Host ("Convenience .cmd:  {0}" -f $(if ($status.launcherPresent) { 'present' } else { 'missing' }))
Write-Host ("Tunnel client:     {0}" -f $(if ($status.tunnelClientPresent) { 'present' } else { 'missing' }))
Write-Host ("Trusted host gate: {0}" -f $status.trustedHostApproval)
Write-Host ("Owner live:        {0}" -f $status.ownerLive)
Write-Host ("Tunnel live:       {0}" -f $status.tunnelLive)
Write-Host ("Permission:        {0}" -f $status.permissionProfile)
Write-Host 'Allowed roots:'
if ($status.allowedRoots.Count -eq 0) { Write-Host '  (none configured)' }
else { $status.allowedRoots | ForEach-Object { Write-Host ("  - {0}" -f $_) } }
if (-not [string]::IsNullOrWhiteSpace($status.lastDiagnostic)) {
  Write-Host ("Last diagnostic:   {0}" -f $status.lastDiagnostic)
}
