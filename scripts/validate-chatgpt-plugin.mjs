import console from 'node:console';
import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const scriptRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const requiredSkills = [
  'lnwjud-core',
  'lnwjud-development',
  'lnwjud-windows',
  'lnwjud-browser',
  'lnwjud-office',
  'lnwjud-long-session',
];
const requiredInterfaceFields = [
  'displayName', 'shortDescription', 'longDescription', 'developerName', 'category',
  'capabilities', 'websiteURL', 'privacyPolicyURL', 'termsOfServiceURL', 'defaultPrompt',
];

function resolveRoot(argv) {
  const index = argv.indexOf('--root');
  if (index < 0) return scriptRoot;
  const value = argv[index + 1];
  if (!value) throw new Error('--root requires a path');
  return path.resolve(process.cwd(), value);
}

async function exists(filePath) {
  try { await access(filePath); return true; } catch { return false; }
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

function frontmatterName(content) {
  const block = content.match(/^---\s*\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  return block?.[1]?.match(/^name:\s*([^\r\n]+)\s*$/m)?.[1]?.trim() ?? null;
}

function collectIds(value, ids = []) {
  if (Array.isArray(value)) {
    for (const entry of value) collectIds(entry, ids);
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

async function validate(root) {
  const errors = [];
  const rootPackage = await readJson(path.join(root, 'package.json'), 'root package.json', errors);
  const manifest = await readJson(path.join(root, '.codex-plugin', 'plugin.json'), 'plugin manifest', errors);

  if (rootPackage && manifest) {
    if (manifest.name !== 'eco') errors.push('plugin manifest name must be "eco"');
    if (manifest.version !== rootPackage.version) errors.push(`plugin manifest version ${String(manifest.version)} does not match package.json version ${String(rootPackage.version)}`);
    if (manifest.skills !== './skills/') errors.push('plugin manifest skills must be "./skills/"');
    if (typeof manifest.description !== 'string' || !/headless MCP/i.test(manifest.description)) errors.push('plugin description must describe ECO headless MCP');

    const pluginInterface = manifest.interface ?? {};
    for (const field of requiredInterfaceFields) if (!(field in pluginInterface)) errors.push(`plugin manifest interface is missing ${field}`);
    if (pluginInterface.displayName !== 'ECO') errors.push('plugin manifest interface.displayName must be "ECO"');
    if (typeof pluginInterface.longDescription !== 'string' || !/headless stdio MCP/i.test(pluginInterface.longDescription)) errors.push('plugin longDescription must describe the headless stdio MCP path');
    for (const capability of ['Interactive', 'Read', 'Write']) {
      if (!Array.isArray(pluginInterface.capabilities) || !pluginInterface.capabilities.includes(capability)) errors.push(`plugin capabilities must include ${capability}`);
    }
    for (const field of ['websiteURL', 'privacyPolicyURL', 'termsOfServiceURL']) {
      const value = pluginInterface[field];
      if (typeof value !== 'string' || !value.startsWith('https://')) errors.push(`plugin interface.${field} must be an https URL`);
    }
    const prompts = pluginInterface.defaultPrompt;
    if (!Array.isArray(prompts) || prompts.length === 0 || prompts.length > 3 || prompts.some((entry) => typeof entry !== 'string' || !entry.includes('ECO') || entry.length > 128)) {
      errors.push('plugin defaultPrompt must contain 1-3 ECO-branded prompts of at most 128 characters');
    }
    for (const field of ['composerIcon', 'logo', 'logoDark']) {
      const raw = pluginInterface[field];
      if (typeof raw !== 'string' || raw.length === 0 || path.isAbsolute(raw)) {
        errors.push(`plugin interface.${field} must be a non-empty relative path`);
        continue;
      }
      const target = path.resolve(root, raw.replace(/^\.\//, ''));
      const relative = path.relative(root, target);
      if (relative.startsWith('..') || path.isAbsolute(relative) || !(await exists(target))) errors.push(`plugin interface.${field} target is invalid or missing: ${raw}`);
    }
  }

  for (const skill of requiredSkills) {
    const skillPath = path.join(root, 'skills', skill, 'SKILL.md');
    if (!(await exists(skillPath))) {
      errors.push(`required upstream routing skill is missing: skills/${skill}/SKILL.md`);
      continue;
    }
    const content = await readFile(skillPath, 'utf8');
    if (frontmatterName(content) !== skill) errors.push(`skill frontmatter name mismatch for ${skill}`);
  }

  const docs = [
    path.join(root, 'docs', 'chatgpt-plugin.md'),
    path.join(root, 'docs', 'eco-headless.md'),
    path.join(root, 'docs', 'eco-codex.md'),
  ];
  for (const docPath of docs) if (!(await exists(docPath))) errors.push(`required ECO documentation is missing: ${path.relative(root, docPath)}`);
  if (docs.every((docPath) => errors.every((entry) => !entry.includes(path.relative(root, docPath))))) {
    const combined = (await Promise.all(docs.map((docPath) => readFile(docPath, 'utf8')))).join('\n');
    for (const required of ['ECO', 'Secure MCP Tunnel', 'system Node 24', 'eco-mcp.cjs', 'over stdio', '--strict-roots', 'Codex Desktop']) {
      if (!combined.includes(required)) errors.push(`ECO documentation must include ${required}`);
    }
    for (const forbidden of ['eco-node.exe', 'lnwjud v4.13', 'Launch lnwjud Desktop', 'Desktop loopback HTTP MCP']) {
      if (combined.includes(forbidden)) errors.push(`ECO documentation contains stale/forbidden architecture text: ${forbidden}`);
    }
    if (/\b221\b|\b227\b/.test(combined)) errors.push('ECO documentation must not preserve old permanent 221/227 tool counts');
  }

  const appPath = path.join(root, '.app.json');
  if (await exists(appPath)) {
    const appJson = await readJson(appPath, '.app.json', errors);
    if (appJson && containsPlaceholderConnectorId(appJson)) errors.push('.app.json contains a placeholder or missing connector id');
  }

  const scannedTextFiles = [path.join(root, '.codex-plugin', 'plugin.json'), ...docs, ...requiredSkills.map((skill) => path.join(root, 'skills', skill, 'SKILL.md'))];
  const secretPatterns = [
    /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/g,
    /\bCONTROL_PLANE_API_KEY\s*[:=]\s*["']?[A-Za-z0-9_-]{16,}/gi,
    /\btunnel[_ -]?id\s*[:=]\s*["']?[A-Za-z0-9_-]{12,}/gi,
  ];
  for (const filePath of scannedTextFiles) {
    if (!(await exists(filePath))) continue;
    const content = await readFile(filePath, 'utf8');
    if (secretPatterns.some((pattern) => { pattern.lastIndex = 0; return pattern.test(content); })) errors.push(`secret-like credential found in ${path.relative(root, filePath)}`);
  }

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
  const errors = await validate(root);
  if (errors.length > 0) {
    console.error('ChatGPT plugin package validation failed:');
    for (const error of errors) console.error(`- ${error}`);
    process.exitCode = 1;
  } else {
    console.log('ChatGPT plugin package validation passed.');
  }
}
