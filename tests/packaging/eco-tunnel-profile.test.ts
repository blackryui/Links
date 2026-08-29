import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = path.resolve(import.meta.dirname, '..', '..');

describe('ECO Secure MCP Tunnel stdio profile', () => {
  it('configures tunnel-client to spawn the packaged private Node executable directly', async () => {
    const setup = await readFile(path.join(root, 'scripts', 'setup-eco-headless.ps1'), 'utf8');
    const common = await readFile(path.join(root, 'scripts', 'lib', 'eco-headless-common.ps1'), 'utf8');

    expect(setup).toContain('sample_mcp_stdio_local');
    expect(setup).toContain("'--profile'");
    expect(setup).toContain("'eco'");
    expect(setup).toContain("'--mcp-command'");
    expect(setup).toContain('Resolve-EcoRuntimePackage');
    expect(setup).toContain('doctor');
    expect(setup).not.toContain('--mcp-server-url');
    expect(setup).not.toContain('server_urls');
    expect(setup).not.toContain('lnwjud.exe');
    expect(setup).not.toContain('electron');
    expect(setup).not.toContain('CONTROL_PLANE_API_KEY=');

    expect(common).toContain('Resolve-EcoRuntimePackage');
    expect(common).toContain('eco-node.exe');
    expect(common).toContain('eco-mcp.cjs');
    expect(common).toContain("'--strict-roots'");
    expect(common).toContain("'--allowed-root'");
    expect(common).toContain("'--workspace'");
    expect(common).toContain("'--enable-codex-tools'");
    expect(common).not.toContain("$parts += '--profile'");
    expect(common).not.toContain('eco-mcp.cmd --strict-roots');
    expect(common).toContain('eco.runtime.secret');
    expect(common).toContain('eco-tunnel.log');
    expect(common).toContain('eco.tunnel.owner.json');
  });
});
