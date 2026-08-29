import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const repositoryRoot = path.resolve(import.meta.dirname, '..', '..', '..');
const inventoryPath = path.join(repositoryRoot, 'docs', 'eco-headless-parity.json');

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
] as const;

const allowedClassifications = new Set([
  'shared',
  'headless-adapter',
  'ui-replaced',
  'optional-dependency',
  'blocked',
]);

interface ParityCategory {
  id?: unknown;
  classification?: unknown;
  evidence?: unknown;
  tests?: unknown;
}

interface ParityInventory {
  schemaVersion?: unknown;
  upstream?: { repository?: unknown; ref?: unknown; commit?: unknown; version?: unknown };
  ecoBase?: { repository?: unknown; commit?: unknown; version?: unknown };
  categories?: ParityCategory[];
}

function isSha(value: unknown): value is string {
  return typeof value === 'string' && /^[a-f0-9]{40}$/i.test(value);
}

describe('ECO headless feature-parity inventory', () => {
  it('records the exact upstream and ECO baseline', async () => {
    await expect(access(inventoryPath)).resolves.toBeUndefined();
    const inventory = JSON.parse(await readFile(inventoryPath, 'utf8')) as ParityInventory;

    expect(inventory.schemaVersion).toBe(1);
    expect(inventory.upstream?.repository).toBe('engasnm111/lnwjud');
    expect(inventory.upstream?.ref).toBe('main');
    expect(isSha(inventory.upstream?.commit)).toBe(true);
    expect(inventory.upstream?.version).toBe('4.13.0');
    expect(inventory.ecoBase?.repository).toBe('blackryui/Links');
    expect(isSha(inventory.ecoBase?.commit)).toBe(true);
    expect(inventory.ecoBase?.version).toBe('4.13.0');
  });

  it('classifies every required runtime category with concrete evidence and tests', async () => {
    const inventory = JSON.parse(await readFile(inventoryPath, 'utf8')) as ParityInventory;
    const categories = inventory.categories ?? [];

    expect(categories.map((entry) => entry.id)).toEqual([...requiredCategories]);
    for (const category of categories) {
      expect(typeof category.id).toBe('string');
      expect(allowedClassifications.has(String(category.classification))).toBe(true);
      expect(Array.isArray(category.evidence)).toBe(true);
      expect((category.evidence as unknown[]).length).toBeGreaterThan(0);
      expect((category.evidence as unknown[]).every((item) => typeof item === 'string' && item.length > 0)).toBe(true);
      expect(Array.isArray(category.tests)).toBe(true);
      expect((category.tests as unknown[]).length).toBeGreaterThan(0);
      expect((category.tests as unknown[]).every((item) => typeof item === 'string' && item.length > 0)).toBe(true);
      expect(category.classification).not.toBe('missing');
    }
  });
});
