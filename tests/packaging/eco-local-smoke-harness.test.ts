import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = path.resolve(import.meta.dirname, '..', '..');

describe('ECO local built-package smoke harness', () => {
  it('uses the official MCP v2 client against the built eco-mcp.cjs entrypoint', async () => {
    const harness = await readFile(path.join(root, 'packages', 'mcp-server', 'scripts', 'eco-built-smoke.mjs'), 'utf8');
    const rootPackage = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8')) as { scripts?: Record<string, string> };

    expect(rootPackage.scripts?.['smoke:eco:local']).toContain('--filter @lnwjud/mcp-server');
    expect(rootPackage.scripts?.['smoke:eco:local']).toContain('eco-built-smoke.mjs');
    expect(harness).toContain("from '@modelcontextprotocol/client'");
    expect(harness).toContain("from '@modelcontextprotocol/client/stdio'");
    expect(harness).toContain("pin: '2026-07-28'");
    expect(harness).toContain("path.join(packageRoot, 'eco-mcp.cjs')");
    expect(harness).toContain("'--strict-roots'");
    expect(harness).toContain("'--allowed-root'");
    expect(harness).toContain("'--workspace'");
  });

  it('keeps the smoke read-only and verifies shared workspace state plus representative tools', async () => {
    const harness = await readFile(path.join(root, 'packages', 'mcp-server', 'scripts', 'eco-built-smoke.mjs'), 'utf8');

    for (const toolName of ['workspace_list', 'workspace_tree', 'git_status']) {
      expect(harness).toContain(`name: '${toolName}'`);
    }
    for (const requiredTool of ['read_file', 'git_status', 'dom_cdp', 'office', 'run_goal']) {
      expect(harness).toContain(`'${requiredTool}'`);
    }
    expect(harness).toContain("metadata.node?.host !== 'system'");
    expect(harness).toContain("['eco-node.exe', 'eco.exe', 'lnwjud.exe']");
    expect(harness).not.toContain("name: 'write_file'");
    expect(harness).not.toContain("name: 'git'");
  });
});
