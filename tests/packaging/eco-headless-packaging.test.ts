import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const repositoryRoot = path.resolve(import.meta.dirname, '..', '..');
const distRoot = path.join(repositoryRoot, 'dist', 'eco-headless');

async function exists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

describe('ECO headless distribution', () => {
  it('contains the protocol bundle, launcher, private Node runtime and Windows capability bridge', async () => {
    for (const artifact of [
      'eco-mcp.cjs',
      'eco-mcp.cmd',
      'eco-node.exe',
      'windows-capability-bridge.ps1',
      'PACKAGE.json',
    ]) {
      expect(await exists(path.join(distRoot, artifact)), artifact).toBe(true);
    }
  });

  it('records source/parity metadata and never packages the Desktop host', async () => {
    const rootPackage = JSON.parse(await readFile(path.join(repositoryRoot, 'package.json'), 'utf8')) as { version: string };
    const metadata = JSON.parse(await readFile(path.join(distRoot, 'PACKAGE.json'), 'utf8')) as Record<string, unknown>;
    const bundle = await readFile(path.join(distRoot, 'eco-mcp.cjs'), 'utf8');
    const launcher = await readFile(path.join(distRoot, 'eco-mcp.cmd'), 'utf8');

    expect(metadata.name).toBe('ECO Headless');
    expect(metadata.version).toBe(rootPackage.version);
    expect(metadata.sourceEntry).toBe('apps/cli/src/bin/mcp-stdio.ts');
    expect(metadata.parityInventory).toBe('docs/eco-headless-parity.json');
    expect(String(metadata.sourceCommit)).toMatch(/^[a-f0-9]{40}$/i);
    expect(metadata.nodeMajor).toBe(24);

    expect(bundle).not.toContain('apps/desktop');
    expect(bundle).not.toContain('electron');
    expect(launcher).toContain('eco-node.exe');
    expect(launcher).toContain('eco-mcp.cjs');
    expect(launcher).toContain('%*');
    expect(launcher).not.toContain('lnwjud.exe');
  });

  it('builds through the CLI workspace and has no Desktop build-time dependency', async () => {
    const buildScript = await readFile(path.join(repositoryRoot, 'scripts', 'build-eco-headless.mjs'), 'utf8');
    const cliPackage = JSON.parse(await readFile(path.join(repositoryRoot, 'apps', 'cli', 'package.json'), 'utf8')) as {
      devDependencies?: Record<string, string>;
    };

    expect(buildScript).toContain("'--filter',");
    expect(buildScript).toContain("'@lnwjud/cli'");
    expect(buildScript).not.toContain('@lnwjud/desktop');
    expect(cliPackage.devDependencies?.esbuild).toBe('0.25.12');
  });
});
