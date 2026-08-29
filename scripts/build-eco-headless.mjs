import { execFile } from 'node:child_process';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const distRoot = path.join(root, 'dist', 'eco-headless');
const corepack = process.platform === 'win32' ? 'corepack.cmd' : 'corepack';

async function sourceCommit() {
  const { stdout } = await execFileAsync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' });
  return stdout.trim();
}

async function build() {
  const rootPackage = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
  await rm(distRoot, { recursive: true, force: true });
  await mkdir(distRoot, { recursive: true });

  // Reuse the exact esbuild dependency already owned by @lnwjud/desktop as a
  // build tool only. `pnpm --filter ... exec` runs from apps/desktop, so keep
  // entry/output paths relative to that workspace. The resulting bundle is
  // the CLI stdio runtime and must contain no Electron/Desktop runtime import.
  await execFileAsync(corepack, [
    'pnpm@10.15.0',
    '--filter', '@lnwjud/desktop',
    'exec', 'esbuild',
    '../cli/src/bin/mcp-stdio.ts',
    '--bundle',
    '--platform=node',
    '--format=cjs',
    '--outfile=../../dist/eco-headless/eco-mcp.cjs',
  ], { cwd: root, maxBuffer: 16 * 1024 * 1024 });

  await writeFile(
    path.join(distRoot, 'eco-mcp.cmd'),
    '@echo off\r\nnode "%~dp0eco-mcp.cjs" %*\r\n',
    'utf8',
  );

  const metadata = {
    name: 'ECO Headless MCP',
    version: rootPackage.version,
    sourceCommit: await sourceCommit(),
    entrypoint: 'eco-mcp.cjs',
    launcher: 'eco-mcp.cmd',
    parityInventory: 'docs/eco-headless-parity.json',
    node: rootPackage.engines?.node ?? '>=24.0.0 <25',
  };
  await writeFile(path.join(distRoot, 'PACKAGE.json'), `${JSON.stringify(metadata, null, 2)}\n`, 'utf8');
  process.stdout.write(`Built ECO Headless MCP ${metadata.version} at ${distRoot}\n`);
}

build().catch((error) => {
  process.stderr.write(`ECO headless build failed: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
