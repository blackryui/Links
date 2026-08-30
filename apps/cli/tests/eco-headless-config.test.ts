import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  readEcoHeadlessConfig,
  resetEcoHeadlessConfigValue,
  setEcoHeadlessConfigValue,
} from '../src/runtime/headless-config.js';

const temporaryRoots: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

async function tempDataPath(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), 'eco-headless-config-'));
  temporaryRoots.push(root);
  return root;
}

describe('ECO headless shared configuration', () => {
  it('persists runtime boundaries and Codex delegation in the same lnwjud SQLite state', async () => {
    const dataPath = await tempDataPath();

    setEcoHeadlessConfigValue(dataPath, 'permission-profile', 'balanced');
    setEcoHeadlessConfigValue(dataPath, 'strict-roots', 'true');
    setEcoHeadlessConfigValue(dataPath, 'allowed-roots', 'C:\\Work;D:\\Shared;C:\\Work');
    setEcoHeadlessConfigValue(dataPath, 'codex-tools-enabled', 'true');
    setEcoHeadlessConfigValue(dataPath, 'destructive-policy', '{"approvals":{"delete_file":true}}');

    const config = readEcoHeadlessConfig(dataPath);
    expect(config['permission-profile']).toBe('balanced');
    expect(config['strict-roots']).toBe(true);
    expect(config['allowed-roots']).toEqual(['C:\\Work', 'D:\\Shared']);
    expect(config['codex-tools-enabled']).toBe(true);
    expect(config['destructive-policy']).toMatchObject({
      protectCriticalFiles: true,
      recoverableDelete: true,
      approvals: { delete_file: true },
    });
  });

  it('fails closed on unknown or safety-invalid configuration', async () => {
    const dataPath = await tempDataPath();

    expect(() => setEcoHeadlessConfigValue(dataPath, 'not-a-setting', 'x')).toThrow(/Unknown ECO headless config key/);
    expect(() => setEcoHeadlessConfigValue(dataPath, 'permission-profile', 'unsafe')).toThrow(/permission-profile/);
    expect(() => setEcoHeadlessConfigValue(dataPath, 'codex-tools-enabled', 'maybe')).toThrow(/boolean/);
    expect(() => setEcoHeadlessConfigValue(dataPath, 'destructive-policy', '{"protectCriticalFiles":false}')).toThrow(/protectCriticalFiles.*true/);
  });

  it('resets one shared setting without disturbing the remaining policy', async () => {
    const dataPath = await tempDataPath();
    setEcoHeadlessConfigValue(dataPath, 'permission-profile', 'safe');
    setEcoHeadlessConfigValue(dataPath, 'codex-tools-enabled', 'true');
    resetEcoHeadlessConfigValue(dataPath, 'codex-tools-enabled');

    const config = readEcoHeadlessConfig(dataPath);
    expect(config['permission-profile']).toBe('safe');
    expect(config['codex-tools-enabled']).toBeNull();
  });
});
