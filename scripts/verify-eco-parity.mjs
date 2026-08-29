import console from 'node:console';
import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const defaultRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
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
const allowedClassifications = new Set([
  'shared',
  'headless-adapter',
  'ui-replaced',
  'optional-dependency',
  'blocked',
]);
const requiredSharedEntrypoints = [
  'apps/cli/src/bin/mcp-stdio.ts',
  'apps/cli/src/runtime/stdio-mcp-runtime.ts',
  'packages/mcp-server/src/server.ts',
  'packages/mcp-server/src/stdio.ts',
  'packages/mcp-server/src/tool-registry.ts',
];

function parseArgs(argv) {
  const rootIndex = argv.indexOf('--root');
  const root = rootIndex === -1 ? defaultRoot : path.resolve(process.cwd(), argv[rootIndex + 1] ?? '');
  if (rootIndex !== -1 && !argv[rootIndex + 1]) throw new Error('--root requires a path');
  return { root, release: argv.includes('--release') };
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
    errors.push(`${label} is missing: ${path.relative(process.cwd(), filePath)}`);
    return null;
  }
  try {
    return JSON.parse(await readFile(filePath, 'utf8'));
  } catch (error) {
    errors.push(`${label} is not valid JSON: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

function isSha(value) {
  return typeof value === 'string' && /^[a-f0-9]{40}$/i.test(value);
}

function isNonEmptyStringArray(value) {
  return Array.isArray(value) && value.length > 0 && value.every((item) => typeof item === 'string' && item.trim().length > 0);
}

function collectForbiddenToolCountKeys(value, currentPath = '$', found = []) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => collectForbiddenToolCountKeys(item, `${currentPath}[${index}]`, found));
    return found;
  }
  if (!value || typeof value !== 'object') return found;
  for (const [key, child] of Object.entries(value)) {
    const nextPath = `${currentPath}.${key}`;
    if (/^(?:toolCount|toolCounts|defaultToolCount|totalTools)$/i.test(key)) found.push(nextPath);
    collectForbiddenToolCountKeys(child, nextPath, found);
  }
  return found;
}

function isPathLikeTest(value) {
  return typeof value === 'string' && !/\s/.test(value) && (value.endsWith('.ts') || value.endsWith('.mjs') || value.endsWith('.ps1'));
}

async function validate(root, release) {
  const errors = [];
  const inventoryPath = path.join(root, 'docs', 'eco-headless-parity.json');
  const packagePath = path.join(root, 'package.json');
  const manifestPath = path.join(root, '.codex-plugin', 'plugin.json');
  const inventory = await readJson(inventoryPath, 'ECO parity inventory', errors);
  const rootPackage = await readJson(packagePath, 'root package.json', errors);
  const manifest = await readJson(manifestPath, 'ECO plugin manifest', errors);

  if (inventory) {
    if (inventory.schemaVersion !== 1) errors.push('parity inventory schemaVersion must be 1');
    if (inventory.upstream?.repository !== 'engasnm111/lnwjud') errors.push('parity upstream.repository must be engasnm111/lnwjud');
    if (inventory.upstream?.ref !== 'main') errors.push('parity upstream.ref must be main');
    if (!isSha(inventory.upstream?.commit)) errors.push('parity upstream.commit must be an exact 40-character Git SHA');
    if (!isSha(inventory.ecoBase?.commit)) errors.push('parity ecoBase.commit must be an exact 40-character Git SHA');
    if (inventory.ecoBase?.repository !== 'blackryui/Links') errors.push('parity ecoBase.repository must be blackryui/Links');

    if (rootPackage) {
      if (inventory.ecoBase?.version !== rootPackage.version) {
        errors.push(`parity ecoBase.version ${String(inventory.ecoBase?.version)} does not match package.json ${String(rootPackage.version)}`);
      }
      if (inventory.upstream?.version !== rootPackage.version) {
        errors.push(`parity upstream.version ${String(inventory.upstream?.version)} does not match local runtime version ${String(rootPackage.version)}`);
      }
    }

    const categories = Array.isArray(inventory.categories) ? inventory.categories : [];
    const ids = categories.map((entry) => entry?.id);
    if (JSON.stringify(ids) !== JSON.stringify(requiredCategories)) {
      errors.push(`parity categories must exactly match required ordered ids: ${requiredCategories.join(', ')}`);
    }

    for (const category of categories) {
      const id = String(category?.id ?? '<unknown>');
      if (!allowedClassifications.has(category?.classification)) {
        errors.push(`parity category ${id} has invalid classification ${String(category?.classification)}`);
      }
      if (release && category?.classification === 'blocked') {
        errors.push(`parity category ${id} is blocked in release mode`);
      }
      if (!isNonEmptyStringArray(category?.evidence)) errors.push(`parity category ${id} must have non-empty evidence`);
      if (!isNonEmptyStringArray(category?.tests)) errors.push(`parity category ${id} must have non-empty tests`);

      if (Array.isArray(category?.evidence)) {
        for (const evidence of category.evidence) {
          if (typeof evidence !== 'string') continue;
          if (!(await exists(path.join(root, evidence)))) errors.push(`parity evidence is missing for ${id}: ${evidence}`);
        }
      }
      if (release && Array.isArray(category?.tests)) {
        for (const test of category.tests) {
          if (isPathLikeTest(test) && !(await exists(path.join(root, test)))) {
            errors.push(`parity release test evidence is missing for ${id}: ${test}`);
          }
        }
      }
    }

    const forbiddenToolCountKeys = collectForbiddenToolCountKeys(inventory);
    if (forbiddenToolCountKeys.length > 0) {
      errors.push(`parity inventory must derive tool catalog from ToolRegistry, not hard-code tool counts: ${forbiddenToolCountKeys.join(', ')}`);
    }
  }

  if (manifest) {
    if (manifest.name !== 'eco') errors.push('ECO plugin manifest name must be "eco"');
    if (manifest.interface?.displayName !== 'ECO') errors.push('ECO plugin manifest interface.displayName must be "ECO"');
    if (rootPackage && manifest.version !== rootPackage.version) {
      errors.push(`ECO plugin version ${String(manifest.version)} does not match package.json ${String(rootPackage.version)}`);
    }
  }

  for (const entrypoint of requiredSharedEntrypoints) {
    if (!(await exists(path.join(root, entrypoint)))) errors.push(`required shared runtime entrypoint is missing: ${entrypoint}`);
  }

  return errors;
}

let parsed;
try {
  parsed = parseArgs(process.argv.slice(2));
} catch (error) {
  console.error(`ECO parity validation failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}

if (parsed) {
  const errors = await validate(parsed.root, parsed.release);
  if (errors.length > 0) {
    console.error('ECO parity validation failed:');
    errors.forEach((error) => console.error(`- ${error}`));
    process.exitCode = 1;
  } else {
    console.log(`ECO parity validation passed${parsed.release ? ' (release mode)' : ''}.`);
  }
}
