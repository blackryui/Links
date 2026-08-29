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
    return [pscustomobject]@{
      pid = $process.Id
      startedAt = $process.StartTime.ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ss.fffZ', [Globalization.CultureInfo]::InvariantCulture)
    }
  } catch { return $null }
}

function Get-EcoOwnerRecord {
  $ownerPath = Get-EcoOwnerPath
  if (-not (Test-Path -LiteralPath $ownerPath -PathType Leaf)) { return $null }
  try {
    $owner = Get-Content -LiteralPath $ownerPath -Raw | ConvertFrom-Json
    if ($null -eq $owner.pid -or $null -eq $owner.startedAt) { return $null }
    return $owner
  } catch { return $null }
}

function Test-EcoOwnerLive($Owner) {
  if ($null -eq $Owner) { return $false }
  $identity = Get-EcoProcessIdentity ([int]$Owner.pid)
  return $null -ne $identity -and ([string]$identity.startedAt) -ceq ([string]$Owner.startedAt)
}

function Write-EcoOwnerRecord([int]$ProcessId) {
  $identity = Get-EcoProcessIdentity $ProcessId
  if ($null -eq $identity) { throw 'Could not resolve ECO tunnel worker process identity.' }
  $ownerPath = Get-EcoOwnerPath
  $tempPath = "$ownerPath.$ProcessId.$([Guid]::NewGuid().ToString('N')).tmp"
  $record = [pscustomobject][ordered]@{ version = 1; pid = $identity.pid; startedAt = $identity.startedAt }
  $record | ConvertTo-Json -Compress | Set-Content -LiteralPath $tempPath -Encoding UTF8
  Move-Item -LiteralPath $tempPath -Destination $ownerPath -Force
  return $record
}

function Remove-EcoOwnerRecordIfCurrent($Owner) {
  $current = Get-EcoOwnerRecord
  if ($null -eq $current -or $null -eq $Owner) { return }
  if ([int]$current.pid -eq [int]$Owner.pid -and ([string]$current.startedAt) -ceq ([string]$Owner.startedAt)) {
    Remove-Item -LiteralPath (Get-EcoOwnerPath) -Force -ErrorAction SilentlyContinue
  }
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

function New-EcoMcpCommand([string]$EcoMcpPath, [string[]]$AllowedRoots) {
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
  return ($parts -join ' ')
}
