# ECO ChatGPT Web Plugin Setup

ECO is the ChatGPT-facing identity for the current lnwjud-compatible Windows agent runtime. The primary ECO path is headless: ChatGPT reaches the local runtime through OpenAI Secure MCP Tunnel, and tunnel-client launches `eco-mcp` over stdio. lnwjud Desktop/Electron is not required.

## Architecture

```text
ChatGPT Web
  -> ECO plugin metadata + lnwjud routing skills
  -> OpenAI Secure MCP Tunnel
  -> tunnel-client
  -> eco-mcp stdio
  -> shared lnwjud CLI runtime
  -> shared packages/mcp-server ToolRegistry
  -> Windows / Files / Git / Shell / Browser / WSL / Office / Codex-capable tools
```

There is no public inbound MCP port and no Desktop loopback HTTP dependency in the primary ECO path.

## Prerequisites

- Windows 10/11 x64.
- Node 24 and the repository dependencies needed to build ECO, or a prepared ECO Headless distribution.
- At least one explicit project root that ChatGPT is allowed to access.
- An OpenAI Secure MCP Tunnel associated with the intended ChatGPT workspace/organization.
- A restricted Runtime API key for that tunnel, stored locally only.

Never commit Runtime API keys, tunnel credentials, connector credentials, Codex credentials, or other secrets.

## 1. Build ECO Headless

```text
corepack pnpm@10.15.0 build:eco
```

The runtime entrypoint is:

```text
dist\eco-headless\eco-mcp.cmd
```

It reuses the existing CLI runtime and ToolRegistry; ECO does not duplicate tool schemas.

## 2. Configure the Secure MCP Tunnel

Run the headless setup script with the real tunnel ID and explicit project root:

```text
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\setup-eco-headless.ps1 -TunnelId <your tunnel id> -AllowedRoot C:\path\to\project
```

The script configures the tunnel profile `eco` using the OpenAI stdio MCP sample, sets `eco-mcp.cmd` as the MCP command with `--strict-roots`, stores the Runtime API key with Windows user-protected local storage, and runs `tunnel-client doctor`.

Do not send the Runtime API key through ChatGPT or store it in the repository.

## 3. Start ECO in the background

```text
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\start-eco-tunnel.ps1
```

Check status with:

```text
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\status-eco-tunnel.ps1
```

Stop with:

```text
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\stop-eco-tunnel.ps1
```

No Desktop window, tray, renderer, or Electron process is required.

## 4. Create the ChatGPT connection as ECO

In the ChatGPT workspace that will use ECO:

1. Enable Developer mode when required for custom connections.
2. Open Apps / Plugins / Connections.
3. Create a developer-mode connection using **Tunnel**.
4. Select the Secure MCP Tunnel configured for the Windows host.
5. Use the connection name **ECO**.
6. Scan/refresh tools and confirm the shared lnwjud ToolRegistry is discoverable.

After runtime/tool schema changes, use **Refresh connector** and open a new chat if the old schema remains cached.

## 5. Verify read-only Project access

```text
Use ECO to list registered workspaces, report Git status for the active project, and summarize the top-level project tree. Do not modify anything.
```

The verified path should be:

```text
ChatGPT -> ECO -> Secure MCP Tunnel -> eco-mcp stdio -> shared lnwjud runtime -> local project
```

## 6. Verify one controlled write

After read-only access succeeds, use a version-controlled/disposable project. Ask ECO to make one exact guarded text change, run the narrow relevant verification, and show the Git diff.

The headless approval/safety stack is:

```text
ChatGPT app/workspace permissions
AND Secure MCP Tunnel availability
AND shared lnwjud permission profile
AND ECO strict allowed-root boundary
AND shared tool/destructive/recovery safety policy
```

Desktop-native approval dialogs are not part of the headless path. ECO must not route around a denial by substituting a less-safe tool.

## Tool parity

Tool catalog/count is derived from the current shared ToolRegistry, not hard-coded into ECO. Optional `codex_*` delegation follows the upstream lnwjud default and remains opt-in. The parity inventory is `docs/eco-headless-parity.json` and release validation rejects unresolved parity gaps.

## Plugin package lifecycle

The public package contains `.codex-plugin/plugin.json` and six internal `lnwjud-*` routing skills. Internal names stay lnwjud-compatible so the runtime is not forked.

A workspace-specific `.app.json` must be added only when a real verified connector/app ID exists and when the target package-loading flow requires it. Never commit a guessed connector ID.

## Codex

Codex local uses the same `eco-mcp.cmd` stdio command. See `docs/eco-codex.md`.

## Legacy Desktop path

Existing lnwjud Desktop scripts/code remain in the repository for upstream/backward compatibility, but they are not required by ECO Headless and are not the primary ECO deployment path.

## Repository validation

```text
corepack pnpm@10.15.0 test:plugin
corepack pnpm@10.15.0 validate:plugin
corepack pnpm@10.15.0 validate:eco:parity
corepack pnpm@10.15.0 build:eco
corepack pnpm@10.15.0 test:eco:packaging
```

Full feature-parity completion additionally requires the Windows release/parity gate plus real ChatGPT and Codex smoke tests with no Desktop/Electron process running.
