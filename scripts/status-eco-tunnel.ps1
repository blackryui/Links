<#Requires -Version 5.1
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'lib\eco-headless-common.ps1')

$profileDir = Get-EcoProfileDir
$profilePath = Get-EcoProfilePath
$secretPath = Get-EcoSecretPath
$logPath = Get-EcoLogPath
$owner = Get-EcoOwnerRecord
$ownerLive = Test-EcoOwnerLive $owner

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
  ownerPid = if ($ownerLive) { [int]$owner.pid } else { $null }
  running = $ownerLive
  allowedRoots = $allowedRoots
  logPath = $logPath
  lastDiagnostic = $lastDiagnostic
}

$status | ConvertTo-Json -Depth 4
