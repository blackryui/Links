import { execFile } from 'node:child_process';
import { access, mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import { afterEach, describe, expect, it } from 'vitest';

const execFileAsync = promisify(execFile);
const repositoryRoot = path.resolve(import.meta.dirname, '..', '..');
const distRoot = path.join(repositoryRoot, 'dist', 'eco-headless');
const temporaryRoots: string[] = [];

const windowsIt = process.platform === 'win32' ? it : it.skip;

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map(async (root) => {
    try { await rm(root, { recursive: true, force: true }); } catch { /* Windows may retain transient handles. */ }
  }));
});

describe('ECO headless MCP project flow', () => {
  windowsIt('uses the packaged stdio runtime for strict-root project read/write/Git/state behavior', async () => {
    const ecoNode = path.join(distRoot, 'eco-node.exe');
    const ecoBundle = path.join(distRoot, 'eco-mcp.cjs');
    await access(ecoNode);
    await access(ecoBundle);

    const projectRoot = await createProjectFixture();
    const outsideRoot = await createTempRoot('eco-outside-');
    const dataRoot = await createTempRoot('eco-data-');
    await writeFile(path.join(outsideRoot, 'outside.txt'), 'outside boundary\n', 'utf8');

    const { Client, StdioClientTransport } = await loadMcpClient();
    const environment = stringEnvironment(process.env);
    environment.LNWJUD_DATA_PATH = dataRoot;

    const transport = new StdioClientTransport({
      command: ecoNode,
      args: [
        ecoBundle,
        '--strict-roots',
        '--allowed-root', projectRoot,
        '--workspace', projectRoot,
        '--profile', 'full',
      ],
      env: environment,
      stderr: 'pipe',
    });
    let diagnostics = '';
    transport.stderr?.on('data', (chunk: Buffer) => { diagnostics += chunk.toString('utf8'); });
    const client = new Client(
      { name: 'eco-headless-integration', version: '0.1.0' },
      { versionNegotiation: { mode: { pin: '2026-07-28' } } },
    );

    try {
      await client.connect(transport);
      const catalog = await client.listTools();
      const names = catalog.tools.map((tool: { name: string }) => tool.name);
      for (const required of ['workspace_list', 'workspace_info', 'read_file', 'edit_file', 'write_file', 'git_status', 'list_checkpoints', 'run_goal', 'list_goals']) {
        expect(names).toContain(required);
      }
      expect(names.some((name: string) => name.startsWith('codex_'))).toBe(false);

      const listed = await callTool(client, 'workspace_list', {});
      const workspaces = structuredArray(listed, 'value');
      const workspace = workspaces.find((entry) => samePath(String(entry.realRootPath ?? ''), projectRoot));
      expect(workspace).toBeDefined();
      const workspaceId = String(workspace?.id ?? '');
      expect(workspaceId.length).toBeGreaterThan(0);

      const info = await callTool(client, 'workspace_info', { workspaceId });
      expect(samePath(String(structured(info).realRootPath ?? ''), projectRoot)).toBe(true);

      const initial = await callTool(client, 'read_file', { workspaceId, path: 'src/app.ts' });
      expect(String(structured(initial).content)).toContain("value = 'before'");

      const edit = await callTool(client, 'edit_file', {
        workspaceId,
        path: 'src/app.ts',
        oldText: "value = 'before'",
        newText: "value = 'after'",
        expectedOccurrences: 1,
      });
      expect(edit.isError).not.toBe(true);

      const write = await callTool(client, 'write_file', {
        workspaceId,
        path: 'src/generated.ts',
        content: 'export const generated = true;\n',
      });
      expect(write.isError).not.toBe(true);

      const after = await callTool(client, 'read_file', { workspaceId, path: 'src/app.ts' });
      expect(String(structured(after).content)).toContain("value = 'after'");

      const gitStatus = await callTool(client, 'git_status', { workspaceId });
      expect(JSON.stringify(structured(gitStatus))).toContain('src/app.ts');
      expect(JSON.stringify(structured(gitStatus))).toContain('src/generated.ts');

      const checkpoints = await callTool(client, 'list_checkpoints', { workspaceId, limit: 20 });
      expect(structuredArray(checkpoints, 'value').length).toBeGreaterThan(0);

      const denied = await callTool(client, 'read_file', { path: path.join(outsideRoot, 'outside.txt') });
      expect(denied.isError).toBe(true);
      expect(structured(denied).error).toBeDefined();

      const goal = await callTool(client, 'run_goal', {
        workspaceId,
        goalKey: 'eco-headless-integration',
        objective: 'Prove durable goal state without Desktop',
        plan: { steps: [{ id: 'smoke', title: 'Run ECO headless smoke' }] },
      });
      expect(goal.isError).not.toBe(true);
      expect(typeof structured(goal).goalId).toBe('string');

      const goals = await callTool(client, 'list_goals', { workspaceId, limit: 10 });
      expect(JSON.stringify(structured(goals))).toContain('eco-headless-integration');
      expect(diagnostics).toContain('lnwjud MCP stdio ready');
    } finally {
      await client.close();
    }

    await access(path.join(dataRoot, 'lnwjud.sqlite'));
    await access(path.join(dataRoot, 'workspace-index'));
    expect(await readFile(path.join(projectRoot, 'src', 'app.ts'), 'utf8')).toContain("value = 'after'");
  }, 60_000);
});

