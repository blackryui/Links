import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = path.resolve(import.meta.dirname, '..', '..');
const capabilityToolsPath = path.join(root, 'packages', 'mcp-server', 'src', 'tools', 'capability-tools.ts');

const classifiedCapabilityTools = {
  'shell-process': ['shell'],
  'browser-cdp': ['dom_cdp'],
  'windows-native-accessibility-input-vision': [
    'accessibility',
    'input_event',
    'vision',
    'vision_annotated_capture',
    'ui_target_action',
    'window',
    'health',
    'system_info',
    'notification',
    'file_dialog',
    'clipboard',
    'audio',
    'screen_record',
  ],
  'office-document-workbook': ['office'],
  'system-scheduler-web-fetch': ['web_fetch', 'scheduler'],
  wsl: ['wsl_exec', 'wsl_fs'],
} as const;

describe('ECO capability parity catalog', () => {
  it('classifies every current capability tool so upstream additions cannot be silently dropped', async () => {
    const source = await readFile(capabilityToolsPath, 'utf8');
    const discovered = [...source.matchAll(/defineTool\(\{\s*name:\s*'([^']+)'/g)].map((match) => match[1]!).sort();
    const classified = Object.values(classifiedCapabilityTools).flat().sort();

    expect(discovered.length).toBeGreaterThan(0);
    expect(classified).toEqual(discovered);
  });

  it('keeps representative runtime implementations for every headless capability family', async () => {
    const requiredEvidence = [
      'packages/capabilities/src/shell-backend.ts',
      'packages/capabilities/src/browser-cdp-backend.ts',
      'packages/capabilities/src/windows-native-backend.ts',
      'packages/capabilities/src/windows-ocr-backend.ts',
      'packages/capabilities/src/wsl-backend.ts',
      'packages/capabilities/src/event-log-backend.ts',
      'packages/capabilities/src/scheduler-backend.ts',
      'packages/capabilities/src/web-fetch-backend.ts',
      'packages/mcp-server/src/document-runtime.ts',
      'packages/mcp-server/src/lsp-runtime.ts',
      'packages/extensions/src/extensions-service.ts',
      'packages/mcp-server/src/tools/mcp-bridge-tools.ts',
    ];
    await Promise.all(requiredEvidence.map((relative) => access(path.join(root, relative))));

    const runtime = await readFile(path.join(root, 'apps', 'cli', 'src', 'runtime', 'stdio-mcp-runtime.ts'), 'utf8');
    for (const backend of [
      'BrowserCdpBackend',
      'PowerShellWindowsCapabilityBridge',
      'WindowsNativeCapabilityBackend',
      'WindowsOcrCapabilityBackend',
      'WslCapabilityBackend',
      'WslFilesystemCapabilityBackend',
      'WebFetchCapabilityBackend',
      'SchedulerCapabilityBackend',
    ]) {
      expect(runtime).toContain(backend);
    }
    expect(runtime).toContain("office: new WindowsNativeCapabilityBackend('office'");
  });

  it('preserves child MCP bridge discovery/call tools in the shared registry layer', async () => {
    const bridge = await readFile(path.join(root, 'packages', 'mcp-server', 'src', 'tools', 'mcp-bridge-tools.ts'), 'utf8');
    for (const tool of ['mcp_list', 'mcp_describe', 'mcp_call']) {
      expect(bridge).toContain(`name: '${tool}'`);
    }
  });
});
