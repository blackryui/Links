import { copyFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputRoot = path.join(repositoryRoot, 'dist', 'eco-headless');
const cliEntry = path.join(repositoryRoot, 'apps', 'cli', 'src', 'bin', 'mcp-stdio.ts');
const bundlePath = path.join(outputRoot, 'eco-mcp.cjs');
const launcherPath = path.join(outputRoot, 'eco-mcp.cmd');
const nodePath = path.join(outputRoot, 'eco-node.exe');
const capabilityBridgeSource = path.join(repositoryRoot, 'packages', 'capabilities', 'src', 'windows-capability-bridge.ps1');
const capabilityBridgeTarget = path.join(outputRoot, 'windows-capability-bridge.ps1');
const metadataPath = path.join(outputRoot, 'PACKAGE.json');
const rootPackage = JSON.parse(readFileSync(path.join(repositoryRoot, 'package.json'), 'utf8'));
const nodeMajor = Number.parseInt(process.versions.node.split('.')[0] ?? '', 10);

if (process.platform !== 'win32') {
  throw new Error(`ECO Headless Windows distribution must be built on Windows; got ${process.platform}`);
}
if (nodeMajor !== 24) {
  throw new Error(`ECO Headless distribution requires Node.js 24.x; got ${process.versions.node}`);
}

rmSync(outputRoot, { recursive: true, force: true });
mkdirSync(outputRoot, { recursive: true });

// Use a version-pinned standalone esbuild invocation instead of borrowing the
// Desktop workspace's devDependency. This keeps ECO source builds independent
// of Electron/Desktop package ownership while retaining a reproducible version.
const corepack = process.platform === 'win32' ? 'corepack.cmd' : 'corepack';
const build = spawnSync(corepack, [
  'pnpm@10.15.0',
  'dlx',
  'esbuild@0.25.12',
  cliEntry,
  '--bundle',
  '--platform=node',
  '--format=cjs',
  '--target=node24',
  `--outfile=${bundlePath}`,
], {
  cwd: repositoryRoot,
  stdio: 'inherit',
});
if (build.error) throw build.error;
if (build.status !== 0) throw new Error(`ECO headless esbuild failed with exit code ${String(build.status)}`);

copyFileSync(process.execPath, nodePath);
copyFileSync(capabilityBridgeSource, capabilityBridgeTarget);

const launcher = `@echo off\r\nsetlocal\r\nset "BASE=%~dp0"\r\nset "SCRIPT=%BASE%eco-mcp.cjs"\r\nset "NODE_EXE=%BASE%eco-node.exe"\r\nset "LNWJUD_CAPABILITY_BRIDGE_SCRIPT=%BASE%windows-capability-bridge.ps1"\r\nif not exist "%SCRIPT%" (\r\n  echo ECO headless MCP bundle missing: %SCRIPT% 1>&2\r\n  exit /b 1\r\n)\r\nif not exist "%NODE_EXE%" (\r\n  echo ECO private Node runtime missing: %NODE_EXE% 1>&2\r\n  exit /b 1\r\n)\r\nif not exist "%LNWJUD_CAPABILITY_BRIDGE_SCRIPT%" (\r\n  echo ECO Windows capability bridge missing: %LNWJUD_CAPABILITY_BRIDGE_SCRIPT% 1>&2\r\n  exit /b 1\r\n)\r\n"%NODE_EXE%" "%SCRIPT%" %*\r\n`;
writeFileSync(launcherPath, launcher, 'utf8');

const sourceCommit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repositoryRoot, encoding: 'utf8' }).trim();
if (!/^[a-f0-9]{40}$/i.test(sourceCommit)) throw new Error(`Could not resolve source commit: ${sourceCommit}`);

const metadata = {
  name: 'ECO Headless',
  version: rootPackage.version,
  platform: 'win32-x64',
  nodeMajor,
  sourceCommit,
  sourceEntry: 'apps/cli/src/bin/mcp-stdio.ts',
  parityInventory: 'docs/eco-headless-parity.json',
  transport: 'stdio',
  bundler: 'esbuild@0.25.12',
  artifacts: [
    'eco-mcp.cjs',
    'eco-mcp.cmd',
    'eco-node.exe',
    'windows-capability-bridge.ps1',
  ],
};
writeFileSync(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`, 'utf8');

process.stdout.write(`ECO Headless ${rootPackage.version} built at ${outputRoot}\n`);
