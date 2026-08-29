import { execFile } from 'node:child_process';
import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { promisify } from 'node:util';
import { describe, expect, it } from 'vitest';

const execFileAsync = promisify(execFile);
const repositoryRoot = path.resolve(import.meta.dirname, '..', '..');

const requiredSkills = [
  'lnwjud-core',
  'lnwjud-development',
  'lnwjud-windows',
  'lnwjud-browser',
  'lnwjud-office',
  'lnwjud-long-session',
] as const;

interface PluginManifest {
  name?: unknown;
  version?: unknown;
  skills?: unknown;
  interface?: {
    capabilities?: unknown;
    composerIcon?: unknown;
    logo?: unknown;
    logoDark?: unknown;
  };
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function runValidator(root: string): Promise<{ ok: boolean; stdout: string; stderr: string }> {
  const validatorPath = path.join(repositoryRoot, 'scripts', 'validate-chatgpt-plugin.mjs');
  try {
    const { stdout, stderr } = await execFileAsync(process.execPath, [validatorPath, '--root', root], {
      cwd: repositoryRoot,
      encoding: 'utf8',
      maxBuffer: 1024 * 1024,
    });
    return { ok: true, stdout, stderr };
  } catch (error) {
    const failure = error as { stdout?: string; stderr?: string; message?: string };
    return {
      ok: false,
      stdout: failure.stdout ?? '',
      stderr: failure.stderr ?? failure.message ?? '',
    };
  }
}

describe('ChatGPT plugin package', () => {
  it('declares a version-synchronized plugin manifest', async () => {
    const manifestPath = path.join(repositoryRoot, '.codex-plugin', 'plugin.json');
    expect(await fileExists(manifestPath)).toBe(true);

    const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as PluginManifest;
    const rootPackage = JSON.parse(await readFile(path.join(repositoryRoot, 'package.json'), 'utf8')) as {
      version?: unknown;
    };

    expect(manifest.name).toBe('lnwjud');
    expect(manifest.version).toBe(rootPackage.version);
    expect(manifest.skills).toBe('./skills/');
    expect(manifest.interface?.capabilities).toEqual(expect.arrayContaining(['Interactive', 'Read', 'Write']));

    for (const iconField of ['composerIcon', 'logo', 'logoDark'] as const) {
      const iconPath = manifest.interface?.[iconField];
      expect(typeof iconPath).toBe('string');
      expect(await fileExists(path.join(repositoryRoot, String(iconPath).replace(/^\.\//, '')))).toBe(true);
    }
  });

  it('ships exactly the six V1 routing skills', async () => {
    const skillsRoot = path.join(repositoryRoot, 'skills');
    const discovered: string[] = [];

    for (const skill of requiredSkills) {
      const skillPath = path.join(skillsRoot, skill, 'SKILL.md');
      if (await fileExists(skillPath)) discovered.push(skill);
    }

    expect(discovered).toEqual([...requiredSkills]);
  });

  it('does not commit a workspace-specific app binding before a verified connector exists', async () => {
    expect(await fileExists(path.join(repositoryRoot, '.app.json'))).toBe(false);
  });

  it('passes the static plugin validator', async () => {
    const result = await runValidator(repositoryRoot);
    expect(result.ok, result.stderr || result.stdout).toBe(true);
    expect(result.stdout).toContain('ChatGPT plugin package validation passed.');
  });
});
