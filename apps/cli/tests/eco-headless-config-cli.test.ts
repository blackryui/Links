import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const repositoryRoot = path.resolve(import.meta.dirname, '..', '..', '..');

describe('ECO headless config CLI', () => {
  it('provides show/get/set/reset over the allowlisted shared-state adapter', async () => {
    const cli = await readFile(path.join(repositoryRoot, 'apps', 'cli', 'src', 'bin', 'eco-config.ts'), 'utf8');
    const build = await readFile(path.join(repositoryRoot, 'scripts', 'build-eco-headless.mjs'), 'utf8');
    const docs = await readFile(path.join(repositoryRoot, 'docs', 'eco-headless.md'), 'utf8');

    expect(cli).toContain('readEcoHeadlessConfig');
    expect(cli).toContain('setEcoHeadlessConfigValue');
    expect(cli).toContain('resetEcoHeadlessConfigValue');
    for (const command of ["'show'", "'get'", "'set'", "'reset'"]) expect(cli).toContain(command);
    expect(cli).toContain('resolveLnwjudDataPath');

    expect(build).toContain("'../cli/src/bin/eco-config.ts'");
    expect(build).toContain('eco-config.cjs');
    expect(build).toContain('eco-config.cmd');
    expect(docs).toContain('eco-config.cmd');
  });
});
