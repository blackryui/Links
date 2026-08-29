# ECO Headless with Codex

ECO exposes the same headless stdio MCP runtime to local Codex that ChatGPT reaches through OpenAI Secure MCP Tunnel. There is no separate Codex-specific ECO server and no Desktop/Electron host.

## Shared runtime

```text
ChatGPT -> Secure MCP Tunnel -> eco-mcp stdio -> shared ToolRegistry
Codex   ---------------------> eco-mcp stdio -> shared ToolRegistry
```

Both clients therefore use the same workspace registrations, strict allowed roots, permission profile, files/Git/process services, local capabilities, SQLite state, recovery, goals/tasks and optional `codex_*` delegation setting.

## Prerequisites

1. Build and configure ECO Headless first with `scripts/setup-eco-headless.ps1`.
2. Install/authenticate the Codex CLI normally. ECO does not read, copy or rewrite Codex credentials.
3. Confirm the configured ECO allowed roots are the projects Codex should be allowed to access.

## Register ECO

Run:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\setup-eco-codex.ps1
```

The script uses the official Codex MCP CLI shape:

```text
codex mcp add eco -- <COMMAND> <ARGS...>
```

On Windows, `<COMMAND>` is the ECO private `eco-node.exe`; the first argument is the shared `eco-mcp.cjs` bundle followed by `--strict-roots`, the configured permission profile, one `--allowed-root` per root, and the primary `--workspace`.

ECO does not edit `.codex/config.toml` directly. Codex owns its own MCP configuration schema through `codex mcp add/get/remove`.

## Inspect registration

```powershell
codex mcp get eco --json
```

To intentionally replace only the named ECO registration:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\setup-eco-codex.ps1 -Replace
```

This removes only the MCP server named `eco` before re-registering it. It does not alter unrelated Codex MCP servers.

## Codex smoke test

After registration, use Codex to perform a read-only project task through ECO, such as listing the configured workspace and reading project/Git context. Confirm that out-of-root paths remain denied.

Local Codex as an MCP client is separate from the optional `codex_*` delegation tools inside the lnwjud-compatible ToolRegistry. Those delegation tools remain disabled by default unless the shared runtime setting enables them.

## Security

- Keep explicit strict allowed roots.
- Do not point Codex to a second unrestricted ECO command.
- Do not expose Codex credential files to ECO.
- Keep destructive file/Git policy and critical-file protection shared with the runtime.
- Treat a missing/unauthenticated Codex installation as an unavailable optional integration rather than weakening ECO safety.
