$script:EcoProfileName = 'eco'
$script:EcoConnectionMaxTtl = '168h0m0s'

function Get-EcoRepositoryRoot {
  return (Split-Path -Parent (Split-Path -Parent $PSScriptRoot))
}

function Get-EcoProfileDirectory {
  if (-not [string]::IsNullOrWhiteSpace($env:TUNNEL_CLIENT_PROFILE_DIR)) {
    return [IO.Path]::GetFullPath($env:TUNNEL_CLIENT_PROFILE_DIR)
  }
  if ([string]::IsNullOrWhiteSpace($env:APPDATA)) { throw 'APPDATA is required for ECO tunnel profile storage.' }
  return (Join-Path $env:APPDATA 'tunnel-client')
}

function Get-EcoSecretPath {
  param([string]$ProfileDirectory = (Get-EcoProfileDirectory))
  return (Join-Path $ProfileDirectory 'eco.runtime.secret')
}

function Get-EcoLogPath {
  param([string]$ProfileDirectory = (Get-EcoProfileDirectory))
  return (Join-Path $ProfileDirectory 'eco-tunnel.log')
}

function Get-EcoOwnerPath {
  param([string]$ProfileDirectory = (Get-EcoProfileDirectory))
  return (Join-Path $ProfileDirectory 'eco.tunnel.owner.json')
}

function Get-EcoStopPath {
  param([string]$ProfileDirectory = (Get-EcoProfileDirectory))
  return (Join-Path $ProfileDirectory 'eco.tunnel.stop')
}

function Get-EcoConfigPath {
  param([string]$ProfileDirectory = (Get-EcoProfileDirectory))
  return (Join-Path $ProfileDirectory 'eco.headless.config.json')
}

function Resolve-EcoBundleRoot {
  param([string]$BundleRoot)
  if (-not [string]::IsNullOrWhiteSpace($BundleRoot)) { return [IO.Path]::GetFullPath($BundleRoot) }
  if (-not [string]::IsNullOrWhiteSpace($env:ECO_HEADLESS_HOME)) { return [IO.Path]::GetFullPath($env:ECO_HEADLESS_HOME) }
  return (Join-Path (Get-EcoRepositoryRoot) 'dist\eco-headless')
}

function Resolve-EcoMcpLauncherPath {
  param([string]$BundleRoot)
  $resolvedRoot = Resolve-EcoBundleRoot -BundleRoot $BundleRoot
  $launcher = Join-Path $resolvedRoot 'eco-mcp.cmd'
  if (-not (Test-Path -LiteralPath $launcher -PathType Leaf)) {
    throw "ECO MCP launcher not found: $launcher. Run corepack pnpm@10.15.0 build:eco first."
  }
  return (Resolve-Path -LiteralPath $launcher -ErrorAction Stop).Path
}

function Resolve-EcoTunnelClientPath {
  param([string]$TunnelClientPath)
  $candidates = @()
  if (-not [string]::IsNullOrWhiteSpace($TunnelClientPath)) { $candidates += $TunnelClientPath }
  if (-not [string]::IsNullOrWhiteSpace($env:ECO_TUNNEL_CLIENT_PATH)) { $candidates += $env:ECO_TUNNEL_CLIENT_PATH }
  foreach ($commandName in @('tunnel-client.exe', 'tunnel-client')) {
    $command = Get-Command $commandName -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($null -ne $command -and -not [string]::IsNullOrWhiteSpace($command.Source)) { $candidates += $command.Source }
  }
  foreach ($candidate in $candidates) {
    if ([string]::IsNullOrWhiteSpace($candidate)) { continue }
    if (Test-Path -LiteralPath $candidate -PathType Leaf) {
      return (Resolve-Path -LiteralPath $candidate -ErrorAction Stop).Path
    }
  }
  throw 'tunnel-client was not found. Pass -TunnelClientPath, set ECO_TUNNEL_CLIENT_PATH, or add tunnel-client to PATH.'
}

function Resolve-EcoAllowedRoots {
  param([string[]]$AllowedRoot)
  if ($null -eq $AllowedRoot -or $AllowedRoot.Count -eq 0) { throw 'At least one -AllowedRoot is required.' }
  $seen = @{}
  $resolved = @()
  foreach ($root in $AllowedRoot) {
    if ([string]::IsNullOrWhiteSpace($root)) { continue }
    $item = Get-Item -LiteralPath $root -Force -ErrorAction Stop
    if (-not $item.PSIsContainer) { throw "Allowed root must be a directory: $root" }
    $full = [IO.Path]::GetFullPath($item.FullName)
    $key = $full.ToLowerInvariant()
    if (-not $seen.ContainsKey($key)) {
      $seen[$key] = $true
      $resolved += $full
    }
  }
  if ($resolved.Count -eq 0) { throw 'At least one existing -AllowedRoot directory is required.' }
  return ,$resolved
}

function ConvertTo-EcoCommandArgument {
  param([Parameter(Mandatory = $true)][string]$Value)
  if ($Value.Contains('"')) { throw 'ECO command arguments may not contain a double quote character.' }
  return ('"' + $Value + '"')
}

