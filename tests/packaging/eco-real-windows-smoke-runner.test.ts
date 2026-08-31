import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = path.resolve(import.meta.dirname, '..', '..');

describe('ECO real Windows smoke runner', () => {
  it('orchestrates prerequisite, build, local MCP smoke and evidence capture without tunnel secrets', async () => {
    const runner = await readFile(path.join(root, 'scripts', 'run-eco-real-smoke.ps1'), 'utf8');

    expect(runner).toMatch(/^#Requires -Version 5\.1\r?\n/);
    expect(runner).toContain('node --version');
    expect(runner).toContain('install --frozen-lockfile');
    expect(runner).toContain('build:eco');
    expect(runner).toContain('smoke:eco:local');
    expect(runner).toContain('.local-artifacts');
    expect(runner).toContain('local-stdio.json');
    expect(runner).toContain("$smokeResult.ok -ne $true");

    for (const forbidden of ['CONTROL_PLANE_API_KEY', 'Read-Host', 'TunnelId', 'eco-node.exe']) {
      expect(runner).not.toContain(forbidden);
    }
  });
});
