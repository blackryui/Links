<#Requires -Version 5.1
.SYNOPSIS
Registers the same ECO Headless stdio runtime as a local MCP server in Codex.

.DESCRIPTION
Uses the official `codex mcp` CLI so Codex owns its configuration format. ECO
never writes ~/.codex/config.toml directly. The registered server launches the
private Node 24 runtime plus the same eco-mcp.cjs bundle used by Secure Tunnel.
#>

[CmdletBinding()]
param(
  [string]$CodexPath,
  [switch]$Replace
)

$ErrorActionPreference = 'Stop'
$commonPath = Join-Path $PSScriptRoot 'lib\eco-headless-common.ps1'
if (-not (Test-Path -LiteralPath $commonPath -PathType Leaf)) { throw "Missing ECO headless helper: $commonPath" }
. $commonPath

$profileDir = Get-EcoProfileDirectory
$config = Read-EcoConfig -ProfileDirectory $profileDir
if ($null -eq $config) { throw 'ECO Headless is not configured. Run scripts\setup-eco-headless.ps1 first.' }

if ([string]::IsNullOrWhiteSpace($CodexPath)) {
  $CodexPath = $env:ECO_CODEX_PATH
}
if ([string]::IsNullOrWhiteSpace($CodexPath)) {
  foreach ($name in @('codex.exe', 'codex')) {
    $command = Get-Command $name -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($null -ne $command -and -not [string]::IsNullOrWhiteSpace($command.Source)) {
      $CodexPath = $command.Source
      break
    }
  }
}
if ([string]::IsNullOrWhiteSpace($CodexPath) -or -not (Test-Path -LiteralPath $CodexPath -PathType Leaf)) {
  throw 'Codex CLI was not found. Pass -CodexPath, set ECO_CODEX_PATH, or add codex to PATH.'
}
$CodexPath = (Resolve-Path -LiteralPath $CodexPath -ErrorAction Stop).Path

$bundleRoot = [string]$config.bundleRoot
$nodePath = Join-Path $bundleRoot 'eco-node.exe'
$bundlePath = Join-Path $bundleRoot 'eco-mcp.cjs'
if (-not (Test-Path -LiteralPath $nodePath -PathType Leaf)) { throw "ECO private Node runtime missing: $nodePath" }
if (-not (Test-Path -LiteralPath $bundlePath -PathType Leaf)) { throw "ECO MCP bundle missing: $bundlePath" }

$allowedRoots = @(Resolve-EcoAllowedRoots -AllowedRoot @($config.allowedRoots))
$permissionProfile = [string]$config.permissionProfile
if ([string]::IsNullOrWhiteSpace($permissionProfile)) { $permissionProfile = 'full' }

& $CodexPath mcp get $script:EcoProfileName --json *> $null
$alreadyRegistered = ($LASTEXITCODE -eq 0)
if ($alreadyRegistered -and -not $Replace) {
  throw "Codex MCP server '$($script:EcoProfileName)' already exists. Re-run with -Replace to replace only that named server."
}
if ($alreadyRegistered) {
  & $CodexPath mcp remove $script:EcoProfileName
  if ($LASTEXITCODE -ne 0) { throw "codex mcp remove failed with exit code $LASTEXITCODE" }
}

# Trusted host approval is explicit. ToolRegistry still requires the tool's own
# userConfirmed marker and permission/destructive rules before this host layer
# is reached; the flag maps Codex's host approval surface to the final provider.
$runtimeArgs = @('--strict-roots', '--trusted-host-approval', '--profile', $permissionProfile)
foreach ($root in $allowedRoots) {
  $runtimeArgs += '--allowed-root'
  $runtimeArgs += $root
}
$runtimeArgs += '--workspace'
$runtimeArgs += $allowedRoots[0]

# Official Codex form: codex mcp add <NAME> -- <COMMAND> <ARGS...>
& $CodexPath mcp add $script:EcoProfileName -- $nodePath $bundlePath @runtimeArgs
if ($LASTEXITCODE -ne 0) { throw "codex mcp add failed with exit code $LASTEXITCODE" }

& $CodexPath mcp get $script:EcoProfileName --json
if ($LASTEXITCODE -ne 0) { throw "codex mcp get verification failed with exit code $LASTEXITCODE" }

Write-Host ''
Write-Host 'ECO is registered as a local Codex MCP server.'
Write-Host ("Codex:       {0}" -f $CodexPath)
Write-Host ("MCP name:    {0}" -f $script:EcoProfileName)
Write-Host ("Runtime:     {0}" -f $nodePath)
Write-Host ("Bundle:      {0}" -f $bundlePath)
Write-Host ("Permission:  {0}" -f $permissionProfile)
Write-Host 'Allowed roots:'
$allowedRoots | ForEach-Object { Write-Host ("  - {0}" -f $_) }
