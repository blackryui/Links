import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const repositoryRoot = path.resolve(import.meta.dirname, '..', '..', '..');

describe('ECO Codex delegation policy', () => {
  it('uses the upstream stored setting rather than an ECO-only MCP bootstrap override', async () => {
    const runtime = await readFile(path.join(repositoryRoot, 'apps', 'cli', 'src', 'runtime', 'stdio-mcp-runtime.ts'), 'utf8');
    const upstreamEntrypoint = await readFile(path.join(repositoryRoot, 'apps', 'cli', 'src', 'bin', 'mcp-stdio.ts'), 'utf8');
    const ecoEntrypoint = await readFile(path.join(repositoryRoot, 'apps', 'cli', 'src', 'bin', 'eco-mcp.ts'), 'utf8');
    const setup = await readFile(path.join(repositoryRoot, 'scripts', 'setup-eco-headless.ps1'), 'utf8');
    const runtimePackage = await readFile(path.join(repositoryRoot, 'scripts', 'lib', 'eco-runtime-package.ps1'), 'utf8');

    expect(runtime).toContain('settingsRepository.get(USER_SETTING_KEYS.codexToolsEnabled)');
    expect(upstreamEntrypoint).toContain('codexToolsEnabled: runtime.codexToolsEnabled');
    expect(setup).toContain('[switch]$EnableCodexTools');
    expect(setup).toContain("Invoke-EcoConfig @('set', 'codex-tools-enabled', 'true')");

    expect(ecoEntrypoint).not.toContain('--enable-codex-tools');
    expect(runtimePackage).not.toContain('--enable-codex-tools');
    expect(runtimePackage).not.toContain('--disable-codex-tools');
  });
});
