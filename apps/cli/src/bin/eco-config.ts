import process from 'node:process';
import { resolveLnwjudDataPath } from '@lnwjud/shared';
import {
  ECO_HEADLESS_CONFIG_KEYS,
  readEcoHeadlessConfig,
  resetEcoHeadlessConfigValue,
  setEcoHeadlessConfigValue,
} from '../runtime/headless-config.js';

function usage(): string {
  return [
    'Usage:',
    '  eco-config show',
    '  eco-config get <key>',
    '  eco-config set <key> <value>',
    '  eco-config reset <key>',
    `Keys: ${ECO_HEADLESS_CONFIG_KEYS.join(', ')}`,
  ].join('\n');
}

function writeJson(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function isConfigKey(value: string): value is (typeof ECO_HEADLESS_CONFIG_KEYS)[number] {
  return (ECO_HEADLESS_CONFIG_KEYS as readonly string[]).includes(value);
}

function main(argv: readonly string[]): number {
  const dataPath = resolveLnwjudDataPath(process.env);
  const command = argv[2];

  if (command === 'show' && argv.length === 3) {
    writeJson({ dataPath, settings: readEcoHeadlessConfig(dataPath) });
    return 0;
  }

  if (command === 'get' && argv.length === 4) {
    const key = argv[3]!;
    if (!isConfigKey(key)) throw new Error(`Unknown ECO headless config key: ${key}`);
    const config = readEcoHeadlessConfig(dataPath);
    writeJson({ key, value: config[key] });
    return 0;
  }

  if (command === 'set' && argv.length === 5) {
    const key = argv[3]!;
    const value = argv[4]!;
    writeJson({ key, value: setEcoHeadlessConfigValue(dataPath, key, value) });
    return 0;
  }

  if (command === 'reset' && argv.length === 4) {
    const key = argv[3]!;
    resetEcoHeadlessConfigValue(dataPath, key);
    writeJson({ key, reset: true });
    return 0;
  }

  process.stderr.write(`${usage()}\n`);
  return 2;
}

try {
  process.exitCode = main(process.argv);
} catch (error: unknown) {
  process.stderr.write(`ECO config failed: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}
