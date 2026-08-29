# ECO Headless Feature-Parity Amendment

**Date:** 2026-08-29  
**Repository:** `blackryui/Links`  
**Primary design:** `docs/superpowers/specs/2026-08-29-eco-headless-windows-design.md`  
**Authoritative parity baseline:** `engasnm111/lnwjud` `main`, version `4.13.0`

## 1. Amendment purpose

ECO Headless is not a reduced CLI edition of lnwjud. It must preserve the functional behavior, safety model, data model, MCP contracts, and local capability coverage of the latest authoritative lnwjud runtime while replacing the Desktop/Electron host with a headless MCP host designed to work directly with ChatGPT and Codex.

The intended relationship is:

```text
lnwjud v4.13.0 runtime capabilities and safety semantics
                    =
ECO Headless runtime capabilities and safety semantics

except:
Desktop renderer / tray / dashboard UI
                    -> replaced by
ChatGPT + Codex + headless setup/status commands
```

A feature may not be omitted merely because its current configuration surface lives in Desktop. If the underlying capability is relevant to MCP/agent work, ECO Headless must expose an equivalent headless configuration or lifecycle path.

## 2. Authoritative source and update rule

At implementation start, the executor must compare `blackryui/Links` against current `engasnm111/lnwjud` `main`.

The current verified upstream `main` package version is `4.13.0`. The implementation must not intentionally downgrade to the older published release contract when upstream `main` contains newer runtime behavior.

For all code shared with upstream, prefer merging/reusing the upstream implementation over reimplementing it in ECO-owned code.

Before final merge, record:

- upstream main commit SHA used as parity baseline;
- `blackryui/Links` base SHA;
- root package version;
- ToolRegistry/tool-catalog comparison;
- any upstream runtime changes not yet present in ECO and their disposition.

If upstream main advances materially during implementation, re-run the parity check before final merge. New upstream behavior that affects MCP runtime, safety, state, capabilities, Codex, tunnel operation, tasks, or recovery must be incorporated or explicitly block release until resolved.

## 3. What “same as lnwjud” means

Feature parity applies to behavior, not GUI shape. ECO may use different user interaction surfaces, but underlying results and safety boundaries must remain equivalent.

### 3.1 MCP and tool parity

ECO must use the same `packages/mcp-server` ToolRegistry and tool schemas as the parity baseline.

Requirements:

- no duplicated ECO-owned MCP tool schemas;
- no silent removal of tools from the normal runtime catalog;
- preserve the current default/optional tool policy, including optional `codex_*` delegation;
- preserve MCP protocol, tasks capability, progress behavior, tool annotations, request scoping, result mapping, and timeout semantics;
- `docs:tools:check` remains the authoritative registry-drift check.

Tool count must be derived from the actual parity-baseline ToolRegistry at implementation/verification time rather than being hard-coded as a permanent ECO constant. If upstream changes the count, ECO follows upstream.

### 3.2 Workspace and project behavior

ECO must preserve:

- workspace registration/query/info/tree behavior;
- project snapshot behavior;
- Git state and project command flows;
- workspace indexes and search;
- multi-workspace behavior supported by the runtime;
- Active Project / workspace mutation boundaries semantically, even though the headless configuration surface differs from Desktop.

ECO's stricter first-run root selection is a deployment default, not a reduction in runtime capability. Users may intentionally configure multiple allowed roots where upstream supports them.

### 3.3 File, Git, process, and recovery parity

ECO must preserve applicable upstream behavior for:

- file reads/search/writes/patches/moves/copies/deletes;
- checkpoints;
- recoverable delete and recovery trash;
- backup/restore state required by the runtime;
- Git inspection and mutation safety;
- process start/list/status/logs/stop;
- project test/lint/typecheck/build commands;
- durable background tasks and MCP task protocol.

Headless packaging must not weaken critical-file protection, destructive Git protections, deletion policy, workspace path guards, or request-scope safety.

### 3.4 Local capability parity

Where the Windows host satisfies the same dependencies, ECO must preserve the same MCP-accessible local capabilities as the upstream CLI/runtime, including applicable:

- shell/process execution;
- Windows native/accessibility/window/input/clipboard/file-dialog capability paths;
- screenshot/vision/OCR behavior;
- browser/CDP and managed browser behavior;
- WSL execution/filesystem capabilities;
- web fetch;
- scheduler/event-log/system capability backends;
- Office/document/workbook capabilities exposed by the current ToolRegistry;
- local provider integrations such as PDF/LSP where supported;
- extension skills and child MCP bridge behavior.

A capability that requires an optional external binary may remain unavailable when that binary is absent, exactly as upstream does. ECO must report capability availability rather than deleting the tool family from its architecture.

### 3.5 Storage, state, audit, and continuity parity

ECO must retain the same compatible local state model for runtime-relevant features, including:

- SQLite repositories/migrations;
- workspace registrations;
- settings needed by headless runtime;
- audit/activity logs;
- checkpoint encryption;
- backup/recovery state;
- background task state;
- goals and scheduled-continuation state;
- workspace indexes;
- upgrade/runtime state consumed by MCP tools.

The existing `LNWJUD_*` environment/settings compatibility names may remain internal to avoid migration risk.

### 3.6 Goals, long sessions, and tasks parity

