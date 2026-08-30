# ECO Real Windows Smoke Acceptance

**Purpose:** final host-level evidence before PR #5 can leave Draft status or claim ECO/lnwjud MCP parity complete.

**Required environment:** supported Windows x64 host, system Node.js 24.x, current OpenAI `tunnel-client`, Codex Desktop/CLI where Codex validation is performed, and the real project root intended for ECO access.

## 1. Source checkpoint

Record before testing:

- ECO branch: `feat/eco-headless-runtime`
- ECO commit: `<git rev-parse HEAD>`
- Upstream checkpoint: `engasnm111/lnwjud@21bcbbf67862404bf5814d41bd65d0cd0962c81c`
- Runtime version: `4.31.0`
- Test date/time: `<local ISO time>`
- Windows version/build: `<winver/systeminfo>`
- Node: `<where node>` / `<node --version>`

Acceptance: Node must resolve to system Node 24.x. No ECO-owned Node/runtime executable is allowed.

## 2. Build + local stdio MCP smoke

From the repository root in PowerShell, run the one-command host smoke:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\run-eco-real-smoke.ps1 `
  -Root "C:\PATH\TO\REAL\PROJECT"
```

The runner validates system Node 24, enables/prepares Corepack, performs the frozen install, builds ECO, runs the official MCP v2 local stdio smoke, and writes the resulting JSON evidence to:

```text
.local-artifacts\eco-real-smoke\local-stdio.json
```

Required evidence:

- `ok: true`
- Node host is `system` and version is 24.x
- MCP protocol is `2026-07-28`
- selected workspace root equals the real project root
- `workspace_list` and `workspace_tree` pass
- `git_status` passes when the target is a Git repository
- representative upstream tools are present (`read_file`, `git_status`, `dom_cdp`, `office`, `run_goal`)
- `forbiddenRuntimeExecutablesFound` is empty
- packaged `rg.exe` is present as a helper dependency

## 3. Secure MCP Tunnel setup and host lifecycle

Configure ECO with explicit allowed roots only:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\setup-eco-headless.ps1 `
  -TunnelId "<REAL_TUNNEL_ID>" `
  -AllowedRoot "C:\PATH\TO\REAL\PROJECT"

powershell -NoProfile -ExecutionPolicy Bypass -File scripts\start-eco-tunnel.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\status-eco-tunnel.ps1
```

Required evidence:

- setup reports `ECO system Node`, not a private Node runtime
- profile is `eco`
- `--strict-roots` is present in the configured MCP command
- status reports one healthy ECO worker and an owned tunnel-client child
- no lnwjud Desktop/Electron process is required for the ECO path
- no broad process kill is needed for normal stop/restart

After ChatGPT testing, verify clean stop:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\stop-eco-tunnel.ps1
```

## 4. ChatGPT Web smoke

Using the real ECO connector through OpenAI Secure MCP Tunnel, perform read-only checks first:

1. list available workspaces/projects;
2. show the top-level tree of the selected real project;
3. read one known non-secret text file;
4. show Git status;
5. confirm representative tool visibility appropriate to current runtime configuration.

Required evidence:

- ChatGPT reaches the Windows host through the Secure MCP Tunnel;
- returned workspace path is the intended allowed root;
- reads/Git inspection work without Desktop/Electron;
- access outside the configured allowed root is rejected;
- connector/tool schema is consistent with the synchronized upstream registry.

Record:

- ChatGPT connector name: `<...>`
- test chat/date: `<...>`
- workspace ID/root returned: `<...>`
- read-only tools verified: `<...>`
- outside-root denial verified: `yes/no`
- result: `PASS/FAIL`

## 5. Codex Desktop smoke

Register/use the same ECO stdio MCP package with the same data path and allowed-root policy. Codex Desktop is a second MCP client; it must not use a separate ECO ToolRegistry or separate ECO state store.

Perform:

1. workspace/project listing;
2. read one known file;
3. Git status;
4. inspect the same workspace registration/state created or visible from the ChatGPT/ECO runtime;
5. if `codex_*` delegation tools are enabled, verify they come from the shared upstream setting rather than an ECO-only CLI override.

Required evidence:

- Codex Desktop connects to `eco-mcp.cjs` through system Node 24;
- workspace root and IDs/state are compatible with the ChatGPT/ECO run;
- shared `lnwjud.sqlite` state is used;
- no second ToolRegistry implementation exists;
- no ECO-owned runtime `.exe` is used.

Record:

- Codex version: `<...>`
- MCP registration/config location: `<...>`
- workspace ID/root returned: `<...>`
- shared-state proof: `<...>`
- result: `PASS/FAIL`

## 6. Representative optional capability smoke

Only test capabilities whose prerequisites are installed on the host. Absence of an optional dependency is not parity failure if upstream reports it as dependency-gated.

Recommended representatives:

- Windows native: `system_info` or `accessibility`
- Browser: `dom_cdp` read-only/list-tabs path
- WSL: WSL status/read-only operation when WSL exists
- Office: read-only/diagnostic Office operation when Microsoft Office exists
- Search: `search_text` using packaged ripgrep helper

Record each as `PASS`, `dependency-gated`, or `FAIL` with the returned upstream reason.

## 7. Final acceptance table

| Gate | Required result | Actual |
| --- | --- | --- |
| Automated Windows CI | PASS | PASS (run #103 before host smoke) |
| Local built-package stdio smoke | PASS | `<pending>` |
| No ECO-owned runtime executable | PASS | `<pending>` |
| Secure MCP Tunnel lifecycle | PASS | `<pending>` |
| ChatGPT Web read-only smoke | PASS | `<pending>` |
| Strict-root rejection | PASS | `<pending>` |
| Codex Desktop same-runtime smoke | PASS | `<pending>` |
| Shared state proof | PASS | `<pending>` |
| Optional representative capabilities | PASS or dependency-gated | `<pending>` |
| Final upstream-main re-check | PASS | `<pending>` |

Do not mark PR #5 ready for merge until every required row is resolved and the final upstream-main re-check still matches the synchronized checkpoint or the branch has been resynchronized.
