<#Requires -Version 5.1
.SYNOPSIS
Starts ECO Headless Secure MCP Tunnel without a GUI host.

.DESCRIPTION
By default this script starts a hidden PowerShell worker and returns. The worker
owns exactly one ECO tunnel-client process, decrypts the DPAPI runtime key only
after claiming ownership, runs tunnel-client doctor, then supervises tunnel-client
with a bounded rapid-restart policy. It never starts lnwjud Desktop.
#>

[CmdletBinding()]
param(
  [string]$TunnelClientPath,
  [switch]$Foreground,
  [switch]$Worker,
  [switch]$Once
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$commonPath = Join-Path $PSScriptRoot 'lib\eco-headless-common.ps1'
if (-not (Test-Path -LiteralPath $commonPath -PathType Leaf)) { throw "Missing ECO headless helper: $commonPath" }
. $commonPath

# Ownership is persisted at eco.tunnel.owner.json under the tunnel profile directory.
$profileDir = Get-EcoProfileDirectory
New-Item -ItemType Directory -Force -Path $profileDir | Out-Null
$ownerPath = Get-EcoOwnerPath -ProfileDirectory $profileDir
$stopPath = Get-EcoStopPath -ProfileDirectory $profileDir
$secretPath = Get-EcoSecretPath -ProfileDirectory $profileDir
$logPath = Get-EcoLogPath -ProfileDirectory $profileDir
$maxRapidRestarts = 5

function New-EcoWorkerArgumentLine {
  $parts = @(
    '-NoProfile',
    '-NonInteractive',
    '-ExecutionPolicy', 'Bypass',
    '-File', (ConvertTo-EcoCommandArgument -Value $PSCommandPath),
    '-Worker'
  )
  if (-not [string]::IsNullOrWhiteSpace($TunnelClientPath)) {
    $parts += '-TunnelClientPath'
    $parts += (ConvertTo-EcoCommandArgument -Value $TunnelClientPath)
  }
  if ($Once) { $parts += '-Once' }
  return ($parts -join ' ')
}

if (-not $Worker -and -not $Foreground) {
  $powershellExe = (Get-Process -Id $PID -ErrorAction Stop).Path
  $workerProcess = Start-Process -FilePath $powershellExe -ArgumentList (New-EcoWorkerArgumentLine) -WindowStyle Hidden -PassThru
  Write-Host ("ECO headless tunnel worker started (PID {0})." -f $workerProcess.Id)
  Write-Host 'Use scripts\status-eco-tunnel.ps1 to inspect status.'
  return
}

$config = Read-EcoConfig -ProfileDirectory $profileDir
if ($null -eq $config) {
  throw 'ECO Headless is not configured. Run scripts\setup-eco-headless.ps1 first.'
}
$configuredClient = if ([string]::IsNullOrWhiteSpace($TunnelClientPath)) { [string]$config.tunnelClientPath } else { $TunnelClientPath }
$clientPath = Resolve-EcoTunnelClientPath -TunnelClientPath $configuredClient
if (-not (Test-Path -LiteralPath $secretPath -PathType Leaf)) {
  throw "ECO tunnel runtime key is missing: $secretPath. Run setup again."
}

$existing = Read-EcoOwnerRecord -ProfileDirectory $profileDir
if ($null -ne $existing -and (Test-EcoOwnerRecordIdentity -Owner $existing)) {
  throw ("ECO tunnel is already owned by PID {0} (started {1})." -f $existing.ownerPid, $existing.ownerStartedAt)
}
if ($null -ne $existing) {
  Remove-Item -LiteralPath $ownerPath -Force -ErrorAction SilentlyContinue
}

$ownerStartedAt = Get-EcoProcessStartedAt -ProcessId $PID
$owner = [ordered]@{
  schemaVersion = 1
  profile = $script:EcoProfileName
  ownerPid = $PID
  ownerStartedAt = $ownerStartedAt
  tunnelPid = $null
  tunnelStartedAt = $null
  allowedRoots = @($config.allowedRoots)
  startedAt = (Get-Date).ToUniversalTime().ToString('o')
  lastExitCode = $null
}

# Claim ownership atomically. If another launcher wins the race, CreateNew fails.
$ownerJson = $owner | ConvertTo-Json -Depth 8
$ownerBytes = [Text.UTF8Encoding]::new($false).GetBytes($ownerJson)
$ownerStream = $null
try {
  $ownerStream = [IO.File]::Open($ownerPath, [IO.FileMode]::CreateNew, [IO.FileAccess]::Write, [IO.FileShare]::None)
  $ownerStream.Write($ownerBytes, 0, $ownerBytes.Length)
  $ownerStream.Flush($true)
}
catch {
  throw "ECO tunnel ownership could not be claimed: $($_.Exception.Message)"
}
finally {
  if ($null -ne $ownerStream) { $ownerStream.Dispose() }
}

# Only the confirmed owner may clear a stale stop request from an earlier run.
Remove-Item -LiteralPath $stopPath -Force -ErrorAction SilentlyContinue

$keyPointer = [IntPtr]::Zero
$activeTunnel = $null
$rapidRestartCount = 0
$rapidRestartWindowStarted = Get-Date
$env:TUNNEL_CLIENT_PROFILE_DIR = $profileDir

try {
  # Decrypt only after ownership is acquired.
  $encrypted = Get-Content -LiteralPath $secretPath -Raw -ErrorAction Stop
  $secureKey = ConvertTo-SecureString -String $encrypted.Trim()
  $keyPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureKey)
  $plainKey = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($keyPointer)
  if ([string]::IsNullOrWhiteSpace($plainKey)) { throw 'ECO tunnel runtime key could not be decrypted.' }
  $env:CONTROL_PLANE_API_KEY = $plainKey

  Write-Host 'ECO headless: running tunnel doctor ...'
  & $clientPath doctor --profile $script:EcoProfileName --profile-dir $profileDir --explain
  if ($LASTEXITCODE -ne 0) { throw "tunnel-client doctor failed with exit code $LASTEXITCODE" }

  while ($true) {
    if (Test-Path -LiteralPath $stopPath) {
      Write-Host 'ECO headless: stop requested before tunnel start.'
      break
    }

    $runArgumentLine = @(
      'run',
      '--profile', (ConvertTo-EcoCommandArgument -Value $script:EcoProfileName),
      '--profile-dir', (ConvertTo-EcoCommandArgument -Value $profileDir),
      '--log.file', (ConvertTo-EcoCommandArgument -Value $logPath),
      '--mcp.connection-max-ttl', (ConvertTo-EcoCommandArgument -Value $script:EcoConnectionMaxTtl)
    ) -join ' '

    $activeTunnel = Start-Process -FilePath $clientPath -ArgumentList $runArgumentLine -WindowStyle Hidden -PassThru
    $tunnelStartedAt = $activeTunnel.StartTime.ToUniversalTime().ToString('o')
    $owner.tunnelPid = $activeTunnel.Id
    $owner.tunnelStartedAt = $tunnelStartedAt
    Write-EcoOwnerRecord -Record $owner -ProfileDirectory $profileDir

    while (-not $activeTunnel.HasExited) {
      if (Test-Path -LiteralPath $stopPath) {
        if (Test-EcoProcessIdentity -ProcessId $activeTunnel.Id -ExpectedStartedAt $tunnelStartedAt) {
          Stop-Process -Id $activeTunnel.Id -Force -ErrorAction SilentlyContinue
        }
        break
      }
      Start-Sleep -Milliseconds 500
      $activeTunnel.Refresh()
    }

    try { $activeTunnel.WaitForExit() } catch { }
    $exitCode = if ($activeTunnel.HasExited) { $activeTunnel.ExitCode } else { -1 }
    $owner.lastExitCode = $exitCode
    $owner.tunnelPid = $null
    $owner.tunnelStartedAt = $null
    Write-EcoOwnerRecord -Record $owner -ProfileDirectory $profileDir
    $activeTunnel = $null

    if ($Once) {
      Write-Host ("ECO headless: tunnel-client exited ({0}); -Once requested." -f $exitCode)
      break
    }
    if (Test-Path -LiteralPath $stopPath) {
      Write-Host ("ECO headless: tunnel-client stopped by request ({0})." -f $exitCode)
      break
    }

    $elapsed = ((Get-Date) - $rapidRestartWindowStarted).TotalSeconds
    if ($elapsed -gt 30) {
      $rapidRestartCount = 0
      $rapidRestartWindowStarted = Get-Date
    }
    $rapidRestartCount += 1
    if ($rapidRestartCount -gt $maxRapidRestarts) {
      throw "tunnel-client exited $maxRapidRestarts times in a short window; automatic restart paused. Inspect $logPath and run start again after fixing the cause."
    }
    $delaySeconds = [int][Math]::Min(30, 3 * [Math]::Pow(2, $rapidRestartCount - 1))
    Write-Host ("ECO headless: tunnel-client exited ({0}); restarting in {1}s (attempt {2}/{3})." -f $exitCode, $delaySeconds, $rapidRestartCount, $maxRapidRestarts)
    Start-Sleep -Seconds $delaySeconds
  }
}
finally {
  if ($null -ne $activeTunnel -and -not $activeTunnel.HasExited) {
    if (Test-EcoProcessIdentity -ProcessId $activeTunnel.Id -ExpectedStartedAt ([string]$owner.tunnelStartedAt)) {
      Stop-Process -Id $activeTunnel.Id -Force -ErrorAction SilentlyContinue
    }
  }
  if ($keyPointer -ne [IntPtr]::Zero) {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($keyPointer)
  }
  Remove-Item Env:CONTROL_PLANE_API_KEY -ErrorAction SilentlyContinue
  Remove-Item Env:TUNNEL_CLIENT_PROFILE_DIR -ErrorAction SilentlyContinue
  [void](Remove-EcoOwnerRecordIfOwned -Owner $owner -ProfileDirectory $profileDir)
  Remove-Item -LiteralPath $stopPath -Force -ErrorAction SilentlyContinue
}
