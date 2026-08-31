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
  const pathValue = readPathEnvironment(env);
  if (pathValue !== undefined && pathValue.trim().length > 0) {
    const executable = process.platform === 'win32' ? 'node.exe' : 'node';
    for (const rawDirectory of pathValue.split(path.delimiter)) {
      const directory = stripSurroundingQuotes(rawDirectory.trim());
      if (directory.length === 0) continue;
      const candidate = path.resolve(directory, executable);
      try {
        await access(candidate);
        return candidate;
      } catch {
        // Continue scanning PATH entries without spawning where.exe/which.
      }
    }
  }
  throw new Error('ECO Headless could not resolve Node.js 24.x from PATH. Install Node.js 24 or provide an explicit Node path.');
}

function readPathEnvironment(env: NodeJS.ProcessEnv): string | undefined {
  for (const [key, value] of Object.entries(env)) {
    if (key.toLowerCase() === 'path' && typeof value === 'string') return value;
  }
  return undefined;
}

function stripSurroundingQuotes(value: string): string {
  return value.length >= 2 && value.startsWith('"') && value.endsWith('"')
    ? value.slice(1, -1)
    : value;
}
