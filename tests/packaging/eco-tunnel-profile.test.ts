import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { describe, expect, it } from 'vitest';

const root = path.resolve(import.meta.dirname, '..', '..');
const execFileAsync = promisify(execFile);

// Mirrors the quoting semantics used by openai/tunnel-client parseStdioCommandArgv:
// backslash escapes the following byte outside single quotes and inside double quotes.
function parseTunnelCommandArgv(raw: string): string[] {
  const input = raw.trim();
  const args: string[] = [];
  let current = '';
  let inSingle = false;
  let inDouble = false;
  let escaped = false;

  const push = () => {
    if (current.length > 0) {
      args.push(current);
      current = '';
    }
  };

  for (let i = 0; i < input.length; i += 1) {
    const ch = input[i];
    if (escaped) {
      current += ch;
      escaped = false;
      continue;
    }
    if (inSingle) {
      if (ch === "'") inSingle = false;
      else current += ch;
      continue;
    }
    if (inDouble) {
      if (ch === '\\') escaped = true;
      else if (ch === '"') inDouble = false;
      else current += ch;
      continue;
    }
    if (ch === '\\') escaped = true;
    else if (ch === "'") inSingle = true;
    else if (ch === '"') inDouble = true;
    else if (/\s/.test(ch)) push();
    else current += ch;
  }
  push();
  return args;
}

describe('ECO Secure MCP Tunnel stdio profile', () => {
  it('configures tunnel-client to spawn the packaged private Node executable directly', async () => {
    const setup = await readFile(path.join(root, 'scripts', 'setup-eco-headless.ps1'), 'utf8');
    const common = await readFile(path.join(root, 'scripts', 'lib', 'eco-headless-common.ps1'), 'utf8');
    const runtimePackage = await readFile(path.join(root, 'scripts', 'lib', 'eco-runtime-package.ps1'), 'utf8');

    expect(setup).toContain('sample_mcp_stdio_local');
    expect(setup).toContain("'--profile'");
    expect(setup).toContain("'eco'");
    expect(setup).toContain("'--mcp-command'");
    expect(setup).toContain('Resolve-EcoRuntimePackage');
    expect(setup).toContain('New-EcoDirectMcpCommand');
    expect(setup).toContain('doctor');
    expect(setup).not.toContain('--mcp-server-url');
    expect(setup).not.toContain('server_urls');
    expect(setup).not.toContain('lnwjud.exe');
    expect(setup).not.toContain('electron');
    expect(setup).not.toContain('CONTROL_PLANE_API_KEY=');

    expect(runtimePackage).toContain('Resolve-EcoRuntimePackage');
    expect(runtimePackage).toContain('eco-node.exe');
    expect(runtimePackage).toContain('eco-mcp.cjs');
    expect(runtimePackage).toContain("'--strict-roots'");
    expect(runtimePackage).toContain("'--allowed-root'");
    expect(runtimePackage).toContain("'--workspace'");
    expect(runtimePackage).toContain("'--enable-codex-tools'");
    expect(runtimePackage).toContain('runtime-tools\\ripgrep\\rg.exe');
    expect(runtimePackage).not.toContain('eco-mcp.cmd');

    expect(common).not.toContain("$parts += '--profile'");
    expect(common).toContain('eco.runtime.secret');
    expect(common).toContain('eco-tunnel.log');
    expect(common).toContain('eco.tunnel.owner.json');
  });

  it('round-trips Windows paths through tunnel-client command parsing semantics', async () => {
    if (process.platform !== 'win32') return;

    const commonPath = path.join(root, 'scripts', 'lib', 'eco-headless-common.ps1').replaceAll("'", "''");
    const runtimePackagePath = path.join(root, 'scripts', 'lib', 'eco-runtime-package.ps1').replaceAll("'", "''");
    const nodePath = 'C:\\Users\\eco bu\\ECO\\dist\\eco-headless\\eco-node.exe';
    const scriptPath = 'C:\\Users\\eco bu\\ECO\\dist\\eco-headless\\eco-mcp.cjs';
    const allowedRoot = 'C:\\Users\\eco bu\\ECO';
    const ps = [
      `. '${commonPath}'`,
      `. '${runtimePackagePath}'`,
      `$runtimePackage = [pscustomobject]@{ nodePath = '${nodePath}'; scriptPath = '${scriptPath}' }`,
      `$command = New-EcoDirectMcpCommand -RuntimePackage $runtimePackage -AllowedRoots @('${allowedRoot}')`,
      '[Console]::Out.Write($command)',
    ].join('; ');

    const { stdout } = await execFileAsync('powershell.exe', ['-NoProfile', '-Command', ps]);
    const args = parseTunnelCommandArgv(stdout);

    expect(args).toEqual([
      nodePath,
      scriptPath,
      '--strict-roots',
      '--allowed-root',
      allowedRoot,
      '--workspace',
      allowedRoot,
    ]);
  });

  it('persists the encrypted runtime key without newline corruption and accepts legacy trailing whitespace', async () => {
    const setup = await readFile(path.join(root, 'scripts', 'setup-eco-headless.ps1'), 'utf8');

    expect(setup).toContain('[IO.File]::WriteAllText');
    expect(setup).toContain('[Text.UTF8Encoding]::new($false)');
    expect(setup).toContain("(Get-Content -LiteralPath $secretPath -Raw).Trim()");
    expect(setup).not.toContain('ConvertFrom-SecureString | Set-Content');
  });

  it('trims a legacy encrypted runtime key before background startup decrypts it', async () => {
    const start = await readFile(path.join(root, 'scripts', 'start-eco-tunnel.ps1'), 'utf8');

    expect(start).toContain("(Get-Content -LiteralPath $secretPath -Raw).Trim()");
  });
});
