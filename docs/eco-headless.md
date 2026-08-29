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

Build on Windows x64 with Node 24 and pnpm 10.15.0:

```text
corepack pnpm@10.15.0 build:eco
```

Expected distribution:

```text
dist\eco-headless\eco-mcp.cjs
dist\eco-headless\eco-mcp.cmd
dist\eco-headless\eco-node.exe
dist\eco-headless\runtime-tools\ripgrep\rg.exe
dist\eco-headless\windows-capability-bridge.ps1
dist\eco-headless\PACKAGE.json
```

The packaged runtime carries its own private Node 24 runtime and verified ripgrep, matching the operational requirements of the upstream packaged stdio runtime. A system Node or ripgrep installation is not required to run the packaged ECO MCP. The optional Windows OCR helper is included when its upstream build prerequisite is available.

No `lnwjud.exe` or Electron process is required to run ECO.

## Configure ChatGPT Secure MCP Tunnel

Create an OpenAI Secure MCP Tunnel in the intended OpenAI organization/workspace, then on the Windows machine run:

```text
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\setup-eco-headless.ps1 -TunnelId <your tunnel id> -AllowedRoot C:\path\to\project
```

For more than one intentionally permitted root:

```text
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\setup-eco-headless.ps1 -TunnelId <your tunnel id> -AllowedRoot C:\Work\ProjectA,D:\Work\Shared
```

When you intentionally want ChatGPT/ECO to expose the optional six `codex_*` delegation tools, add:

```text
-EnableCodexTools
```

This does not change lnwjud's saved default; it adds `--enable-codex-tools` to this ECO MCP profile only.

The setup script:

- requires existing explicit allowed roots;
- configures the tunnel profile `eco` for stdio command forwarding;
- launches `eco-mcp.cmd` with `--strict-roots` and repeated `--allowed-root` arguments;
- optionally adds the explicit Codex delegation flag;
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

The start script owns one ECO worker through a named mutex and a versioned owner record that also records the exact tunnel-client child PID, start identity and executable path. Orphan recovery or stop is allowed only when that child identity is proven; ambiguous/mismatched ownership fails closed rather than killing a process by name.

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

See `docs/eco-codex.md`. Codex uses the same `eco-mcp.cmd` stdio entrypoint; ECO does not have a separate Codex server. Codex acting as an MCP client is distinct from enabling the optional `codex_*` delegation tools.

## Security defaults

- strict allowed roots are required by ECO setup;
- unrestricted mode is not enabled by setup;
- the existing lnwjud permission/destructive policy remains active;
- critical-file, path, Git, recovery and checkpoint protections stay in the shared runtime;
- optional capabilities remain subject to their Windows/external-binary prerequisites;
- `codex_*` delegation remains opt-in; explicit ECO enable/disable flags override only the current MCP process catalog.

## State and headless configuration

ECO preserves the existing lnwjud-compatible local state model. `LNWJUD_DATA_PATH` may be used to select an explicit state directory; otherwise the shared runtime resolves its normal per-user data path. Existing SQLite, audit/activity, checkpoint, recovery, workspace-index, goals and background-task state remain shared with the CLI runtime.

The core launch path already exposes workspace roots, strict-root policy, permission profile and Codex delegation without Desktop. Additional runtime settings that upstream stores in SQLite (for example provider/time-out configuration) are being exposed through a separate ECO headless configuration surface rather than reintroducing Desktop Settings.

## Verification commands

```text
corepack pnpm@10.15.0 validate:eco:parity
corepack pnpm@10.15.0 build:eco
corepack pnpm@10.15.0 test:eco:packaging
corepack pnpm@10.15.0 test:eco:parity
```

Release parity additionally requires the ECO release gate and real Windows ChatGPT/Codex smoke evidence. A successful static/package check alone is not sufficient to claim feature-parity complete.
