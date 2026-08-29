<#Requires -Version 5.1
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'lib\eco-headless-common.ps1')

$profileDir = Get-EcoProfileDir
$profilePath = Get-EcoProfilePath
$secretPath = Get-EcoSecretPath
$logPath = Get-EcoLogPath
$ownerPath = Get-EcoOwnerPath
$ownerFileExists = Test-Path -LiteralPath $ownerPath -PathType Leaf
$owner = Get-EcoOwnerRecord
$ownerValid = -not $ownerFileExists -or $null -ne $owner
$ownerLive = Test-EcoOwnerLive $owner
$childState = if ($null -eq $owner) { 'none' } else { Get-EcoOwnedChildState $owner }
$childLive = $childState -eq 'owned'

$allowedRoots = @()
if (Test-Path -LiteralPath $profilePath -PathType Leaf) {
  $profileText = Get-Content -LiteralPath $profilePath -Raw
  $matches = [regex]::Matches($profileText, '--allowed-root\s+\\?"([^"\r\n]+)\\?"')
  foreach ($match in $matches) {
    $value = $match.Groups[1].Value
    if ($allowedRoots -notcontains $value) { $allowedRoots += $value }
  }
}

$lastDiagnostic = $null
if (Test-Path -LiteralPath $logPath -PathType Leaf) {
  $tail = @(Get-Content -LiteralPath $logPath -Tail 40 -ErrorAction SilentlyContinue)
  if ($tail.Count -gt 0) {
    $lastDiagnostic = ([regex]::Replace([string]$tail[-1], '\s+', ' ')).Trim()
    if ($lastDiagnostic.Length -gt 240) { $lastDiagnostic = $lastDiagnostic.Substring(0, 237) + '...' }
  }
}

$status = [pscustomobject][ordered]@{
  profile = Get-EcoProfileName
  profileDirectory = $profileDir
  profileExists = Test-Path -LiteralPath $profilePath -PathType Leaf
  runtimeKeyStored = Test-Path -LiteralPath $secretPath -PathType Leaf
  ownerRecordValid = $ownerValid
  ownerPid = if ($null -ne $owner) { [int]$owner.pid } else { $null }
  workerRunning = $ownerLive
  childPid = if ($null -ne $owner -and $null -ne $owner.childPid) { [int]$owner.childPid } else { $null }
  childState = $childState
  running = $ownerLive -or $childLive
  healthy = $ownerValid -and $ownerLive -and $childState -in @('none', 'owned')
  allowedRoots = $allowedRoots
  logPath = $logPath
  lastDiagnostic = $lastDiagnostic
}

$status | ConvertTo-Json -Depth 4
