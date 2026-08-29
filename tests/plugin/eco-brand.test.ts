import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const repositoryRoot = path.resolve(import.meta.dirname, '..', '..');

describe('ECO plugin branding and headless primary path', () => {
  it('exposes ECO as the ChatGPT-facing headless MCP identity', async () => {
    const manifest = JSON.parse(
      await readFile(path.join(repositoryRoot, '.codex-plugin', 'plugin.json'), 'utf8'),
    ) as {
      name?: unknown;
      description?: unknown;
      interface?: {
        displayName?: unknown;
        shortDescription?: unknown;
        longDescription?: unknown;
        defaultPrompt?: unknown;
      };
    };

    expect(manifest.name).toBe('eco');
    expect(manifest.interface?.displayName).toBe('ECO');
    expect(String(manifest.description)).toContain('headless MCP');
    expect(String(manifest.interface?.shortDescription)).toContain('ECO');
    expect(String(manifest.interface?.longDescription)).toContain('headless stdio MCP');
    expect(String(manifest.interface?.longDescription)).toContain('Desktop/Electron is not required');

    const prompts = manifest.interface?.defaultPrompt;
    expect(Array.isArray(prompts)).toBe(true);
    if (Array.isArray(prompts)) {
      expect(prompts.length).toBeGreaterThan(0);
      expect(prompts.every((prompt) => typeof prompt === 'string' && prompt.includes('ECO'))).toBe(true);
    }
  });

  it('documents ECO Headless as the primary ChatGPT and Codex path', async () => {
    const doc = await readFile(path.join(repositoryRoot, 'docs', 'chatgpt-plugin.md'), 'utf8');
    expect(doc).toContain('# ECO ChatGPT Web Plugin Setup');
    expect(doc).toContain('connection name **ECO**');
    expect(doc).toContain('eco-node.exe + eco-mcp.cjs');
    expect(doc).toContain('over stdio');
    expect(doc).toContain('Secure MCP Tunnel');
    expect(doc).toContain('--strict-roots');
    expect(doc).toContain('Codex local may use the convenience `eco-mcp.cmd`');
    expect(doc).toContain('lnwjud Desktop/Electron is not required');
    expect(doc).not.toContain('Launch lnwjud Desktop');
    expect(doc).not.toContain('Configure Tunnel in Desktop Settings');
  });
});
