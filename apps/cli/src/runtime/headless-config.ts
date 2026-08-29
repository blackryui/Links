import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { EXTENSIONS_SETTINGS_KEY, parseExtensionsSettings, type ExtensionsSettings } from '@lnwjud/extensions';
import {
  DESTRUCTIVE_AUTO_APPROVAL_SETTING_KEY,
  MAX_CONFIGURABLE_WAIT_SECONDS,
  MIN_CONFIGURABLE_WAIT_SECONDS,
  STDIO_ALLOWED_ROOTS_SETTING_KEY,
  STDIO_PERMISSION_PROFILE_SETTING_KEY,
  STDIO_STRICT_ROOTS_SETTING_KEY,
  USER_SETTING_KEYS,
  parseAllowedRoots,
  parseCustomPermissionSettings,
  parseDestructiveAutoApprovalPolicy,
  parsePathList,
  parseStringRecordSetting,
  serializeAllowedRoots,
  serializeCustomPermissionSettings,
  serializeDestructiveAutoApprovalPolicy,
  serializePathList,
  serializeStringRecordSetting,
} from '@lnwjud/shared';
import { SqliteDatabase, SqliteSettingsRepository } from '@lnwjud/storage';

export const ECO_HEADLESS_CONFIG_KEYS = [
  'permission-profile',
  'strict-roots',
  'allowed-roots',
  'custom-permission',
  'mcp-call-timeout-ms',
  'mcp-idle-timeout-ms',
  'process-timeout-ms',
  'mcp-poll-wait-seconds',
  'shell-synchronous-wait-seconds',
  'capability-roots',
  'pdf-provider-path',
  'lsp-commands',
  'codex-tools-enabled',
  'destructive-policy',
  'extensions',
] as const;

export type EcoHeadlessConfigKey = typeof ECO_HEADLESS_CONFIG_KEYS[number];
export type EcoHeadlessConfigSnapshot = Readonly<Record<EcoHeadlessConfigKey, unknown>>;

type SettingSpec = {
  readonly storageKey: string;
  encode(value: string): string;
  decode(value: string | null): unknown;
};

const PERMISSION_DECISIONS = new Set(['ALLOW', 'ASK', 'DENY']);
const CUSTOM_PERMISSION_KEYS = ['read', 'write', 'execute', 'dangerous', 'allowedExecutables'] as const;
const DESTRUCTIVE_POLICY_KEYS = ['protectCriticalFiles', 'recoverableDelete', 'approvals'] as const;
const DESTRUCTIVE_APPROVAL_KEYS = [
  'delete_file',
  'git_rm',
  'git_clean',
  'git_reset_restore',
  'shell_rm_unlink',
  'shell_rmdir',
  'shell_del_erase',
  'wsl_rm_unlink',
  'wsl_rmdir',
] as const;
const EXTENSION_KEYS = [
  'mode',
  'disabledServers',
  'enabledServers',
  'disabledSkillRoots',
  'extraSkillRoots',
  'extraMcpServers',
] as const;
const EXTENSION_SERVER_KEYS = ['command', 'args', 'env', 'cwd', 'type'] as const;

