import { existsSync } from 'node:fs';
import path from 'node:path';

export interface PackagedRuntimeEnvironmentResult {
  readonly ripgrepDir: string | null;
}

export function preparePackagedRuntimeEnvironment(
  argv: readonly string[] = process.argv,
  env: NodeJS.ProcessEnv = process.env,
  platform: NodeJS.Platform = process.platform,
): PackagedRuntimeEnvironmentResult {
  const entrypoint = argv[1];
  if (typeof entrypoint !== 'string' || entrypoint.trim().length === 0) return { ripgrepDir: null };

  const runtimeDir = path.dirname(path.resolve(entrypoint));
  const executable = platform === 'win32' ? 'rg.exe' : 'rg';
  const ripgrepDir = path.join(runtimeDir, 'runtime-tools', 'ripgrep');
  if (!existsSync(path.join(ripgrepDir, executable))) return { ripgrepDir: null };

  const currentPath = env.PATH ?? env.Path ?? '';
  const entries = currentPath.split(path.delimiter).filter((entry) => entry.length > 0);
  const normalizedRipgrepDir = normalizePathForComparison(ripgrepDir, platform);
  const alreadyPresent = entries.some((entry) => normalizePathForComparison(entry, platform) === normalizedRipgrepDir);
  if (!alreadyPresent) env.PATH = currentPath.length === 0 ? ripgrepDir : `${ripgrepDir}${path.delimiter}${currentPath}`;

  return { ripgrepDir };
}

function normalizePathForComparison(value: string, platform: NodeJS.Platform): string {
  const resolved = path.resolve(value);
  return platform === 'win32' ? resolved.toLowerCase() : resolved;
}
