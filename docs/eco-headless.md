# ECO Headless on Windows

ECO Headless runs the current compatible lnwjud Windows agent runtime as an MCP process for ChatGPT and Codex without requiring lnwjud Desktop, Electron, a tray process, or a public inbound MCP port.

## Architecture

```text
ChatGPT Web
  -> ECO custom app/plugin
  -> OpenAI Secure MCP Tunnel
  -> tunnel-client.exe
  -> stdio
  -> eco-node.exe + eco-mcp.cjs
  -> shared apps/cli headless bootstrap
  -> shared packages/mcp-server ToolRegistry

Codex local
  -> Codex MCP stdio
  -> eco-node.exe + eco-mcp.cjs
  -> the same shared bootstrap and ToolRegistry
```

`eco-mcp.cmd` is shipped only as a manual/convenience launcher. The generated ChatGPT Tunnel and Codex registrations both use the direct `eco-node.exe + eco-mcp.cjs` process path.

The user-facing product name is **ECO**. Internal `@lnwjud/*`, `LNWJUD_*`, SQLite and tool/skill compatibility names remain intentionally unchanged so ECO reuses the latest lnwjud runtime instead of forking it.

## Feature-parity rule

ECO is not a reduced CLI edition. The release baseline is the current `engasnm111/lnwjud` `main` runtime, recorded in `docs/eco-headless-parity.json` and checked again immediately before release.

The machine-readable parity inventory classifies MCP, project/workspace, files/recovery, Git, process, browser, Windows, WSL, Office, extensions, state, goals/tasks, Codex, tunnel lifecycle and security behavior. A release must not contain an unexplained missing or blocked runtime category.

For the current v4.13.0 baseline, the normal ToolRegistry advertises 221 tools and the six `codex_*` delegation tools remain optional for 227 configurable tools. ECO does not treat those numbers as permanent constants: future releases follow the current upstream ToolRegistry and `docs:tools:check` result.

## Requirements

- Windows 10/11 x64.
- An ECO/lnwjud source checkout when building locally, or a prepared ECO Headless distribution.
- Node.js 24.x and pnpm 10.15.0 for a source build. The generated distribution carries its own private Node 24 executable for runtime use.
- OpenAI `tunnel-client` available on PATH, via `ECO_TUNNEL_CLIENT_PATH`, or supplied to setup.
- A real OpenAI Secure MCP Tunnel ID associated with the intended Platform organization and ChatGPT workspace.
- A restricted OpenAI tunnel runtime API key. The setup script prompts for this value securely; do not place it in Git, command history or documentation.
- One or more explicit Windows project/workspace roots that ECO is allowed to use.
- Codex CLI only when local Codex MCP integration is desired.

## 1. Build ECO Headless

From the repository root on Windows with Node 24:

```powershell
corepack pnpm@10.15.0 install --frozen-lockfile
corepack pnpm@10.15.0 build:eco
```

The build produces:

```text
dist/eco-headless/
  eco-mcp.cjs
  eco-mcp.cmd
  eco-node.exe
  windows-capability-bridge.ps1
  PACKAGE.json
```

`eco-mcp.cjs` is bundled from `apps/cli/src/bin/mcp-stdio.ts`. It does not create a second ToolRegistry and does not require Electron. `eco-node.exe` is the private Node 24 runtime used directly by both ChatGPT Tunnel and Codex MCP.

## 2. Configure strict project roots and the Secure MCP Tunnel

Run setup with a real tunnel ID and explicit roots:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\setup-eco-headless.ps1 `
  -TunnelId tunnel_your_real_id `
  -AllowedRoot 'C:\Work\eco-system' `
  -PermissionProfile full
```

For multiple roots, pass an array from PowerShell:

```powershell
& .\scripts\setup-eco-headless.ps1 `
  -TunnelId tunnel_your_real_id `
  -AllowedRoot @('C:\Work\eco-system', 'D:\Projects') `
  -PermissionProfile full
