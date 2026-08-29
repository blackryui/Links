import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = path.resolve(import.meta.dirname, '..', '..');
const skillNames = [
  'lnwjud-core',
  'lnwjud-development',
  'lnwjud-windows',
  'lnwjud-browser',
  'lnwjud-office',
  'lnwjud-long-session',
] as const;

describe('ECO Headless ChatGPT plugin surface', () => {
  it('describes the stdio headless architecture rather than Desktop hosting', async () => {
    const manifest = JSON.parse(await readFile(path.join(root, '.codex-plugin', 'plugin.json'), 'utf8')) as any;
    const doc = await readFile(path.join(root, 'docs', 'chatgpt-plugin.md'), 'utf8');

    expect(manifest.name).toBe('eco');
    expect(manifest.interface?.displayName).toBe('ECO');
    expect(String(manifest.description)).toContain('Headless');
    expect(String(manifest.interface?.longDescription)).toContain('Headless');

    for (const concept of ['ECO Headless', 'Secure MCP Tunnel', 'stdio', 'eco-mcp', 'setup-eco-headless.ps1', 'start-eco-tunnel.ps1', 'setup-eco-codex.ps1']) {
      expect(doc).toContain(concept);
    }
    expect(doc).not.toContain('Launch lnwjud Desktop');
    expect(doc).not.toContain('Settings -> OpenAI Secure MCP Tunnel');
    expect(doc).not.toContain('Desktop loopback HTTP MCP');
  });

  it('removes Desktop as an operational dependency from routing skill bodies', async () => {
    for (const skill of skillNames) {
      const content = await readFile(path.join(root, 'skills', skill, 'SKILL.md'), 'utf8');
      expect(content, skill).not.toContain('lnwjud Desktop');
      expect(content, skill).not.toContain('Desktop permission');
      expect(content, skill).not.toContain('native exact-action approval');
    }
  });
});
