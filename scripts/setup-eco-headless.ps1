#Requires -Version 5.1
param(
  [Parameter(Mandatory = $true)][string]$TunnelId,
  [Parameter(Mandatory = $true)][string[]]$AllowedRoot,
  [string]$TunnelClientPath,
  [string]$EcoMcpPath,
  [switch]$ReplaceRuntimeKey,
  [switch]$EnableCodexTools
)

$ErrorActionPreference = 'Stop'
$repositoryRoot = Split-Path -Parent $PSScriptRoot
. (Join-Path $PSScriptRoot 'lib\eco-headless-common.ps1')
. (Join-Path $PSScriptRoot 'lib\eco-runtime-package.ps1')

$profileDir = Get-EcoProfileDir
$profileName = Get-EcoProfileName
$secretPath = Get-EcoSecretPath
New-Item -ItemType Directory -Path $profileDir -Force | Out-Null

$resolvedRoots = @()
foreach ($root in $AllowedRoot) {
  $resolved = (Resolve-Path -LiteralPath $root -ErrorAction Stop).Path
  if (-not (Test-Path -LiteralPath $resolved -PathType Container)) { throw "Allowed root is not a directory: $resolved" }
  if ($resolvedRoots -notcontains $resolved) { $resolvedRoots += $resolved }
}
if ($resolvedRoots.Count -lt 1) { throw 'At least one explicit allowed root is required.' }

$tunnelClient = Resolve-EcoTunnelClientPath $TunnelClientPath
$runtimePackage = Resolve-EcoRuntimePackage -RepositoryRoot $repositoryRoot -EcoMcpPath $EcoMcpPath
$mcpCommand = New-EcoDirectMcpCommand -RuntimePackage $runtimePackage -AllowedRoots $resolvedRoots -EnableCodexTools:$EnableCodexTools

if ($ReplaceRuntimeKey -or -not (Test-Path -LiteralPath $secretPath -PathType Leaf)) {
  $secureKey = Read-Host 'OpenAI Tunnel runtime API key' -AsSecureString
  $secureKey | ConvertFrom-SecureString | Set-Content -LiteralPath $secretPath -Encoding UTF8
}

$keyPointer = $null
try {
  $encrypted = Get-Content -LiteralPath $secretPath -Raw
  $secureKey = ConvertTo-SecureString -String $encrypted
  $keyPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureKey)
  $env:CONTROL_PLANE_API_KEY = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($keyPointer)
  $env:TUNNEL_CLIENT_PROFILE_DIR = $profileDir

  $initArgs = @(
    '--sample', 'sample_mcp_stdio_local',
    '--profile', 'eco',
    '--tunnel-id', $TunnelId,
    '--mcp-command', $mcpCommand
  )
  & $tunnelClient init @initArgs
  if ($LASTEXITCODE -ne 0) { throw "tunnel-client init failed with exit code $LASTEXITCODE" }

  & $tunnelClient doctor --profile $profileName --profile-dir $profileDir --explain
  if ($LASTEXITCODE -ne 0) { throw "tunnel-client doctor failed with exit code $LASTEXITCODE" }

  Write-Host 'ECO Headless tunnel profile configured.'
  Write-Host "Profile: $profileName"
  Write-Host "Profile directory: $profileDir"
  Write-Host "ECO private Node: $($runtimePackage.nodePath)"
  Write-Host "ECO MCP script: $($runtimePackage.scriptPath)"
  Write-Host "Codex delegation tools: $(if ($EnableCodexTools) { 'enabled' } else { 'upstream default/stored setting' })"
  Write-Host 'Allowed roots:'
  $resolvedRoots | ForEach-Object { Write-Host "  - $_" }
}
finally {
  if ($null -ne $keyPointer) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($keyPointer) }
  Remove-Item Env:CONTROL_PLANE_API_KEY -ErrorAction SilentlyContinue
  Remove-Item Env:TUNNEL_CLIENT_PROFILE_DIR -ErrorAction SilentlyContinue
}
