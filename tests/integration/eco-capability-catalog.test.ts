import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = path.resolve(import.meta.dirname, '..', '..');

const representativeFamilies = {
  shell: ['shell'],
  browser: ['dom_cdp'],
  windows: ['accessibility', 'input_event', 'vision', 'vision_annotated_capture', 'ui_target_action', 'window', 'clipboard', 'file_dialog'],
  system: ['health', 'system_info', 'notification', 'web_fetch', 'scheduler'],
  media: ['audio', 'screen_record'],
  office: ['office'],
  wsl: ['wsl_exec', 'wsl_fs'],
} as const;

function registeredToolNames(source: string): Set<string> {
  return new Set([...source.matchAll(/name:\s*'([^']+)'/g)].map((match) => match[1]));
}

describe('ECO capability-family parity', () => {
  it('guards representative capability families in the shared upstream-compatible registry', async () => {
    const capabilitySource = await readFile(path.join(root, 'packages', 'mcp-server', 'src', 'tools', 'capability-tools.ts'), 'utf8');
    const names = registeredToolNames(capabilitySource);

    for (const [family, tools] of Object.entries(representativeFamilies)) {
      expect(tools.length, family).toBeGreaterThan(0);
      for (const tool of tools) expect(names.has(tool), `${family}:${tool}`).toBe(true);
    }
  });

  it('requires parity classifications for every runtime capability category', async () => {
    const inventory = JSON.parse(
      await readFile(path.join(root, 'docs', 'eco-headless-parity.json'), 'utf8'),
    ) as { categories: Array<{ id: string; classification: string; evidence: string[]; tests: string[] }> };

    const categoryIds = new Set(inventory.categories.map((entry) => entry.id));
    for (const required of [
      'browser-cdp',
      'windows-native-accessibility-input-vision',
      'wsl',
      'office-document-workbook',
      'system-event-log-scheduler-web-fetch',
      'extensions-skills-child-mcp',
      'codex-delegation',
    ]) {
      expect(categoryIds.has(required), required).toBe(true);
    }

    for (const category of inventory.categories) {
      expect(category.evidence.length, category.id).toBeGreaterThan(0);
      expect(category.tests.length, category.id).toBeGreaterThan(0);
    }
  });
});
