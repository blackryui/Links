import console from 'node:console';
import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

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
  'windows-native-accessibility-input-vision',
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
const approvedClassifications = new Set([
  'shared',
  'headless-adapter',
  'ui-replaced',
  'optional-dependency',
  'blocked',
]);
const requiredSharedPaths = [
  'apps/cli/src/bin/mcp-stdio.ts',
  'apps/cli/src/runtime/stdio-mcp-runtime.ts',
  'packages/mcp-server/src/server.ts',
  'packages/mcp-server/src/stdio.ts',
  'packages/mcp-server/src/tool-registry.ts',
  'scripts/generate-tool-catalog.mjs',
];
const shaPattern = /^[0-9a-f]{40}$/;

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
    if (/^(?:toolCount|defaultToolCount|configuredToolCount|expectedToolCount)$/i.test(key)) return true;
    if (hasPermanentToolCountProof(child)) return true;
  }
  return false;
}

async function validate(root, releaseMode) {
  const errors = [];
  const inventory = await readJson(path.join(root, 'docs', 'eco-headless-parity.json'), 'ECO parity inventory', errors);
  const rootPackage = await readJson(path.join(root, 'package.json'), 'root package.json', errors);
  const plugin = await readJson(path.join(root, '.codex-plugin', 'plugin.json'), 'ECO plugin manifest', errors);

  if (inventory) {
    if (inventory.schemaVersion !== 1) errors.push('parity inventory schemaVersion must be 1');
    if (inventory.upstream?.repository !== 'engasnm111/lnwjud') errors.push('upstream repository must be engasnm111/lnwjud');
    if (inventory.upstream?.ref !== 'main') errors.push('upstream parity ref must be main');
    if (!shaPattern.test(String(inventory.upstream?.commit ?? ''))) errors.push('upstream commit must be an exact 40-character SHA');
    if (!shaPattern.test(String(inventory.ecoBase?.commit ?? ''))) errors.push('ecoBase commit must be an exact 40-character SHA');
    if (inventory.ecoBase?.repository !== 'blackryui/Links') errors.push('ecoBase repository must be blackryui/Links');
    if (rootPackage && inventory.upstream?.version !== rootPackage.version) errors.push('upstream version must match root package version');
    if (rootPackage && inventory.ecoBase?.version !== rootPackage.version) errors.push('ecoBase version must match root package version');

    const categories = Array.isArray(inventory.categories) ? inventory.categories : [];
    const ids = categories.map((entry) => entry?.id);
    if (JSON.stringify(ids) !== JSON.stringify(requiredCategories)) {
      errors.push('parity categories must exactly match the required ordered category list');
    }
    for (const category of categories) {
      if (!approvedClassifications.has(category?.classification)) {
        errors.push(`invalid parity classification for ${String(category?.id)}: ${String(category?.classification)}`);
      }
      if (!Array.isArray(category?.evidence) || category.evidence.length === 0) {
        errors.push(`parity category ${String(category?.id)} must include evidence`);
      }
      if (!Array.isArray(category?.tests) || category.tests.length === 0) {
        errors.push(`parity category ${String(category?.id)} must include tests`);
      }
      if (releaseMode && category?.classification === 'blocked') {
        errors.push(`release parity is blocked by category ${String(category?.id)}`);
      }
    }
    if (hasPermanentToolCountProof(inventory)) {
      errors.push('parity inventory must derive tool catalog/count from ToolRegistry evidence, not permanent count fields');
    }
  }

  if (plugin) {
    if (plugin.name !== 'eco') errors.push('plugin manifest name must remain eco');
    if (plugin.interface?.displayName !== 'ECO') errors.push('plugin displayName must remain ECO');
  }

  for (const relativePath of requiredSharedPaths) {
    if (!(await exists(path.join(root, relativePath)))) errors.push(`required shared runtime path is missing: ${relativePath}`);
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
  const errors = await validate(root, releaseMode);
  if (errors.length > 0) {
    console.error('ECO parity validation failed:');
    for (const error of errors) console.error(`- ${error}`);
    process.exitCode = 1;
  } else {
    console.log(`ECO parity validation passed${releaseMode ? ' (release)' : ''}.`);
  }
}
