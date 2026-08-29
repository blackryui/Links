import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const cliRoot = path.resolve(import.meta.dirname, '..');

describe('shared ECO headless MCP bootstrap', () => {
  it('uses the existing stdio runtime without Desktop or Electron dependencies', async () => {
    const bootstrapPath = path.join(cliRoot, 'src', 'runtime', 'headless-mcp-bootstrap.ts');
    const bootstrap = await readFile(bootstrapPath, 'utf8');
    const entrypoint = await readFile(path.join(cliRoot, 'src', 'bin', 'mcp-stdio.ts'), 'utf8');

    expect(bootstrap).toContain('export async function runHeadlessMcp');
    expect(bootstrap).toContain('createStdioMcpRuntime');
    expect(bootstrap).toContain('startMcpStdio');
    expect(bootstrap).toContain("'--strict-roots'");
    expect(bootstrap).toContain("'--allowed-root'");
    expect(bootstrap).toContain('LNWJUD_ALLOWED_ROOTS');
    expect(bootstrap).toContain('LNWJUD_WORKSPACE');

    for (const forbidden of ['apps/desktop', "from 'electron'", '@lnwjud/ipc-contracts']) {
      expect(bootstrap).not.toContain(forbidden);
    }

    expect(entrypoint).toContain('runHeadlessMcp');
    expect(entrypoint).not.toContain('createStdioMcpRuntime');
    expect(entrypoint).not.toContain('startMcpStdio');
  });
});
