import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = path.resolve(import.meta.dirname, '..', '..');

describe('ECO headless tunnel lifecycle', () => {
  it('owns one ECO worker and never launches or broadly kills Desktop/tunnel processes', async () => {
    const start = await readFile(path.join(root, 'scripts', 'start-eco-tunnel.ps1'), 'utf8');
    const stop = await readFile(path.join(root, 'scripts', 'stop-eco-tunnel.ps1'), 'utf8');
    const status = await readFile(path.join(root, 'scripts', 'status-eco-tunnel.ps1'), 'utf8');

    expect(start).toContain('Get-EcoTunnelMutexName');
    expect(start).toContain('eco.tunnel.owner.json');
    expect(start).toContain('doctor');
    expect(start).toContain("'run'");
    expect(start).toContain('CONTROL_PLANE_API_KEY');
    expect(start).toContain('ZeroFreeBSTR');
    expect(start).toContain('maxRapidRestarts');
    expect(start).toContain('Start-Process');
    expect(start).not.toContain('lnwjud.exe');
    expect(start).not.toContain('electron');

    expect(stop).toContain('Get-EcoOwnerRecord');
    expect(stop).toContain('Get-EcoStopPath');
    expect(stop).not.toContain("Get-Process -Name 'tunnel-client'");
    expect(stop).not.toContain('taskkill /IM');

    expect(status).toContain('Get-EcoOwnerRecord');
    expect(status).toContain('Get-EcoLogPath');
    expect(status).not.toContain('CONTROL_PLANE_API_KEY');
  });
});