ECO must preserve the latest lnwjud durable goal and continuation semantics that are meaningful to ChatGPT/Codex MCP work:

- durable goal state;
- checkpoint/resume;
- MCP tasks list/get/result/cancel behavior where present;
- single-successor continuation safety;
- lease/claim/fencing rules;
- fail-closed behavior on conflicting continuation ownership.

The absence of Desktop UI must not remove the underlying durable-goal capability.

### 3.7 Codex parity

ECO is explicitly intended to work with both ChatGPT and Codex.

Requirements:

- local Codex discovery/authentication behavior remains upstream-compatible;
- existing `codex_*` tools remain optional according to upstream defaults;
- ECO does not copy or expose Codex credential files;
- Codex delegation uses the same workspace, permission, audit, and safety boundaries as upstream;
- ECO can also be registered as a local MCP server for Codex using the same headless stdio entrypoint used by the tunnel path.

The target architecture is therefore:

```text
ChatGPT Web -> Secure MCP Tunnel -> ECO stdio MCP
Codex local -> ECO stdio MCP
```

Both paths terminate in the same runtime services and ToolRegistry.

## 4. Desktop-only functions and required replacements

Desktop/Electron itself is not a parity requirement. The following UI-oriented functions may be removed from the required runtime path only if their operational purpose is replaced:

| Desktop responsibility | ECO Headless replacement |
| --- | --- |
| Dashboard / renderer | ChatGPT/Codex plus CLI status output |
| Settings UI | setup/config commands and local config/state |
| Start/stop connection buttons | `start-eco-tunnel.ps1` / `stop-eco-tunnel.ps1` |
| Tunnel status/log viewer | `status-eco-tunnel.ps1` plus log files/diagnostics |
| Guided tunnel setup UI | `setup-eco-headless.ps1` |
| Active Project selection UI | explicit workspace/root configuration |
| Native exact-action dialog | ChatGPT permission/approval layer plus existing headless tool safety/destructive policy |
| Tray lifecycle | explicit background launcher lifecycle |
| Desktop update UI | headless update/install path or documented package update workflow |

If a Desktop feature owns runtime state or safety behavior rather than presentation only, that behavior must be moved/reused in headless code instead of dropped.

## 5. Parity matrix required before implementation completion

Create and maintain a machine-readable or test-backed parity inventory with at least these categories:

```text
MCP transport/protocol
ToolRegistry/tool schemas
Workspace/project
Files/checkpoints/recovery
Git
Process/project commands
Search/index/context
Browser/CDP
Windows native/accessibility/input/vision
WSL
Office/document/workbook
System/event-log/scheduler/web-fetch
Extensions/skills/child MCP
Audit/activity
SQLite/settings/backups
Goals/continuations/tasks
Codex delegation
Tunnel lifecycle
Upgrade/update runtime state
Security/permission/destructive policy
```

Each category must be classified as one of:

- `shared` — same upstream implementation is reused;
- `headless-adapter` — same behavior through a non-Desktop host adapter;
- `ui-replaced` — Desktop presentation replaced by ChatGPT/Codex/CLI surface;
- `optional-dependency` — same upstream availability rules apply;
- `blocked` — parity gap that prevents release.

There must be no unexplained `missing` category at release time.

## 6. Tests required for parity

In addition to the original ECO Headless design tests, implementation must add or reuse tests proving:

1. ECO and the upstream-compatible CLI entrypoint instantiate the same MCP runtime service families.
2. ECO lists the same default ToolRegistry catalog as the current local parity baseline.
3. Optional Codex tool enablement changes the catalog exactly as upstream defines.
4. Representative tools from every runtime capability category are discoverable under the same prerequisite conditions.
5. Workspace/path/destructive protections are not weaker than the upstream runtime.
6. Storage/checkpoint/recovery/goal/task state works without Desktop running.
7. Neither ChatGPT nor Codex requires a separate ECO-specific tool implementation.
8. The same `eco-mcp` stdio entrypoint can serve Secure MCP Tunnel and local Codex MCP configuration.
9. No production runtime import from Electron/renderer/Desktop IPC is required to start ECO.
10. A parity regression test fails when an upstream ToolRegistry/runtime category is added without an ECO classification.

## 7. Release gate

ECO Headless must not be called feature-parity complete unless all of these are true:

- latest upstream-main parity baseline is recorded;
- the parity inventory has no unexplained missing capability;
- ToolRegistry/catalog drift checks pass;
- headless MCP integration tests pass;
- representative capability-category tests pass;
- ChatGPT tunnel smoke test passes;
- Codex local MCP smoke test passes;
- no Desktop/Electron process is required during those smoke tests;
- any known UI-only differences are documented as replacements rather than lost functionality.

## 8. Updated acceptance statement

The final ECO product goal is:

> ECO is the latest lnwjud Windows agent runtime expressed as a headless MCP project for ChatGPT and Codex. It shares lnwjud's runtime services, ToolRegistry, capabilities, state, safety, recovery, tasks, and Codex behavior; only the Desktop/Electron interaction layer is replaced by ChatGPT, Codex, and headless Windows lifecycle/configuration commands.

This amendment is normative. Where it conflicts with the primary ECO Headless design, this amendment takes precedence.
