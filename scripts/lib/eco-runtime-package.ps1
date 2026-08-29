Set-StrictMode -Version Latest

function Resolve-EcoRuntimePackage {
  param(
    [Parameter(Mandatory = $true)][string]$RepositoryRoot,
    [string]$EcoMcpPath
  )

  $scriptPath = if (-not [string]::IsNullOrWhiteSpace($EcoMcpPath)) {
    (Resolve-Path -LiteralPath $EcoMcpPath -ErrorAction Stop).Path
  } elseif ($env:ECO_MCP_PATH) {
    (Resolve-Path -LiteralPath $env:ECO_MCP_PATH -ErrorAction Stop).Path
  } else {
    (Resolve-Path -LiteralPath (Join-Path $RepositoryRoot 'dist\eco-headless\eco-mcp.cjs') -ErrorAction Stop).Path
  }

  if ([IO.Path]::GetExtension($scriptPath) -ine '.cjs') {
    throw "ECO Tunnel requires the packaged eco-mcp.cjs entrypoint, not a shell launcher: $scriptPath"
  }

  $runtimeDir = Split-Path -Parent $scriptPath
  $nodePath = (Resolve-Path -LiteralPath (Join-Path $runtimeDir 'eco-node.exe') -ErrorAction Stop).Path
  $rgPath = (Resolve-Path -LiteralPath (Join-Path $runtimeDir 'runtime-tools\ripgrep\rg.exe') -ErrorAction Stop).Path

  return [pscustomobject][ordered]@{
    runtimeDir = $runtimeDir
    nodePath = $nodePath
    scriptPath = $scriptPath
    ripgrepPath = $rgPath
  }
}

function New-EcoDirectMcpCommand {
  param(
    [Parameter(Mandatory = $true)]$RuntimePackage,
    [Parameter(Mandatory = $true)][string[]]$AllowedRoots,
    [bool]$EnableCodexTools = $false
  )

  if ($AllowedRoots.Count -lt 1) { throw 'At least one explicit allowed root is required.' }
  $parts = @(
    (ConvertTo-EcoQuotedArgument ([string]$RuntimePackage.nodePath)),
    (ConvertTo-EcoQuotedArgument ([string]$RuntimePackage.scriptPath)),
    '--strict-roots'
  )
  foreach ($root in $AllowedRoots) {
    $parts += '--allowed-root'
    $parts += (ConvertTo-EcoQuotedArgument $root)
  }
  $parts += '--workspace'
  $parts += (ConvertTo-EcoQuotedArgument $AllowedRoots[0])
  if ($EnableCodexTools) { $parts += '--enable-codex-tools' }
  return ($parts -join ' ')
}
