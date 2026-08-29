import { execFile } from 'node:child_process';
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
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

async function writeJson(filePath: string, value: unknown): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

async function createValidFixture(): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), 'lnwjud-plugin-'));
  const manifest = {
    name: 'lnwjud',
    version: '4.13.0',
    description: 'fixture',
    author: { name: 'lnwjud project' },
    repository: 'https://github.com/blackryui/Links',
    license: 'MIT',
    skills: './skills/',
    interface: {
      displayName: 'lnwjud',
      capabilities: ['Interactive', 'Read', 'Write'],
      composerIcon: './assets/icon.png',
      logo: './assets/icon.png',
      logoDark: './assets/icon.png',
    },
  };

  await writeJson(path.join(root, 'package.json'), { name: 'lnwjud', version: '4.13.0' });
  await writeJson(path.join(root, '.codex-plugin', 'plugin.json'), manifest);
  await mkdir(path.join(root, 'assets'), { recursive: true });
  await writeFile(path.join(root, 'assets', 'icon.png'), 'fixture', 'utf8');

  for (const skill of requiredSkills) {
    const skillPath = path.join(root, 'skills', skill, 'SKILL.md');
    await mkdir(path.dirname(skillPath), { recursive: true });
    await writeFile(
      skillPath,
      `---\nname: ${skill}\ndescription: Fixture skill for validator testing.\n---\n\n# ${skill}\n`,
      'utf8',
    );
  }

  return root;
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

  it('rejects manifest version drift', async () => {
    const root = await createValidFixture();
    try {
      const manifestPath = path.join(root, '.codex-plugin', 'plugin.json');
      const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as Record<string, unknown>;
      manifest.version = '9.9.9';
      await writeJson(manifestPath, manifest);

      const result = await runValidator(root);
      expect(result.ok).toBe(false);
      expect(result.stderr).toContain('version');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('rejects placeholder app connector identifiers', async () => {
    const root = await createValidFixture();
    try {
      await writeJson(path.join(root, '.app.json'), {
        apps: { lnwjud: { id: 'connector_xxxxxxxxxxxxxxxxx' } },
      });

      const result = await runValidator(root);
      expect(result.ok).toBe(false);
      expect(result.stderr).toContain('placeholder');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('rejects secret-like credentials in plugin skill files', async () => {
    const root = await createValidFixture();
    try {
      const skillPath = path.join(root, 'skills', 'lnwjud-core', 'SKILL.md');
      await writeFile(
        skillPath,
        '---\nname: lnwjud-core\ndescription: fixture\n---\n\nNever commit sk-proj-abcdefghijklmnopqrstuvwxyz1234567890.\n',
        'utf8',
      );

      const result = await runValidator(root);
      expect(result.ok).toBe(false);
      expect(result.stderr).toContain('secret-like');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
