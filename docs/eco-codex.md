# ECO with Codex

ECO Headless uses the same local stdio MCP entrypoint for Codex that OpenAI Secure MCP Tunnel uses for ChatGPT. There is no second Codex-specific MCP server and no duplicated ToolRegistry.

## Two Codex roles

Codex can participate in ECO in two different ways:

1. **Codex as an MCP client** — Codex connects to `eco-mcp.cmd` and uses the same Project/runtime tools as ChatGPT. This does not require the optional `codex_*` tools.
2. **Codex as a delegated worker** — ChatGPT/ECO may call the six optional `codex_*` tools to delegate coding/review work to the locally installed Codex runtime. This remains opt-in, matching lnwjud's upstream default.

## Prerequisites

- Build ECO Headless so `dist\eco-headless\eco-mcp.cmd` exists.
- Choose one or more explicit Windows project roots.
- Install/authenticate the current Codex CLI normally. ECO does not read, copy, or manage Codex credential files.

The packaged ECO runtime is self-contained for Node and ripgrep: `eco-mcp.cmd` uses the bundled private Node 24 runtime and bundled verified `rg.exe`. A system Node/ripgrep installation is not required for the packaged ECO runtime.

## Register ECO as a local stdio MCP server

From a terminal with the current Codex CLI, register ECO using the documented stdio form:

```text
codex mcp add eco -- C:\path\to\Links\dist\eco-headless\eco-mcp.cmd --strict-roots --allowed-root C:\path\to\project --workspace C:\path\to\project
```

For multiple intentional roots, repeat `--allowed-root` before the selected primary `--workspace`:

```text
codex mcp add eco -- C:\path\to\Links\dist\eco-headless\eco-mcp.cmd --strict-roots --allowed-root C:\Work\ProjectA --allowed-root D:\Work\Shared --workspace C:\Work\ProjectA
```

The server registration is named `eco`; the command is the same `eco-mcp.cmd` generated for the ChatGPT Secure MCP Tunnel path.

By default this launch uses the stored ECO/lnwjud stdio permission profile; when none is stored, the shared runtime fallback remains `full`. To set the shared stored profile:

```text
dist\eco-headless\eco-config.cmd set permission-profile balanced
```

To override the stored profile for one Codex MCP process only, add `--profile safe|balanced|full|custom` to that registration command.

## Optional: expose `codex_*` delegation tools

When you intentionally want ECO/ChatGPT to delegate work back to local Codex, add:

```text
--enable-codex-tools
```

For example:

```text
codex mcp add eco -- C:\path\to\Links\dist\eco-headless\eco-mcp.cmd --strict-roots --allowed-root C:\path\to\project --workspace C:\path\to\project --enable-codex-tools
```

This is a process-level ECO override. It does not rewrite the saved lnwjud setting and does not change the upstream default. `--disable-codex-tools` is the explicit inverse; using both flags together is rejected.

The saved default can also be controlled headlessly:

```text
dist\eco-headless\eco-config.cmd set codex-tools-enabled true
```

For ChatGPT's Secure MCP Tunnel profile, the equivalent process override is:

```text
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\setup-eco-headless.ps1 -TunnelId <tunnel id> -AllowedRoot C:\path\to\project -EnableCodexTools
```

## Verify registration

Inspect the configured server rather than assuming registration succeeded:

```text
codex mcp get eco --json
```

The returned transport should be stdio and should preserve the ECO command plus strict-root arguments. `codex mcp list` can be used to confirm that `eco` is enabled in the current Codex configuration.

Then start a fresh Codex session in the intended project and use ECO for a read-only smoke first, for example: list the ECO workspaces, inspect Git status, and read one project file without making changes.

## Configuration equivalent

Codex stores MCP servers under `mcp_servers` in its configuration. A direct TOML form is conceptually:

```toml
[mcp_servers.eco]
command = "C:\\path\\to\\Links\\dist\\eco-headless\\eco-mcp.cmd"
args = ["--strict-roots", "--allowed-root", "C:\\path\\to\\project", "--workspace", "C:\\path\\to\\project"]
```

Prefer `codex mcp add` when available so the installed Codex version owns config serialization.

## Safety and parity

- ECO reuses the existing lnwjud CLI runtime and `packages/mcp-server` ToolRegistry.
- Strict roots are the default ECO deployment boundary.
- Permission profile selection does not remove critical-file, destructive, recovery, or path protections.
- `codex_*` delegation remains opt-in even though Codex itself can always be an ECO MCP client when registered.
- Never add Codex API tokens, ChatGPT tunnel Runtime API keys, or other credentials to the ECO MCP command or repository configuration.

## One runtime, two clients

```text
ChatGPT Web -> Secure MCP Tunnel -> eco-mcp stdio -> shared lnwjud runtime
Codex local ----------------------> eco-mcp stdio -> shared lnwjud runtime
```

Both clients terminate in the same application services, capability runtime, storage model, and ToolRegistry.