const settingSpecs: Readonly<Record<EcoHeadlessConfigKey, SettingSpec>> = {
  'permission-profile': {
    storageKey: STDIO_PERMISSION_PROFILE_SETTING_KEY,
    encode: (value) => {
      const normalized = value.trim().toLowerCase();
      if (!['safe', 'balanced', 'full', 'custom'].includes(normalized)) {
        throw new Error('permission-profile must be safe, balanced, full, or custom');
      }
      return normalized;
    },
    decode: (value) => value,
  },
  'strict-roots': booleanSpec(STDIO_STRICT_ROOTS_SETTING_KEY),
  'allowed-roots': {
    storageKey: STDIO_ALLOWED_ROOTS_SETTING_KEY,
    encode: (value) => serializeAllowedRoots(parseAllowedRoots(value)),
    decode: (value) => value === null ? null : [...parseAllowedRoots(value)],
  },
  'custom-permission': {
    storageKey: USER_SETTING_KEYS.customPermissionProfile,
    encode: (value) => {
      const parsed = requireJsonObject(value, 'custom-permission');
      validateCustomPermission(parsed);
      return serializeCustomPermissionSettings(parseCustomPermissionSettings(value));
    },
    decode: (value) => value === null ? null : parseCustomPermissionSettings(value),
  },
  'mcp-call-timeout-ms': integerSpec(USER_SETTING_KEYS.mcpCallTimeoutMs, 1_000, 60 * 60_000),
  'mcp-idle-timeout-ms': integerSpec(USER_SETTING_KEYS.mcpIdleTimeoutMs, 30_000, 24 * 60 * 60_000),
  'process-timeout-ms': integerSpec(USER_SETTING_KEYS.processTimeoutMs, 1_000, 4 * 60 * 60_000),
  'mcp-poll-wait-seconds': integerSpec(USER_SETTING_KEYS.mcpPollWaitSeconds, MIN_CONFIGURABLE_WAIT_SECONDS, MAX_CONFIGURABLE_WAIT_SECONDS),
  'shell-synchronous-wait-seconds': integerSpec(USER_SETTING_KEYS.shellSynchronousWaitSeconds, MIN_CONFIGURABLE_WAIT_SECONDS, MAX_CONFIGURABLE_WAIT_SECONDS),
  'capability-roots': {
    storageKey: USER_SETTING_KEYS.capabilityRoots,
    encode: (value) => serializePathList(parsePathList(value)),
    decode: (value) => value === null ? null : [...parsePathList(value)],
  },
  'pdf-provider-path': {
    storageKey: USER_SETTING_KEYS.pdfProviderPath,
    encode: (value) => {
      const trimmed = value.trim();
      if (trimmed.length === 0) throw new Error('pdf-provider-path must be non-empty; use reset to clear it');
      return trimmed;
    },
    decode: (value) => value,
  },
  'lsp-commands': {
    storageKey: USER_SETTING_KEYS.lspCommands,
    encode: (value) => {
      requireStringRecord(value, 'lsp-commands');
      return serializeStringRecordSetting(parseStringRecordSetting(value));
    },
    decode: (value) => value === null ? null : parseStringRecordSetting(value),
  },
  'codex-tools-enabled': booleanSpec(USER_SETTING_KEYS.codexToolsEnabled),
  'destructive-policy': {
    storageKey: DESTRUCTIVE_AUTO_APPROVAL_SETTING_KEY,
    encode: (value) => {
      const parsed = requireJsonObject(value, 'destructive-policy');
      validateDestructivePolicy(parsed);
      return serializeDestructiveAutoApprovalPolicy(parseDestructiveAutoApprovalPolicy(value, false));
    },
    decode: (value) => value === null ? null : parseDestructiveAutoApprovalPolicy(value, false),
  },
  extensions: {
    storageKey: EXTENSIONS_SETTINGS_KEY,
    encode: (value) => {
      const parsed = requireJsonObject(value, 'extensions');
      validateExtensions(parsed);
      return JSON.stringify(parseExtensionsSettings(value));
    },
    decode: (value) => value === null ? null : redactExtensions(parseExtensionsSettings(value)),
  },
};

export function readEcoHeadlessConfig(dataPath: string): EcoHeadlessConfigSnapshot {
  return withSettings(dataPath, (settings) => Object.fromEntries(
    ECO_HEADLESS_CONFIG_KEYS.map((key) => [key, settingSpecs[key].decode(settings.get(settingSpecs[key].storageKey))]),
  ) as Record<EcoHeadlessConfigKey, unknown>);
}

export function setEcoHeadlessConfigValue(dataPath: string, key: string, value: string): unknown {
  const normalizedKey = requireConfigKey(key);
  const spec = settingSpecs[normalizedKey];
  const encoded = spec.encode(value);
  return withSettings(dataPath, (settings) => {
    settings.set(spec.storageKey, encoded);
    return spec.decode(encoded);
  });
}

export function resetEcoHeadlessConfigValue(dataPath: string, key: string): void {
  const normalizedKey = requireConfigKey(key);
  const spec = settingSpecs[normalizedKey];
  withSettings(dataPath, (settings) => {
    settings.delete(spec.storageKey);
  });
}

function requireConfigKey(value: string): EcoHeadlessConfigKey {
  const key = value.trim() as EcoHeadlessConfigKey;
  if (!ECO_HEADLESS_CONFIG_KEYS.includes(key)) throw new Error(`Unknown ECO headless config key: ${value}`);
  return key;
}

function booleanSpec(storageKey: string): SettingSpec {
  return {
    storageKey,
    encode: (value): string => {
      const normalized = value.trim().toLowerCase();
      if (normalized === 'true' || normalized === '1' || normalized === 'yes' || normalized === 'on') return 'true';
      if (normalized === 'false' || normalized === '0' || normalized === 'no' || normalized === 'off') return 'false';
      throw new Error('boolean value must be true/false, 1/0, yes/no, or on/off');
    },
    decode: (value) => value === null ? null : value === 'true',
  };
}

function integerSpec(storageKey: string, minimum: number, maximum: number): SettingSpec {
  return {
    storageKey,
    encode: (value): string => {
      const parsed = Number(value);
      if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) {
        throw new Error(`integer value must be between ${minimum} and ${maximum}`);
      }
      return String(parsed);
    },
    decode: (value) => value === null ? null : Number(value),
  };
}

function requireJsonObject(value: string, label: string): Record<string, unknown> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error(`${label} must be valid JSON`);
  }
  if (!isRecord(parsed)) throw new Error(`${label} must be a JSON object`);
  return parsed;
}

function requireStringRecord(value: string, label: string): Readonly<Record<string, string>> {
  const parsed = requireJsonObject(value, label);
  for (const [key, entry] of Object.entries(parsed)) {
    if (key.trim().length === 0 || typeof entry !== 'string' || entry.trim().length === 0) {
      throw new Error(`${label} must be a JSON object whose values are non-empty strings`);
    }
  }
  return parsed as Readonly<Record<string, string>>;
}

