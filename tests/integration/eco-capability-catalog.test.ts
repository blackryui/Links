import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { ToolRegistry } from '@lnwjud/mcp-server';
import { describe, expect, it } from 'vitest';

const root = path.resolve(import.meta.dirname, '..', '..');

describe('ECO upstream-derived MCP catalog', () => {
  it('preserves ToolRegistry advertisement policy without hard-coded catalog counts', () => {
    const services = {} as ConstructorParameters<typeof ToolRegistry>[0];
    const actor = { clientId: 'eco-parity', clientName: 'eco-parity' } as ConstructorParameters<typeof ToolRegistry>[1];
    const defaultRegistry = new ToolRegistry(services, actor);
    const codexRegistry = new ToolRegistry(services, actor, { codexToolsEnabled: true });

    const all = codexRegistry.listAll();
    const advertisedDefault = defaultRegistry.list();
    const advertisedCodex = codexRegistry.list();
    const allNames = all.map((tool) => tool.name);
    const defaultNames = advertisedDefault.map((tool) => tool.name);
    const codexNames = advertisedCodex.map((tool) => tool.name);
    const allSet = new Set(allNames);
    const defaultSet = new Set(defaultNames);
    const codexSet = new Set(codexNames);

    expect(allSet.size).toBe(allNames.length);
    expect(defaultSet.size).toBe(defaultNames.length);
    expect(codexSet.size).toBe(codexNames.length);
    expect(advertisedDefault.length).toBeGreaterThan(0);
    expect(advertisedCodex.length).toBeGreaterThanOrEqual(advertisedDefault.length);
    expect(all.length).toBeGreaterThanOrEqual(advertisedCodex.length);

    for (const name of defaultNames) {
      expect(codexSet.has(name), `Codex-enabled catalog dropped default tool ${name}`).toBe(true);
      expect(allSet.has(name), `default tool ${name} missing from listAll()`).toBe(true);
    }
    for (const name of codexNames) expect(allSet.has(name), `advertised tool ${name} missing from listAll()`).toBe(true);

    const codexOnly = codexNames.filter((name) => !defaultSet.has(name));
    expect(codexOnly.length).toBeGreaterThan(0);
    expect(codexOnly.every((name) => name.startsWith('codex_'))).toBe(true);

    const representativeTools = [
      'read_file',
      'git_status',
      'dom_cdp',
      'wsl_exec',
      'office',
      'computer_use',
      'run_goal',
      'codex_task_status',
    ] as const;
    for (const name of representativeTools) {
      expect(allSet.has(name), `live ToolRegistry is missing representative tool ${name}`).toBe(true);
    }
  });

  it('keeps ECO as an adapter rather than a second tool registry', async () => {
    const ecoEntrypoint = await readFile(path.join(root, 'apps', 'cli', 'src', 'bin', 'eco-mcp.ts'), 'utf8');
    const generator = await readFile(path.join(root, 'scripts', 'generate-tool-catalog.mjs'), 'utf8');
    const parity = JSON.parse(await readFile(path.join(root, 'docs', 'eco-headless-parity.json'), 'utf8')) as Record<string, unknown>;

    expect(ecoEntrypoint).toContain("import('./mcp-stdio.js')");
    expect(ecoEntrypoint).not.toContain('ToolRegistry');
    expect(generator).toContain('new ToolRegistry');
    expect(generator).toContain('.listAll()');
    expect(generator).toContain('.list()');
    expect(JSON.stringify(parity)).not.toMatch(/"(?:toolCount|defaultToolCount|configuredToolCount|expectedToolCount|defaultAdvertisedCount|codexAdvertisedCount)"/i);
  });
});
