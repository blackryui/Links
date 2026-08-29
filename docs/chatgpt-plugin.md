# ECO Headless ChatGPT Web Plugin Setup

ECO is the ChatGPT-facing identity for the latest compatible lnwjud Windows agent runtime, hosted as a headless stdio MCP process. ChatGPT reaches ECO through OpenAI Secure MCP Tunnel; no lnwjud Desktop, Electron host, public inbound MCP port, or loopback HTTP MCP server is required.

For full Windows operator setup, lifecycle, security details and Codex integration, see `docs/eco-headless.md`.

## Architecture

```text
ChatGPT Web
  -> ECO plugin metadata + shared routing skills
  -> OpenAI Secure MCP Tunnel
  -> tunnel-client.exe
  -> stdio
  -> eco-node.exe + eco-mcp.cjs
  -> shared apps/cli MCP runtime
  -> shared packages/mcp-server ToolRegistry
  -> configured Windows project roots and local capabilities
```

`eco-mcp.cmd` is only a convenience launcher. The generated Tunnel command uses the same direct private Node + MCP bundle process used by Codex.

The plugin does not copy tool schemas. Live MCP schemas and behavior come from the shared ToolRegistry.

## Prerequisites

- Windows 10/11 x64.
- ECO Headless distribution built/configured with `scripts/setup-eco-headless.ps1`.
- At least one explicit strict allowed project root.
- An OpenAI Secure MCP Tunnel associated with the ChatGPT workspace that will use ECO.
- A locally stored tunnel runtime API key. Never commit the key or paste it into documentation.
- A ChatGPT workspace/plan with the custom-app/developer capabilities required for the intended read/write actions.

## 1. Configure ECO Headless

Build from source when needed:

```powershell
corepack pnpm@10.15.0 build:eco
```

Configure the real tunnel and project root:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\setup-eco-headless.ps1 `
  -TunnelId tunnel_your_real_id `
  -AllowedRoot 'C:\Work\your-project' `
  -PermissionProfile full
```

Setup prompts for the runtime API key using a secure PowerShell prompt and stores only its Windows-DPAPI encrypted representation outside the repository.

The generated stdio MCP command launches `eco-node.exe eco-mcp.cjs` directly and includes `--strict-roots`, `--trusted-host-approval`, explicit `--allowed-root` values and the selected primary `--workspace`.

`--trusted-host-approval` does not bypass shared safety. It is an explicit adapter for the ChatGPT host-approval layer that replaces the old Desktop dialog. The ToolRegistry still requires any tool-level `userConfirmed` marker plus the permission profile, Active Project/strict-root boundary, path/secret guards and destructive policy before the provider is reached. Raw stdio without the flag remains fail-closed for operations that require the host provider.

## 2. Start ECO

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\start-eco-tunnel.ps1
```

Inspect state:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\status-eco-tunnel.ps1
```

Status should report the private Node and MCP bundle as present, the intended roots/profile, `Trusted host gate: True`, and the current tunnel process state. It never decrypts or prints the runtime key.

