<#Requires -Version 5.1
param([int]$TimeoutSeconds = 12)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'lib\eco-headless-common.ps1')

$owner = Get-EcoOwnerRecord
if (-not (Test-EcoOwnerLive $owner)) {
  Remove-Item -LiteralPath (Get-EcoOwnerPath) -Force -ErrorAction SilentlyContinue
  Remove-Item -LiteralPath (Get-EcoStopPath) -Force -ErrorAction SilentlyContinue
  Write-Host 'ECO tunnel is not running.'
  exit 0
}

$stopPath = Get-EcoStopPath
New-Item -ItemType File -Path $stopPath -Force | Out-Null
$deadline = (Get-Date).AddSeconds([Math]::Max(1, $TimeoutSeconds))
do {
  Start-Sleep -Milliseconds 250
  if (-not (Test-EcoOwnerLive $owner)) {
    Write-Host 'ECO tunnel stopped.'
    exit 0
  }
} while ((Get-Date) -lt $deadline)

throw "ECO tunnel worker PID $($owner.pid) did not stop within $TimeoutSeconds second(s); no broad process kill was attempted."
