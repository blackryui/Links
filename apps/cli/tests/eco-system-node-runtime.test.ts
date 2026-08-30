import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { assertEcoNode24Version, resolveEcoNodeRuntime } from '../src/runtime/eco-system-node-runtime.js';

describe('ECO system Node runtime', () => {
  it('accepts the current explicit Node 24 executable without copying it', async () => {
    const runtime = await resolveEcoNodeRuntime(process.execPath);

    expect(path.resolve(runtime.nodePath)).toBe(path.resolve(process.execPath));
    expect(runtime.version).toMatch(/^v?24\./);
  });

  it('rejects Node versions outside major 24', () => {
    expect(() => assertEcoNode24Version('v23.11.0')).toThrow(/requires Node\.js 24\.x/i);
    expect(() => assertEcoNode24Version('v25.0.0')).toThrow(/requires Node\.js 24\.x/i);
  });

  it('resolves Node from PATH when no explicit executable is supplied', async () => {
    const runtime = await resolveEcoNodeRuntime(undefined, process.env);

    expect(runtime.nodePath.toLowerCase()).toMatch(/node(?:\.exe)?$/i);
    expect(runtime.version).toMatch(/^v?24\./);
  });

  it('fails closed when an explicit Node executable does not exist', async () => {
    const missing = path.join(process.cwd(), '.eco-test-missing-node', 'node.exe');
    await expect(resolveEcoNodeRuntime(missing)).rejects.toThrow(/Node.*not found|could not.*Node/i);
  });
});