function validateCustomPermission(record: Record<string, unknown>): void {
  assertOnlyKeys(record, CUSTOM_PERMISSION_KEYS, 'custom-permission');
  for (const key of ['read', 'write', 'execute', 'dangerous'] as const) {
    if (!(key in record)) continue;
    if (typeof record[key] !== 'string' || !PERMISSION_DECISIONS.has(record[key])) {
      throw new Error(`custom-permission ${key} must be ALLOW, ASK, or DENY`);
    }
  }
  if ('allowedExecutables' in record) {
    if (!Array.isArray(record.allowedExecutables)
      || record.allowedExecutables.some((entry) => typeof entry !== 'string' || entry.trim().length === 0)) {
      throw new Error('custom-permission allowedExecutables must be an array of non-empty strings');
    }
  }
}

function validateDestructivePolicy(record: Record<string, unknown>): void {
  assertOnlyKeys(record, DESTRUCTIVE_POLICY_KEYS, 'destructive-policy');
  if ('protectCriticalFiles' in record && record.protectCriticalFiles !== true) {
    throw new Error('destructive-policy protectCriticalFiles must remain true');
  }
  if ('recoverableDelete' in record && record.recoverableDelete !== true) {
    throw new Error('destructive-policy recoverableDelete must remain true');
  }
  if (!('approvals' in record)) return;
  if (!isRecord(record.approvals)) throw new Error('destructive-policy approvals must be a JSON object');
  for (const [key, value] of Object.entries(record.approvals)) {
    if (!(DESTRUCTIVE_APPROVAL_KEYS as readonly string[]).includes(key)) {
      throw new Error(`unknown destructive approval: ${key}`);
    }
    if (typeof value !== 'boolean') throw new Error(`destructive approval ${key} must be boolean`);
  }
}

function validateExtensions(record: Record<string, unknown>): void {
  assertOnlyKeys(record, EXTENSION_KEYS, 'extensions');
  if ('mode' in record && record.mode !== 'enable_all' && record.mode !== 'allowlist') {
    throw new Error('extensions mode must be enable_all or allowlist');
  }
  for (const key of ['disabledServers', 'enabledServers', 'disabledSkillRoots', 'extraSkillRoots'] as const) {
    if (!(key in record)) continue;
    const value = record[key];
    if (!Array.isArray(value) || value.some((entry) => typeof entry !== 'string' || entry.trim().length === 0)) {
      throw new Error(`extensions ${key} must be an array of non-empty strings`);
    }
  }
  if (!('extraMcpServers' in record)) return;
  if (!isRecord(record.extraMcpServers)) throw new Error('extensions extraMcpServers must be a JSON object');
  for (const [name, rawServer] of Object.entries(record.extraMcpServers)) {
    if (name.trim().length === 0 || !isRecord(rawServer)) {
      throw new Error('extensions extraMcpServers entries must be named JSON objects');
    }
    assertOnlyKeys(rawServer, EXTENSION_SERVER_KEYS, `extensions extraMcpServers.${name}`);
    if (typeof rawServer.command !== 'string' || rawServer.command.trim().length === 0) {
      throw new Error(`extensions extraMcpServers.${name}.command must be a non-empty string`);
    }
    if ('args' in rawServer && (!Array.isArray(rawServer.args) || rawServer.args.some((entry) => typeof entry !== 'string'))) {
      throw new Error(`extensions extraMcpServers.${name}.args must be an array of strings`);
    }
    if ('env' in rawServer) {
      if (!isRecord(rawServer.env)
        || Object.values(rawServer.env).some((entry) => typeof entry !== 'string')) {
        throw new Error(`extensions extraMcpServers.${name}.env values must be strings`);
      }
    }
    for (const key of ['cwd', 'type'] as const) {
      if (key in rawServer && typeof rawServer[key] !== 'string') {
        throw new Error(`extensions extraMcpServers.${name}.${key} must be a string`);
      }
    }
  }
}

function assertOnlyKeys(record: Record<string, unknown>, allowed: readonly string[], label: string): void {
  for (const key of Object.keys(record)) {
    if (!allowed.includes(key)) throw new Error(`unknown ${label} setting: ${key}`);
  }
}

function redactExtensions(settings: ExtensionsSettings): ExtensionsSettings {
  return {
    ...settings,
    extraMcpServers: Object.fromEntries(Object.entries(settings.extraMcpServers).map(([name, server]) => [name, {
      ...server,
      ...(server.env === undefined ? {} : {
        env: Object.fromEntries(Object.keys(server.env).map((key) => [key, '[REDACTED]'])),
      }),
    }])),
  };
}

function withSettings<T>(dataPath: string, operation: (settings: SqliteSettingsRepository) => T): T {
  const resolved = path.resolve(dataPath);
  mkdirSync(resolved, { recursive: true });
  const database = new SqliteDatabase(path.join(resolved, 'lnwjud.sqlite'), { backupDirectory: path.join(resolved, 'backups') });
  try {
    return operation(new SqliteSettingsRepository(database));
  } finally {
    database.close();
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
