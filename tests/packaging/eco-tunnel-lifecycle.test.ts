import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = path.resolve(import.meta.dirname, '..', '..');

describe('ECO headless tunnel lifecycle', () => {
  it('keeps all operator PowerShell entrypoints parseable with a real #Requires directive', async () => {
    const scriptPaths = [
      path.join(root, 'scripts', 'setup-eco-headless.ps1'),
      path.join(root, 'scripts', 'start-eco-tunnel.ps1'),
      path.join(root, 'scripts', 'status-eco-tunnel.ps1'),
      path.join(root, 'scripts', 'stop-eco-tunnel.ps1'),
    ];

    for (const scriptPath of scriptPaths) {
      const source = await readFile(scriptPath, 'utf8');
      expect(source, path.basename(scriptPath)).toMatch(/^#Requires -Version 5\.1\r?\n/);
      expect(source, path.basename(scriptPath)).not.toMatch(/^<#Requires/m);

      if (process.platform === 'win32') {
        const escapedPath = scriptPath.replaceAll("'", "''");
        const parser = [
          '$tokens = $null',
          '$errors = $null',
          `[System.Management.Automation.Language.Parser]::ParseFile('${escapedPath}', [ref]$tokens, [ref]$errors) | Out-Null`,
          'if ($errors.Count -gt 0) { $errors | ForEach-Object { Write-Error $_.Message }; exit 1 }',
        ].join('; ');
        const result = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', parser], {
          encoding: 'utf8',
        });
        expect(result.status, `${path.basename(scriptPath)}\n${result.stderr}`).toBe(0);
      }
    }
  });

  it('owns one ECO worker and one verified tunnel-client child without broad process kills', async () => {
    const common = await readFile(path.join(root, 'scripts', 'lib', 'eco-headless-common.ps1'), 'utf8');
    const start = await readFile(path.join(root, 'scripts', 'start-eco-tunnel.ps1'), 'utf8');
    const stop = await readFile(path.join(root, 'scripts', 'stop-eco-tunnel.ps1'), 'utf8');
    const status = await readFile(path.join(root, 'scripts', 'status-eco-tunnel.ps1'), 'utf8');

    expect(common).toContain('version = 2');
    expect(common).toContain('tunnelClientPath');
    expect(common).toContain('childPid');
    expect(common).toContain('childStartedAt');
    expect(common).toContain('Test-EcoOwnedChildLive');
    expect(common).toContain('Stop-EcoOwnedChild');

    expect(start).toContain('Get-EcoTunnelMutexName');
    expect(start).toContain('eco.tunnel.owner.json');
    expect(start).toContain('Set-EcoOwnerChild');
    expect(start).toContain('Stop-EcoOwnedChild');
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
    expect(stop).toContain('Stop-EcoOwnedChild');
    expect(stop).not.toContain("Get-Process -Name 'tunnel-client'");
    expect(stop).not.toContain('taskkill /IM');

    expect(status).toContain('Get-EcoOwnerRecord');
    expect(status).toContain('Get-EcoLogPath');
    expect(status).toContain('childPid');
    expect(status).not.toContain('CONTROL_PLANE_API_KEY');
  });
});
