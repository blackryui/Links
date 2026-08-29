# ECO Headless Windows Runtime Design

**Date:** 2026-08-29  
**Repository:** `blackryui/Links`  
**Target platform:** Windows 10/11 x64  
**ChatGPT-facing identity:** ECO  
**Runtime compatibility:** existing lnwjud CLI/MCP runtime and ToolRegistry

## 1. Goal

Run ECO on the user's Windows machine without lnwjud Desktop or Electron. ChatGPT Web connects to ECO through OpenAI Secure MCP Tunnel, and `tunnel-client` launches the existing local MCP runtime through stdio.

The resulting path is:

```text
ChatGPT Web
  -> ECO plugin
  -> OpenAI Secure MCP Tunnel
  -> tunnel-client.exe
  -> stdio
  -> ECO headless launcher
  -> existing apps/cli MCP runtime
  -> existing packages/mcp-server ToolRegistry
  -> Windows / Files / Git / Shell / Browser / WSL / Codex / Office-capable local tools
```

The design must preserve the existing MCP tool implementations as the only source of truth and remove Desktop/Electron from the required runtime path.

## 2. Non-goals

- Do not reimplement or copy the 227 MCP tool schemas.
- Do not require `lnwjud.exe`, Electron, the Desktop renderer, Desktop IPC, or Desktop Settings.
- Do not expose a public inbound MCP port.
- Do not require a loopback HTTP MCP server for the primary ECO path.
- Do not make unrestricted filesystem or destructive permissions the default.
- Do not commit OpenAI Runtime API keys, tunnel IDs, connector IDs, or other credentials.
- Do not remove Desktop compatibility from the upstream-compatible codebase in this phase.

## 3. Existing reusable runtime

The repository already contains the core pieces needed for a headless implementation:

1. `packages/mcp-server/src/stdio.ts` exposes `startMcpStdio()`.
2. `packages/mcp-server/src/http.ts` exists but is not required for the primary headless path.
3. `apps/cli/src/bin/mcp-stdio.ts` already bootstraps a complete local MCP runtime and starts the MCP server over stdio.
4. `apps/cli/src/runtime/stdio-mcp-runtime.ts` wires application services, storage, capabilities, files, Git, processes, browser/CDP, Windows capability bridges, WSL, extensions, goals, search, and optional Codex delegation.
5. The live ToolRegistry remains in `packages/mcp-server` and remains authoritative for the 221-default / 227-configurable tool behavior.

Therefore ECO Headless is primarily a packaging, launcher, tunnel, policy, and lifecycle change rather than a new MCP implementation.

## 4. Recommended architecture

Use a stdio-first headless runtime.

```text
ChatGPT Web
     |
     | ECO custom app/plugin
     v
OpenAI Secure MCP Tunnel
     |
     | outbound HTTPS control/data path
     v
tunnel-client.exe
     |
     | --mcp-command / stdio
     v
eco-mcp.cmd
     |
     v
eco-mcp.cjs or Node CLI entrypoint
     |
     v
apps/cli stdio runtime
     |
     v
packages/mcp-server ToolRegistry
```

No Desktop process participates in this path.

## 5. Runtime unit boundaries

### 5.1 ECO plugin package

Existing `.codex-plugin/plugin.json` remains the ChatGPT-facing package identity.

Responsibilities:

- Display `ECO` to the user.
- Route intent through the existing six `lnwjud-*` skills.
- Document the headless connection model.
- Never embed local secrets or machine-specific connector IDs.

It does not own MCP schemas or local execution.

### 5.2 ECO headless MCP launcher

Add a Windows-friendly launcher whose public name is ECO while reusing the current CLI MCP entrypoint.

Target outputs:

```text
dist/eco-headless/
  eco-mcp.cjs
  eco-mcp.cmd
  eco-headless.env.example
```

Responsibilities:

- Start the stdio MCP runtime.
- Forward workspace/policy arguments to the existing CLI runtime.
- Emit diagnostics to stderr only; stdout remains protocol-only.
- Exit when the stdio peer closes.
- Avoid Electron imports and Desktop IPC dependencies.

### 5.3 ECO tunnel launcher

Add a separate tunnel lifecycle script, for example:

```text
scripts/setup-eco-headless.ps1
scripts/start-eco-tunnel.ps1
scripts/stop-eco-tunnel.ps1
scripts/status-eco-tunnel.ps1
```

Responsibilities:

- Configure a tunnel-client profile named `eco`.
- Target the headless MCP through an stdio command instead of `server_urls` pointing at Desktop HTTP.
- Load the Runtime API key from Windows-protected or user-private local storage, not Git.
- Run `tunnel-client doctor` before start.
- Start tunnel-client and restart it only under bounded restart policy.
- Never start or require `lnwjud.exe`.

### 5.4 Existing CLI runtime

`apps/cli/src/bin/mcp-stdio.ts` and `apps/cli/src/runtime/stdio-mcp-runtime.ts` remain the runtime implementation.

