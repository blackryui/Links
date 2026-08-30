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

function Resolve-EcoTunnelClientPath([string]$RequestedPath) {
  if (-not [string]::IsNullOrWhiteSpace($RequestedPath)) {
    return (Resolve-Path -LiteralPath $RequestedPath -ErrorAction Stop).Path
  }
  if (-not [string]::IsNullOrWhiteSpace($env:ECO_TUNNEL_CLIENT_PATH)) {
    return (Resolve-Path -LiteralPath $env:ECO_TUNNEL_CLIENT_PATH -ErrorAction Stop).Path
  }
  $command = Get-Command tunnel-client.exe -ErrorAction SilentlyContinue
  if ($null -eq $command) { $command = Get-Command tunnel-client -ErrorAction SilentlyContinue }
  if ($null -eq $command) {
    throw 'tunnel-client was not found. Install the current OpenAI tunnel-client or set ECO_TUNNEL_CLIENT_PATH.'
  }
  return [string]$command.Source
}
