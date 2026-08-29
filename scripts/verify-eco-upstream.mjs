import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const execFileAsync = promisify(execFile);
const scriptRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function parseArgs(argv) {
  const rootIndex = argv.indexOf('--root');
  const remoteIndex = argv.indexOf('--remote-sha');
  const root = rootIndex === -1 ? scriptRoot : path.resolve(process.cwd(), argv[rootIndex + 1] ?? '');
  if (rootIndex !== -1 && !argv[rootIndex + 1]) throw new Error('--root requires a path');
  const remoteSha = remoteIndex === -1 ? undefined : argv[remoteIndex + 1];
  if (remoteIndex !== -1 && !remoteSha) throw new Error('--remote-sha requires a SHA');
  return { root, remoteSha };
}

function isSha(value) {
  return typeof value === 'string' && /^[a-f0-9]{40}$/i.test(value.trim());
}

async function resolveRemoteSha(repository, ref, override) {
  if (override !== undefined) {
    if (!isSha(override)) throw new Error('--remote-sha must be an exact 40-character Git SHA');
    return override.toLowerCase();
  }
  const url = `https://github.com/${repository}.git`;
  const { stdout } = await execFileAsync('git', ['ls-remote', url, `refs/heads/${ref}`], {
    encoding: 'utf8',
    maxBuffer: 1024 * 1024,
    timeout: 30_000,
    windowsHide: true,
  });
  const sha = stdout.trim().split(/\s+/)[0];
  if (!isSha(sha)) throw new Error(`Could not resolve ${repository} ${ref} from git ls-remote`);
  return sha.toLowerCase();
}

async function main() {
  const { root, remoteSha: override } = parseArgs(process.argv.slice(2));
  const inventoryPath = path.join(root, 'docs', 'eco-headless-parity.json');
  const inventory = JSON.parse(await readFile(inventoryPath, 'utf8'));
  const upstream = inventory?.upstream ?? {};
  if (upstream.repository !== 'engasnm111/lnwjud') throw new Error('ECO parity upstream repository must be engasnm111/lnwjud');
  if (upstream.ref !== 'main') throw new Error('ECO parity upstream ref must be main');
  if (!isSha(upstream.commit)) throw new Error('ECO parity upstream commit must be an exact 40-character Git SHA');

  const remoteSha = await resolveRemoteSha(upstream.repository, upstream.ref, override);
  const baselineSha = upstream.commit.toLowerCase();
  if (remoteSha !== baselineSha) {
    throw new Error(
      `engasnm111/lnwjud main advanced beyond the recorded parity baseline: recorded=${baselineSha} current=${remoteSha}. `
      + 'Audit upstream runtime changes, update ECO/shared code and parity evidence, then record the new baseline before release.',
    );
  }

  process.stdout.write(`ECO upstream parity is current: ${upstream.repository}@${remoteSha}\n`);
}

main().catch((error) => {
  process.stderr.write(`ECO upstream parity validation failed: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
