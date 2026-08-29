import console from 'node:console';
import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const scriptRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const expectedPluginName = 'eco';
const expectedDisplayName = 'ECO';
const requiredSkills = [
  'lnwjud-core',
  'lnwjud-development',
  'lnwjud-windows',
  'lnwjud-browser',
  'lnwjud-office',
  'lnwjud-long-session',
];
const requiredInterfaceFields = [
  'displayName',
  'shortDescription',
  'longDescription',
  'developerName',
  'category',
  'capabilities',
  'websiteURL',
  'privacyPolicyURL',
  'termsOfServiceURL',
  'defaultPrompt',
];
const requiredUrlFields = ['websiteURL', 'privacyPolicyURL', 'termsOfServiceURL'];
const iconFields = ['composerIcon', 'logo', 'logoDark'];
const requiredHeadlessFiles = [
  'docs/eco-headless.md',
  'scripts/setup-eco-headless.ps1',
  'scripts/start-eco-tunnel.ps1',
  'scripts/stop-eco-tunnel.ps1',
  'scripts/status-eco-tunnel.ps1',
  'scripts/setup-eco-codex.ps1',
  'scripts/lib/eco-headless-common.ps1',
  'scripts/build-eco-headless.mjs',
];
const requiredHeadlessDocConcepts = [
  'ECO Headless',
  'Secure MCP Tunnel',
  'stdio',
  'eco-mcp',
  'setup-eco-headless.ps1',
  'start-eco-tunnel.ps1',
  'setup-eco-codex.ps1',
  'strict allowed',
];
const forbiddenDesktopPrimaryPhrases = [
  'Launch lnwjud Desktop',
  'Settings -> OpenAI Secure MCP Tunnel',
  'Desktop loopback HTTP MCP',
];

