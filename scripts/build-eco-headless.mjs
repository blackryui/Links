import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { access, copyFile, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const distRoot = path.join(root, 'dist', 'eco-headless');
const corepack = process.platform === 'win32' ? 'corepack.cmd' : 'corepack';
const bridgeSource = path.join(root, 'packages', 'capabilities', 'src', 'windows-capability-bridge.ps1');
const ocrSource = path.join(root, 'native', 'windows-ocr', 'bin', 'lnwjud-windows-ocr.exe');

async function sourceCommit() {
  const { stdout } = await execFileAsync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' });
  return stdout.trim();
}

async function exists(filePath) {
  try { await access(filePath); return true; } catch { return false; }
}

async function sha256(filePath) {
  return createHash('sha256').update(await readFile(filePath)).digest('hex');
}

async function prepareOptionalWindowsOcr() {
  if (process.platform !== 'win32') return;
  await execFileAsync('powershell.exe', [
    '-NoProfile',
    '-NonInteractive',
    '-ExecutionPolicy', 'Bypass',
    '-File', path.join(root, 'scripts', 'prepare-windows-ocr.ps1'),
  ], { cwd: root, maxBuffer: 16 * 1024 * 1024 });
}

async function build() {
  const rootPackage = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
  await rm(distRoot, { recursive: true, force: true });
  await mkdir(distRoot, { recursive: true });

  // Reuse the exact esbuild dependency already owned by @lnwjud/desktop as a
  // build tool only. `pnpm --filter ... exec` runs from apps/desktop, so keep
  // entry/output paths relative to that workspace. The generated runtime is
  // the CLI stdio entrypoint and contains no Electron/Desktop host import.
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

  await copyFile(bridgeSource, path.join(distRoot, 'windows-capability-bridge.ps1'));
  const bridgeSha256 = await sha256(path.join(distRoot, 'windows-capability-bridge.ps1'));

  await prepareOptionalWindowsOcr();
  let windowsOcrIncluded = false;
  if (await exists(ocrSource)) {
    const ocrTargetDir = path.join(distRoot, 'native', 'windows-ocr');
    await mkdir(ocrTargetDir, { recursive: true });
    await copyFile(ocrSource, path.join(ocrTargetDir, 'lnwjud-windows-ocr.exe'));
    windowsOcrIncluded = true;
  }

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
    windowsCapabilityBridge: 'windows-capability-bridge.ps1',
    windowsCapabilityBridgeSha256: bridgeSha256,
    windowsOcrIncluded,
    windowsOcrPath: windowsOcrIncluded ? 'native/windows-ocr/lnwjud-windows-ocr.exe' : null,
  };
  await writeFile(path.join(distRoot, 'PACKAGE.json'), `${JSON.stringify(metadata, null, 2)}\n`, 'utf8');
  process.stdout.write(`Built ECO Headless MCP ${metadata.version} at ${distRoot}\n`);
}

build().catch((error) => {
  process.stderr.write(`ECO headless build failed: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
