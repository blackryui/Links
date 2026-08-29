import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = path.resolve(import.meta.dirname, '..', '..');

describe('ECO Headless authoritative release gate', () => {
  it('defines one aggregate verify:eco command covering all headless parity gates', async () => {
    const pkg = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8')) as { scripts?: Record<string, string> };
    const verify = pkg.scripts?.['verify:eco'] ?? '';
    for (const command of [
      'lint',
      'typecheck',
      'test:plugin',
      'validate:plugin',
      'test:eco:parity',
      'validate:eco:parity',
      '--filter @lnwjud/cli test:eco',
      '--filter @lnwjud/mcp-server test',
      'build:eco',
      'test:eco:packaging',
      'test:eco:tunnel',
      'test:eco:integration',
      'docs:tools:check',
      'validate:eco:release',
      'test:eco:release-gate',
    ]) {
      expect(verify, `verify:eco missing ${command}`).toContain(command);
    }
    expect(pkg.scripts?.['validate:eco:release']).toContain('--release');
  });

  it('runs explicit ECO stages in deterministic order inside Windows release verification', async () => {
    const script = await readFile(path.join(root, 'scripts', 'verify-release.ps1'), 'utf8');
    const stages = [
      'lint',
      'typecheck',
      'test:plugin',
      'validate:plugin',
      'test:eco:parity',
      'validate:eco:parity',
      'test:eco:cli',
      'test:eco:mcp-server',
      'build:eco',
      'test:eco:packaging',
      'test:eco:tunnel',
      'test:eco:integration',
      'docs:tools:check',
      'validate:eco:release',
      'test:eco:release-gate',
    ];
    let previous = -1;
    for (const stage of stages) {
      const index = script.indexOf(`'${stage}'`);
      expect(index, `missing or out-of-order ECO release stage: ${stage}`).toBeGreaterThan(previous);
      previous = index;
    }
    expect(script).toContain("@('--filter', '@lnwjud/cli', 'test:eco')");
    expect(script).toContain("@('--filter', '@lnwjud/mcp-server', 'test')");
    expect(script).toContain("@('validate:eco:release')");
  });

  it('keeps the Windows CI authority and uploads the ECO distribution with existing release artifacts', async () => {
    const workflow = await readFile(path.join(root, '.github', 'workflows', 'ci.yml'), 'utf8');
    expect(workflow).toContain('Authoritative Release Verification (Windows)');
    expect(workflow).toContain("node-version: '24'");
    expect(workflow).toContain('scripts/verify-release.ps1');
    expect(workflow).toContain('dist/eco-headless/eco-mcp.cjs');
    expect(workflow).toContain('dist/eco-headless/eco-mcp.cmd');
    expect(workflow).toContain('dist/eco-headless/eco-node.exe');
    expect(workflow).toContain('dist/eco-headless/PACKAGE.json');
  });

  it('does not replace legacy upstream-compatible Desktop checks with ECO-only verification', async () => {
    const script = await readFile(path.join(root, 'scripts', 'verify-release.ps1'), 'utf8');
    for (const legacyStage of ['test:release', 'test:acceptance', 'test:e2e', 'test:packaging', 'test:release-gate', 'package:windows']) {
      expect(script).toContain(`'${legacyStage}'`);
    }
  });
});
