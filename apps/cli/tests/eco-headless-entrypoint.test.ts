import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const cliRoot = path.resolve(import.meta.dirname, '..');
const bootstrapPath = path.join(cliRoot, 'src', 'runtime', 'headless-mcp-bootstrap.ts');
const entrypointPath = path.join(cliRoot, 'src', 'bin', 'mcp-stdio.ts');
const runtimePath = path.join(cliRoot, 'src', 'runtime', 'stdio-mcp-runtime.ts');

const serviceFamilies = [
  'workspaceInfo',
  'workspaceQuery',
  'projectSnapshot',
  'project',
  'file',
  'checkpoint',
  'goals',
  'scheduledContinuations',
  'search',
  'workspaceIndex',
  'git',
  'process',
  'codex',
  'capabilities',
  'extensions',
] as const;

describe('ECO shared headless MCP entrypoint', () => {
  it('uses one shared stdio bootstrap and no desktop UI host dependency', async () => {
    const bootstrap = await readFile(bootstrapPath, 'utf8');
    const entrypoint = await readFile(entrypointPath, 'utf8');

    expect(bootstrap).toContain("from '@lnwjud/mcp-server'");
    expect(bootstrap).toContain('startMcpStdio');
    expect(bootstrap).toContain("from './stdio-mcp-runtime.js'");
    expect(bootstrap).toContain('createStdioMcpRuntime');
    expect(bootstrap).toContain('export async function runHeadlessMcp');
    expect(bootstrap).toContain('export interface HeadlessMcpHandle');

    for (const forbidden of ['apps/desktop', "from 'electron'", '@lnwjud/ipc-contracts', 'DesktopMcpLifecycle']) {
      expect(bootstrap).not.toContain(forbidden);
    }

    expect(entrypoint).toContain("from '../runtime/headless-mcp-bootstrap.js'");
    expect(entrypoint).toContain('runHeadlessMcp(process.argv, process.env)');
    expect(entrypoint).not.toContain('createStdioMcpRuntime');
    expect(entrypoint).not.toContain('startMcpStdio');
  });

  it('keeps all runtime service families in the shared CLI runtime', async () => {
    const runtime = await readFile(runtimePath, 'utf8');
    for (const family of serviceFamilies) {
      expect(runtime).toMatch(new RegExp(`\\b${family}\\b\\s*(?::|,)`));
    }
  });

  it('maps all explicitly strict allowed roots into the active workspace set while preserving one primary workspace', async () => {
    const runtime = await readFile(runtimePath, 'utf8');
    const bootstrap = await readFile(bootstrapPath, 'utf8');

    expect(runtime).toContain('activeWorkspaceScopesProvider');
    expect(runtime).toContain('strictAllowedRoots');
    expect(runtime).toContain('workspaceRepository.list()');
    expect(bootstrap).toContain('activeWorkspaceScopesProvider: runtime.activeWorkspaceScopesProvider');
    expect(bootstrap).toContain('activeWorkspaceScopeProvider: runtime.activeWorkspaceScopeProvider');
  });

  it('keeps destructive host approval fail-closed unless the launcher explicitly trusts the client host', async () => {
    const bootstrap = await readFile(bootstrapPath, 'utf8');
    expect(bootstrap).toContain("hasFlag(argv, '--trusted-host-approval')");
    expect(bootstrap).toContain('hostMutationApprovalProvider');
    expect(bootstrap).toContain('trustedHostApproval ? async (): Promise<boolean> => true : undefined');
  });
});
