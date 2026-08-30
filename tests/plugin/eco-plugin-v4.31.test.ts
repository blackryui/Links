import { execFile } from 'node:child_process';
import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { promisify } from 'node:util';
import { describe, expect, it } from 'vitest';

const execFileAsync = promisify(execFile);
const root = path.resolve(import.meta.dirname, '..', '..');
const requiredUpstreamSkills = [
  'lnwjud-core',
  'lnwjud-development',
  'lnwjud-windows',
  'lnwjud-browser',
  'lnwjud-office',
  'lnwjud-long-session',
];

async function exists(filePath: string): Promise<boolean> {
  try { await access(filePath); return true; } catch { return false; }
}

describe('ECO ChatGPT/Codex plugin package', () => {
  it('keeps ECO identity and version synchronized with the v4.31+ runtime', async () => {
    const manifest = JSON.parse(await readFile(path.join(root, '.codex-plugin', 'plugin.json'), 'utf8')) as Record<string, any>;
    const rootPackage = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8')) as Record<string, any>;

    expect(manifest.name).toBe('eco');
    expect(manifest.version).toBe(rootPackage.version);
    expect(manifest.interface?.displayName).toBe('ECO');
    expect(manifest.description).toMatch(/headless MCP/i);
    expect(manifest.interface?.longDescription).toMatch(/headless stdio MCP/i);
    expect(manifest.skills).toBe('./skills/');
    expect(manifest.interface?.capabilities).toEqual(expect.arrayContaining(['Interactive', 'Read', 'Write']));

    for (const field of ['composerIcon', 'logo', 'logoDark']) {
      const relative = String(manifest.interface?.[field] ?? '').replace(/^\.\//, '');
      expect(await exists(path.join(root, relative)), `${field} target is missing`).toBe(true);
    }
  });

  it('retains upstream routing skills but does not add user/domain skills to MCP core', async () => {
    for (const skill of requiredUpstreamSkills) {
      expect(await exists(path.join(root, 'skills', skill, 'SKILL.md')), `missing upstream skill ${skill}`).toBe(true);
    }
    const spec = await readFile(path.join(root, 'docs', 'superpowers', 'specs', '2026-08-30-eco-headless-latest-upstream-no-custom-exe-design.md'), 'utf8');
    expect(spec).toContain('Skills are a separate workflow layer');
  });

  it('documents system Node + Secure MCP Tunnel and rejects stale private-node architecture', async () => {
    const docs = await Promise.all([
      'docs/chatgpt-plugin.md',
      'docs/eco-headless.md',
      'docs/eco-codex.md',
    ].map((relative) => readFile(path.join(root, relative), 'utf8')));
    const combined = docs.join('\n');

    expect(combined).toContain('Secure MCP Tunnel');
    expect(combined).toContain('system Node 24');
    expect(combined).toContain('eco-mcp.cjs');
    expect(combined).toContain('--strict-roots');
    expect(combined).toContain('Codex Desktop');
    expect(combined).not.toContain('eco-node.exe');
    expect(combined).not.toContain('lnwjud v4.13');
    expect(combined).not.toMatch(/\b221\b|\b227\b/);
  });

  it('passes the static ECO plugin validator', async () => {
    const validator = path.join(root, 'scripts', 'validate-chatgpt-plugin.mjs');
    const { stdout } = await execFileAsync(process.execPath, [validator, '--root', root], {
      cwd: root,
      encoding: 'utf8',
      maxBuffer: 1024 * 1024,
    });
    expect(stdout).toContain('ChatGPT plugin package validation passed.');
  });
});
