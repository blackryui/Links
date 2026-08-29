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

describe('ECO headless runtime configuration', () => {
  it('persists only allowlisted runtime-relevant settings in the shared lnwjud SQLite state', async () => {
    const dataPath = await tempDataPath();

    setEcoHeadlessConfigValue(dataPath, 'permission-profile', 'balanced');
    setEcoHeadlessConfigValue(dataPath, 'strict-roots', 'true');
    setEcoHeadlessConfigValue(dataPath, 'allowed-roots', 'C:\\Work;D:\\Shared;C:\\Work');
    setEcoHeadlessConfigValue(dataPath, 'mcp-call-timeout-ms', '90000');
    setEcoHeadlessConfigValue(dataPath, 'mcp-idle-timeout-ms', '600000');
    setEcoHeadlessConfigValue(dataPath, 'process-timeout-ms', '7200000');
    setEcoHeadlessConfigValue(dataPath, 'mcp-poll-wait-seconds', '10');
    setEcoHeadlessConfigValue(dataPath, 'shell-synchronous-wait-seconds', '30');
    setEcoHeadlessConfigValue(dataPath, 'capability-roots', 'C:\\Work;D:\\Shared');
    setEcoHeadlessConfigValue(dataPath, 'pdf-provider-path', 'C:\\Tools\\pdf-provider.exe');
    setEcoHeadlessConfigValue(dataPath, 'lsp-commands', '{"typescript":"typescript-language-server --stdio"}');
    setEcoHeadlessConfigValue(dataPath, 'codex-tools-enabled', 'true');
    setEcoHeadlessConfigValue(dataPath, 'custom-permission', '{"read":"ALLOW","write":"ASK","execute":"ASK","dangerous":"DENY","allowedExecutables":["git"]}');
    setEcoHeadlessConfigValue(dataPath, 'destructive-policy', '{"approvals":{"delete_file":true}}');
    setEcoHeadlessConfigValue(dataPath, 'extensions', '{"mode":"enable_all","extraSkillRoots":["C:\\\\Skills"],"extraMcpServers":{"private":{"command":"tool.exe","env":{"TOKEN":"secret-value"}}}}');

    const config = readEcoHeadlessConfig(dataPath);
    expect(config['permission-profile']).toBe('balanced');
    expect(config['strict-roots']).toBe(true);
    expect(config['allowed-roots']).toEqual(['C:\\Work', 'D:\\Shared']);
    expect(config['mcp-call-timeout-ms']).toBe(90000);
    expect(config['mcp-idle-timeout-ms']).toBe(600000);
    expect(config['process-timeout-ms']).toBe(7200000);
    expect(config['mcp-poll-wait-seconds']).toBe(10);
    expect(config['shell-synchronous-wait-seconds']).toBe(30);
    expect(config['capability-roots']).toEqual(['C:\\Work', 'D:\\Shared']);
    expect(config['pdf-provider-path']).toBe('C:\\Tools\\pdf-provider.exe');
    expect(config['lsp-commands']).toEqual({ typescript: 'typescript-language-server --stdio' });
    expect(config['codex-tools-enabled']).toBe(true);
    expect(config['custom-permission']).toMatchObject({ read: 'ALLOW', write: 'ASK', execute: 'ASK', dangerous: 'DENY' });
    expect(config['destructive-policy']).toMatchObject({ protectCriticalFiles: true, recoverableDelete: true, approvals: { delete_file: true } });
    expect(config.extensions).toMatchObject({
      mode: 'enable_all',
      extraSkillRoots: ['C:\\Skills'],
      extraMcpServers: { private: { command: 'tool.exe', env: { TOKEN: '[REDACTED]' } } },
    });
  });

  it('rejects unknown, malformed, and out-of-range settings instead of silently falling back', async () => {
    const dataPath = await tempDataPath();
    expect(() => setEcoHeadlessConfigValue(dataPath, 'not-a-setting', 'x')).toThrow(/Unknown ECO headless config key/);
    expect(() => setEcoHeadlessConfigValue(dataPath, 'permission-profile', 'unsafe')).toThrow(/permission-profile/);
    expect(() => setEcoHeadlessConfigValue(dataPath, 'codex-tools-enabled', 'maybe')).toThrow(/boolean/);
    expect(() => setEcoHeadlessConfigValue(dataPath, 'mcp-poll-wait-seconds', '2')).toThrow(/5.*60/);
    expect(() => setEcoHeadlessConfigValue(dataPath, 'lsp-commands', '[]')).toThrow(/JSON object/);
    expect(() => setEcoHeadlessConfigValue(dataPath, 'extensions', '{broken')).toThrow(/valid JSON/);
  });

  it('resets one allowlisted setting without disturbing the rest', async () => {
    const dataPath = await tempDataPath();
    setEcoHeadlessConfigValue(dataPath, 'permission-profile', 'safe');
    setEcoHeadlessConfigValue(dataPath, 'codex-tools-enabled', 'true');
    resetEcoHeadlessConfigValue(dataPath, 'codex-tools-enabled');

    const config = readEcoHeadlessConfig(dataPath);
    expect(config['permission-profile']).toBe('safe');
    expect(config['codex-tools-enabled']).toBeNull();
  });
});
