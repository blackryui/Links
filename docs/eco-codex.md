# ECO with Codex Desktop

Codex Desktop and ChatGPT Web are separate MCP clients of the same local ECO/lnwjud runtime.

```text
ChatGPT Web -> Secure MCP Tunnel -> system Node 24 + eco-mcp.cjs
                                                   |
Codex Desktop -------------------------------------+
                                                   v
                                         upstream lnwjud stdio MCP
                                         shared ToolRegistry + state
```

## Codex Desktop registration

Register the built MCP entrypoint as a stdio MCP server using the validated **system Node 24** executable followed by `dist/eco-headless/eco-mcp.cjs`. Supply the same project boundary arguments used for ChatGPT, including `--strict-roots`, one or more `--allowed-root` values, and the selected `--workspace`.

The exact Codex Desktop UI/config surface can change; the invariant is the command contract:

```text
<absolute system node.exe> <absolute eco-mcp.cjs> --strict-roots --allowed-root <root> --workspace <root>
```

Do not point Codex Desktop at a second cloned MCP implementation and do not launch the lnwjud Desktop/Electron MCP host for ECO.

## Shared state

ECO uses the upstream lnwjud data path and `lnwjud.sqlite`. ChatGPT Tunnel and Codex Desktop therefore share workspace registrations, permission settings, audit/recovery/task state, and the stored `codex-tools-enabled` policy unless an upstream-supported per-process override is intentionally used.

## Codex delegation tools

The `codex_*` tools are optional tools inside the lnwjud MCP catalog. They are separate from Codex Desktop acting as an MCP client.

To persist the upstream Codex delegation setting:

```powershell
.\dist\eco-headless\eco-config.cmd set codex-tools-enabled true
```

Or use `-EnableCodexTools` during `setup-eco-headless.ps1`. ECO does not add a private `--enable-codex-tools` bootstrap mode; the shared upstream setting remains the source of truth.

## Validation

Before treating the integration as complete, verify both client paths against the same project and data path:

1. ChatGPT Web can reach the project through Secure MCP Tunnel.
2. Codex Desktop can list and call tools through the same stdio runtime.
3. A read-only state check returns consistent workspace/Git information from both clients.
4. Available browser/Windows/WSL/Office capabilities follow upstream prerequisite checks.
5. No lnwjud Desktop/Electron MCP host is required.

User/domain Skills should be developed only after this shared MCP foundation passes.
