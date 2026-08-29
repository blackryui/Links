import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const repositoryRoot = path.resolve(import.meta.dirname, '..', '..');

describe('ECO plugin branding', () => {
  it('exposes ECO as the ChatGPT-facing plugin identity', async () => {
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
    expect(String(manifest.description)).toContain('ECO');
    expect(String(manifest.interface?.shortDescription)).toContain('ECO');
    expect(String(manifest.interface?.longDescription)).toContain('ECO');

    const prompts = manifest.interface?.defaultPrompt;
    expect(Array.isArray(prompts)).toBe(true);
    if (Array.isArray(prompts)) {
      expect(prompts.length).toBeGreaterThan(0);
      expect(prompts.every((prompt) => typeof prompt === 'string' && prompt.includes('ECO'))).toBe(true);
    }
  });

  it('documents ECO as the ChatGPT connection name while preserving the lnwjud runtime', async () => {
    const doc = await readFile(path.join(repositoryRoot, 'docs', 'chatgpt-plugin.md'), 'utf8');
    expect(doc).toContain('# ECO ChatGPT Web Plugin Setup');
    expect(doc).toContain('connection name **ECO**');
    expect(doc).toContain('lnwjud Desktop');
    expect(doc).toContain('221');
    expect(doc).toContain('227');
  });
});