```

Setup performs these operations:

1. Canonicalizes every allowed root and refuses a missing root.
2. Builds/resolves `eco-node.exe`, `eco-mcp.cjs` and the convenience launcher.
3. Prompts for the tunnel runtime API key with `Read-Host -AsSecureString`.
4. Stores only the DPAPI-encrypted key at `%APPDATA%\tunnel-client\eco.runtime.secret`.
5. Calls the official tunnel-client stdio flow using `sample_mcp_stdio_local`, profile `eco`, the real tunnel ID and the direct MCP command `eco-node.exe eco-mcp.cjs ...`.
6. The generated command includes `--strict-roots`, `--trusted-host-approval`, repeated `--allowed-root`, the selected primary `--workspace`, and the chosen lnwjud permission profile.
7. Runs `tunnel-client doctor`.
8. Saves only non-secret local lifecycle configuration to `%APPDATA%\tunnel-client\eco.headless.config.json`.

The primary ECO path does not create a loopback HTTP MCP server and does not use `server_urls`.

## 3. Trusted host approval: what it means

The lnwjud ToolRegistry has a second host-owned approval boundary for confirmed/destructive mutations. Desktop provided that boundary with a local dialog. ECO Headless replaces only that host adapter, not the rest of the safety model.

Generated ChatGPT/Codex registrations therefore include:

```text
--trusted-host-approval
```

With that flag, ECO trusts the configured ChatGPT/Codex host to perform its own interaction/approval policy before forwarding an action. The MCP server's final host-approval provider can then approve a tool call **only after the shared ToolRegistry has already required the tool-level confirmation and passed all other guards**.

This flag does **not** make mutations unconditional:

- A destructive tool that requires `userConfirmed:true` still fails without it.
- The permission profile must still allow the action.
- The target workspace must still be in the explicit Active Project/strict-root set.
- Secret/path/critical-file guards still apply.
- Destructive Git/file policy, recovery, checkpoint and recoverable-delete behavior still apply.
- ChatGPT/Codex host permissions should remain configured to ask/review write or important actions according to the user's risk preference.

Raw/manual stdio startup without `--trusted-host-approval` retains upstream fail-closed behavior: confirmed/destructive actions requiring the host provider remain denied.

Do not add `--trusted-host-approval` to an untrusted generic MCP client command merely to make a blocked operation work.

## 4. Start, inspect and stop ECO

Start the tunnel in a hidden background worker:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\start-eco-tunnel.ps1
```

Inspect state without decrypting the API key:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\status-eco-tunnel.ps1
```

For machine-readable status:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\status-eco-tunnel.ps1 -Json
```

Status reports the direct private Node/bundle presence, whether trusted-host mode was configured, the explicit roots, tunnel ownership and bounded diagnostics; it never decrypts or prints the runtime API key.

Stop ECO:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\stop-eco-tunnel.ps1
```

The worker records its PID and process start time plus the exact tunnel-client child identity. Stop never kills tunnel-client processes by name; it signals and stops only the recorded ECO-owned process.

Tunnel logs are written under `%APPDATA%\tunnel-client\eco-tunnel.log`. The lifecycle has a capped rapid-restart policy rather than an unlimited restart loop.

## 5. Connect ChatGPT to ECO

The Secure MCP Tunnel must already be associated with the ChatGPT workspace that will use it.

In a ChatGPT workspace with the required custom-app/developer capabilities:

1. Open the Apps/Connections area and enable Developer mode when required.
2. Create a custom app/connection named **ECO**.
3. Choose **Tunnel** as the connection type.
4. Select the associated tunnel or paste the real tunnel ID requested by the UI.
5. Scan/refresh the MCP tools.
6. Create/save the app.
7. Configure app permissions so reads/writes/important actions have the confirmation behavior you want; do not weaken ECO's local guards to compensate for a ChatGPT-layer denial.
8. Start with a read-only smoke request before allowing a write.

Suggested first prompt:

```text
Use ECO to list available workspaces, show Git status for the configured project, and summarize the top-level tree. Do not modify anything.
```

Suggested controlled write after read access succeeds:

```text
Use ECO to make one exact text edit inside the configured project, verify the change, and show the Git diff. Do not modify files outside the configured roots.
```

For a destructive acceptance test, use only a disposable file. Confirm the exact tool action through the host when prompted; the tool call must still carry its explicit confirmation contract.

If a schema changes after an ECO/lnwjud upgrade, refresh the ChatGPT connector/app and open a new chat if the current conversation retains stale tool metadata.

Do not commit a guessed `.app.json`. A connector/app binding may be added only after ChatGPT supplies a real identifier and only when that binding is appropriate to store.

## 6. Register the same ECO runtime with Codex

After ECO Headless setup/build, register the same bundle with Codex:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\setup-eco-codex.ps1
```

