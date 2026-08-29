import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const repositoryRoot = path.resolve(import.meta.dirname, '..', '..');
const distRoot = path.join(repositoryRoot, 'dist', 'eco-headless');

async function exists(filePath: string): Promise<boolean> {
  try { await access(filePath); return true; } catch { return false; }
}

describe('ECO headless distribution', () => {
  it('packages one stdio MCP runtime without Desktop/Electron runtime dependencies', async () => {
    const cjsPath = path.join(distRoot, 'eco-mcp.cjs');
    const cmdPath = path.join(distRoot, 'eco-mcp.cmd');
    const metadataPath = path.join(distRoot, 'PACKAGE.json');

    expect(await exists(cjsPath)).toBe(true);
    expect(await exists(cmdPath)).toBe(true);
    expect(await exists(metadataPath)).toBe(true);

    const bundle = await readFile(cjsPath, 'utf8');
    const cmd = await readFile(cmdPath, 'utf8');
    const metadata = JSON.parse(await readFile(metadataPath, 'utf8')) as Record<string, unknown>;

    expect(bundle).not.toContain("require('electron')");
    expect(bundle).not.toContain('apps/desktop');
    expect(cmd).toContain('eco-mcp.cjs');
    expect(cmd).toContain('%*');
    expect(metadata.name).toBe('ECO Headless MCP');
    expect(metadata.version).toBe('4.13.0');
    expect(metadata.entrypoint).toBe('eco-mcp.cjs');
    expect(metadata.parityInventory).toBe('docs/eco-headless-parity.json');
  });
});
