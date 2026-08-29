import { Client, StdioClientTransport } from '../../packages/mcp-server/tests/eco-client-harness.js';
import { execFile } from 'node:child_process';
import { access, mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { afterEach, describe, expect, it } from 'vitest';

const execFileAsync = promisify(execFile);
const repositoryRoot = path.resolve(import.meta.dirname, '..', '..');
const bundlePath = path.join(repositoryRoot, 'dist', 'eco-headless', 'eco-mcp.cjs');
const temporaryRoots: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map(async (root) => {
    try { await rm(root, { recursive: true, force: true }); } catch { /* Windows cleanup can lag */ }
  }));
});

describe('ECO headless real MCP project flow', () => {
  it('uses the shared stdio runtime for strict-root project read/write/Git/state work', async () => {
    await access(bundlePath);
    const projectRoot = await createProjectFixture();
    const outsideRoot = await createOutsideFixture();
    const rawDataRoot = await mkdtemp(path.join(os.tmpdir(), 'eco-headless-state-'));
    temporaryRoots.push(rawDataRoot);
    const dataRoot = await realpath(rawDataRoot);

    const transport = new StdioClientTransport({
      command: process.execPath,
      args: [
        bundlePath,
        '--strict-roots',
        '--allowed-root', projectRoot,
        '--workspace', projectRoot,
        '--profile', 'full',
      ],
      env: { ...process.env, LNWJUD_DATA_PATH: dataRoot },
      stderr: 'pipe',
    });
    const client = new Client(
      { name: 'eco-headless-project-flow', version: '0.1.0' },
      { versionNegotiation: { mode: { pin: '2026-07-28' } } },
    );

    try {
      await client.connect(transport);
      const catalog = await client.listTools();
      const toolNames = catalog.tools.map((tool) => tool.name);
      for (const required of ['workspace_list', 'workspace_info', 'workspace_full_scan', 'project_snapshot', 'read_file', 'write_file', 'edit_file', 'git_status', 'list_checkpoints']) {
        expect(toolNames).toContain(required);
      }
      expect(toolNames.some((name) => name.startsWith('codex_'))).toBe(false);

      const listed = await callTool(client, 'workspace_list', {});
      const workspaceId = findWorkspaceId(listed, projectRoot);
      expect(workspaceId).toEqual(expect.any(String));

      const info = await callTool(client, 'workspace_info', { workspaceId });
      expect(containsWorkspaceRoot(info, projectRoot)).toBe(true);

      const read = await callTool(client, 'read_file', { workspaceId, path: 'src/app.ts' });
      expect(JSON.stringify(read)).toContain("value = 'before'");

      const write = await callTool(client, 'write_file', {
        workspaceId,
        path: 'src/created.ts',
        content: 'export const created = true;\n',
      });
      expect(JSON.stringify(write)).toContain('created.ts');

      const edit = await callTool(client, 'edit_file', {
        workspaceId,
        path: 'src/app.ts',
        oldText: "value = 'before'",
        newText: "value = 'after'",
        expectedOccurrences: 1,
      });
      expect(JSON.stringify(edit)).toContain('app.ts');
      expect(await readFile(path.join(projectRoot, 'src', 'app.ts'), 'utf8')).toContain("value = 'after'");

      const gitStatus = await callTool(client, 'git_status', { workspaceId });
      expect(JSON.stringify(gitStatus)).toContain('src/app.ts');
      expect(JSON.stringify(gitStatus)).toContain('src/created.ts');

      const checkpoints = await callTool(client, 'list_checkpoints', { workspaceId, limit: 20 });
      expect(JSON.stringify(checkpoints)).toContain('app.ts');

      const indexedScan = await callTool(client, 'workspace_full_scan', { workspaceId, includeIgnored: false, pageSize: 100 });
      expect(JSON.stringify(indexedScan)).toContain('src/app.ts');

      const snapshot = await callTool(client, 'project_snapshot', { workspaceId });
      expect(JSON.stringify(snapshot)).toContain('git');

      const outside = await callTool(client, 'read_file', { path: path.join(outsideRoot, 'outside.txt') });
      expect(hasStructuredError(outside)).toBe(true);

      await access(path.join(dataRoot, 'lnwjud.sqlite'));
      await access(path.join(dataRoot, 'mcp-activity.log'));
    } finally {
      await client.close();
    }
  }, 45_000);
});

