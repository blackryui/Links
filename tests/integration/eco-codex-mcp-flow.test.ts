import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = path.resolve(import.meta.dirname, '..', '..');

describe('ECO Codex MCP registration contract', () => {
  it('uses the same eco-mcp stdio entrypoint as the Secure MCP Tunnel', async () => {
    const codexDoc = await readFile(path.join(root, 'docs', 'eco-codex.md'), 'utf8');
    const setup = await readFile(path.join(root, 'scripts', 'setup-eco-headless.ps1'), 'utf8');
    const build = await readFile(path.join(root, 'scripts', 'build-eco-headless.mjs'), 'utf8');

    expect(codexDoc).toContain('codex mcp add eco --');
    expect(codexDoc).toContain('eco-mcp.cmd');
    expect(codexDoc).toContain('--strict-roots');
    expect(codexDoc).toContain('--allowed-root');
    expect(codexDoc).toContain('codex mcp get eco --json');
    expect(codexDoc).not.toContain('codex-mcp-server');

    expect(setup).toContain('eco-mcp');
    expect(build).toContain('eco-mcp.cjs');
    expect(build).toContain('eco-mcp.cmd');
  });
});
