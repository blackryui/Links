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
      requireJsonObject(value, 'custom-permission');
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
      requireJsonObject(value, 'destructive-policy');
      return serializeDestructiveAutoApprovalPolicy(parseDestructiveAutoApprovalPolicy(value, false));
    },
    decode: (value) => value === null ? null : parseDestructiveAutoApprovalPolicy(value, false),
  },
  extensions: {
    storageKey: EXTENSIONS_SETTINGS_KEY,
    encode: (value) => {
      requireJsonObject(value, 'extensions');
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
    encode: (value) => {
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
    encode: (value) => {
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
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error(`${label} must be a JSON object`);
  }
  return parsed as Record<string, unknown>;
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
