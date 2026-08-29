<#Requires -Version 5.1
.SYNOPSIS
Stops only the ECO-owned Secure MCP Tunnel process recorded by the headless worker.
#>

[CmdletBinding()]
param(
  [int]$WaitSeconds = 10
)

$ErrorActionPreference = 'Stop'
$commonPath = Join-Path $PSScriptRoot 'lib\eco-headless-common.ps1'
if (-not (Test-Path -LiteralPath $commonPath -PathType Leaf)) { throw "Missing ECO headless helper: $commonPath" }
. $commonPath

$profileDir = Get-EcoProfileDirectory
$owner = Read-EcoOwnerRecord -ProfileDirectory $profileDir
if ($null -eq $owner) {
  Write-Host 'ECO headless tunnel is not running (no owner record).'
  return
}

$ownerLive = Test-EcoProcessIdentity -ProcessId ([int]$owner.ownerPid) -ExpectedStartedAt ([string]$owner.ownerStartedAt)
$tunnelLive = $false
if ($null -ne $owner.tunnelPid -and $null -ne $owner.tunnelStartedAt) {
  $tunnelLive = Test-EcoProcessIdentity -ProcessId ([int]$owner.tunnelPid) -ExpectedStartedAt ([string]$owner.tunnelStartedAt)
}

$stopPath = Get-EcoStopPath -ProfileDirectory $profileDir
Set-Content -LiteralPath $stopPath -Value ((Get-Date).ToUniversalTime().ToString('o')) -Encoding UTF8

if ($tunnelLive) {
  # Exact PID + process-start identity was verified above; never stop by process name.
  Stop-Process -Id ([int]$owner.tunnelPid) -Force -ErrorAction SilentlyContinue
}

if ($ownerLive) {
  $deadline = (Get-Date).AddSeconds([Math]::Max(0, $WaitSeconds))
  do {
    Start-Sleep -Milliseconds 250
    $ownerLive = Test-EcoProcessIdentity -ProcessId ([int]$owner.ownerPid) -ExpectedStartedAt ([string]$owner.ownerStartedAt)
  } while ($ownerLive -and (Get-Date) -lt $deadline)
}

if (-not $ownerLive) {
  [void](Remove-EcoOwnerRecordIfOwned -Owner $owner -ProfileDirectory $profileDir)
  Remove-Item -LiteralPath $stopPath -Force -ErrorAction SilentlyContinue
  Write-Host 'ECO headless tunnel stopped.'
  return
}

Write-Warning ("ECO tunnel stop was requested, but owner PID {0} is still shutting down. Re-run status before retrying." -f $owner.ownerPid)
