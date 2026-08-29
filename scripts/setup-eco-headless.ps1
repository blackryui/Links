<#Requires -Version 5.1
.SYNOPSIS
Configures ECO Headless for OpenAI Secure MCP Tunnel without lnwjud Desktop.

.DESCRIPTION
Builds/resolves the ECO stdio MCP runtime, requires one or more explicit allowed
workspace roots, stores the OpenAI tunnel runtime API key with Windows DPAPI,
and creates the `eco` tunnel-client profile through the official stdio sample.
No public MCP port, Desktop process, or Electron host is required.
#>

[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [ValidatePattern('^tunnel_[A-Za-z0-9_-]+$')]
  [string]$TunnelId,

  [Parameter(Mandatory = $true)]
  [string[]]$AllowedRoot,

  [ValidateSet('safe', 'balanced', 'full', 'custom')]
  [string]$PermissionProfile = 'full',

  [string]$TunnelClientPath,
  [string]$BundleRoot,
  [SecureString]$RuntimeApiKey,
  [switch]$SkipBuild
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

$commonPath = Join-Path $PSScriptRoot 'lib\eco-headless-common.ps1'
if (-not (Test-Path -LiteralPath $commonPath -PathType Leaf)) {
  throw "Missing ECO headless helper: $commonPath"
}
. $commonPath

$profileDir = Get-EcoProfileDirectory
New-Item -ItemType Directory -Force -Path $profileDir | Out-Null
$env:TUNNEL_CLIENT_PROFILE_DIR = $profileDir

$roots = @(Resolve-EcoAllowedRoots -AllowedRoot $AllowedRoot)
$resolvedBundleRoot = Resolve-EcoBundleRoot -BundleRoot $BundleRoot
$nodeCandidate = Join-Path $resolvedBundleRoot 'eco-node.exe'
$bundleCandidate = Join-Path $resolvedBundleRoot 'eco-mcp.cjs'

if (-not (Test-Path -LiteralPath $nodeCandidate -PathType Leaf) -or -not (Test-Path -LiteralPath $bundleCandidate -PathType Leaf)) {
  if ($SkipBuild) {
    throw "ECO MCP runtime not found in: $resolvedBundleRoot"
  }
  $repositoryRoot = Get-EcoRepositoryRoot
  $rootPackage = Join-Path $repositoryRoot 'package.json'
  if (-not (Test-Path -LiteralPath $rootPackage -PathType Leaf)) {
    throw "ECO MCP runtime is missing and source checkout is unavailable: $resolvedBundleRoot"
  }
  Push-Location $repositoryRoot
  try {
    & corepack pnpm@10.15.0 build:eco
    if ($LASTEXITCODE -ne 0) { throw "ECO headless build failed with exit code $LASTEXITCODE" }
  }
  finally {
    Pop-Location
  }
}

$runtimePaths = Resolve-EcoMcpRuntimePaths -BundleRoot $resolvedBundleRoot
$clientPath = Resolve-EcoTunnelClientPath -TunnelClientPath $TunnelClientPath
$mcpCommand = New-EcoMcpCommand `
  -NodePath $runtimePaths.nodePath `
  -BundlePath $runtimePaths.bundlePath `
  -AllowedRoots $roots `
  -PermissionProfile $PermissionProfile
$secretPath = Get-EcoSecretPath -ProfileDirectory $profileDir

if ($null -eq $RuntimeApiKey) {
  $RuntimeApiKey = Read-Host 'OpenAI Tunnel runtime API key' -AsSecureString
}
if ($null -eq $RuntimeApiKey -or $RuntimeApiKey.Length -eq 0) {
  throw 'A non-empty OpenAI Tunnel runtime API key is required.'
}

# Windows PowerShell ConvertFrom-SecureString without -Key uses DPAPI for the
# current user. The resulting encrypted value is safe to persist locally but
# remains machine/user scoped and must never be committed to Git.
$encryptedKey = ConvertFrom-SecureString -SecureString $RuntimeApiKey
Set-Content -LiteralPath $secretPath -Value $encryptedKey -Encoding UTF8

$keyPointer = [IntPtr]::Zero
try {
  $saved = Get-Content -LiteralPath $secretPath -Raw -ErrorAction Stop
  $secureKey = ConvertTo-SecureString -String $saved.Trim()
  $keyPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureKey)
  $plainKey = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($keyPointer)
  if ([string]::IsNullOrWhiteSpace($plainKey)) { throw 'Saved tunnel runtime API key could not be decrypted.' }
  $env:CONTROL_PLANE_API_KEY = $plainKey

  Write-Host 'ECO headless: creating Secure MCP Tunnel stdio profile ...'
  $initArgs = @(
    'init',
    '--sample', 'sample_mcp_stdio_local',
    '--profile', $script:EcoProfileName,
    '--tunnel-id', $TunnelId,
    '--mcp-command', $mcpCommand
  )
  & $clientPath @initArgs
  if ($LASTEXITCODE -ne 0) { throw "tunnel-client init failed with exit code $LASTEXITCODE" }

  Write-Host 'ECO headless: validating tunnel profile ...'
  & $clientPath doctor --profile $script:EcoProfileName --profile-dir $profileDir --explain
  if ($LASTEXITCODE -ne 0) { throw "tunnel-client doctor failed with exit code $LASTEXITCODE" }

  $config = [ordered]@{
    schemaVersion = 1
    profile = $script:EcoProfileName
    tunnelId = $TunnelId
    tunnelClientPath = $clientPath
    bundleRoot = $runtimePaths.bundleRoot
    launcherPath = $runtimePaths.launcherPath
    nodePath = $runtimePaths.nodePath
    bundlePath = $runtimePaths.bundlePath
    permissionProfile = $PermissionProfile
    allowedRoots = @($roots)
    transport = 'stdio'
    trustedHostApproval = $true
    configuredAt = (Get-Date).ToUniversalTime().ToString('o')
  }
  Write-EcoConfig -Config $config -ProfileDirectory $profileDir
}
finally {
  if ($keyPointer -ne [IntPtr]::Zero) {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($keyPointer)
  }
  Remove-Item Env:CONTROL_PLANE_API_KEY -ErrorAction SilentlyContinue
  Remove-Item Env:TUNNEL_CLIENT_PROFILE_DIR -ErrorAction SilentlyContinue
}

Write-Host ''
Write-Host 'ECO Headless configured successfully.'
Write-Host ("Profile:       {0}" -f $script:EcoProfileName)
Write-Host ("Profile dir:   {0}" -f $profileDir)
Write-Host ("Node runtime:  {0}" -f $runtimePaths.nodePath)
Write-Host ("MCP bundle:    {0}" -f $runtimePaths.bundlePath)
Write-Host ("Tunnel client: {0}" -f $clientPath)
Write-Host ("Permission:    {0}" -f $PermissionProfile)
Write-Host 'Allowed roots:'
$roots | ForEach-Object { Write-Host ("  - {0}" -f $_) }
Write-Host 'Trusted host approval: enabled for this generated ChatGPT tunnel command.'
Write-Host 'Runtime API key: stored locally with Windows DPAPI (value not shown).'
Write-Host 'Next: run scripts\start-eco-tunnel.ps1'
