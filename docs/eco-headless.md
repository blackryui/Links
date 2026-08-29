# ECO Headless on Windows

ECO Headless runs the current lnwjud v4.13.0 agent runtime as a local stdio MCP server for ChatGPT and Codex without requiring lnwjud Desktop or Electron.

## Runtime path

```text
ChatGPT Web -> OpenAI Secure MCP Tunnel -> tunnel-client -> eco-mcp stdio
Codex local -----------------------------------------------> eco-mcp stdio
                                                            -> shared lnwjud CLI runtime
                                                            -> shared MCP ToolRegistry
```

## Build

From the repository root with Node 24 and pnpm 10.15.0 available:

```text
corepack pnpm@10.15.0 build:eco
```

Expected distribution:

```text
dist\eco-headless\eco-mcp.cjs
dist\eco-headless\eco-mcp.cmd
dist\eco-headless\PACKAGE.json
```

No Desktop/Electron process is required to run these artifacts.

## Configure ChatGPT Secure MCP Tunnel

Create an OpenAI Secure MCP Tunnel in the intended OpenAI organization/workspace, then on the Windows machine run:

```text
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\setup-eco-headless.ps1 -TunnelId <your tunnel id> -AllowedRoot C:\path\to\project
```

For more than one intentionally permitted root:

```text
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\setup-eco-headless.ps1 -TunnelId <your tunnel id> -AllowedRoot C:\Work\ProjectA,D:\Work\Shared
```

The setup script:

- requires existing explicit allowed roots;
- configures the tunnel profile `eco` for stdio command forwarding;
- launches `eco-mcp.cmd` with `--strict-roots` and repeated `--allowed-root` arguments;
- stores the Runtime API key locally using Windows user-protected secure-string storage;
- runs `tunnel-client doctor` before reporting the setup usable;
- never requires `lnwjud.exe`.

Do not put the Runtime API key in Git, chat messages, command-line arguments, or documentation.

## Lifecycle

Start in the background:

```text
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\start-eco-tunnel.ps1
```

Status:

```text
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\status-eco-tunnel.ps1
```

Stop:

```text
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\stop-eco-tunnel.ps1
```

The start script owns one ECO worker through a named mutex and owner record. Stop targets that owner through a stop marker; it does not broadly terminate other tunnel-client processes.

## ChatGPT connection

In a ChatGPT workspace that supports the required developer/custom-app capability:

1. Open Apps / Plugins / Connections.
2. Create a developer-mode app using **Tunnel**.
3. Select the OpenAI tunnel configured for this Windows host.
4. Name the connection **ECO**.
5. Scan/refresh tools after an ECO or lnwjud runtime upgrade.
6. Start with a read-only smoke request.

Example:

```text
Use ECO to list registered workspaces, inspect Git status, and summarize the active project tree. Do not modify anything.
```

After that succeeds, verify one exact controlled edit in a version-controlled project and inspect the Git diff.

## Codex

See `docs/eco-codex.md`. Codex uses the same `eco-mcp.cmd` stdio entrypoint; ECO does not have a separate Codex server.

## Security defaults

- strict allowed roots are required by ECO setup;
- unrestricted mode is not enabled by setup;
- the existing lnwjud permission/destructive policy remains active;
- critical-file, path, Git, recovery and checkpoint protections stay in the shared runtime;
- optional capabilities remain subject to their Windows/external-binary prerequisites;
- `codex_*` delegation remains opt-in according to the shared runtime setting.

## State

ECO preserves the existing lnwjud-compatible local state model. `LNWJUD_DATA_PATH` may be used to select an explicit state directory; otherwise the shared runtime resolves its normal per-user data path. Existing SQLite, audit/activity, checkpoint, recovery, workspace-index, goals and background-task state remain shared with the CLI runtime.

## Verification commands

```text
corepack pnpm@10.15.0 validate:eco:parity
corepack pnpm@10.15.0 build:eco
corepack pnpm@10.15.0 test:eco:packaging
corepack pnpm@10.15.0 test:eco:parity
```

Release parity additionally requires the ECO release gate and real Windows ChatGPT/Codex smoke evidence. A successful static/package check alone is not sufficient to claim feature-parity complete.
