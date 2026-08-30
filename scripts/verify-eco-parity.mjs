import { execFile } from 'node:child_process';
import console from 'node:console';
import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const execFileAsync = promisify(execFile);
const scriptRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const requiredCategories = [
  'mcp-transport-protocol',
  'tool-registry-schemas',
  'workspace-project',
  'files-checkpoints-recovery',
  'git',
  'process-project-commands',
  'search-index-context',
  'browser-cdp',
  'windows-native-accessibility-input-vision-computer-use',
  'wsl',
  'office-document-workbook',
  'system-event-log-scheduler-web-fetch',
  'extensions-skills-child-mcp',
  'audit-activity',
  'sqlite-settings-backups',
  'goals-continuations-tasks',
  'codex-delegation',
  'tunnel-lifecycle',
  'upgrade-update-runtime-state',
  'security-permission-destructive-policy',
];
const approvedClassifications = new Set(['shared', 'headless-adapter', 'optional-dependency', 'blocked']);
const shaPattern = /^[0-9a-f]{40}$/;
const forbiddenRuntimeTokens = ['eco-node.exe', 'privateNode', 'privateNodeMajor', 'privateNodeSha256', 'copyFile(process.execPath'];
const productionFilesWithoutCustomRuntime = [
  'apps/cli/src/bin/eco-mcp.ts',
  'scripts/build-eco-headless.mjs',
  'scripts/lib/eco-runtime-package.ps1',
  'scripts/setup-eco-headless.ps1',
];

function resolveRoot(argv) {
  const index = argv.indexOf('--root');
  if (index === -1) return scriptRoot;
  const value = argv[index + 1];
  if (!value) throw new Error('--root requires a path');
  return path.resolve(process.cwd(), value);
}

