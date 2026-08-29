import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { preparePackagedRuntimeEnvironment } from '../src/runtime/packaged-runtime-env.js';

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe('ECO packaged runtime environment', () => {
  it('prepends adjacent bundled ripgrep for direct private-Node stdio launches', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'eco-package-env-'));
    roots.push(root);
    const script = path.join(root, 'eco-mcp.cjs');
    const rgDir = path.join(root, 'runtime-tools', 'ripgrep');
    await mkdir(rgDir, { recursive: true });
    await writeFile(script, '', 'utf8');
    await writeFile(path.join(rgDir, process.platform === 'win32' ? 'rg.exe' : 'rg'), '', 'utf8');

    const env: NodeJS.ProcessEnv = { PATH: 'C:\\Existing' };
    const result = preparePackagedRuntimeEnvironment(['eco-node.exe', script], env, process.platform === 'win32' ? 'win32' : process.platform);

    expect(result.ripgrepDir).toBe(rgDir);
    expect(env.PATH?.split(path.delimiter)[0]).toBe(rgDir);
  });

  it('does nothing for a source-tree/dev entrypoint without adjacent runtime tools', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'eco-source-env-'));
    roots.push(root);
    const script = path.join(root, 'mcp-stdio.ts');
    await writeFile(script, '', 'utf8');
    const env: NodeJS.ProcessEnv = { PATH: 'existing' };

    const result = preparePackagedRuntimeEnvironment(['node', script], env, process.platform);
    expect(result.ripgrepDir).toBeNull();
    expect(env.PATH).toBe('existing');
  });
});
