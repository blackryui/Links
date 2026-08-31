# ECO Headless

ECO Headless is the Windows MCP adapter for using the latest upstream-derived lnwjud runtime without launching the lnwjud Desktop/Electron application.

## Runtime path

```text
ChatGPT Web -> Secure MCP Tunnel -> system Node 24 + eco-mcp.cjs -> upstream lnwjud stdio MCP runtime
Codex Desktop -----------------------------------------------------> same MCP runtime
```

`eco-mcp.cjs` is a thin wrapper. It prepares packaged helper paths such as ripgrep and then delegates to the current upstream `apps/cli/src/bin/mcp-stdio.ts` runtime. ECO does not maintain a second ToolRegistry or a second copy of MCP schemas.

ECO does not ship a custom JavaScript runtime executable. The host is a validated **system Node 24** installation. Native/platform dependencies such as `rg.exe`, optional OCR helpers, `tunnel-client`, PowerShell, WSL, or Codex remain normal prerequisites where the upstream capability requires them.

## Build

From the repository root on Windows x64 with Node 24 and pnpm 10.15.0:

```powershell
corepack pnpm@10.15.0 install --frozen-lockfile
corepack pnpm@10.15.0 build:eco
```

The output is `dist/eco-headless/` and includes:

- `eco-mcp.cjs` — production stdio MCP entrypoint;
- `eco-config.cjs` — shared-state configuration CLI;
- optional convenience `.cmd` launchers;
- `runtime-tools/ripgrep/`;
- the Windows capability bridge and optional native OCR helper;
- `PACKAGE.json` metadata declaring system Node as the host.

## Security boundary

ECO setup requires one or more explicit allowed roots and generates the tunnel MCP command with `--strict-roots`, `--allowed-root`, and an initial `--workspace`. The same boundary is also persisted in the shared lnwjud SQLite settings so ChatGPT and Codex Desktop can converge on the same policy and state.

Do not enable unrestricted/full-bypass behavior as part of ordinary ECO setup. Destructive operations remain governed by the upstream permission and destructive-policy implementation.

## Configuration

After the package is built, `eco-config.cmd` or `node eco-config.cjs` exposes only runtime-relevant shared settings:

```powershell
.\dist\eco-headless\eco-config.cmd show
.\dist\eco-headless\eco-config.cmd set permission-profile balanced
.\dist\eco-headless\eco-config.cmd set codex-tools-enabled true
.\dist\eco-headless\eco-config.cmd reset codex-tools-enabled
```

The configuration is stored in the normal lnwjud data path and `lnwjud.sqlite`; it is not a separate ECO database.

## Tunnel lifecycle

Configure once:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\setup-eco-headless.ps1 `
  -TunnelId <your-tunnel-id> `
  -AllowedRoot C:\Projects\ProjectA
```

Start, inspect, and stop:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\start-eco-tunnel.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\status-eco-tunnel.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\stop-eco-tunnel.ps1
```

The supervisor records process identity and stops only its verified `tunnel-client` child. It does not use broad process-name kills.

## Tool parity

The live upstream `ToolRegistry.listAll()` / `list()` behavior is the parity oracle. ECO does not hard-code a permanent tool count. `corepack pnpm@10.15.0 docs:tools:check` validates that the generated catalog remains synchronized with the runtime.

## Skills boundary

The existing lnwjud routing skills remain available as upstream runtime guidance. User-specific workflow Skills are a separate layer and are added only after MCP parity is complete. They should compose MCP tools rather than modify or duplicate MCP core implementations.
