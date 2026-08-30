import { execFileSync } from 'node:child_process';
import { cp, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..');
const distRoot = path.join(repoRoot, 'dist', 'eco-headless');
const desktopRoot = path.join(repoRoot, 'apps', 'desktop');
const desktopBuildRoot = path.join(desktopRoot, 'build');
const ripgrepSource = path.join(desktopBuildRoot, 'runtime-tools', 'ripgrep');
const ocrSource = path.join(repoRoot, 'native', 'windows-ocr', 'bin', 'lnwjud-windows-ocr.exe');
const windowsBridgeSource = path.join(repoRoot, 'packages', 'capabilities', 'src', 'windows-capability-bridge.ps1');

if (process.platform !== 'win32' || process.arch !== 'x64') {
  throw new Error(`ECO Headless packaging currently supports Windows x64 only; got ${process.platform}/${process.arch}`);
}

const nodeMajor = Number.parseInt(process.versions.node.split('.')[0] ?? '', 10);
if (nodeMajor !== 24) throw new Error(`ECO Headless build requires Node.js 24.x; got ${process.version}`);

function run(command, args, options = {}) {
  execFileSync(command, args, {
    cwd: repoRoot,
    stdio: 'inherit',
    windowsHide: true,
    ...options,
  });
}

function runPnpm(args, options = {}) {
  run('corepack', ['pnpm@10.15.0', ...args], options);
}

async function exists(filePath) {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

async function sha256(filePath) {
  return createHash('sha256').update(await readFile(filePath)).digest('hex');
}

async function buildCliWorkspaceDependencies() {
  for (const packageName of [
    '@lnwjud/domain',
    '@lnwjud/workspace',
    '@lnwjud/storage',
    '@lnwjud/audit',
    '@lnwjud/process',
    '@lnwjud/search',
    '@lnwjud/codex',
    '@lnwjud/capabilities',
    '@lnwjud/extensions',
    '@lnwjud/application',
    '@lnwjud/mcp-server',
    '@lnwjud/shared',
  ]) {
    runPnpm(['--filter', packageName, 'build']);
  }
}

async function prepareRuntimeHelpers() {
  run('powershell', [
    '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass',
    '-File', path.join(desktopRoot, 'scripts', 'prepare-ripgrep.ps1'),
  ]);
  if (!(await exists(path.join(ripgrepSource, 'rg.exe')))) {
    throw new Error('ripgrep preparation completed without producing runtime-tools/ripgrep/rg.exe');
  }

  run('powershell', [
    '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass',
    '-File', path.join(repoRoot, 'scripts', 'prepare-windows-ocr.ps1'),
  ]);
}

async function bundleEntrypoints() {
  const esbuildPath = path.join(desktopRoot, 'node_modules', 'esbuild', 'lib', 'main.js');
  const { build } = await import(pathToFileURL(esbuildPath).href);
  const common = {
    bundle: true,
    platform: 'node',
    target: 'node24',
    format: 'cjs',
    sourcemap: false,
    minify: false,
    packages: 'bundle',
  };

  await build({
    ...common,
    entryPoints: [path.join(repoRoot, 'apps', 'cli', 'src', 'bin', 'eco-mcp.ts')],
    outfile: path.join(distRoot, 'eco-mcp.cjs'),
  });
  await build({
    ...common,
    entryPoints: [path.join(repoRoot, 'apps', 'cli', 'src', 'bin', 'eco-config.ts')],
    outfile: path.join(distRoot, 'eco-config.cjs'),
  });
}

await rm(distRoot, { recursive: true, force: true });
await mkdir(distRoot, { recursive: true });
await buildCliWorkspaceDependencies();
await prepareRuntimeHelpers();
await bundleEntrypoints();

const runtimeTools = path.join(distRoot, 'runtime-tools');
await mkdir(runtimeTools, { recursive: true });
await cp(ripgrepSource, path.join(runtimeTools, 'ripgrep'), { recursive: true });
await cp(windowsBridgeSource, path.join(runtimeTools, 'windows-capability-bridge.ps1'));

let windowsOcrIncluded = false;
if (await exists(ocrSource)) {
  const ocrDir = path.join(runtimeTools, 'windows-ocr');
  await mkdir(ocrDir, { recursive: true });
  await cp(ocrSource, path.join(ocrDir, 'lnwjud-windows-ocr.exe'));
  windowsOcrIncluded = true;
}

const mcpLauncher = [
  '@echo off',
  'setlocal',
  'set "BASE=%~dp0"',
  'where node.exe >nul 2>nul || (echo ECO Headless requires system Node.js 24.x 1>&2 & exit /b 1)',
  'set "PATH=%BASE%runtime-tools\\ripgrep;%PATH%"',
  'node "%BASE%eco-mcp.cjs" %*',
  '',
].join('\r\n');
const configLauncher = [
  '@echo off',
  'setlocal',
  'set "BASE=%~dp0"',
  'where node.exe >nul 2>nul || (echo ECO Headless requires system Node.js 24.x 1>&2 & exit /b 1)',
  'node "%BASE%eco-config.cjs" %*',
  '',
].join('\r\n');
await writeFile(path.join(distRoot, 'eco-mcp.cmd'), mcpLauncher, 'utf8');
await writeFile(path.join(distRoot, 'eco-config.cmd'), configLauncher, 'utf8');

const rootPackage = JSON.parse(await readFile(path.join(repoRoot, 'package.json'), 'utf8'));
let sourceCommit = null;
try {
  sourceCommit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repoRoot, encoding: 'utf8', windowsHide: true }).trim();
} catch {
  // The package remains usable without source metadata in non-Git export environments.
}

const metadata = {
  name: 'ECO Headless',
  version: rootPackage.version,
  sourceCommit,
  upstreamRuntime: 'lnwjud',
  node: { range: rootPackage.engines?.node ?? '>=24.0.0 <25', host: 'system' },
  entrypoint: 'eco-mcp.cjs',
  launcher: 'eco-mcp.cmd',
  configEntrypoint: 'eco-config.cjs',
  configLauncher: 'eco-config.cmd',
  ripgrep: 'runtime-tools/ripgrep/rg.exe',
  ripgrepSha256: await sha256(path.join(runtimeTools, 'ripgrep', 'rg.exe')),
  windowsCapabilityBridge: 'runtime-tools/windows-capability-bridge.ps1',
  windowsCapabilityBridgeSha256: await sha256(path.join(runtimeTools, 'windows-capability-bridge.ps1')),
  windowsOcrIncluded,
  windowsOcrPath: windowsOcrIncluded ? 'runtime-tools/windows-ocr/lnwjud-windows-ocr.exe' : null,
};
await writeFile(path.join(distRoot, 'PACKAGE.json'), `${JSON.stringify(metadata, null, 2)}\n`, 'utf8');

process.stdout.write(`ECO Headless package built at ${distRoot}\n`);
