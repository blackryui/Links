import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = path.resolve(import.meta.dirname, '..', '..');

async function script(name: string): Promise<string> {
  return readFile(path.join(root, 'scripts', name), 'utf8');
}

describe('ECO headless tunnel lifecycle', () => {
  it('starts a hidden ECO-owned worker and never launches Desktop', async () => {
    const start = await script('start-eco-tunnel.ps1');
    expect(start).toContain('[switch]$Worker');
    expect(start).toContain('WindowStyle Hidden');
    expect(start).toContain('eco.tunnel.owner.json');
    expect(start).toContain('CONTROL_PLANE_API_KEY');
    expect(start).toContain('ConvertTo-SecureString');
    expect(start).toContain('doctor');
    expect(start).toContain('run');
    expect(start).toContain('mcp.connection-max-ttl');
    expect(start).toContain('ZeroFreeBSTR');
    expect(start).toContain('Remove-Item Env:CONTROL_PLANE_API_KEY');
    expect(start).not.toContain('lnwjud.exe');
    expect(start.toLowerCase()).not.toContain('electron');
  });

  it('uses bounded restart and exact process identity', async () => {
    const start = await script('start-eco-tunnel.ps1');
    expect(start).toContain('$maxRapidRestarts = 5');
    expect(start).toContain('ownerStartedAt');
    expect(start).toContain('tunnelStartedAt');
    expect(start).toContain('Test-EcoProcessIdentity');
    expect(start).toContain('Get-EcoStopPath');
  });

  it('stops only the recorded ECO owner/tunnel process', async () => {
    const stop = await script('stop-eco-tunnel.ps1');
    expect(stop).toContain('Read-EcoOwnerRecord');
    expect(stop).toContain('Test-EcoProcessIdentity');
    expect(stop).toContain('Stop-Process -Id');
    expect(stop).not.toContain('Get-Process -Name');
    expect(stop).not.toContain('taskkill');
  });

  it('reports status without decrypting or printing secret material', async () => {
    const status = await script('status-eco-tunnel.ps1');
    expect(status).toContain('Read-EcoOwnerRecord');
    expect(status).toContain('secretPresent');
    expect(status).toContain('allowedRoots');
    expect(status).toContain('lastDiagnostic');
    expect(status).not.toContain('ConvertTo-SecureString');
    expect(status).not.toContain('CONTROL_PLANE_API_KEY');
    expect(status).not.toContain('Get-Content $secretPath -Raw');
  });
});
