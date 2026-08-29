import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const repositoryRoot = path.resolve(import.meta.dirname, '..', '..', '..');

describe('ECO headless Codex delegation option', () => {
  it('keeps upstream default behavior and exposes explicit headless enable/disable overrides', async () => {
    const bootstrap = await readFile(path.join(repositoryRoot, 'apps', 'cli', 'src', 'runtime', 'headless-mcp-bootstrap.ts'), 'utf8');
    const runtime = await readFile(path.join(repositoryRoot, 'apps', 'cli', 'src', 'runtime', 'stdio-mcp-runtime.ts'), 'utf8');
    const setup = await readFile(path.join(repositoryRoot, 'scripts', 'setup-eco-headless.ps1'), 'utf8');
    const common = await readFile(path.join(repositoryRoot, 'scripts', 'lib', 'eco-headless-common.ps1'), 'utf8');

    expect(runtime).toContain('readonly codexToolsEnabled?: boolean');
    expect(runtime).toContain('options.codexToolsEnabled ?? parseBooleanSetting');

    expect(bootstrap).toContain("--enable-codex-tools");
    expect(bootstrap).toContain("--disable-codex-tools");
    expect(bootstrap).toContain('cannot be used together');
    expect(bootstrap).toContain('codexToolsEnabled: codexToolsOverride');

    expect(setup).toContain('[switch]$EnableCodexTools');
    expect(setup).toContain('-EnableCodexTools:$EnableCodexTools');
    expect(common).toContain('[bool]$EnableCodexTools = $false');
    expect(common).toContain("'--enable-codex-tools'");
  });
});
