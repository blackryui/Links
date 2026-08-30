import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const cliRoot = path.resolve(import.meta.dirname, '..');

describe('ECO thin MCP entrypoint', () => {
  it('prepares packaged helpers and then delegates to the current upstream stdio runtime', async () => {
    const eco = await readFile(path.join(cliRoot, 'src', 'bin', 'eco-mcp.ts'), 'utf8');
    const upstream = await readFile(path.join(cliRoot, 'src', 'bin', 'mcp-stdio.ts'), 'utf8');

    expect(eco).toContain('preparePackagedRuntimeEnvironment');
    expect(eco).toContain("import('./mcp-stdio.js')");
    expect(eco).not.toContain('createStdioMcpRuntime');
    expect(eco).not.toContain('startMcpStdio');

    expect(upstream).toContain('createStdioMcpRuntime');
    expect(upstream).toContain('startMcpStdio');
    expect(upstream).toContain("'--strict-roots'");
    expect(upstream).toContain("'--allowed-root'");
    expect(upstream).toContain('STDIO_ALLOWED_ROOTS_SETTING_KEY');
    expect(upstream).toContain('STDIO_PERMISSION_PROFILE_SETTING_KEY');
    expect(upstream).toContain('codexToolsEnabled: runtime.codexToolsEnabled');

    for (const source of [eco, upstream]) {
      expect(source).not.toContain("from 'electron'");
      expect(source).not.toContain('apps/desktop');
    }
  });
});