async function callTool(client: any, name: string, args: Record<string, unknown>): Promise<any> {
  return client.callTool({ name, arguments: args });
}

function structured(result: any): Record<string, any> {
  const value = result?.structuredContent;
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error('MCP result did not contain structuredContent');
  return value as Record<string, any>;
}

function structuredArray(result: any, field: string): Record<string, any>[] {
  const value = structured(result)[field];
  if (!Array.isArray(value)) throw new Error(`MCP structured field ${field} was not an array`);
  return value.filter((entry) => typeof entry === 'object' && entry !== null) as Record<string, any>[];
}

async function loadMcpClient(): Promise<{ Client: any; StdioClientTransport: any }> {
  const resolver = createRequire(path.join(repositoryRoot, 'packages', 'mcp-server', 'package.json'));
  const clientPath = resolver.resolve('@modelcontextprotocol/client');
  const stdioPath = resolver.resolve('@modelcontextprotocol/client/stdio');
  const clientModule = await import(pathToFileURL(clientPath).href);
  const stdioModule = await import(pathToFileURL(stdioPath).href);
  return { Client: clientModule.Client, StdioClientTransport: stdioModule.StdioClientTransport };
}

function stringEnvironment(environment: NodeJS.ProcessEnv): Record<string, string> {
  return Object.fromEntries(Object.entries(environment).filter((entry): entry is [string, string] => typeof entry[1] === 'string'));
}

async function createProjectFixture(): Promise<string> {
  const root = await createTempRoot('eco-project-');
  await mkdir(path.join(root, 'src'));
  await writeFile(path.join(root, 'src', 'app.ts'), "export const value = 'before';\n", 'utf8');
  await writeFile(path.join(root, 'package.json'), JSON.stringify({ name: 'eco-headless-fixture', scripts: { test: 'node --version' } }, null, 2), 'utf8');
  await execFileAsync('git', ['init', '--quiet'], { cwd: root, windowsHide: true });
  await execFileAsync('git', ['config', 'user.email', 'eco-test@example.invalid'], { cwd: root, windowsHide: true });
  await execFileAsync('git', ['config', 'user.name', 'ECO Integration'], { cwd: root, windowsHide: true });
  await execFileAsync('git', ['add', '--', 'package.json', 'src/app.ts'], { cwd: root, windowsHide: true });
  await execFileAsync('git', ['commit', '--quiet', '-m', 'fixture'], { cwd: root, windowsHide: true });
  return root;
}

async function createTempRoot(prefix: string): Promise<string> {
  const raw = await mkdtemp(path.join(os.tmpdir(), prefix));
  temporaryRoots.push(raw);
  return realpath(raw);
}

function samePath(left: string, right: string): boolean {
  return path.resolve(left).toLowerCase() === path.resolve(right).toLowerCase();
}
