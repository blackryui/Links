import { access, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { clearTimeout, setTimeout } from 'node:timers';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDir, '..', '..', '..');
const packageRoot = path.join(repositoryRoot, 'dist', 'eco-headless');
const requestedRoot = readArg('--root');
const workspaceRoot = path.resolve(requestedRoot ?? repositoryRoot);
const forbiddenRuntimeExecutables = ['eco-node.exe', 'eco.exe', 'lnwjud.exe'];
const requiredAdvertisedTools = ['read_file', 'git_status', 'dom_cdp', 'office', 'run_goal'];
const timeoutMs = 30_000;

if (process.platform !== 'win32' || process.arch !== 'x64') {
  throw new Error(`ECO local smoke requires Windows x64; got ${process.platform}/${process.arch}`);
}
const nodeMajor = Number.parseInt(process.versions.node.split('.')[0] ?? '', 10);
if (nodeMajor !== 24) throw new Error(`ECO local smoke requires system Node.js 24.x; got ${process.version}`);

await requirePath(workspaceRoot, 'workspace root');
const metadataPath = path.join(packageRoot, 'PACKAGE.json');
const metadata = JSON.parse(await readFile(metadataPath, 'utf8'));
if (metadata.node?.host !== 'system') {
  throw new Error(`ECO package metadata must declare system Node hosting; got ${String(metadata.node?.host)}`);
}

const packagedFiles = await listFiles(packageRoot);
const forbiddenFound = packagedFiles.filter((filePath) => forbiddenRuntimeExecutables.includes(path.basename(filePath).toLowerCase()));
if (forbiddenFound.length > 0) {
  throw new Error(`ECO package contains forbidden runtime executable(s): ${forbiddenFound.join(', ')}`);
}

const mcpPath = path.join(packageRoot, 'eco-mcp.cjs');
await requirePath(mcpPath, 'built ECO MCP entrypoint');
await requirePath(path.join(packageRoot, 'runtime-tools', 'ripgrep', 'rg.exe'), 'packaged ripgrep helper');

const childEnvironment = Object.fromEntries(
  Object.entries(process.env).filter((entry) => typeof entry[1] === 'string'),
);
const transport = new StdioClientTransport({
  command: process.execPath,
  args: [
    mcpPath,
    '--strict-roots',
    '--allowed-root', workspaceRoot,
    '--workspace', workspaceRoot,
  ],
  env: childEnvironment,
  stderr: 'pipe',
});
let diagnostics = '';
transport.stderr?.on('data', (chunk) => {
  diagnostics += chunk.toString('utf8');
  if (diagnostics.length > 32_000) diagnostics = diagnostics.slice(-32_000);
});

const client = new Client(
  { name: 'eco-built-package-smoke', version: '1.0.0' },
  { versionNegotiation: { mode: { pin: '2026-07-28' } } },
);

try {
  await withTimeout(client.connect(transport), 'MCP connect');
  const protocolVersion = client.getNegotiatedProtocolVersion();
  if (protocolVersion !== '2026-07-28') {
    throw new Error(`ECO smoke negotiated unexpected MCP protocol: ${String(protocolVersion)}`);
  }

  const listed = await withTimeout(client.listTools(), 'tools/list');
  const toolNames = listed.tools.map((tool) => tool.name);
  const toolSet = new Set(toolNames);
  for (const requiredTool of requiredAdvertisedTools) {
    if (!toolSet.has(requiredTool)) throw new Error(`ECO tools/list is missing ${requiredTool}`);
  }

  const workspaceListResult = await withTimeout(
    client.callTool({ name: 'workspace_list', arguments: {} }),
    'workspace_list',
  );
  const workspaces = requireArrayToolValue(workspaceListResult, 'workspace_list');
  const workspace = workspaces.find((entry) => isWorkspaceAtRoot(entry, workspaceRoot));
  if (workspace === undefined || typeof workspace.id !== 'string') {
    throw new Error(`workspace_list did not return the selected root: ${workspaceRoot}`);
  }

  await requireSuccessfulToolCall(
    client.callTool({
      name: 'workspace_tree',
      arguments: { workspaceId: workspace.id, maxDepth: 1, maxEntries: 100 },
    }),
    'workspace_tree',
  );

  let gitStatus = 'skipped:not_git_repository';
  if (await exists(path.join(workspaceRoot, '.git'))) {
    await requireSuccessfulToolCall(
      client.callTool({ name: 'git_status', arguments: { workspaceId: workspace.id } }),
      'git_status',
    );
    gitStatus = 'passed';
  }

  process.stdout.write(`${JSON.stringify({
    ok: true,
    node: { executable: process.execPath, version: process.version, host: metadata.node.host },
    mcp: { protocolVersion, advertisedToolCount: toolNames.length },
    workspace: { id: workspace.id, root: workspaceRoot },
    readOnlyChecks: { workspaceList: 'passed', workspaceTree: 'passed', gitStatus },
    package: {
      version: metadata.version,
      sourceCommit: metadata.sourceCommit ?? null,
      forbiddenRuntimeExecutablesFound: forbiddenFound,
      ripgrep: metadata.ripgrep ?? null,
      windowsOcrIncluded: metadata.windowsOcrIncluded === true,
    },
    diagnosticsTail: compactDiagnostics(diagnostics),
  }, null, 2)}\n`);
} finally {
  await client.close().catch(() => undefined);
}

function readArg(flag) {
  const index = process.argv.indexOf(flag);
  if (index < 0) return undefined;
  const value = process.argv[index + 1];
  if (typeof value !== 'string' || value.trim().length === 0) throw new Error(`${flag} requires a path`);
  return value;
}

async function exists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function requirePath(filePath, label) {
  if (!(await exists(filePath))) throw new Error(`${label} is missing: ${filePath}`);
}

async function listFiles(root) {
  const output = [];
  const entries = await readdir(root, { withFileTypes: true });
  for (const entry of entries) {
    const absolute = path.join(root, entry.name);
    if (entry.isDirectory()) output.push(...await listFiles(absolute));
    else if (entry.isFile()) output.push(absolute);
  }
  return output;
}

function normalizePathForCompare(value) {
  return path.resolve(value).replace(/[\\/]+$/, '').toLowerCase();
}

function isWorkspaceAtRoot(value, root) {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const realRootPath = typeof value.realRootPath === 'string' ? value.realRootPath : undefined;
  const rootPath = typeof value.rootPath === 'string' ? value.rootPath : undefined;
  const expected = normalizePathForCompare(root);
  return [realRootPath, rootPath]
    .filter((candidate) => candidate !== undefined)
    .some((candidate) => normalizePathForCompare(candidate) === expected);
}

function toolFailureText(result) {
  return result.content
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join(' | ')
    .slice(0, 2_000);
}

async function requireSuccessfulToolCall(promise, label) {
  const result = await withTimeout(promise, label);
  if (result.isError === true) throw new Error(`${label} failed: ${toolFailureText(result)}`);
  return result;
}

function requireArrayToolValue(result, label) {
  if (result.isError === true) throw new Error(`${label} failed: ${toolFailureText(result)}`);
  const structured = result.structuredContent;
  if (typeof structured !== 'object' || structured === null || !Array.isArray(structured.value)) {
    throw new Error(`${label} did not return an array in structuredContent.value`);
  }
  return structured.value;
}

async function withTimeout(promise, label) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs} ms`)), timeoutMs);
      }),
    ]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

function compactDiagnostics(value) {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .slice(-8);
}
