import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = path.resolve(import.meta.dirname, '..', '..');

describe('ECO local Codex MCP registration', () => {
  it('registers ECO through the Codex MCP CLI and never edits config.toml directly', async () => {
    const setup = await readFile(path.join(root, 'scripts', 'setup-eco-codex.ps1'), 'utf8');
    expect(setup).toContain("mcp add $script:EcoProfileName --");
    expect(setup).toContain('eco-node.exe');
    expect(setup).toContain('eco-mcp.cjs');
    expect(setup).toContain('--strict-roots');
    expect(setup).toContain('--trusted-host-approval');
    expect(setup).toContain('--allowed-root');
    expect(setup).toContain('--workspace');
    expect(setup).toContain('mcp get $script:EcoProfileName --json');
    expect(setup).not.toContain('.codex/config.toml');
    expect(setup).not.toContain('.codex\\config.toml');
    expect(setup).not.toContain('Set-Content');
  });

  it('keeps Codex delegation tools opt-in inside the shared runtime', async () => {
    const runtime = await readFile(path.join(root, 'apps', 'cli', 'src', 'runtime', 'stdio-mcp-runtime.ts'), 'utf8');
    const bootstrap = await readFile(path.join(root, 'apps', 'cli', 'src', 'runtime', 'headless-mcp-bootstrap.ts'), 'utf8');
    expect(runtime).toContain('DEFAULT_CODEX_TOOLS_ENABLED');
    expect(runtime).toContain('codexToolsEnabled: parseBooleanSetting');
    expect(bootstrap).toContain('codexToolsEnabled: runtime.codexToolsEnabled');
    expect(bootstrap).toContain('hostMutationApprovalProvider');
  });
});
