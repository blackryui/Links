import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { promisify } from 'node:util';
import { describe, expect, it } from 'vitest';

const execFileAsync = promisify(execFile);
const root = path.resolve(import.meta.dirname, '..', '..');
const verifier = path.join(root, 'scripts', 'verify-eco-upstream.mjs');
const baseline = 'edbc739b6df599e8b824c7c2c75cda1cd9e6d493';

describe('ECO latest-upstream parity gate', () => {
  it('accepts an exact upstream main SHA and rejects drift without needing network in the test', async () => {
    const fixture = await mkdtemp(path.join(tmpdir(), 'eco-upstream-'));
    try {
      await mkdir(path.join(fixture, 'docs'), { recursive: true });
      await writeFile(path.join(fixture, 'docs', 'eco-headless-parity.json'), JSON.stringify({
        upstream: { repository: 'engasnm111/lnwjud', ref: 'main', commit: baseline, version: '4.13.0' },
      }), 'utf8');

      const pass = await execFileAsync(process.execPath, [verifier, '--root', fixture, '--remote-sha', baseline], { encoding: 'utf8' });
      expect(pass.stdout).toContain('ECO upstream parity is current');

      await expect(execFileAsync(process.execPath, [verifier, '--root', fixture, '--remote-sha', 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'], { encoding: 'utf8' }))
        .rejects.toMatchObject({ stderr: expect.stringContaining('advanced beyond the recorded parity baseline') });
    } finally {
      await rm(fixture, { recursive: true, force: true });
    }
  });
});
