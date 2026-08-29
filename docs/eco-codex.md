# ECO with Codex

ECO Headless uses the same local stdio MCP entrypoint for Codex that OpenAI Secure MCP Tunnel uses for ChatGPT. There is no second Codex-specific MCP server and no duplicated ToolRegistry.

## Prerequisites

- Build ECO Headless so `dist\eco-headless\eco-mcp.cmd` exists.
- Choose one or more explicit Windows project roots.
- Install/authenticate the current Codex CLI normally. ECO does not read, copy, or manage Codex credential files.

## Register ECO as a local stdio MCP server

From a terminal with the current Codex CLI, register ECO using the documented stdio form:

```text
codex mcp add eco -- C:\path\to\Links\dist\eco-headless\eco-mcp.cmd --strict-roots --allowed-root C:\path\to\project --workspace C:\path\to\project --profile full
```

For multiple intentional roots, repeat `--allowed-root` before the selected primary `--workspace`:

```text
codex mcp add eco -- C:\path\to\Links\dist\eco-headless\eco-mcp.cmd --strict-roots --allowed-root C:\Work\ProjectA --allowed-root D:\Work\Shared --workspace C:\Work\ProjectA --profile full
```

The server registration is named `eco`; the command is the same `eco-mcp.cmd` generated for the ChatGPT Secure MCP Tunnel path.

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
args = ["--strict-roots", "--allowed-root", "C:\\path\\to\\project", "--workspace", "C:\\path\\to\\project", "--profile", "full"]
```

Prefer `codex mcp add` when available so the installed Codex version owns config serialization.

## Safety and parity

- ECO reuses the existing lnwjud CLI runtime and `packages/mcp-server` ToolRegistry.
- Strict roots are the default ECO deployment boundary.
- The `full` profile does not remove critical-file, destructive, recovery, or path protections.
- The optional `codex_*` delegation tools inside ECO are separate from Codex using ECO as an MCP client. They remain disabled unless the existing lnwjud runtime setting enables them.
- Never add Codex API tokens, ChatGPT tunnel Runtime API keys, or other credentials to the ECO MCP command or repository configuration.

## One runtime, two clients

```text
ChatGPT Web -> Secure MCP Tunnel -> eco-mcp stdio -> shared lnwjud runtime
Codex local ----------------------> eco-mcp stdio -> shared lnwjud runtime
```

Both clients terminate in the same application services, capability runtime, storage model, and ToolRegistry.
