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

async function exists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function writeJson(filePath: string, value: unknown): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

async function runValidator(root: string): Promise<{ ok: boolean; stdout: string; stderr: string }> {
  const validator = path.join(repositoryRoot, 'scripts', 'validate-chatgpt-plugin.mjs');
  try {
    const { stdout, stderr } = await execFileAsync(process.execPath, [validator, '--root', root], {
      cwd: repositoryRoot,
      encoding: 'utf8',
      maxBuffer: 1024 * 1024,
    });
    return { ok: true, stdout, stderr };
  } catch (error) {
    const failure = error as { stdout?: string; stderr?: string; message?: string };
    return { ok: false, stdout: failure.stdout ?? '', stderr: failure.stderr ?? failure.message ?? '' };
  }
}

async function createValidFixture(): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), 'eco-plugin-'));
  await writeJson(path.join(root, 'package.json'), { name: 'lnwjud', version: '4.13.0' });
  await writeJson(path.join(root, '.codex-plugin', 'plugin.json'), {
    name: 'eco',
    version: '4.13.0',
    description: 'ECO fixture',
    author: { name: 'lnwjud project' },
    repository: 'https://github.com/blackryui/Links',
    license: 'MIT',
    skills: './skills/',
    interface: {
      displayName: 'ECO',
      shortDescription: 'ECO fixture',
      longDescription: 'ECO fixture over lnwjud runtime',
      developerName: 'ECO',
      category: 'Developer Tools',
      capabilities: ['Interactive', 'Read', 'Write'],
      websiteURL: 'https://github.com/blackryui/Links',
      privacyPolicyURL: 'https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement',
      termsOfServiceURL: 'https://docs.github.com/en/site-policy/github-terms/github-terms-of-service',
      defaultPrompt: ['Use ECO for this fixture.'],
      composerIcon: './assets/icon.png',
      logo: './assets/icon.png',
      logoDark: './assets/icon.png',
    },
  });
  await mkdir(path.join(root, 'assets'), { recursive: true });
  await writeFile(path.join(root, 'assets', 'icon.png'), 'fixture', 'utf8');
  for (const skill of requiredSkills) {
    const skillPath = path.join(root, 'skills', skill, 'SKILL.md');
    await mkdir(path.dirname(skillPath), { recursive: true });
    await writeFile(skillPath, `---\nname: ${skill}\ndescription: Use when testing ECO routing.\n---\n\n# ${skill}\n`, 'utf8');
  }
  return root;
}

describe('ChatGPT plugin package', () => {
  it('declares a version-synchronized ECO manifest', async () => {
    const manifest = JSON.parse(
      await readFile(path.join(repositoryRoot, '.codex-plugin', 'plugin.json'), 'utf8'),
    ) as { name?: unknown; version?: unknown; skills?: unknown; interface?: Record<string, unknown> };
    const rootPackage = JSON.parse(await readFile(path.join(repositoryRoot, 'package.json'), 'utf8')) as { version?: unknown };

    expect(manifest.name).toBe('eco');
    expect(manifest.version).toBe(rootPackage.version);
    expect(manifest.skills).toBe('./skills/');
    expect(manifest.interface?.displayName).toBe('ECO');
    expect(manifest.interface?.capabilities).toEqual(expect.arrayContaining(['Interactive', 'Read', 'Write']));

    for (const urlField of ['websiteURL', 'privacyPolicyURL', 'termsOfServiceURL']) {
      expect(String(manifest.interface?.[urlField]).startsWith('https://')).toBe(true);
    }
    const prompts = manifest.interface?.defaultPrompt;
    expect(Array.isArray(prompts)).toBe(true);
    if (Array.isArray(prompts)) {
      expect(prompts.length).toBeLessThanOrEqual(3);
      expect(prompts.every((prompt) => typeof prompt === 'string' && prompt.includes('ECO') && prompt.length <= 128)).toBe(true);
    }
    for (const iconField of ['composerIcon', 'logo', 'logoDark']) {
      const iconPath = String(manifest.interface?.[iconField] ?? '').replace(/^\.\//, '');
      expect(await exists(path.join(repositoryRoot, iconPath))).toBe(true);
    }
  });

  it('keeps the six internal lnwjud routing skills', async () => {
    for (const skill of requiredSkills) {
      expect(await exists(path.join(repositoryRoot, 'skills', skill, 'SKILL.md'))).toBe(true);
    }
  });

  it('does not commit a workspace-specific app binding before a verified connector exists', async () => {
    expect(await exists(path.join(repositoryRoot, '.app.json'))).toBe(false);
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

  it('rejects wrong ECO identity', async () => {
    const root = await createValidFixture();
    try {
      const manifestPath = path.join(root, '.codex-plugin', 'plugin.json');
      const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as { name?: string; interface?: Record<string, unknown> };
      manifest.name = 'lnwjud';
      if (manifest.interface) manifest.interface.displayName = 'lnwjud';
      await writeJson(manifestPath, manifest);
      const result = await runValidator(root);
      expect(result.ok).toBe(false);
      expect(result.stderr).toContain('eco');
      expect(result.stderr).toContain('ECO');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('rejects missing required interface metadata', async () => {
    const root = await createValidFixture();
    try {
      const manifestPath = path.join(root, '.codex-plugin', 'plugin.json');
      const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as { interface?: Record<string, unknown> };
      if (manifest.interface) delete manifest.interface.websiteURL;
      await writeJson(manifestPath, manifest);
      const result = await runValidator(root);
      expect(result.ok).toBe(false);
      expect(result.stderr).toContain('websiteURL');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('rejects placeholder app connector identifiers', async () => {
    const root = await createValidFixture();
    try {
      await writeJson(path.join(root, '.app.json'), { apps: { eco: { id: 'connector_xxxxxxxxxxxxxxxxx' } } });
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
      await writeFile(
        path.join(root, 'skills', 'lnwjud-core', 'SKILL.md'),
        '---\nname: lnwjud-core\ndescription: Use when testing.\n---\n\nNever commit sk-proj-abcdefghijklmnopqrstuvwxyz1234567890.\n',
        'utf8',
      );
      const result = await runValidator(root);
      expect(result.ok).toBe(false);
      expect(result.stderr).toContain('secret-like');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('keeps the plugin manifest in the repository version synchronizer', async () => {
    const versionScript = await readFile(path.join(repositoryRoot, 'scripts', 'set-version.mjs'), 'utf8');
    expect(versionScript).toContain("'.codex-plugin', 'plugin.json'");
    expect(versionScript).toContain('updatePackageJson(pluginManifestPath, version)');
  });

  it('documents ECO tunnel setup and app-binding lifecycle', async () => {
    const doc = await readFile(path.join(repositoryRoot, 'docs', 'chatgpt-plugin.md'), 'utf8');
    for (const concept of ['ECO', 'Secure MCP Tunnel', '221', '227', 'codex_*', '.app.json', 'Refresh connector']) {
      expect(doc).toContain(concept);
    }
  });
});