Stop only the ECO-owned tunnel process:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\stop-eco-tunnel.ps1
```

## 3. Create the ChatGPT ECO connection

In the ChatGPT workspace that owns or can access the associated Secure MCP Tunnel:

1. Enable Developer mode when the workspace requires it for a custom app.
2. Open Apps/Connections and create a custom app named **ECO**.
3. Choose **Tunnel** as the connection type.
4. Select the associated tunnel or enter the real tunnel ID when requested by the UI.
5. Scan/refresh tools, then create/save the app.
6. Configure app permissions so write/modify/important actions retain the confirmation behavior appropriate to the workspace and user.
7. Start with read-only project inspection.

If ChatGPT denies an action, do not weaken ECO local protections to compensate for that host-layer decision.

If ECO/lnwjud tool schemas change, use **Refresh connector** (or the current equivalent refresh action) and start a new conversation if the old chat retains stale tool metadata.

## 4. Load the plugin package

The package entrypoint is `.codex-plugin/plugin.json`:

- machine name: `eco`
- display name: `ECO`
- capabilities: `Interactive`, `Read`, `Write`
- routing skills: six internal `lnwjud-*` compatibility skill directories

The internal skill names remain stable intentionally so ECO follows the shared runtime instead of maintaining a forked schema layer.

The public repository must not contain a guessed `.app.json`. Add a binding only after ChatGPT supplies a real app/connector identifier and only when that identifier is appropriate to store.

## 5. Read-only smoke test

```text
Use ECO to list available workspaces, report Git status for the configured project, and summarize the top-level tree. Do not modify anything.
```

Expected path:

```text
ChatGPT -> ECO -> Secure MCP Tunnel -> stdio -> eco-node + eco-mcp -> shared ToolRegistry -> project
```

## 6. Controlled write smoke test

After the read-only path succeeds:

```text
Use ECO to make one exact text edit inside the configured project, verify the result, and show the Git diff. Do not modify anything outside the configured roots.
```

A write must still satisfy the effective host permission, permission profile, strict-root/Active Project workspace set, secret/path and tool-specific safety rules.

For a destructive acceptance test, use only a disposable file. The unconfirmed call must be denied. After the exact host action is deliberately confirmed, the call may use the tool's explicit `userConfirmed:true` contract and still must pass every local policy check.

## 7. Codex uses the same runtime

Register the same ECO bundle with local Codex:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\setup-eco-codex.ps1
```

The script delegates Codex configuration to the official `codex mcp` CLI and does not edit `.codex/config.toml` directly. Its generated runtime command uses the same `eco-node.exe`, `eco-mcp.cjs`, strict roots and explicit trusted-host adapter as the ChatGPT Tunnel path.

Both paths share one runtime:

```text
ChatGPT -> Secure MCP Tunnel -> ECO stdio MCP
Codex local -----------------> ECO stdio MCP
```

## Feature parity

ECO follows the current lnwjud runtime baseline recorded in `docs/eco-headless-parity.json`. The shared ToolRegistry is authoritative. For the current v4.13.0 baseline, the catalog advertises 221 tools by default and six `codex_*` tools remain optional; future ECO versions follow upstream registry changes rather than freezing those counts.

Release parity includes project/workspace behavior, files/checkpoints/recovery, Git/process, browser, Windows, WSL, Office, system capabilities, extensions/child MCP, SQLite/audit/backup state, goals/tasks/continuations, Codex, tunnel lifecycle and destructive-policy semantics.

## Security boundaries

```text
ChatGPT app/workspace permissions and approval
AND explicit trusted-host adapter for the configured Tunnel command
AND Secure MCP Tunnel availability
AND ECO/lnwjud permission profile
AND explicit strict allowed roots / Active Project workspace set
AND tool-level confirmation/destructive policy
AND path/secret/critical-file protection
```

ECO must not route around a denial by substituting a less-safe shell/UI/browser path.

## Troubleshooting

- **Tunnel offline:** run `status-eco-tunnel.ps1`, inspect `%APPDATA%\tunnel-client\eco-tunnel.log`, then run setup/doctor again if configuration is invalid.
- **Runtime key missing:** re-run `setup-eco-headless.ps1`; do not store the plaintext key in Git.
- **Project denied:** review the explicit allowed roots and permission profile.
- **Destructive action returns `PERMISSION_REQUIRED`:** provide the tool's explicit confirmation only after deliberate host/user approval.
- **Destructive action returns `HOST_APPROVAL_REQUIRED`:** verify the ECO connection was created by the setup flow and status reports the trusted host gate; do not add the flag to an arbitrary untrusted stdio client.
- **Old ChatGPT tool schema:** refresh the ECO connector/app and open a new chat if needed.
- **`codex_*` tools missing:** normal while optional local Codex delegation is disabled.
- **Local capability unavailable:** verify the shared capability prerequisite (Office, WSL, OCR helper, browser, etc.) rather than removing the capability family.

## Repository validation

```text
corepack pnpm@10.15.0 test:plugin
corepack pnpm@10.15.0 validate:plugin
corepack pnpm@10.15.0 validate:eco:parity
corepack pnpm@10.15.0 validate:eco:upstream
```

ECO must not be called feature-parity complete until the Windows ChatGPT and Codex acceptance smoke tests also pass without a Desktop/Electron process.
