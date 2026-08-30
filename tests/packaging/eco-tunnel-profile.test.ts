import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = path.resolve(import.meta.dirname, '..', '..');

describe('ECO Secure MCP Tunnel profile', () => {
  it('constructs the direct MCP command from a resolved system Node path and eco-mcp.cjs', async () => {
    const runtimePackage = await readFile(path.join(root, 'scripts', 'lib', 'eco-runtime-package.ps1'), 'utf8');

    expect(runtimePackage).toContain('Resolve-EcoSystemNode');
    expect(runtimePackage).toContain('nodePath');
    expect(runtimePackage).toContain('scriptPath');
    expect(runtimePackage).toContain('eco-mcp.cjs');
    expect(runtimePackage).not.toContain('eco-node.exe');
  });

  it('keeps strict roots in the production tunnel command', async () => {
    const runtimePackage = await readFile(path.join(root, 'scripts', 'lib', 'eco-runtime-package.ps1'), 'utf8');

    expect(runtimePackage).toContain("'--strict-roots'");
    expect(runtimePackage).toContain("'--allowed-root'");
    expect(runtimePackage).toContain("'--workspace'");
  });

  it('reports system Node rather than a private ECO Node runtime', async () => {
    const setup = await readFile(path.join(root, 'scripts', 'setup-eco-headless.ps1'), 'utf8');

    expect(setup).toContain('ECO system Node');
    expect(setup).not.toContain('ECO private Node');
    expect(setup).not.toContain('eco-node.exe');
  });
});
