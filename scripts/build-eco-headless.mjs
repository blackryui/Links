import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { access, copyFile, cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const distRoot = path.join(root, 'dist', 'eco-headless');
const bridgeSource = path.join(root, 'packages', 'capabilities', 'src', 'windows-capability-bridge.ps1');
const ocrSource = path.join(root, 'native', 'windows-ocr', 'bin', 'lnwjud-windows-ocr.exe');
const ripgrepSource = path.join(root, 'apps', 'desktop', 'build', 'runtime-tools', 'ripgrep');

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

async function runPowerShell(scriptPath) {
  await execFileAsync('powershell.exe', [
    '-NoProfile',
    '-NonInteractive',
    '-ExecutionPolicy', 'Bypass',
    '-File', scriptPath,
  ], { cwd: root, windowsHide: true, maxBuffer: 16 * 1024 * 1024 });
}

async function runEsbuild() {
  const commandProcessor = process.env.ComSpec ?? process.env.COMSPEC ?? 'cmd.exe';
  const command = [
    'corepack pnpm@10.15.0 --filter @lnwjud/desktop exec esbuild',
    '../cli/src/bin/mcp-stdio.ts',
    '--bundle',
    '--platform=node',
    '--format=cjs',
    '--outfile=../../dist/eco-headless/eco-mcp.cjs',
  ].join(' ');
  await execFileAsync(commandProcessor, ['/d', '/s', '/c', command], {
    cwd: root,
    windowsHide: true,
    maxBuffer: 16 * 1024 * 1024,
  });
}

async function prepareWindowsRuntimeTools() {
  await runPowerShell(path.join(root, 'apps', 'desktop', 'scripts', 'prepare-ripgrep.ps1'));
  await runPowerShell(path.join(root, 'scripts', 'prepare-windows-ocr.ps1'));
}

async function build() {
  if (process.platform !== 'win32') {
    throw new Error(`ECO Headless distribution targets Windows x64; build on Windows, not ${process.platform}`);
  }
  const nodeMajor = Number.parseInt(process.versions.node.split('.')[0] ?? '', 10);
  if (nodeMajor !== 24) throw new Error(`ECO Headless requires the build runtime to be Node.js 24.x; got ${process.versions.node}`);

  const rootPackage = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
  await rm(distRoot, { recursive: true, force: true });
  await mkdir(distRoot, { recursive: true });

  // Reuse the exact esbuild dependency already owned by @lnwjud/desktop as a
  // build tool only. The generated runtime is the CLI stdio entrypoint and
  // contains no Electron/Desktop host import.
  await runEsbuild();

  // Match upstream packaged stdio behavior: carry a private Node 24 runtime
  // and verified ripgrep so ECO search/runtime do not depend on system PATH.
  const nodeTarget = path.join(distRoot, 'eco-node.exe');
  await copyFile(process.execPath, nodeTarget);
  await prepareWindowsRuntimeTools();
  if (!(await exists(path.join(ripgrepSource, 'rg.exe')))) {
    throw new Error(`Prepared ripgrep runtime is missing: ${path.join(ripgrepSource, 'rg.exe')}`);
  }
  const ripgrepTarget = path.join(distRoot, 'runtime-tools', 'ripgrep');
  await cp(ripgrepSource, ripgrepTarget, { recursive: true });

  await copyFile(bridgeSource, path.join(distRoot, 'windows-capability-bridge.ps1'));
  const bridgeSha256 = await sha256(path.join(distRoot, 'windows-capability-bridge.ps1'));

  let windowsOcrIncluded = false;
  if (await exists(ocrSource)) {
    const ocrTargetDir = path.join(distRoot, 'native', 'windows-ocr');
    await mkdir(ocrTargetDir, { recursive: true });
    await copyFile(ocrSource, path.join(ocrTargetDir, 'lnwjud-windows-ocr.exe'));
    windowsOcrIncluded = true;
  }

  const launcher = [
    '@echo off',
    'setlocal',
    'set "BASE=%~dp0"',
    'set "SCRIPT=%BASE%eco-mcp.cjs"',
    'set "NODE_EXE=%BASE%eco-node.exe"',
    'set "RIPGREP_DIR=%BASE%runtime-tools\\ripgrep"',
    'if not exist "%SCRIPT%" (',
    '  echo ECO MCP launcher missing: %SCRIPT% 1>&2',
    '  exit /b 1',
    ')',
    'if not exist "%NODE_EXE%" (',
    '  echo ECO private Node runtime missing: %NODE_EXE% 1>&2',
    '  exit /b 1',
    ')',
    'if not exist "%RIPGREP_DIR%\\rg.exe" (',
    '  echo ECO ripgrep runtime missing: %RIPGREP_DIR%\\rg.exe 1>&2',
    '  exit /b 1',
    ')',
    'set "PATH=%RIPGREP_DIR%;%PATH%"',
    '"%NODE_EXE%" "%SCRIPT%" %*',
    '',
  ].join('\r\n');
  await writeFile(path.join(distRoot, 'eco-mcp.cmd'), launcher, 'utf8');

  const rgPath = path.join(ripgrepTarget, 'rg.exe');
  const metadata = {
    name: 'ECO Headless MCP',
    version: rootPackage.version,
    sourceCommit: await sourceCommit(),
    entrypoint: 'eco-mcp.cjs',
    launcher: 'eco-mcp.cmd',
    privateNode: 'eco-node.exe',
    privateNodeMajor: nodeMajor,
    privateNodeSha256: await sha256(nodeTarget),
    ripgrep: 'runtime-tools/ripgrep/rg.exe',
    ripgrepSha256: await sha256(rgPath),
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
