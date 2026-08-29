import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const repositoryRoot = path.resolve(import.meta.dirname, '..', '..', '..');

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

const approvedClassifications = new Set([
  'shared',
  'headless-adapter',
  'ui-replaced',
  'optional-dependency',
  'blocked',
]);

interface ParityCategory {
  id: string;
  classification: string;
  evidence: string[];
  tests: string[];
}

interface ParityInventory {
  schemaVersion: number;
  upstream: { repository: string; ref: string; commit: string; version: string };
  ecoBase: { repository: string; commit: string; version: string };
  categories: ParityCategory[];
}

describe('ECO headless feature parity inventory', () => {
  it('records exact baseline metadata and every required runtime category', async () => {
    const inventory = JSON.parse(
      await readFile(path.join(repositoryRoot, 'docs', 'eco-headless-parity.json'), 'utf8'),
    ) as ParityInventory;

    expect(inventory.schemaVersion).toBe(1);
    expect(inventory.upstream.repository).toBe('engasnm111/lnwjud');
    expect(inventory.upstream.ref).toBe('main');
    expect(inventory.upstream.version).toBe('4.13.0');
    expect(inventory.upstream.commit).toMatch(/^[0-9a-f]{40}$/);
    expect(inventory.ecoBase.repository).toBe('blackryui/Links');
    expect(inventory.ecoBase.version).toBe('4.13.0');
    expect(inventory.ecoBase.commit).toMatch(/^[0-9a-f]{40}$/);

    expect(inventory.categories.map((entry) => entry.id)).toEqual(requiredCategories);
    for (const category of inventory.categories) {
      expect(approvedClassifications.has(category.classification)).toBe(true);
      expect(category.classification).not.toBe('missing');
      expect(category.evidence.length).toBeGreaterThan(0);
      expect(category.tests.length).toBeGreaterThan(0);
    }
  });
});