Only minimal refactoring is allowed if packaging needs a cleaner reusable entrypoint. Tool behavior must remain unchanged unless a test demonstrates a headless-only defect.

## 6. Workspace and permission model

ECO Headless must default to a constrained workspace boundary.

Recommended default launch policy:

```text
--strict-roots
--allowed-root <explicit user-selected workspace>
--profile full
```

`full` here refers to the existing lnwjud permission profile, but strict roots remain the hard path boundary. The setup flow must not silently use all fixed drives.

For first-time setup, require at least one explicit workspace root.

Examples:

```text
C:\Users\<user>\Projects\eco-system
D:\Work
```

If multiple roots are intentionally configured, each must be explicit.

Unrestricted mode must remain opt-in and must not be enabled by the ECO setup script by default.

## 7. Mutation approval model without Desktop

Desktop-native approval dialogs are unavailable in headless mode. Therefore the headless design must not pretend that Desktop exact-action approval still exists.

The effective approval stack becomes:

```text
ChatGPT app permission mode
AND ChatGPT workspace capability
AND Secure MCP Tunnel availability
AND ECO/lnwjud permission profile
AND strict allowed-root boundary
AND tool-specific safety checks / destructive policy
```

For V1:

- Keep destructive operations conservative by default.
- Do not auto-enable AI delete approvals.
- Preserve critical-file protection and recoverable-delete behavior from existing runtime settings.
- Treat ChatGPT's own write/important-action approval as the user-interaction approval layer.

A future V2 may add a local approval broker/service, but it is not required for the first headless release.

## 8. Tunnel configuration

The ECO tunnel profile must use stdio command forwarding rather than Desktop HTTP.

Conceptually:

```text
profile: eco
mcp command: eco-mcp.cmd --strict-roots --allowed-root <workspace> --profile full
```

The exact profile schema and tunnel-client CLI flags must be verified against the bundled/current tunnel-client version during implementation; the design requirement is semantic: tunnel-client launches ECO's stdio MCP command directly.

Runtime API key requirements:

- Never store in repository files.
- Prefer Windows DPAPI or another local user-private mechanism already compatible with the current tunnel-client workflow.
- Decrypt only into the tunnel process environment when starting.
- Clear process environment references on shutdown.

## 9. Background operation on Windows

The user should not need an interactive terminal window after setup.

V1 should support a no-GUI background launcher with these commands:

```text
setup-eco-headless.ps1
start-eco-tunnel.ps1
stop-eco-tunnel.ps1
status-eco-tunnel.ps1
```

The start command may use a hidden/background PowerShell process to own tunnel-client. It must persist only while the Windows user session is available unless the user explicitly installs a service/task in a later phase.

Do not use Windows Task Scheduler as an implicit default continuation mechanism. If always-on startup is added later, it must be an explicit installation step with clear ownership and uninstall behavior.

## 10. Packaging strategy

Preferred V1 packaging:

1. Build the existing CLI workspace.
2. Bundle `apps/cli/src/bin/mcp-stdio.ts` as `eco-mcp.cjs` using the same proven esbuild strategy already used by Desktop packaging.
3. Add `eco-mcp.cmd` that launches the bundled file with Node or a packaged Node-compatible host as selected by the existing distribution environment.
4. Ship or document the required `tunnel-client.exe` location separately from Desktop.
5. Do not package Electron just to obtain the CLI bundle.

If the existing tunnel-client preparation script is currently Desktop-local, move only the reusable tunnel-client acquisition/verification logic into a shared script/module; avoid copying it.

## 11. Naming and compatibility

User-facing names:

- Plugin/app: `ECO`
- Tunnel profile: `eco`
- Headless command: `eco-mcp`
- Headless launcher scripts: `eco-*`

Internal compatibility names may remain:

- npm workspaces `@lnwjud/*`
- SQLite filename `lnwjud.sqlite`
- environment variables `LNWJUD_*`
- internal skill directories `lnwjud-*`
- ToolRegistry/tool names

This prevents a risky internal rename while providing a consistent ECO user experience.

## 12. Data and state

ECO Headless continues to use the existing local SQLite and state model through `resolveLnwjudDataPath()` unless implementation reveals a hard Desktop dependency.

The setup script must expose the effective data path and workspace roots so the user understands where local state lives.

Existing backup, checkpoint, recovery-trash, activity-log, goal, and workspace-index mechanisms should continue to work through the CLI runtime.

## 13. Browser and Windows capabilities

Because the runtime executes on the user's Windows machine, the existing CLI capability service may continue to expose browser/CDP, shell, WSL, Windows accessibility/vision/input, and other local capabilities where their backend requirements are available.

Limitations must be explicit:

- No Desktop renderer is required.
- Windows secure desktop/UAC isolation still cannot be bypassed.
- Elevated-process accessibility may be restricted by Windows integrity boundaries.
- Browser automation uses the CLI runtime's managed browser profile, not an arbitrary personal Chrome profile unless existing policy explicitly allows it.

