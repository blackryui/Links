import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = path.resolve(import.meta.dirname, '..', '..');

describe('ECO Headless release gate', () => {
  it('has no unresolved parity category and keeps Desktop out of the headless runtime path', async () => {
    const inventory = JSON.parse(await readFile(path.join(root, 'docs', 'eco-headless-parity.json'), 'utf8')) as {
      categories: Array<{ id: string; classification: string }>;
    };
    expect(inventory.categories.some((entry) => entry.classification === 'blocked')).toBe(false);

    const bootstrap = await readFile(path.join(root, 'apps', 'cli', 'src', 'runtime', 'headless-mcp-bootstrap.ts'), 'utf8');
    const start = await readFile(path.join(root, 'scripts', 'start-eco-tunnel.ps1'), 'utf8');
    const setup = await readFile(path.join(root, 'scripts', 'setup-eco-headless.ps1'), 'utf8');
    const docs = await readFile(path.join(root, 'docs', 'eco-headless.md'), 'utf8');

    for (const source of [bootstrap, start, setup]) {
      expect(source).not.toContain('apps/desktop');
      expect(source).not.toContain("from 'electron'");
      expect(source).not.toContain('lnwjud.exe');
    }

    expect(docs).toContain('ChatGPT Web -> OpenAI Secure MCP Tunnel -> tunnel-client -> eco-mcp stdio');
    expect(docs).toContain('Codex local');
    expect(docs).toContain('No `lnwjud.exe` or Electron process is required');
    expect(docs).toContain('Release parity additionally requires');
  });

  it('preserves one shared ToolRegistry and a self-contained Windows stdio package', async () => {
    const build = await readFile(path.join(root, 'scripts', 'build-eco-headless.mjs'), 'utf8');
    const entry = await readFile(path.join(root, 'apps', 'cli', 'src', 'bin', 'mcp-stdio.ts'), 'utf8');
    const bootstrap = await readFile(path.join(root, 'apps', 'cli', 'src', 'runtime', 'headless-mcp-bootstrap.ts'), 'utf8');

    expect(entry).toContain('runHeadlessMcp');
    expect(bootstrap).toContain('createStdioMcpRuntime');
    expect(bootstrap).toContain('effectiveCodexToolsEnabled');
    expect(build).toContain("'../cli/src/bin/mcp-stdio.ts'");
    expect(build).toContain("'eco-node.exe'");
    expect(build).toContain("'prepare-ripgrep.ps1'");
    expect(build).toContain("'windows-capability-bridge.ps1'");
    expect(build).not.toContain('eco-tool-registry');
  });
});
