Set-StrictMode -Version Latest

function Get-EcoProfileDir {
  if ($env:ECO_TUNNEL_PROFILE_DIR) { return [IO.Path]::GetFullPath($env:ECO_TUNNEL_PROFILE_DIR) }
  return (Join-Path $env:APPDATA 'tunnel-client')
}

function Get-EcoProfileName { return 'eco' }
function Get-EcoSecretPath { return (Join-Path (Get-EcoProfileDir) 'eco.runtime.secret') }
function Get-EcoLogPath { return (Join-Path (Get-EcoProfileDir) 'eco-tunnel.log') }
function Get-EcoStopPath { return (Join-Path (Get-EcoProfileDir) 'eco.tunnel.stop') }
function Get-EcoOwnerPath { return (Join-Path (Get-EcoProfileDir) 'eco.tunnel.owner.json') }
function Get-EcoProfilePath { return (Join-Path (Get-EcoProfileDir) 'eco.yaml') }

function Get-EcoTunnelMutexName {
  $normalized = (Get-EcoProfileDir).TrimEnd([char[]]@([char]'\', [char]'/')).ToLowerInvariant()
  $sha = [Security.Cryptography.SHA256]::Create()
  try {
    $hash = $sha.ComputeHash(([Text.UTF8Encoding]::new($false)).GetBytes($normalized))
    $hex = -join ($hash | ForEach-Object { $_.ToString('x2', [Globalization.CultureInfo]::InvariantCulture) })
    return 'Local\eco-headless-tunnel-' + $hex.Substring(0, 24)
  } finally { $sha.Dispose() }
}

function Get-EcoProcessIdentity([int]$ProcessId) {
  try {
    $process = Get-Process -Id $ProcessId -ErrorAction Stop
  } catch {
    return [pscustomobject]@{ state = 'gone'; pid = $ProcessId }
  }

  try {
    $startedAt = $process.StartTime.ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ss.fffZ', [Globalization.CultureInfo]::InvariantCulture)
    $executablePath = [string]$process.Path
    if ([string]::IsNullOrWhiteSpace($executablePath)) {
      return [pscustomobject]@{ state = 'unverifiable'; pid = $ProcessId; reason = 'process_path_unavailable' }
    }
    return [pscustomobject]@{
      state = 'live'
      pid = $process.Id
      startedAt = $startedAt
      path = [IO.Path]::GetFullPath($executablePath)
    }
  } catch {
    return [pscustomobject]@{ state = 'unverifiable'; pid = $ProcessId; reason = 'process_identity_probe_failed' }
  }
}

function Get-EcoOwnerRecord {
  $ownerPath = Get-EcoOwnerPath
  if (-not (Test-Path -LiteralPath $ownerPath -PathType Leaf)) { return $null }
  try {
    $owner = Get-Content -LiteralPath $ownerPath -Raw | ConvertFrom-Json
    if ([int]$owner.version -ne 2) { return $null }
    if ($null -eq $owner.pid -or [string]::IsNullOrWhiteSpace([string]$owner.startedAt)) { return $null }
    if ([string]::IsNullOrWhiteSpace([string]$owner.tunnelClientPath)) { return $null }
    if ([string]::IsNullOrWhiteSpace([string]$owner.profileDir)) { return $null }
    return $owner
  } catch { return $null }
}

function Test-EcoOwnerSame($Left, $Right) {
  if ($null -eq $Left -or $null -eq $Right) { return $false }
  return [int]$Left.pid -eq [int]$Right.pid `
    -and ([string]$Left.startedAt) -ceq ([string]$Right.startedAt)
}

function Test-EcoOwnerLive($Owner) {
  if ($null -eq $Owner) { return $false }
  $identity = Get-EcoProcessIdentity ([int]$Owner.pid)
  return $identity.state -eq 'live' -and ([string]$identity.startedAt) -ceq ([string]$Owner.startedAt)
}

function Write-EcoOwnerPayload($Record) {
  $ownerPath = Get-EcoOwnerPath
  $tempPath = "$ownerPath.$($Record.pid).$([Guid]::NewGuid().ToString('N')).tmp"
  $Record | ConvertTo-Json -Compress | Set-Content -LiteralPath $tempPath -Encoding UTF8
  Move-Item -LiteralPath $tempPath -Destination $ownerPath -Force
  return $Record
}

function Write-EcoOwnerRecord([int]$ProcessId, [string]$TunnelClientPath, [string]$ProfileDir) {
  $identity = Get-EcoProcessIdentity $ProcessId
  if ($identity.state -ne 'live') { throw 'Could not resolve ECO tunnel worker process identity.' }
  $record = [pscustomobject][ordered]@{
    version = 2
    pid = $identity.pid
    startedAt = $identity.startedAt
    tunnelClientPath = [IO.Path]::GetFullPath($TunnelClientPath)
    profileDir = [IO.Path]::GetFullPath($ProfileDir)
    childPid = $null
    childStartedAt = $null
  }
  return Write-EcoOwnerPayload $record
}

function Set-EcoOwnerChild($Owner, [int]$ChildPid) {
  $current = Get-EcoOwnerRecord
  if (-not (Test-EcoOwnerSame $current $Owner)) { throw 'ECO tunnel owner changed before child publication.' }

  $identity = Get-EcoProcessIdentity $ChildPid
  if ($identity.state -ne 'live') { throw 'Could not verify ECO tunnel-client child process identity.' }
  $expectedPath = [IO.Path]::GetFullPath([string]$current.tunnelClientPath)
  if (-not [StringComparer]::OrdinalIgnoreCase.Equals([string]$identity.path, $expectedPath)) {
    throw "ECO child executable mismatch: expected=$expectedPath actual=$($identity.path)"
  }

  $record = [pscustomobject][ordered]@{
    version = 2
    pid = [int]$current.pid
    startedAt = [string]$current.startedAt
    tunnelClientPath = $expectedPath
    profileDir = [IO.Path]::GetFullPath([string]$current.profileDir)
    childPid = [int]$identity.pid
    childStartedAt = [string]$identity.startedAt
  }
  return Write-EcoOwnerPayload $record
}

function Clear-EcoOwnerChild($Owner) {
  $current = Get-EcoOwnerRecord
  if (-not (Test-EcoOwnerSame $current $Owner)) { throw 'ECO tunnel owner changed before child cleanup.' }
  $record = [pscustomobject][ordered]@{
    version = 2
    pid = [int]$current.pid
    startedAt = [string]$current.startedAt
    tunnelClientPath = [IO.Path]::GetFullPath([string]$current.tunnelClientPath)
    profileDir = [IO.Path]::GetFullPath([string]$current.profileDir)
    childPid = $null
    childStartedAt = $null
  }
  return Write-EcoOwnerPayload $record
}

function Get-EcoOwnedChildState($Owner) {
  if ($null -eq $Owner -or $null -eq $Owner.childPid -or [string]::IsNullOrWhiteSpace([string]$Owner.childStartedAt)) {
    return 'none'
  }

  $identity = Get-EcoProcessIdentity ([int]$Owner.childPid)
  if ($identity.state -eq 'gone') { return 'gone' }
  if ($identity.state -ne 'live') { return 'unverifiable' }
  if (([string]$identity.startedAt) -cne ([string]$Owner.childStartedAt)) { return 'mismatch' }

  try {
    $expectedPath = [IO.Path]::GetFullPath([string]$Owner.tunnelClientPath)
  } catch { return 'unverifiable' }
  if (-not [StringComparer]::OrdinalIgnoreCase.Equals([string]$identity.path, $expectedPath)) { return 'mismatch' }
  return 'owned'
}

function Test-EcoOwnedChildLive($Owner) {
  return (Get-EcoOwnedChildState $Owner) -eq 'owned'
}

function Stop-EcoOwnedChild($Owner, [int]$TimeoutSeconds = 8) {
  $state = Get-EcoOwnedChildState $Owner
  if ($state -in @('none', 'gone')) { return $true }
  if ($state -ne 'owned') { throw "ECO tunnel-client child ownership is $state; refusing to kill an unverified process." }

  $childPid = [int]$Owner.childPid
  $childStartedAt = [string]$Owner.childStartedAt
  Stop-Process -Id $childPid -ErrorAction Stop
  $deadline = (Get-Date).AddSeconds([Math]::Max(1, $TimeoutSeconds))
  do {
    Start-Sleep -Milliseconds 200
    $identity = Get-EcoProcessIdentity $childPid
    if ($identity.state -eq 'gone') { return $true }
    if ($identity.state -eq 'live' -and ([string]$identity.startedAt) -cne $childStartedAt) { return $true }
    if ($identity.state -eq 'unverifiable') { throw 'ECO tunnel-client child became unverifiable while stopping.' }
  } while ((Get-Date) -lt $deadline)
  throw "ECO tunnel-client child PID $childPid did not stop within $TimeoutSeconds second(s)."
}

function Remove-EcoOwnerRecordIfCurrent($Owner) {
  $current = Get-EcoOwnerRecord
  if (-not (Test-EcoOwnerSame $current $Owner)) { return }
  Remove-Item -LiteralPath (Get-EcoOwnerPath) -Force -ErrorAction SilentlyContinue
}

function Resolve-EcoTunnelClientPath([string]$RequestedPath) {
  if (-not [string]::IsNullOrWhiteSpace($RequestedPath)) {
    return (Resolve-Path -LiteralPath $RequestedPath -ErrorAction Stop).Path
  }
  if ($env:ECO_TUNNEL_CLIENT_PATH) {
    return (Resolve-Path -LiteralPath $env:ECO_TUNNEL_CLIENT_PATH -ErrorAction Stop).Path
  }
  $command = Get-Command tunnel-client.exe -ErrorAction SilentlyContinue
  if ($null -eq $command) { $command = Get-Command tunnel-client -ErrorAction SilentlyContinue }
  if ($null -eq $command) { throw 'tunnel-client was not found. Install the current OpenAI tunnel-client or set ECO_TUNNEL_CLIENT_PATH.' }
  return $command.Source
}

function Resolve-EcoMcpPath([string]$RepositoryRoot, [string]$RequestedPath) {
  $candidate = if (-not [string]::IsNullOrWhiteSpace($RequestedPath)) {
    $RequestedPath
  } elseif ($env:ECO_MCP_PATH) {
    $env:ECO_MCP_PATH
  } else {
    Join-Path $RepositoryRoot 'dist\eco-headless\eco-mcp.cmd'
  }
  return (Resolve-Path -LiteralPath $candidate -ErrorAction Stop).Path
}

function ConvertTo-EcoQuotedArgument([string]$Value) {
  return '"' + ($Value -replace '"', '\"') + '"'
}

function New-EcoMcpCommand {
  param(
    [Parameter(Mandatory = $true)][string]$EcoMcpPath,
    [Parameter(Mandatory = $true)][string[]]$AllowedRoots,
    [bool]$EnableCodexTools = $false
  )

  if ($AllowedRoots.Count -lt 1) { throw 'At least one explicit allowed root is required.' }
  $parts = @((ConvertTo-EcoQuotedArgument $EcoMcpPath), '--strict-roots')
  foreach ($root in $AllowedRoots) {
    $parts += '--allowed-root'
    $parts += (ConvertTo-EcoQuotedArgument $root)
  }
  $parts += '--workspace'
  $parts += (ConvertTo-EcoQuotedArgument $AllowedRoots[0])
  $parts += '--profile'
  $parts += 'full'
  if ($EnableCodexTools) { $parts += '--enable-codex-tools' }
  return ($parts -join ' ')
}