async function exists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function readJson(filePath, label, errors) {
  if (!(await exists(filePath))) {
    errors.push(`${label} is missing: ${filePath}`);
    return null;
  }
  try {
    return JSON.parse(await readFile(filePath, 'utf8'));
  } catch (error) {
    errors.push(`${label} is not valid JSON: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

function hasPermanentToolCountProof(value) {
  if (Array.isArray(value)) return value.some(hasPermanentToolCountProof);
  if (!value || typeof value !== 'object') return false;
  for (const [key, child] of Object.entries(value)) {
    if (/^(?:toolCount|defaultToolCount|configuredToolCount|expectedToolCount|totalTools|defaultAdvertisedCount|codexAdvertisedCount)$/i.test(key)) return true;
    if (hasPermanentToolCountProof(child)) return true;
  }
  return false;
}

async function verifyCurrentUpstreamSha(expectedSha, errors) {
  try {
    const { stdout } = await execFileAsync('git', [
      'ls-remote',
      'https://github.com/engasnm111/lnwjud.git',
      'refs/heads/main',
    ], { encoding: 'utf8', windowsHide: true, timeout: 30_000 });
    const current = stdout.trim().split(/\s+/)[0] ?? '';
    if (!shaPattern.test(current)) {
      errors.push(`could not resolve a valid upstream main SHA; got ${current || 'empty output'}`);
    } else if (current !== expectedSha) {
      errors.push(`upstream main advanced: recorded=${expectedSha} current=${current}`);
    }
  } catch (error) {
    errors.push(`upstream main re-check failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function validate(root, options) {
  const errors = [];
  const inventory = await readJson(path.join(root, 'docs', 'eco-headless-parity.json'), 'ECO parity inventory', errors);
  const rootPackage = await readJson(path.join(root, 'package.json'), 'root package.json', errors);

  if (inventory) {
    if (inventory.schemaVersion !== 2) errors.push('parity inventory schemaVersion must be 2');
    if (inventory.upstream?.repository !== 'engasnm111/lnwjud') errors.push('upstream repository must be engasnm111/lnwjud');
    if (inventory.upstream?.ref !== 'main') errors.push('upstream parity ref must be main');
    if (!shaPattern.test(String(inventory.upstream?.commit ?? ''))) errors.push('upstream commit must be an exact 40-character SHA');
    if (!shaPattern.test(String(inventory.ecoBase?.commit ?? ''))) errors.push('ecoBase commit must be an exact 40-character SHA');
    if (inventory.ecoBase?.repository !== 'blackryui/Links') errors.push('ecoBase repository must be blackryui/Links');
    if (rootPackage && inventory.upstream?.version !== rootPackage.version) errors.push('upstream version must match root package version');
    if (rootPackage && inventory.ecoBase?.version !== rootPackage.version) errors.push('ecoBase version must match root package version');
    if (inventory.catalogPolicy?.source !== 'ToolRegistry.listAll/list') errors.push('catalog policy must use ToolRegistry.listAll/list as its source');
    if (inventory.catalogPolicy?.generator !== 'scripts/generate-tool-catalog.mjs') errors.push('catalog policy must point at the upstream tool catalog generator');
    if (inventory.catalogPolicy?.countsAreEvidenceOnly !== true) errors.push('tool counts must be evidence-only, not parity constants');
    if (hasPermanentToolCountProof(inventory)) errors.push('parity inventory must not store permanent tool-count proof fields');

    const categories = Array.isArray(inventory.categories) ? inventory.categories : [];
    const ids = categories.map((entry) => entry?.id);
    if (JSON.stringify(ids) !== JSON.stringify(requiredCategories)) errors.push('parity categories must exactly match the required ordered category list');
    for (const category of categories) {
      if (!approvedClassifications.has(category?.classification)) {
        errors.push(`invalid parity classification for ${String(category?.id)}: ${String(category?.classification)}`);
      }
      if (options.releaseMode && category?.classification === 'blocked') errors.push(`release parity is blocked by category ${String(category?.id)}`);
      if (!Array.isArray(category?.evidence) || category.evidence.length === 0) {
        errors.push(`parity category ${String(category?.id)} must include evidence`);
      } else {
        for (const relativePath of category.evidence) {
          if (!(await exists(path.join(root, relativePath)))) errors.push(`missing parity evidence for ${String(category?.id)}: ${relativePath}`);
        }
      }
      if (!Array.isArray(category?.tests) || category.tests.length === 0) errors.push(`parity category ${String(category?.id)} must include tests`);
    }

    if (options.checkUpstreamMain && shaPattern.test(String(inventory.upstream?.commit ?? ''))) {
      await verifyCurrentUpstreamSha(inventory.upstream.commit, errors);
    }
  }

  for (const relativePath of productionFilesWithoutCustomRuntime) {
    const absolutePath = path.join(root, relativePath);
    if (!(await exists(absolutePath))) {
      errors.push(`required ECO production file is missing: ${relativePath}`);
      continue;
    }
    const source = await readFile(absolutePath, 'utf8');
    for (const token of forbiddenRuntimeTokens) {
      if (source.includes(token)) errors.push(`forbidden custom-runtime token '${token}' found in ${relativePath}`);
    }
  }

  const ecoEntrypointPath = path.join(root, 'apps', 'cli', 'src', 'bin', 'eco-mcp.ts');
  if (await exists(ecoEntrypointPath)) {
    const source = await readFile(ecoEntrypointPath, 'utf8');
    for (const token of ['ToolRegistry', 'tool-schema-registry', 'toolSchemas', 'registerTool']) {
      if (source.includes(token)) errors.push(`ECO entrypoint must not duplicate MCP registry/schema behavior: found ${token}`);
    }
    if (!source.includes("import('./mcp-stdio.js')")) errors.push('ECO entrypoint must delegate to the upstream mcp-stdio runtime');
  }

  if (options.releaseMode) {
    const plugin = await readJson(path.join(root, '.codex-plugin', 'plugin.json'), 'ECO plugin manifest', errors);
    if (plugin) {
      if (plugin.name !== 'eco') errors.push('plugin manifest name must remain eco');
      if (plugin.interface?.displayName !== 'ECO') errors.push('plugin displayName must remain ECO');
    }
  }

  return errors;
}

let root;
try {
  root = resolveRoot(process.argv.slice(2));
} catch (error) {
  console.error(`ECO parity validation failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}

if (root) {
  const releaseMode = process.argv.includes('--release');
  const checkUpstreamMain = process.argv.includes('--check-upstream-main');
  const errors = await validate(root, { releaseMode, checkUpstreamMain });
  if (errors.length > 0) {
    console.error('ECO parity validation failed:');
    for (const error of errors) console.error(`- ${error}`);
    process.exitCode = 1;
  } else {
    console.log(`ECO parity validation passed${releaseMode ? ' (release)' : ''}${checkUpstreamMain ? ' with upstream-main check' : ''}.`);
  }
}
