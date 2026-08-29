import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = path.resolve(import.meta.dirname, '..', '..');
const setupPath = path.join(root, 'scripts', 'setup-eco-headless.ps1');
const commonPath = path.join(root, 'scripts', 'lib', 'eco-headless-common.ps1');

describe('ECO Secure MCP Tunnel stdio profile', () => {
  it('uses the official tunnel-client stdio init flow with the same direct runtime used by Codex', async () => {
    const setup = await readFile(setupPath, 'utf8');
    const common = await readFile(commonPath, 'utf8');
    const combined = `${common}\n${setup}`;

    expect(combined).toContain("EcoProfileName = 'eco'");
    expect(setup).toContain('sample_mcp_stdio_local');
    expect(setup).toContain("'--mcp-command'");
    expect(setup).toContain("'--tunnel-id'");
    expect(common).toContain('eco-node.exe');
    expect(common).toContain('eco-mcp.cjs');
    expect(common).toContain('--strict-roots');
    expect(common).toContain('--trusted-host-approval');
    expect(common).toContain('--allowed-root');
    expect(common).toContain('--workspace');

    expect(combined).not.toContain('server_urls:');
    expect(combined).not.toContain('lnwjud.exe');
    expect(combined.toLowerCase()).not.toContain('electron');
  });

  it('stores the runtime key outside Git and exposes it only to the tunnel process environment', async () => {
    const setup = await readFile(setupPath, 'utf8');
    const common = await readFile(commonPath, 'utf8');
    const combined = `${common}\n${setup}`;

    expect(common).toContain('eco.runtime.secret');
    expect(setup).toContain('Read-Host');
    expect(setup).toContain('-AsSecureString');
    expect(setup).toContain('ConvertFrom-SecureString');
    expect(setup).toContain('ConvertTo-SecureString');
    expect(setup).toContain('CONTROL_PLANE_API_KEY');
    expect(setup).toContain('Remove-Item Env:CONTROL_PLANE_API_KEY');
    expect(combined).not.toMatch(/sk-(?:proj-)?[A-Za-z0-9_-]{20,}/);
  });
});
