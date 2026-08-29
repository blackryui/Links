import { createHash } from 'node:crypto';
import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const repositoryRoot = path.resolve(import.meta.dirname, '..', '..');
const distRoot = path.join(repositoryRoot, 'dist', 'eco-headless');

async function exists(filePath: string): Promise<boolean> {
  try { await access(filePath); return true; } catch { return false; }
}

async function sha256(filePath: string): Promise<string> {
  return createHash('sha256').update(await readFile(filePath)).digest('hex');
}

describe('ECO headless distribution', () => {
  it('uses the Windows command processor for the Corepack .cmd build boundary', async () => {
    const build = await readFile(path.join(repositoryRoot, 'scripts', 'build-eco-headless.mjs'), 'utf8');
    expect(build).toContain('process.env.ComSpec');
    expect(build).toContain("'/d', '/s', '/c'");
    expect(build).not.toContain("const corepack = process.platform === 'win32' ? 'corepack.cmd' : 'corepack'");
  });

  it('packages one self-contained Windows stdio MCP runtime without Desktop/Electron runtime dependencies', async () => {
    if (process.platform !== 'win32') return;

    const cjsPath = path.join(distRoot, 'eco-mcp.cjs');
    const cmdPath = path.join(distRoot, 'eco-mcp.cmd');
    const metadataPath = path.join(distRoot, 'PACKAGE.json');
    const nodePath = path.join(distRoot, 'eco-node.exe');
    const rgPath = path.join(distRoot, 'runtime-tools', 'ripgrep', 'rg.exe');
    const bridgePath = path.join(distRoot, 'windows-capability-bridge.ps1');

    for (const required of [cjsPath, cmdPath, metadataPath, nodePath, rgPath, bridgePath]) {
      expect(await exists(required), required).toBe(true);
    }

    const bundle = await readFile(cjsPath, 'utf8');
    const cmd = await readFile(cmdPath, 'utf8');
    const metadata = JSON.parse(await readFile(metadataPath, 'utf8')) as Record<string, unknown>;
    const generatedIntegrity = await readFile(
      path.join(repositoryRoot, 'packages', 'capabilities', 'src', 'windows-capability-integrity.generated.ts'),
      'utf8',
    );
    const expectedBridgeSha = generatedIntegrity.match(/WINDOWS_CAPABILITY_BRIDGE_SHA256 = '([0-9a-f]{64})'/)?.[1];

    expect(bundle).not.toContain("require('electron')");
    expect(bundle).not.toContain('apps/desktop');
    expect(cmd).toContain('eco-mcp.cjs');
    expect(cmd).toContain('eco-node.exe');
    expect(cmd).toContain('runtime-tools\\ripgrep');
    expect(cmd).toContain('set "PATH=%RIPGREP_DIR%;%PATH%"');
    expect(cmd).toContain('%*');

    expect(metadata.name).toBe('ECO Headless MCP');
    expect(metadata.version).toBe('4.13.0');
    expect(metadata.entrypoint).toBe('eco-mcp.cjs');
    expect(metadata.privateNode).toBe('eco-node.exe');
    expect(metadata.privateNodeMajor).toBe(24);
    expect(metadata.privateNodeSha256).toBe(await sha256(nodePath));
    expect(metadata.ripgrep).toBe('runtime-tools/ripgrep/rg.exe');
    expect(metadata.ripgrepSha256).toBe(await sha256(rgPath));
    expect(metadata.parityInventory).toBe('docs/eco-headless-parity.json');
    expect(metadata.windowsCapabilityBridge).toBe('windows-capability-bridge.ps1');
    expect(metadata.windowsCapabilityBridgeSha256).toBe(expectedBridgeSha);
    expect(await sha256(bridgePath)).toBe(expectedBridgeSha);

    if (metadata.windowsOcrIncluded === true) {
      expect(metadata.windowsOcrPath).toBe('native/windows-ocr/lnwjud-windows-ocr.exe');
      expect(await exists(path.join(distRoot, 'native', 'windows-ocr', 'lnwjud-windows-ocr.exe'))).toBe(true);
    } else {
      expect(metadata.windowsOcrPath).toBeNull();
    }
  });
});
