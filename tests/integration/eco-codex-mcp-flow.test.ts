import { Client, StdioClientTransport } from '../../packages/mcp-server/tests/eco-client-harness.js';
import { access, mkdtemp, realpath, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { setEcoHeadlessConfigValue } from '../../apps/cli/src/runtime/headless-config.js';

const root = path.resolve(import.meta.dirname, '..', '..');
const bundlePath = path.join(root, 'dist', 'eco-headless', 'eco-mcp.cjs');
const temporaryRoots: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((entry) => rm(entry, { recursive: true, force: true })));
});

describe('ECO Codex MCP registration contract', () => {
  it('uses the same eco-mcp stdio entrypoint as the Secure MCP Tunnel', async () => {
    const codexDoc = await readText(path.join(root, 'docs', 'eco-codex.md'));
    const setup = await readText(path.join(root, 'scripts', 'setup-eco-headless.ps1'));
    const build = await readText(path.join(root, 'scripts', 'build-eco-headless.mjs'));

    expect(codexDoc).toContain('codex mcp add eco --');
    expect(codexDoc).toContain('eco-mcp.cmd');
    expect(codexDoc).toContain('--strict-roots');
    expect(codexDoc).toContain('--allowed-root');
    expect(codexDoc).toContain('codex mcp get eco --json');
    expect(codexDoc).not.toContain('codex-mcp-server');

    expect(setup).toContain('eco-mcp');
    expect(build).toContain('eco-mcp.cjs');
    expect(build).toContain('eco-mcp.cmd');
  });

  it('honors explicit and stored Codex delegation catalog precedence over stdio', async () => {
    await access(bundlePath);
    const projectRaw = await mkdtemp(path.join(os.tmpdir(), 'eco-codex-project-'));
    const dataRaw = await mkdtemp(path.join(os.tmpdir(), 'eco-codex-state-'));
    temporaryRoots.push(projectRaw, dataRaw);
    const projectRoot = await realpath(projectRaw);
    const dataPath = await realpath(dataRaw);

    const explicitlyEnabled = await listTools(projectRoot, dataPath, ['--enable-codex-tools']);
    expect(explicitlyEnabled).toContain('codex_status');
    expect(explicitlyEnabled).toContain('codex_run');

    setEcoHeadlessConfigValue(dataPath, 'codex-tools-enabled', 'true');
    const storedEnabled = await listTools(projectRoot, dataPath, []);
    expect(storedEnabled).toContain('codex_status');
    expect(storedEnabled).toContain('codex_run');

    const explicitlyDisabled = await listTools(projectRoot, dataPath, ['--disable-codex-tools']);
    expect(explicitlyDisabled.some((name) => name.startsWith('codex_'))).toBe(false);
  }, 45_000);
});

async function listTools(projectRoot: string, dataPath: string, extraArgs: readonly string[]): Promise<string[]> {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [
      bundlePath,
      '--strict-roots',
      '--allowed-root', projectRoot,
      '--workspace', projectRoot,
      ...extraArgs,
    ],
    env: { ...process.env, LNWJUD_DATA_PATH: dataPath },
    stderr: 'pipe',
  });
  const client = new Client(
    { name: 'eco-codex-catalog-test', version: '0.1.0' },
    { versionNegotiation: { mode: { pin: '2026-07-28' } } },
  );
  try {
    await client.connect(transport);
    const listed = await client.listTools();
    return listed.tools.map((tool) => tool.name);
  } finally {
    await client.close();
  }
}

async function readText(filePath: string): Promise<string> {
  const { readFile } = await import('node:fs/promises');
  return readFile(filePath, 'utf8');
}
