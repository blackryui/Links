# ECO Headless Acceptance Evidence

**Status:** CODE IMPLEMENTED / LIVE WINDOWS + CHATGPT + CODEX ACCEPTANCE NOT RUN  
**Repository:** `blackryui/Links`  
**Implementation branch:** `feat/eco-headless`  
**Draft PR:** #4  
**Upstream parity baseline:** `engasnm111/lnwjud@edbc739b6df599e8b824c7c2c75cda1cd9e6d493`  
**Baseline version:** `4.13.0`

This document is the bounded acceptance record for ECO Headless. A checkbox may be marked complete only from actual command/client evidence. Do not infer live success from code review or static tests.

## 1. Repository / CI verification

- [ ] Windows Node 24 `corepack pnpm@10.15.0 verify:eco` completed with exit code 0.
- [ ] Existing upstream-compatible lnwjud release suite completed through `scripts/verify-release.ps1`.
- [ ] `docs:tools:check` completed with no ToolRegistry/catalog drift.
- [ ] `validate:eco:upstream` confirmed upstream `main` still matches the recorded SHA at release time.
- [ ] `validate:eco:release` completed with no blocked/missing parity category.
- [ ] GitHub Windows CI run URL/ID recorded below.

**Current evidence:** GitHub Actions had not created a workflow run for Draft PR #4 at the latest check. The current execution environment uses Node 22 and cannot download pnpm, so it cannot supply authoritative repository test output.

CI run: `NOT_RUN`

## 2. Real Windows local preflight

Run on the Windows machine that will host ECO:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify-eco-windows-local.ps1
```

Record the generated JSON evidence path here:

```text
NOT_RUN
```

Required evidence:

- [ ] Windows 10/11 x64.
- [ ] Node 24 used for source verification.
- [ ] No `lnwjud.exe` process running during ECO acceptance.
- [ ] `eco-node.exe`, `eco-mcp.cjs`, `eco-mcp.cmd`, Windows capability bridge and `PACKAGE.json` present.
- [ ] Direct runtime is `eco-node.exe + eco-mcp.cjs`; Desktop/Electron is not in the runtime path.

## 3. Secure MCP Tunnel

Run setup with a real workspace-associated tunnel ID and explicit disposable/version-controlled project roots:

```powershell
& .\scripts\setup-eco-headless.ps1 `
  -TunnelId tunnel_real_id `
  -AllowedRoot @('C:\path\to\project') `
  -PermissionProfile full

.\scripts\start-eco-tunnel.ps1
.\scripts\status-eco-tunnel.ps1
```

Required evidence:

- [ ] `tunnel-client doctor` passed.
- [ ] Tunnel is live.
- [ ] Status reports direct private Node + MCP bundle present.
- [ ] Status reports `Trusted host gate: True`.
- [ ] Explicit allowed roots match the intended project set.
- [ ] Runtime API key is present only as encrypted local secret; plaintext is not captured here.
- [ ] No public inbound MCP port / Desktop HTTP MCP is used.

Tunnel evidence: `NOT_RUN`

## 4. ChatGPT ECO acceptance

Use the real ECO custom app/connection attached to the Secure MCP Tunnel.

### Read-only

- [ ] List configured workspaces.
- [ ] Read project tree/context.
- [ ] Run Git status.
- [ ] Confirm out-of-root access is denied.

### Controlled write

- [ ] Make one exact text change inside a configured project root.
- [ ] Verify file content and Git diff.
- [ ] Confirm no unrelated file changed.

### Host/destructive approval boundary

Use a disposable file only.

- [ ] Destructive call without the tool's explicit confirmation is rejected.
- [ ] Host/user deliberately confirms the exact action.
- [ ] Confirmed call succeeds only inside the configured root and produces recovery/audit evidence where the shared tool contract provides it.

ChatGPT acceptance: `NOT_RUN`

Do not store conversation secrets, runtime API keys, lease tokens or unrelated private project content in this evidence file. Record only bounded tool names, paths within the disposable test project, result codes and connector/tunnel identifiers that are safe to retain.

## 5. Codex ECO acceptance

Register the same ECO runtime:

```powershell
.\scripts\setup-eco-codex.ps1
codex mcp get eco --json
```

Required evidence:

- [ ] Codex registration launches `eco-node.exe + eco-mcp.cjs`.
- [ ] Registered arguments include strict roots and the explicit trusted-host adapter.
- [ ] Read-only workspace/Git flow succeeds.
- [ ] Controlled write succeeds inside a configured root.
- [ ] Out-of-root access is denied.
- [ ] Destructive confirmation boundary behaves like the ChatGPT test.
- [ ] `.codex/config.toml` was not edited by ECO code directly; Codex CLI owns its configuration.

Codex acceptance: `NOT_RUN`

## 6. Capability-family acceptance

Only mark a capability PASS when its local prerequisite exists on the test machine. `optional-dependency` means absence is allowed if the shared runtime reports it unavailable cleanly.

| Capability | Status | Evidence |
| --- | --- | --- |
| Files / checkpoints / recovery | NOT_RUN | |
| Git / project commands | NOT_RUN | |
| Shell / background tasks | NOT_RUN | |
| Browser / CDP | NOT_RUN | |
| Windows accessibility / input / windows / clipboard | NOT_RUN | |
| Vision / OCR | NOT_RUN | optional helper may be absent |
| WSL exec / filesystem | NOT_RUN | optional if WSL absent |
| Office/document/workbook | NOT_RUN | optional if Office absent |
| Scheduler / event log / system / web fetch | NOT_RUN | |
| Extensions / skills / child MCP bridge | NOT_RUN | |
| Goals / continuations / MCP tasks | NOT_RUN | |
| Optional `codex_*` delegation | NOT_RUN | remains disabled by default |

## 7. Lifecycle acceptance

- [ ] Start creates one ECO-owned hidden worker.
- [ ] Status identifies the exact worker/tunnel process identity.
- [ ] Bounded restart behavior verified.
- [ ] Stop terminates only the recorded ECO-owned process, not unrelated tunnel-client processes.
- [ ] Runtime key removed from process environment on shutdown.
- [ ] No lnwjud Desktop/Electron process starts at any point.

Lifecycle acceptance: `NOT_RUN`

## 8. Release decision

ECO Headless may be called **feature-parity complete** only after all mandatory sections above are backed by actual evidence and the latest-upstream gate still matches or a new upstream audit has been completed.

Current release decision: **BLOCKED — LIVE ACCEPTANCE NOT RUN**.
