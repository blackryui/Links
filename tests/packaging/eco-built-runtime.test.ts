import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = path.resolve(import.meta.dirname, '..', '..');
const distRoot = path.join(root, 'dist', 'eco-headless');

async function collectRelativeFiles(directory: string, prefix = ''): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const relative = path.join(prefix, entry.name);
    if (entry.isDirectory()) files.push(...await collectRelativeFiles(path.join(directory, entry.name), relative));
    else files.push(relative.replaceAll('\\', '/'));
  }
  return files.sort();
}

describe('built ECO headless runtime', () => {
  it('contains JavaScript entrypoints and no ECO-owned runtime executable', async () => {
    expect((await stat(path.join(distRoot, 'eco-mcp.cjs'))).isFile()).toBe(true);
    expect((await stat(path.join(distRoot, 'eco-config.cjs'))).isFile()).toBe(true);

    const files = await collectRelativeFiles(distRoot);
    const basenames = files.map((file) => path.posix.basename(file).toLowerCase());
    expect(basenames).not.toContain('eco-node.exe');
    expect(basenames).not.toContain('eco.exe');
    expect(basenames).not.toContain('lnwjud.exe');

    // Native/upstream capability helpers are allowed and remain distinct from
    // the JavaScript host.
    expect(files).toContain('runtime-tools/ripgrep/rg.exe');
    expect(files).toContain('runtime-tools/windows-capability-bridge.ps1');
  });

  it('records system Node as the host without private-node metadata', async () => {
    const metadata = JSON.parse(await readFile(path.join(distRoot, 'PACKAGE.json'), 'utf8')) as Record<string, unknown>;
    expect(metadata.entrypoint).toBe('eco-mcp.cjs');
    expect(metadata.configEntrypoint).toBe('eco-config.cjs');
    expect(metadata.node).toMatchObject({ host: 'system' });
    expect(metadata).not.toHaveProperty('privateNode');
    expect(metadata).not.toHaveProperty('privateNodeMajor');
    expect(metadata).not.toHaveProperty('privateNodeSha256');
  });
});