function resolveRoot(argv) {
  const rootIndex = argv.indexOf('--root');
  if (rootIndex === -1) return scriptRoot;
  const rootValue = argv[rootIndex + 1];
  if (!rootValue) throw new Error('--root requires a path');
  return path.resolve(process.cwd(), rootValue);
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

function resolvePackagePath(root, rawPath, label, errors) {
  if (typeof rawPath !== 'string' || rawPath.length === 0) {
    errors.push(`${label} must be a non-empty relative path`);
    return null;
  }
  const relativePath = rawPath.replace(/^\.\//, '');
  const resolved = path.resolve(root, relativePath);
  const relative = path.relative(root, resolved);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    errors.push(`${label} escapes the plugin package root: ${rawPath}`);
    return null;
  }
  return resolved;
}

function frontmatterName(content) {
  const block = content.match(/^---\s*\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!block?.[1]) return null;
  return block[1].match(/^name:\s*([^\r\n]+)\s*$/m)?.[1]?.trim() ?? null;
}

function collectIds(value, ids = []) {
  if (Array.isArray(value)) {
    for (const item of value) collectIds(item, ids);
    return ids;
  }
  if (!value || typeof value !== 'object') return ids;
  for (const [key, child] of Object.entries(value)) {
    if (key === 'id' && typeof child === 'string') ids.push(child);
    collectIds(child, ids);
  }
  return ids;
}

function containsPlaceholderConnectorId(appJson) {
  const ids = collectIds(appJson);
  if (ids.length === 0) return true;
  const placeholder = /(?:placeholder|replace[-_ ]?me|your[-_ ]?connector|connector_(?:x{4,}|0{6,}|example|placeholder)|<[^>]+>)/i;
  return ids.some((id) => id.trim().length === 0 || placeholder.test(id));
}

async function scanSecrets(filePaths, errors) {
  const patterns = [
    { label: 'OpenAI API key', regex: /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/g },
    { label: 'runtime API key assignment', regex: /\b(?:CONTROL_PLANE_API_KEY|runtime[_ -]?api[_ -]?key)\s*[:=]\s*["']?[A-Za-z0-9_-]{16,}/gi },
    { label: 'hard-coded tunnel id', regex: /\btunnel[_ -]?id\s*[:=]\s*["']?[A-Za-z0-9_-]{12,}/gi },
  ];

  for (const filePath of filePaths) {
    if (!(await exists(filePath))) continue;
    const content = await readFile(filePath, 'utf8');
    for (const { label, regex } of patterns) {
      regex.lastIndex = 0;
      if (regex.test(content)) errors.push(`secret-like ${label} found in ${path.relative(process.cwd(), filePath)}`);
    }
  }
}

async function validatePlugin(root) {
  const errors = [];
  const packagePath = path.join(root, 'package.json');
  const manifestPath = path.join(root, '.codex-plugin', 'plugin.json');
  const rootPackage = await readJson(packagePath, 'root package.json', errors);
  const manifest = await readJson(manifestPath, 'plugin manifest', errors);
  const scannedFiles = [manifestPath];

  if (manifest && rootPackage) {
    if (manifest.name !== expectedPluginName) errors.push(`plugin manifest name must be "${expectedPluginName}"`);
    if (manifest.version !== rootPackage.version) {
      errors.push(`plugin manifest version ${String(manifest.version)} does not match package.json version ${String(rootPackage.version)}`);
    }
    if (manifest.skills !== './skills/') errors.push('plugin manifest skills must be "./skills/"');
    if (typeof manifest.description !== 'string' || !manifest.description.includes('Headless')) {
      errors.push('plugin manifest description must identify ECO Headless');
    }

    const pluginInterface = manifest.interface ?? {};
    for (const field of requiredInterfaceFields) {
      if (!(field in pluginInterface)) errors.push(`plugin manifest interface is missing ${field}`);
    }
    if (pluginInterface.displayName !== expectedDisplayName) {
      errors.push(`plugin manifest interface.displayName must be "${expectedDisplayName}"`);
    }
    if (typeof pluginInterface.longDescription !== 'string' || !pluginInterface.longDescription.includes('Headless')) {
      errors.push('plugin manifest interface.longDescription must identify the headless runtime');
    }

    const capabilities = pluginInterface.capabilities;
    for (const required of ['Interactive', 'Read', 'Write']) {
      if (!Array.isArray(capabilities) || !capabilities.includes(required)) {
        errors.push(`plugin manifest interface.capabilities must include ${required}`);
      }
    }

    for (const field of requiredUrlFields) {
      const value = pluginInterface[field];
      if (typeof value !== 'string' || !value.startsWith('https://')) {
        errors.push(`plugin manifest interface.${field} must be an https URL`);
      }
    }

    const prompts = pluginInterface.defaultPrompt;
    if (!Array.isArray(prompts) || prompts.length === 0 || prompts.length > 3
      || prompts.some((prompt) => typeof prompt !== 'string' || !prompt.includes('ECO') || prompt.length > 128)) {
      errors.push('plugin manifest interface.defaultPrompt must contain 1-3 ECO prompts of at most 128 characters');
    }

    for (const field of iconFields) {
      const iconPath = resolvePackagePath(root, pluginInterface[field], `interface.${field}`, errors);
      if (iconPath && !(await exists(iconPath))) errors.push(`interface.${field} does not exist: ${String(pluginInterface[field])}`);
    }
  }

  for (const skill of requiredSkills) {
    const skillPath = path.join(root, 'skills', skill, 'SKILL.md');
    scannedFiles.push(skillPath);
    if (!(await exists(skillPath))) {
      errors.push(`required skill is missing: skills/${skill}/SKILL.md`);
      continue;
    }
    const content = await readFile(skillPath, 'utf8');
    const declaredName = frontmatterName(content);
    if (declaredName !== skill) errors.push(`skill frontmatter name mismatch for ${skill}: found ${String(declaredName)}`);
    for (const forbidden of ['lnwjud Desktop', 'Desktop permission', 'native exact-action approval']) {
      if (content.includes(forbidden)) errors.push(`skill ${skill} still depends on Desktop wording: ${forbidden}`);
    }
  }

  for (const relativePath of requiredHeadlessFiles) {
    const filePath = path.join(root, relativePath);
    scannedFiles.push(filePath);
    if (!(await exists(filePath))) errors.push(`required ECO Headless file is missing: ${relativePath}`);
  }

  const pluginDocPath = path.join(root, 'docs', 'chatgpt-plugin.md');
  scannedFiles.push(pluginDocPath);
  if (await exists(pluginDocPath)) {
    const doc = await readFile(pluginDocPath, 'utf8');
    for (const concept of requiredHeadlessDocConcepts) {
      if (!doc.toLowerCase().includes(concept.toLowerCase())) errors.push(`ChatGPT plugin guide is missing headless concept: ${concept}`);
    }
    for (const forbidden of forbiddenDesktopPrimaryPhrases) {
      if (doc.includes(forbidden)) errors.push(`ChatGPT plugin guide still contains Desktop-primary instruction: ${forbidden}`);
    }
  } else {
    errors.push('ChatGPT plugin guide is missing: docs/chatgpt-plugin.md');
  }

  const appPath = path.join(root, '.app.json');
  if (await exists(appPath)) {
    scannedFiles.push(appPath);
    const appJson = await readJson(appPath, '.app.json', errors);
    if (appJson && containsPlaceholderConnectorId(appJson)) errors.push('.app.json contains a placeholder or missing connector id');
  }

  const mcpPath = path.join(root, '.mcp.json');
  if (await exists(mcpPath)) {
    const mcpContent = await readFile(mcpPath, 'utf8');
    if (/127\.0\.0\.1|localhost/i.test(mcpContent)) errors.push('.mcp.json must not publish a localhost MCP endpoint for ChatGPT Web');
  }

  await scanSecrets(scannedFiles, errors);
  return errors;
}

let root;
try {
  root = resolveRoot(process.argv.slice(2));
} catch (error) {
  console.error(`ChatGPT plugin package validation failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}

if (root) {
  const errors = await validatePlugin(root);
  if (errors.length > 0) {
    console.error('ChatGPT plugin package validation failed:');
    for (const error of errors) console.error(`- ${error}`);
    process.exitCode = 1;
  } else {
    console.log('ChatGPT plugin package validation passed.');
  }
}