## 14. Codex delegation

Preserve the existing default:

- 221 advertised tools by default.
- Six `codex_*` delegation tools remain opt-in.
- All 227 become available only when the existing Codex tools setting is enabled and local Codex capability is valid.

ECO setup must not silently enable Codex delegation.

## 15. Error handling

### MCP command exits

Tunnel lifecycle must record the exit code and a bounded stderr tail. Restart only under a capped rapid-restart policy.

### Runtime API key missing

Fail before tunnel-client starts. Print the local path/instruction needed to save the key without echoing the key.

### Workspace missing

Fail closed. Do not fall back to an unrestricted machine root when strict roots were requested.

### Tool capability unavailable

Return the existing capability/runtime error. Do not substitute a less-safe tool path automatically.

### Tunnel connection stale

Run `doctor` and instruct the user to refresh the ChatGPT connector after schema changes.

## 16. Migration from Desktop-based ECO documentation

Update ECO docs so the primary path no longer says:

```text
Launch lnwjud Desktop
Configure Tunnel in Desktop Settings
Desktop owns Active Project and approvals
Tunnel targets Desktop loopback HTTP MCP
```

Replace with:

```text
Run ECO Headless setup
Select explicit allowed workspace roots
Save the Runtime API key locally
Configure the eco tunnel profile for stdio command execution
Start ECO tunnel
Create/refresh ECO in ChatGPT
```

Keep Desktop-specific scripts/docs only as legacy/upstream-compatible alternatives, clearly marked as not required for ECO Headless.

## 17. Files expected to change in implementation

Likely create:

```text
scripts/setup-eco-headless.ps1
scripts/start-eco-tunnel.ps1
scripts/stop-eco-tunnel.ps1
scripts/status-eco-tunnel.ps1
scripts/build-eco-headless.mjs or equivalent
apps/cli/tests/eco-headless-*.test.ts
docs/eco-headless.md
```

Likely modify:

```text
package.json
apps/cli/package.json
possibly apps/cli/src/bin/mcp-stdio.ts
possibly apps/cli/src/runtime/stdio-mcp-runtime.ts
scripts/validate-chatgpt-plugin.mjs
docs/chatgpt-plugin.md
.codex-plugin/plugin.json only if headless wording needs adjustment
release/packaging verification scripts where appropriate
```

Do not modify `packages/mcp-server` ToolRegistry schemas unless a verified headless defect requires a narrow fix.

## 18. Testing strategy

### Unit / contract tests

- ECO headless launcher does not import Electron or Desktop modules.
- Bundle entrypoint resolves to the CLI stdio runtime.
- Strict roots are required by default setup.
- Missing allowed root fails closed.
- Plugin manifest remains `eco` / `ECO`.
- ToolRegistry count policy remains unchanged.

### Integration tests

- Spawn ECO MCP over stdio and initialize an MCP client.
- List tools and verify representative read-only tools.
- Run a temporary-workspace file read/write test within strict root.
- Verify out-of-root access is denied.
- Verify optional Codex tools remain absent by default.

### Tunnel contract tests

- Generated eco profile invokes the stdio command and does not contain Desktop HTTP `server_urls`.
- Start script never references `lnwjud.exe` or Electron.
- Runtime key is not written in plaintext to repository-owned config.

### Static regression checks

- No duplicate MCP schemas added.
- Desktop remains optional/legacy, not a dependency of ECO Headless.
- `docs:tools:check` remains authoritative for registry drift.

## 19. Rollout phases

### Phase H1 — Headless runtime package

Produce and test `eco-mcp` locally without tunnel integration.

### Phase H2 — Secure MCP Tunnel stdio integration

Create setup/start/stop/status scripts and tunnel profile generation.

### Phase H3 — ChatGPT ECO smoke verification

Verify read-only ECO connection, then one controlled write inside an explicit strict root.

### Phase H4 — Optional capabilities

Verify Browser, Windows UI, WSL, Office, and Codex individually. Capabilities that need extra binaries remain optional rather than blocking core ECO startup.

## 20. Acceptance criteria

ECO Headless V1 is accepted when all are true:

1. ChatGPT can reach ECO on the user's Windows machine without `lnwjud.exe` or Electron running.
2. Tunnel-client launches ECO's MCP through stdio.
3. The existing CLI runtime and ToolRegistry remain the execution source of truth.
4. The default setup requires explicit allowed workspace roots.
5. Out-of-root access fails closed.
6. 221 tools remain the default advertisement; 227 remains configurable.
7. ECO setup/start/stop/status can run without opening a GUI.
8. No Runtime API key, tunnel ID, or connector ID is committed to Git.
9. ECO documentation no longer requires Desktop for the primary path.
10. Representative MCP read and controlled write smoke tests pass through the headless path.
11. Desktop-specific code remains optional and upstream-compatible rather than being deleted in this phase.
