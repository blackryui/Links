# ECO ChatGPT Web Plugin Setup

ECO connects ChatGPT Web to the local Windows MCP runtime through **Secure MCP Tunnel**. The production path is headless and does not require lnwjud Desktop/Electron.

```text
ChatGPT Web -> Secure MCP Tunnel -> system Node 24 + eco-mcp.cjs -> upstream lnwjud stdio MCP runtime
```

Codex Desktop can use the same local stdio runtime separately, so both clients can share the upstream ToolRegistry, project boundaries, settings, audit, recovery, goals, tasks, and continuation state.

## 1. Build ECO Headless

Use Windows x64 with **system Node 24**:

```powershell
corepack pnpm@10.15.0 install --frozen-lockfile
corepack pnpm@10.15.0 build:eco
```

ECO builds `dist/eco-headless/eco-mcp.cjs` and `eco-config.cjs`. It does not create a custom ECO JavaScript runtime executable. Upstream/platform helper executables such as ripgrep or optional OCR remain separate capability dependencies.

## 2. Configure the tunnel

Run setup with your actual tunnel identifier and at least one project root:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\setup-eco-headless.ps1 `
  -TunnelId <your-tunnel-id> `
  -AllowedRoot C:\Projects\ProjectA
```

Setup validates system Node 24 and creates a direct stdio MCP command equivalent to:

```text
<absolute node.exe> <absolute eco-mcp.cjs> --strict-roots --allowed-root <root> --workspace <root>
```

The runtime API key is requested securely during setup and is not committed to the repository.

## 3. Start and inspect the tunnel

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\start-eco-tunnel.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\status-eco-tunnel.ps1
```

The ECO supervisor owns one verified tunnel worker/child lifecycle and does not use broad process-name termination.

## 4. Connect the ChatGPT MCP connector

Create or refresh the ChatGPT MCP connector using the Secure MCP Tunnel endpoint/control-plane information for the configured tunnel. Keep connector identifiers environment-specific; do not commit placeholder or private connector bindings to `.app.json`.

After the connector is created or changed, use **Refresh connector** in ChatGPT so the current `tools/list` surface is rediscovered from the runtime.

Tool counts are not an ECO constant. The catalog is generated from the synchronized upstream `ToolRegistry`, including upstream default, optional-dependency, feature-disabled, and Codex delegation behavior.

## 5. Smoke test

Start read-only:

1. list or identify the active workspace;
2. read the top-level project tree;
3. show Git status;
4. confirm a representative search/file tool works inside the allowed root;
5. if enabled and prerequisites exist, confirm representative browser/Windows/WSL/Office capabilities;
6. compare the same read-only project state from Codex Desktop when it is registered against the same ECO runtime.

Only then test writes under the intended permission profile.

## 6. Stop

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\stop-eco-tunnel.ps1
```

## Skills

The MCP foundation defines what the machine can do. User-specific workflow Skills define how work should be performed and are intentionally developed as a separate layer after MCP parity is verified.
