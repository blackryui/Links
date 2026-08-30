Set-StrictMode -Version Latest

function Resolve-EcoSystemNode {
  param([string]$NodePath)

  $requested = if (-not [string]::IsNullOrWhiteSpace($NodePath)) {
    $NodePath
  } elseif (-not [string]::IsNullOrWhiteSpace($env:ECO_NODE_PATH)) {
    $env:ECO_NODE_PATH
  } else {
    $null
  }

  if ($null -ne $requested) {
    try {
      $resolved = (Resolve-Path -LiteralPath $requested -ErrorAction Stop).Path
    } catch {
      throw "ECO system Node was not found: $requested"
    }
  } else {
    $command = Get-Command node.exe -ErrorAction SilentlyContinue
    if ($null -eq $command) { $command = Get-Command node -ErrorAction SilentlyContinue }
    if ($null -eq $command) {
      throw 'ECO Headless requires system Node.js 24.x. Install Node.js 24 or pass -NodePath.'
    }
    $resolved = [string]$command.Source
  }

  $versionOutput = @(& $resolved --version 2>&1)
  if ($LASTEXITCODE -ne 0) {
    throw "ECO system Node could not execute --version: $resolved"
  }
  $version = ([string]($versionOutput | Select-Object -First 1)).Trim()
  if ($version -notmatch '^v?24\.') {
    throw "ECO Headless requires Node.js 24.x; got $version from $resolved"
  }

  return [pscustomobject][ordered]@{
    nodePath = [IO.Path]::GetFullPath($resolved)
    version = $version
  }
}

function Resolve-EcoRuntimePackage {
  param(
    [Parameter(Mandatory = $true)][string]$RepositoryRoot,
    [string]$EcoMcpPath,
    [string]$NodePath
  )

  $scriptPath = if (-not [string]::IsNullOrWhiteSpace($EcoMcpPath)) {
    (Resolve-Path -LiteralPath $EcoMcpPath -ErrorAction Stop).Path
  } elseif (-not [string]::IsNullOrWhiteSpace($env:ECO_MCP_PATH)) {
    (Resolve-Path -LiteralPath $env:ECO_MCP_PATH -ErrorAction Stop).Path
  } else {
    (Resolve-Path -LiteralPath (Join-Path $RepositoryRoot 'dist\eco-headless\eco-mcp.cjs') -ErrorAction Stop).Path
  }

  if ([IO.Path]::GetExtension($scriptPath) -ine '.cjs') {
    throw "ECO Tunnel requires the packaged eco-mcp.cjs entrypoint, not a shell launcher: $scriptPath"
  }

  $runtimeDir = Split-Path -Parent $scriptPath
  $node = Resolve-EcoSystemNode -NodePath $NodePath
  $rgPath = (Resolve-Path -LiteralPath (Join-Path $runtimeDir 'runtime-tools\ripgrep\rg.exe') -ErrorAction Stop).Path

  return [pscustomobject][ordered]@{
    runtimeDir = $runtimeDir
    nodePath = [string]$node.nodePath
    nodeVersion = [string]$node.version
    scriptPath = $scriptPath
    ripgrepPath = $rgPath
  }
}

function ConvertTo-EcoTunnelCommandArgument([string]$Value) {
  # tunnel-client's stdio command parser treats backslash as an escape even
  # inside double quotes, so Windows paths are escaped once for that parser.
  $escaped = $Value.Replace('\', '\\').Replace('"', '\"')
  return '"' + $escaped + '"'
}

function New-EcoDirectMcpCommand {
  param(
    [Parameter(Mandatory = $true)]$RuntimePackage,
    [Parameter(Mandatory = $true)][string[]]$AllowedRoots
  )

  if ($AllowedRoots.Count -lt 1) { throw 'At least one explicit allowed root is required.' }
  $parts = @(
    (ConvertTo-EcoTunnelCommandArgument ([string]$RuntimePackage.nodePath)),
    (ConvertTo-EcoTunnelCommandArgument ([string]$RuntimePackage.scriptPath)),
    '--strict-roots'
  )
  foreach ($root in $AllowedRoots) {
    $parts += '--allowed-root'
    $parts += (ConvertTo-EcoTunnelCommandArgument $root)
  }
  $parts += '--workspace'
  $parts += (ConvertTo-EcoTunnelCommandArgument $AllowedRoots[0])
  return ($parts -join ' ')
}