If an existing Codex MCP entry named `eco` should intentionally be replaced:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\setup-eco-codex.ps1 -Replace
```

The script uses the official Codex MCP CLI flow:

```text
codex mcp add eco -- <COMMAND> <ARGS...>
```

It does not edit `.codex/config.toml` directly. On Windows it registers `eco-node.exe` as the process executable and `eco-mcp.cjs` as the shared MCP bundle, followed by the same strict-root/trusted-host/profile/workspace arguments used by the ChatGPT Tunnel.

The local Codex MCP path and the ChatGPT Tunnel path therefore terminate in the same application services and ToolRegistry. Keep Codex approval policy appropriately interactive for mutation work; ECO's trusted-host adapter is not a substitute for client-host governance.

## Security model without Desktop

Desktop-native approval dialogs do not exist in the headless product. Their operational role is replaced by the explicit trusted-host adapter plus ChatGPT/Codex host permissions while all shared local guards remain active.

Effective authority is the intersection of:

```text
ChatGPT/Codex host permissions and approvals
AND trusted-host adapter enabled only for configured client paths
AND Secure MCP Tunnel availability when ChatGPT is the client
AND ECO/lnwjud permission profile
AND explicit strict allowed roots
AND Active Project/workspace mutation boundaries
AND tool-level confirmation/destructive policy
AND critical-file/path/secret protection
```

Defaults and invariants:

- Setup requires at least one explicit existing allowed root.
- Multiple explicit roots become the active workspace set; the first root is primary.
- `--strict-roots` is always present in generated ECO connections.
- Unrestricted mode is not enabled by ECO setup.
- AI delete auto-approval is not enabled by ECO setup.
- Critical-file, recovery-trash, checkpoint, Git safety and destructive-scope policies remain shared with lnwjud.
- Secret-like files remain guarded by the existing workspace/secret policy.
- Windows secure desktop/UAC isolation cannot be bypassed.
- Elevated applications may be inaccessible to a non-elevated ECO process because of Windows integrity boundaries.

## Local capabilities

ECO reuses the same CLI capability runtime, subject to local prerequisites:

- Files, checkpoints and recovery.
- Git and project commands.
- Shell/background tasks.
- Browser/CDP managed browser.
- Windows accessibility, input, windows, clipboard, notifications, file dialogs and vision.
- OCR when the optional helper is available.
- WSL when WSL is installed and ready.
- Office automation when Microsoft Office/COM is available.
- Scheduler, event log, system information and web fetch.
- PDF/LSP/local-provider integrations when configured.
- Extension skills and child MCP bridge tools.
- Durable goals, scheduled-continuation state and MCP tasks.
- Optional local Codex delegation.

A missing optional dependency should make that capability report unavailable exactly as the shared runtime does; ECO must not silently remove the capability family from its architecture.

## Repository verification

Narrow headless/parity checks include:

```powershell
corepack pnpm@10.15.0 test:eco:parity
corepack pnpm@10.15.0 validate:eco:parity
corepack pnpm@10.15.0 --filter @lnwjud/cli test:eco
corepack pnpm@10.15.0 build:eco
corepack pnpm@10.15.0 test:eco:packaging
corepack pnpm@10.15.0 test:eco:tunnel
corepack pnpm@10.15.0 test:eco:integration
corepack pnpm@10.15.0 validate:eco:upstream
```

The authoritative Windows gate is:

```powershell
corepack pnpm@10.15.0 verify:eco
```

The release gate must additionally preserve the existing lnwjud release suite and pass real ChatGPT/Codex Windows acceptance before ECO is described as feature-parity complete.

## Troubleshooting

### `tunnel-client` is missing

Pass `-TunnelClientPath`, set `ECO_TUNNEL_CLIENT_PATH`, or place the current tunnel-client executable on PATH.

### ECO bundle is missing

Build it with Node 24:

```powershell
corepack pnpm@10.15.0 build:eco
```

### Runtime key is missing or cannot be decrypted

Re-run `setup-eco-headless.ps1`. Do not copy the plaintext key into a repository file.

### A workspace is denied

Check `status-eco-tunnel.ps1` and the explicit allowed roots. Re-run setup only when the additional root is intentionally trusted.

### A destructive tool still returns `HOST_APPROVAL_REQUIRED`

Confirm the connection was generated by ECO setup and `status-eco-tunnel.ps1` reports trusted-host mode. Do not manually add the flag to an untrusted client. Also verify the tool-level confirmation (`userConfirmed`) and permission/destructive policy requirements were satisfied.

### ChatGPT shows stale tools

Refresh the ECO connector/app after the tunnel is healthy. Open a new chat if stale schemas remain cached in the old conversation.

### Codex already has an `eco` MCP entry

Inspect it with `codex mcp get eco --json`. Use `setup-eco-codex.ps1 -Replace` only when replacement is intentional.

### A Windows/browser/Office capability is unavailable

Run the shared runtime health/diagnostic tool relevant to the failure and verify its prerequisite. Do not substitute a less-safe automation path simply to bypass an unavailable backend.