function New-EcoMcpCommand {
  param(
    [Parameter(Mandatory = $true)][string]$LauncherPath,
    [Parameter(Mandatory = $true)][string[]]$AllowedRoots,
    [string]$PermissionProfile = 'full'
  )
  if ($AllowedRoots.Count -eq 0) { throw 'ECO MCP command requires at least one allowed root.' }
  $parts = @(
    (ConvertTo-EcoCommandArgument -Value $LauncherPath),
    '--strict-roots',
    '--trusted-host-approval',
    '--profile',
    (ConvertTo-EcoCommandArgument -Value $PermissionProfile)
  )
  foreach ($root in $AllowedRoots) {
    $parts += '--allowed-root'
    $parts += (ConvertTo-EcoCommandArgument -Value $root)
  }
  $parts += '--workspace'
  $parts += (ConvertTo-EcoCommandArgument -Value $AllowedRoots[0])
  return ($parts -join ' ')
}

function Read-EcoConfig {
  param([string]$ProfileDirectory = (Get-EcoProfileDirectory))
  $configPath = Get-EcoConfigPath -ProfileDirectory $ProfileDirectory
  if (-not (Test-Path -LiteralPath $configPath -PathType Leaf)) { return $null }
  try {
    return (Get-Content -LiteralPath $configPath -Raw -ErrorAction Stop | ConvertFrom-Json)
  } catch {
    throw "ECO headless config is invalid: $configPath"
  }
}

function Write-EcoConfig {
  param(
    [Parameter(Mandatory = $true)]$Config,
    [string]$ProfileDirectory = (Get-EcoProfileDirectory)
  )
  $configPath = Get-EcoConfigPath -ProfileDirectory $ProfileDirectory
  $tempPath = $configPath + '.tmp.' + [guid]::NewGuid().ToString('N')
  try {
    $Config | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $tempPath -Encoding UTF8
    Move-Item -LiteralPath $tempPath -Destination $configPath -Force
  } finally {
    Remove-Item -LiteralPath $tempPath -Force -ErrorAction SilentlyContinue
  }
}

function Read-EcoOwnerRecord {
  param([string]$ProfileDirectory = (Get-EcoProfileDirectory))
  $ownerPath = Get-EcoOwnerPath -ProfileDirectory $ProfileDirectory
  if (-not (Test-Path -LiteralPath $ownerPath -PathType Leaf)) { return $null }
  try {
    return (Get-Content -LiteralPath $ownerPath -Raw -ErrorAction Stop | ConvertFrom-Json)
  } catch {
    return $null
  }
}

function Get-EcoProcessStartedAt {
  param([Parameter(Mandatory = $true)][int]$ProcessId)
  $process = Get-Process -Id $ProcessId -ErrorAction Stop
  return $process.StartTime.ToUniversalTime().ToString('o')
}

function Test-EcoProcessIdentity {
  param([int]$ProcessId, [string]$ExpectedStartedAt)
  if ($ProcessId -le 0) { return $false }
  try {
    $process = Get-Process -Id $ProcessId -ErrorAction Stop
    if ([string]::IsNullOrWhiteSpace($ExpectedStartedAt)) { return $true }
    $actual = $process.StartTime.ToUniversalTime().ToString('o')
    return $actual -eq $ExpectedStartedAt
  } catch {
    return $false
  }
}

function Write-EcoOwnerRecord {
  param(
    [Parameter(Mandatory = $true)]$Record,
    [string]$ProfileDirectory = (Get-EcoProfileDirectory)
  )
  $ownerPath = Get-EcoOwnerPath -ProfileDirectory $ProfileDirectory
  $tempPath = $ownerPath + '.tmp.' + [guid]::NewGuid().ToString('N')
  try {
    $Record | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $tempPath -Encoding UTF8
    Move-Item -LiteralPath $tempPath -Destination $ownerPath -Force
  } finally {
    Remove-Item -LiteralPath $tempPath -Force -ErrorAction SilentlyContinue
  }
}

function Test-EcoOwnerRecordIdentity {
  param($Owner)
  if ($null -eq $Owner) { return $false }
  return (Test-EcoProcessIdentity -ProcessId ([int]$Owner.ownerPid) -ExpectedStartedAt ([string]$Owner.ownerStartedAt))
}

function Remove-EcoOwnerRecordIfOwned {
  param(
    [Parameter(Mandatory = $true)]$Owner,
    [string]$ProfileDirectory = (Get-EcoProfileDirectory)
  )
  $current = Read-EcoOwnerRecord -ProfileDirectory $ProfileDirectory
  if ($null -eq $current) { return $true }
  if ([int]$current.ownerPid -ne [int]$Owner.ownerPid -or [string]$current.ownerStartedAt -ne [string]$Owner.ownerStartedAt) {
    return $false
  }
  Remove-Item -LiteralPath (Get-EcoOwnerPath -ProfileDirectory $ProfileDirectory) -Force -ErrorAction SilentlyContinue
  return $true
}