async function callTool(client: Client, name: string, args: Record<string, unknown>): Promise<unknown> {
  return client.callTool({ name, arguments: args });
}

function findWorkspaceId(value: unknown, expectedRoot: string): string {
  const target = path.normalize(expectedRoot).toLowerCase();
  const seen = new Set<unknown>();
  const visit = (current: unknown): string | undefined => {
    if (current === null || typeof current !== 'object' || seen.has(current)) return undefined;
    seen.add(current);
    if (!Array.isArray(current)) {
      const record = current as Record<string, unknown>;
      if (typeof record.id === 'string' && typeof record.realRootPath === 'string' && path.normalize(record.realRootPath).toLowerCase() === target) {
        return record.id;
      }
      for (const child of Object.values(record)) {
        const found = visit(child);
        if (found) return found;
      }
      return undefined;
    }
    for (const child of current) {
      const found = visit(child);
      if (found) return found;
    }
    return undefined;
  };
  const found = visit(value);
  if (!found) throw new Error(`Could not find strict-root workspace for ${expectedRoot}`);
  return found;
}

function containsWorkspaceRoot(value: unknown, expectedRoot: string): boolean {
  const target = path.normalize(expectedRoot).toLowerCase();
  const seen = new Set<unknown>();
  const visit = (current: unknown): boolean => {
    if (current === null || typeof current !== 'object' || seen.has(current)) return false;
    seen.add(current);
    if (Array.isArray(current)) return current.some(visit);
    const record = current as Record<string, unknown>;
    for (const key of ['realRootPath', 'rootPath']) {
      const candidate = record[key];
      if (typeof candidate === 'string' && path.normalize(candidate).toLowerCase() === target) return true;
    }
    return Object.values(record).some(visit);
  };
  return visit(value);
}

function hasStructuredError(value: unknown): boolean {
  const text = JSON.stringify(value);
  return /error|denied|outside|boundary|allowed root/i.test(text);
}

async function createProjectFixture(): Promise<string> {
  const rawRoot = await mkdtemp(path.join(os.tmpdir(), 'eco-headless-project-'));
  temporaryRoots.push(rawRoot);
  const root = await realpath(rawRoot);
  await mkdir(path.join(root, 'src'));
  await writeFile(path.join(root, 'src', 'app.ts'), "export const value = 'before';\n", 'utf8');
  await writeFile(path.join(root, 'package.json'), JSON.stringify({ name: 'eco-headless-fixture', scripts: { test: 'node -e "process.exit(0)"' } }), 'utf8');
  await execFileAsync('git', ['init', '--quiet'], { cwd: root, windowsHide: true });
  await execFileAsync('git', ['config', 'user.email', 'eco-test@example.invalid'], { cwd: root, windowsHide: true });
  await execFileAsync('git', ['config', 'user.name', 'ECO integration'], { cwd: root, windowsHide: true });
  await execFileAsync('git', ['add', '--', 'package.json', 'src/app.ts'], { cwd: root, windowsHide: true });
  await execFileAsync('git', ['commit', '--quiet', '-m', 'fixture'], { cwd: root, windowsHide: true });
  return root;
}

async function createOutsideFixture(): Promise<string> {
  const rawRoot = await mkdtemp(path.join(os.tmpdir(), 'eco-outside-'));
  temporaryRoots.push(rawRoot);
  const root = await realpath(rawRoot);
  await writeFile(path.join(root, 'outside.txt'), 'must-not-read\n', 'utf8');
  return root;
}
