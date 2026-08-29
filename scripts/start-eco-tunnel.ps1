<#Requires -Version 5.1
param(
  [string]$TunnelClientPath,
  [switch]$Foreground,
  [switch]$Worker
)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'lib\eco-headless-common.ps1')

$profileDir = Get-EcoProfileDir
$profileName = Get-EcoProfileName
$secretPath = Get-EcoSecretPath
$profilePath = Get-EcoProfilePath
$logPath = Get-EcoLogPath
$stopPath = Get-EcoStopPath
# Ownership metadata lives in eco.tunnel.owner.json.
$ownerPath = Get-EcoOwnerPath
$tunnelClient = Resolve-EcoTunnelClientPath $TunnelClientPath

if (-not $Worker -and -not $Foreground) {
  $workerArgs = @(
    '-NoProfile',
    '-ExecutionPolicy', 'Bypass',
    '-WindowStyle', 'Hidden',
    '-File', (ConvertTo-EcoQuotedArgument $PSCommandPath),
    '-Worker'
  )
  if (-not [string]::IsNullOrWhiteSpace($TunnelClientPath)) {
    $workerArgs += '-TunnelClientPath'
    $workerArgs += (ConvertTo-EcoQuotedArgument $TunnelClientPath)
  }
  Start-Process -FilePath 'powershell.exe' -ArgumentList $workerArgs -WindowStyle Hidden | Out-Null

  $deadline = (Get-Date).AddSeconds(8)
  do {
    Start-Sleep -Milliseconds 200
    $owner = Get-EcoOwnerRecord
    if (Test-EcoOwnerLive $owner) {
      Write-Host "ECO tunnel worker started (PID $($owner.pid))."
      exit 0
    }
  } while ((Get-Date) -lt $deadline)
  throw 'ECO tunnel worker did not publish healthy ownership state.'
}

New-Item -ItemType Directory -Path $profileDir -Force | Out-Null
if (-not (Test-Path -LiteralPath $secretPath -PathType Leaf)) { throw "Missing ECO runtime key: $secretPath. Run setup-eco-headless.ps1 first." }
if (-not (Test-Path -LiteralPath $profilePath -PathType Leaf)) { throw "Missing ECO tunnel profile: $profilePath. Run setup-eco-headless.ps1 first." }

$mutex = [Threading.Mutex]::new($false, (Get-EcoTunnelMutexName))
$mutexHeld = $false
$owner = $null
$child = $null
$maxRapidRestarts = 5
$rapidRestartCount = 0
$rapidRestartWindowStarted = Get-Date
$keyPointer = $null

function Clear-EcoRuntimeKey {
  if ($null -ne $script:keyPointer) {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($script:keyPointer)
    $script:keyPointer = $null
  }
  Remove-Item Env:CONTROL_PLANE_API_KEY -ErrorAction SilentlyContinue
  Remove-Item Env:TUNNEL_CLIENT_PROFILE_DIR -ErrorAction SilentlyContinue
}

function Set-EcoRuntimeKey {
  Clear-EcoRuntimeKey
  $encrypted = Get-Content -LiteralPath $secretPath -Raw
  $secureKey = ConvertTo-SecureString -String $encrypted
  $script:keyPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureKey)
  $env:CONTROL_PLANE_API_KEY = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($script:keyPointer)
  $env:TUNNEL_CLIENT_PROFILE_DIR = $profileDir
}

try {
  try { $mutexHeld = $mutex.WaitOne(0) } catch [Threading.AbandonedMutexException] { $mutexHeld = $true }
  if (-not $mutexHeld) {
    $existing = Get-EcoOwnerRecord
    if (Test-EcoOwnerLive $existing) {
      Write-Host "ECO tunnel is already owned by PID $($existing.pid)."
      exit 0
    }
    throw 'ECO tunnel ownership mutex is held but owner state is not verifiable.'
  }

  Remove-Item -LiteralPath $stopPath -Force -ErrorAction SilentlyContinue
  $owner = Write-EcoOwnerRecord $PID

  :runLoop while ($true) {
    if (Test-Path -LiteralPath $stopPath) { break }

    Set-EcoRuntimeKey
    try {
      & $tunnelClient doctor --profile $profileName --profile-dir $profileDir --explain
      if ($LASTEXITCODE -ne 0) { throw "tunnel-client doctor failed with exit code $LASTEXITCODE" }

      $runArgs = @(
        'run',
        '--profile', $profileName,
        '--profile-dir', $profileDir,
        '--log.file', $logPath,
        '--mcp.connection-max-ttl', '168h0m0s'
      )
      $child = Start-Process -FilePath $tunnelClient -ArgumentList $runArgs -PassThru -WindowStyle Hidden
    }
    finally {
      Clear-EcoRuntimeKey
    }

    $stopRequested = $false
    while (-not $child.HasExited) {
      if (Test-Path -LiteralPath $stopPath) {
        $stopRequested = $true
        Stop-Process -Id $child.Id -ErrorAction SilentlyContinue
        try { $child.WaitForExit(5000) | Out-Null } catch { }
        break
      }
      Start-Sleep -Milliseconds 500
      $child.Refresh()
    }

    if ($stopRequested -or (Test-Path -LiteralPath $stopPath)) { break runLoop }

    $exitCode = $child.ExitCode
    $elapsed = ((Get-Date) - $rapidRestartWindowStarted).TotalSeconds
    if ($elapsed -gt 30) {
      $rapidRestartCount = 0
      $rapidRestartWindowStarted = Get-Date
    }
    $rapidRestartCount += 1
    if ($rapidRestartCount -gt $maxRapidRestarts) {
      throw "tunnel-client exited $maxRapidRestarts times in a short window; ECO automatic restart is paused. Last exit code: $exitCode"
    }
    $delaySeconds = [int][Math]::Min(30, 3 * [Math]::Pow(2, $rapidRestartCount - 1))
    Write-Host "ECO tunnel-client exited ($exitCode); restarting in $delaySeconds second(s), attempt $rapidRestartCount/$maxRapidRestarts."
    Start-Sleep -Seconds $delaySeconds
  }
}
finally {
  Clear-EcoRuntimeKey
  if ($null -ne $child -and -not $child.HasExited) {
    Stop-Process -Id $child.Id -ErrorAction SilentlyContinue
  }
  Remove-Item -LiteralPath $stopPath -Force -ErrorAction SilentlyContinue
  if ($null -ne $owner) { Remove-EcoOwnerRecordIfCurrent $owner }
  if ($mutexHeld) { $mutex.ReleaseMutex() }
  $mutex.Dispose()
}
