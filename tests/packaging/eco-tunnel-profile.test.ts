import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = path.resolve(import.meta.dirname, '..', '..');

describe('ECO Secure MCP Tunnel stdio profile', () => {
  it('configures tunnel-client to spawn the packaged private Node executable directly', async () => {
    const setup = await readFile(path.join(root, 'scripts', 'setup-eco-headless.ps1'), 'utf8');
    const common = await readFile(path.join(root, 'scripts', 'lib', 'eco-headless-common.ps1'), 'utf8');
    const runtimePackage = await readFile(path.join(root, 'scripts', 'lib', 'eco-runtime-package.ps1'), 'utf8');

    expect(setup).toContain('sample_mcp_stdio_local');
    expect(setup).toContain("'--profile'");
    expect(setup).toContain("'eco'");
    expect(setup).toContain("'--mcp-command'");
    expect(setup).toContain('Resolve-EcoRuntimePackage');
    expect(setup).toContain('New-EcoDirectMcpCommand');
    expect(setup).toContain('doctor');
    expect(setup).not.toContain('--mcp-server-url');
    expect(setup).not.toContain('server_urls');
    expect(setup).not.toContain('lnwjud.exe');
    expect(setup).not.toContain('electron');
    expect(setup).not.toContain('CONTROL_PLANE_API_KEY=');

    expect(runtimePackage).toContain('Resolve-EcoRuntimePackage');
    expect(runtimePackage).toContain('eco-node.exe');
    expect(runtimePackage).toContain('eco-mcp.cjs');
    expect(runtimePackage).toContain("'--strict-roots'");
    expect(runtimePackage).toContain("'--allowed-root'");
    expect(runtimePackage).toContain("'--workspace'");
    expect(runtimePackage).toContain("'--enable-codex-tools'");
    expect(runtimePackage).toContain('runtime-tools\\ripgrep\\rg.exe');
    expect(runtimePackage).not.toContain('eco-mcp.cmd');

    expect(common).not.toContain("$parts += '--profile'");
    expect(common).toContain('eco.runtime.secret');
    expect(common).toContain('eco-tunnel.log');
    expect(common).toContain('eco.tunnel.owner.json');
  });
});
