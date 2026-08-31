#Requires -Version 5.1
param([int]$TimeoutSeconds = 12)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'lib\eco-headless-common.ps1')

$ownerPath = Get-EcoOwnerPath
$stopPath = Get-EcoStopPath
if (-not (Test-Path -LiteralPath $ownerPath -PathType Leaf)) {
  Remove-Item -LiteralPath $stopPath -Force -ErrorAction SilentlyContinue
  Write-Host 'ECO tunnel is not running.'
  exit 0
}

$owner = Get-EcoOwnerRecord
if ($null -eq $owner) {
  throw "ECO tunnel owner metadata is invalid: $ownerPath. Refusing broad cleanup."
}

if (-not (Test-EcoOwnerLive $owner)) {
  $childState = Get-EcoOwnedChildState $owner
  if ($childState -eq 'owned') {
    Write-Host "ECO tunnel worker is gone; stopping verified orphan child PID $($owner.childPid)."
    Stop-EcoOwnedChild $owner ([Math]::Max(1, $TimeoutSeconds)) | Out-Null
  } elseif ($childState -notin @('none', 'gone')) {
    throw "ECO tunnel child state is $childState; refusing to kill an unverified process."
  }
  Remove-EcoOwnerRecordIfCurrent $owner
  Remove-Item -LiteralPath $stopPath -Force -ErrorAction SilentlyContinue
  Write-Host 'ECO tunnel stopped.'
  exit 0
}

New-Item -ItemType File -Path $stopPath -Force | Out-Null
$deadline = (Get-Date).AddSeconds([Math]::Max(1, $TimeoutSeconds))
do {
  Start-Sleep -Milliseconds 250
  if (-not (Test-EcoOwnerLive $owner)) {
    $latestOwner = Get-EcoOwnerRecord
    if ($null -ne $latestOwner) {
      $childState = Get-EcoOwnedChildState $latestOwner
      if ($childState -eq 'owned') {
        Stop-EcoOwnedChild $latestOwner ([Math]::Max(1, $TimeoutSeconds)) | Out-Null
      } elseif ($childState -notin @('none', 'gone')) {
        throw "ECO tunnel child state is $childState after worker exit; refusing broad cleanup."
      }
      Remove-EcoOwnerRecordIfCurrent $latestOwner
    } elseif (Test-Path -LiteralPath $ownerPath -PathType Leaf) {
      throw "ECO tunnel owner metadata became invalid during stop: $ownerPath"
    }
    Remove-Item -LiteralPath $stopPath -Force -ErrorAction SilentlyContinue
    Write-Host 'ECO tunnel stopped.'
    exit 0
  }
} while ((Get-Date) -lt $deadline)

throw "ECO tunnel worker PID $($owner.pid) did not stop within $TimeoutSeconds second(s); no broad process kill was attempted."
