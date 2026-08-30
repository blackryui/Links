import { execFile } from 'node:child_process';
import { access } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export interface EcoNodeRuntime {
  readonly nodePath: string;
  readonly version: string;
}

export function assertEcoNode24Version(version: string): void {
  const normalized = version.trim();
  const match = /^v?(\d+)\./.exec(normalized);
  const major = match === null ? Number.NaN : Number.parseInt(match[1] ?? '', 10);
  if (major !== 24) {
    throw new Error(`ECO Headless requires Node.js 24.x; got ${normalized.length > 0 ? normalized : 'unknown'}`);
  }
}

export async function resolveEcoNodeRuntime(
  explicitPath?: string,
  env: NodeJS.ProcessEnv = process.env,
): Promise<EcoNodeRuntime> {
  const requested = explicitPath?.trim();
  const nodePath = requested === undefined || requested.length === 0
    ? await resolveNodeFromPath(env)
    : await resolveExplicitNode(requested);

  try {
    const { stdout } = await execFileAsync(nodePath, ['--version'], {
      env,
      encoding: 'utf8',
      windowsHide: true,
      timeout: 10_000,
    });
    const version = stdout.trim();
    assertEcoNode24Version(version);
    return { nodePath, version };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    if (/requires Node\.js 24\.x/i.test(detail)) throw error;
    throw new Error(`ECO Headless could not execute Node runtime '${nodePath}': ${detail}`);
  }
}

async function resolveExplicitNode(value: string): Promise<string> {
  const candidate = path.resolve(value);
  try {
    await access(candidate);
    return candidate;
  } catch {
    throw new Error(`ECO Headless Node runtime not found: ${candidate}`);
  }
}

async function resolveNodeFromPath(env: NodeJS.ProcessEnv): Promise<string> {
  const locator = process.platform === 'win32' ? 'where.exe' : 'which';
  const executable = process.platform === 'win32' ? 'node.exe' : 'node';
  try {
    const { stdout } = await execFileAsync(locator, [executable], {
      env,
      encoding: 'utf8',
      windowsHide: true,
      timeout: 10_000,
    });
    const candidate = stdout
      .split(/\r?\n/)
      .map((entry) => entry.trim())
      .find((entry) => entry.length > 0);
    if (candidate !== undefined) return path.resolve(candidate);
  } catch {
    // Fall through to the fail-closed error below.
  }
  throw new Error('ECO Headless could not resolve Node.js 24.x from PATH. Install Node.js 24 or provide an explicit Node path.');
}
