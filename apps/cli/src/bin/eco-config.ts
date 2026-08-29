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

function main(argv: readonly string[]): number {
  const dataPath = resolveLnwjudDataPath(process.env);
  const command = argv[2];

  if (command === 'show' && argv.length === 3) {
    writeJson({ dataPath, settings: readEcoHeadlessConfig(dataPath) });
    return 0;
  }

  if (command === 'get' && argv.length === 4) {
    const key = argv[3]!;
    const config = readEcoHeadlessConfig(dataPath);
    if (!ECO_HEADLESS_CONFIG_KEYS.includes(key as (typeof ECO_HEADLESS_CONFIG_KEYS)[number])) {
      throw new Error(`Unknown ECO headless config key: ${key}`);
    }
    writeJson({ key, value: config[key as keyof typeof config] });
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
