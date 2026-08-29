import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const repositoryRoot = path.resolve(import.meta.dirname, '..', '..', '..');

describe('ECO headless Codex delegation option', () => {
  it('keeps upstream stored/default behavior and adds only a headless catalog override', async () => {
    const bootstrap = await readFile(path.join(repositoryRoot, 'apps', 'cli', 'src', 'runtime', 'headless-mcp-bootstrap.ts'), 'utf8');
    const runtime = await readFile(path.join(repositoryRoot, 'apps', 'cli', 'src', 'runtime', 'stdio-mcp-runtime.ts'), 'utf8');
    const setup = await readFile(path.join(repositoryRoot, 'scripts', 'setup-eco-headless.ps1'), 'utf8');
    const common = await readFile(path.join(repositoryRoot, 'scripts', 'lib', 'eco-headless-common.ps1'), 'utf8');

    // Shared lnwjud runtime continues to derive its normal value from the saved
    // upstream setting. ECO overlays only the MCP catalog exposure at bootstrap.
    expect(runtime).toContain('codexToolsEnabled: parseBooleanSetting(settingsRepository.get(USER_SETTING_KEYS.codexToolsEnabled), DEFAULT_CODEX_TOOLS_ENABLED)');

    expect(bootstrap).toContain("--enable-codex-tools");
    expect(bootstrap).toContain("--disable-codex-tools");
    expect(bootstrap).toContain('cannot be used together');
    expect(bootstrap).toContain('const effectiveCodexToolsEnabled = codexToolsOverride ?? runtime.codexToolsEnabled');
    expect(bootstrap).toContain('codexToolsEnabled: effectiveCodexToolsEnabled');

    expect(setup).toContain('[switch]$EnableCodexTools');
    expect(setup).toContain('-EnableCodexTools:$EnableCodexTools');
    expect(common).toContain('[bool]$EnableCodexTools = $false');
    expect(common).toContain("'--enable-codex-tools'");
  });
});
