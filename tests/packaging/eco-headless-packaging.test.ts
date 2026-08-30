import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = path.resolve(import.meta.dirname, '..', '..');

describe('ECO headless packaging contract', () => {
  it('builds JavaScript entrypoints without creating or describing eco-node.exe', async () => {
    const build = await readFile(path.join(root, 'scripts', 'build-eco-headless.mjs'), 'utf8');

    expect(build).toContain('eco-mcp.cjs');
    expect(build).toContain('eco-config.cjs');
    expect(build).not.toContain('eco-node.exe');
    expect(build).not.toContain('privateNode');
    expect(build).not.toContain('privateNodeMajor');
    expect(build).not.toContain('privateNodeSha256');
    expect(build).not.toContain('copyFile(process.execPath');
  });

  it('resolves the Corepack command through the Windows .cmd shim when building ECO', async () => {
    const build = await readFile(path.join(root, 'scripts', 'build-eco-headless.mjs'), 'utf8');

    expect(build).toContain("process.platform === 'win32' ? 'corepack.cmd' : 'corepack'");
    expect(build).toContain("run(corepackCommand, ['pnpm@10.15.0', ...args], options)");
  });

  it('keeps upstream/native helper executables distinct from the ECO JavaScript host', async () => {
    const build = await readFile(path.join(root, 'scripts', 'build-eco-headless.mjs'), 'utf8');

    expect(build).toContain('ripgrep');
    expect(build).toContain('windows-capability-bridge.ps1');
  });
});
