import { execFile } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const execFileAsync = promisify(execFile);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const requestedVersion = process.argv[2];
const upstreamArgs = [path.join(root, 'scripts', 'set-version.mjs')];
if (requestedVersion !== undefined) upstreamArgs.push(requestedVersion);

await execFileAsync(process.execPath, upstreamArgs, {
  cwd: root,
  encoding: 'utf8',
  windowsHide: true,
  maxBuffer: 4 * 1024 * 1024,
});

const rootPackagePath = path.join(root, 'package.json');
const pluginPath = path.join(root, '.codex-plugin', 'plugin.json');
const rootPackage = JSON.parse(await readFile(rootPackagePath, 'utf8'));
const manifest = JSON.parse(await readFile(pluginPath, 'utf8'));
manifest.version = rootPackage.version;
await writeFile(pluginPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
process.stdout.write(`Updated .codex-plugin/plugin.json -> ${rootPackage.version}\n`);
