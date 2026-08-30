# ECO Headless — Latest Upstream, No Custom EXE Design

**Date:** 2026-08-30  
**Repository:** `blackryui/Links`  
**Target branch:** `feat/eco-headless-runtime`  
**Supersedes where conflicting:** the 2026-08-29 ECO Headless design/amendment  
**Verified upstream baseline at design time:** `engasnm111/lnwjud@21bcbbf67862404bf5814d41bd65d0cd0962c81c`, version `4.31.0`

## 1. Goal

ECO is a headless MCP tunnel/plugin layer between ChatGPT Web and the local lnwjud-compatible runtime, while Codex Desktop can register the same local MCP runtime as an MCP client.

ECO must not become a second implementation of lnwjud. The local runtime, MCP ToolRegistry, schemas, state, permissions, recovery, tasks, capability availability rules, and optional Codex delegation must remain upstream lnwjud behavior.

Skills for the user's business and engineering workflows are a separate layer and must not be implemented by modifying MCP core tools.

## 2. Target architecture

```text
ChatGPT Web
    |
    v
OpenAI Secure MCP Tunnel
    |
    v
ECO headless adapter (JS/TS + PowerShell lifecycle/config)
    |
    v
lnwjud CLI/runtime + packages/mcp-server ToolRegistry
    |
    +--> shared local SQLite/state/audit/checkpoints/tasks
    +--> file/git/process/search/browser/windows/wsl/office/etc.

Codex Desktop
    |
    +--------------------------> same ECO/lnwjud stdio MCP runtime
```

ChatGPT and Codex are independent MCP clients. `codex_*` delegation tools are an optional lnwjud capability and are not the mechanism by which Codex Desktop becomes an MCP client.

## 3. Upstream policy

The implementation MUST use the current authoritative `engasnm111/lnwjud` `main` runtime as the source of truth.

At the design checkpoint on 2026-08-30:

- upstream SHA: `21bcbbf67862404bf5814d41bd65d0cd0962c81c`;
- upstream version: `4.31.0`;
- MCP protocol documented by upstream: `2026-07-28`;
- registry inventory: 231 tool definitions;
- normal advertised catalog: 195 tools;
- advertised catalog with the six `codex_*` delegation tools enabled: 201 tools.

The 231/195/201 values are checkpoint evidence, not permanent ECO constants. Tests must derive the catalog from the actual upstream-compatible ToolRegistry and feature policy. ECO must preserve definitions that upstream intentionally keeps planned or feature-disabled without forcing them into normal `tools/list`.

Before merge, the parity check MUST re-resolve upstream `main`. A material upstream runtime change blocks release until ECO is synchronized or the gap is explicitly classified as blocked.

## 4. Chosen synchronization approach

Use **upstream-first synchronization**.

1. Bring the fork/runtime code to the verified upstream snapshot rather than cherry-picking only visible tool additions.
2. Re-apply the ECO headless adapter as a small delta on top of that upstream snapshot.
3. Do not copy MCP schemas, service implementations, or capability implementations into ECO-owned parallel files.
4. Keep ECO-specific code limited to tunnel setup/lifecycle, headless configuration, packaging/entrypoint glue, plugin metadata/docs, and parity/release verification.

Rejected alternatives:

- selective cherry-picking of tool changes: can miss storage, safety, protocol, task, or continuation changes;
- cloning the ToolRegistry into ECO: creates permanent drift and violates the single-runtime goal.

## 5. No-custom-EXE requirement

ECO MUST NOT build, rename, ship, or require an ECO-owned executable such as `eco-node.exe`, `eco.exe`, `lnwjud.exe`, or an Electron/Desktop host.

This requirement does **not** mean Windows can operate without executable dependencies. Upstream/runtime dependencies may still be executable programs when required by their native platform role, including:

- system-installed Node.js (`node.exe`) as the JavaScript host;
- PowerShell/cmd supplied by Windows;
- upstream capability dependencies such as `rg.exe` or the optional Windows OCR helper when lnwjud requires them;
- Codex executable/runtime when Codex functionality is used;
- OpenAI tunnel-client itself.

ECO must not manufacture or rebadge those dependencies as an ECO executable.

### Runtime entrypoint

The production MCP entrypoint is `eco-mcp.cjs` (or an upstream-compatible JS module entrypoint) executed by a resolved system Node 24.x runtime.

The tunnel command therefore starts with the resolved Node executable path and then the ECO MCP script path, for example conceptually:

```text
C:\Program Files\nodejs\node.exe C:\...\eco-mcp.cjs --strict-roots ...
```

The existing private copy/rename of `process.execPath` to `eco-node.exe` must be removed.

## 6. Runtime dependency resolution

ECO setup must fail closed if a required runtime cannot be resolved.

### Node

- require Node `>=24.0.0 <25` to match upstream;
- resolve an explicit configured Node path first when supported;
- otherwise resolve `node.exe` from the operator environment/PATH;
- validate the major version before storing the tunnel command;
- record the resolved path in diagnostics, but do not copy it into the ECO distribution.

### Ripgrep and optional native helpers

Capability dependency handling must follow latest upstream behavior. ECO may package or locate upstream helper artifacts only where upstream itself requires them, but must not treat those helpers as an ECO custom runtime executable.

Missing optional dependencies must reduce capability availability exactly as upstream defines; they must not silently remove unrelated MCP definitions or weaken safety.

## 7. Tool and capability parity contract

ECO must instantiate the same upstream MCP ToolRegistry/runtime service families and preserve upstream feature flags.

Required properties:

- no ECO-owned duplicate tool schemas;
- no hard-coded permanent tool count as the parity oracle;
- default `tools/list` equals upstream default behavior;
- enabling Codex delegation changes the advertised catalog exactly as upstream defines;
- planned/disabled definitions remain inventory-only where upstream keeps them inventory-only;
- MCP task/progress/timeout/annotation/request-scope behavior stays upstream-compatible;
- permission/destructive policy remains the shared runtime policy;
- capability prerequisite checks remain upstream behavior.

Representative parity families include workspace/project, files/checkpoints/recovery, Git, process/project commands, search/index/context, browser/CDP, Windows native/accessibility/input/vision/computer-use, WSL, Office/document/workbook, system/event log/scheduler/web fetch, extensions/skills/child MCP, audit/activity, SQLite/settings/backups, goals/continuations/tasks, Codex delegation, and upgrade/runtime state.

## 8. Parity gate redesign

`docs/eco-headless-parity.json` remains a machine-readable checkpoint inventory, but the verifier must be strengthened.

The release verifier must check:

1. exact recorded upstream repository/ref/SHA/version;
2. local root version matches the synchronized upstream runtime version;
3. actual ToolRegistry/tool-contract generation succeeds;
4. normal advertised catalog matches the synchronized upstream policy;
5. Codex-enabled catalog matches the synchronized upstream policy;
6. no ECO-specific duplicate tool implementation exists;
7. every required runtime capability category has evidence/tests/classification;
8. no release category is `blocked`;
9. ECO production entrypoint has no Electron/Desktop runtime dependency;
10. ECO packaging contains no custom `eco-node.exe`/ECO runtime executable;
11. a final upstream-main re-check occurs before release.

The verifier may record measured counts in transient CI output/evidence. It must not make 231/195/201 immortal constants that fail merely because upstream legitimately adds or removes tools.

## 9. Packaging changes

The old self-contained ECO distribution model is replaced.

Remove from required ECO distribution:

```text
eco-node.exe
privateNode
privateNodeMajor
privateNodeSha256
```

Retain/build as appropriate:

```text
eco-mcp.cjs
eco-config.cjs
eco-mcp.cmd / eco-config.cmd only as optional local convenience launchers
PowerShell setup/start/stop/status scripts
PACKAGE.json metadata
upstream-required capability helper assets where applicable
```

Launcher scripts must call the resolved system Node runtime rather than an adjacent private `eco-node.exe`.

Tunnel setup must use a direct executable command because tunnel-client executes `CommandArgs[0]`; `CommandArgs[0]` will therefore be the validated system Node executable, not a custom ECO executable.

## 10. State and security

Preserve the lnwjud-compatible state model and existing `LNWJUD_*` compatibility naming where reuse avoids migration risk.

ECO setup continues to require explicit allowed roots and strict-root behavior by default. It must not enable unrestricted mode. ChatGPT Tunnel and Codex MCP clients must converge on the same local state, permission profile, workspace boundaries, audit, recovery, checkpoint, goals, and task state unless the operator intentionally supplies a per-process override already supported by upstream.

Runtime API keys and other secrets must not be stored in Git, docs, ordinary command-line arguments, or parity evidence.

## 11. Skills boundary

MCP core answers **what the machine can do**. Skills answer **how work should be performed**.

After MCP parity is complete, user-specific skills may be added separately for workflows such as software delivery, concrete/civil-engineering analysis, LOKI/Google Apps Script, business operations, research, document/report generation, or other domain processes.

Skills must invoke/reuse MCP tools; they must not fork tool implementations or alter upstream registry semantics solely to encode workflow preferences.

## 12. Testing strategy

Implementation follows TDD for ECO-specific behavior.

Tests must first be changed/added to fail for the old behavior, then implementation is changed to make them pass.

Minimum regression coverage:

- packaging test rejects `eco-node.exe` and private-node metadata;
- runtime resolution test accepts valid system Node 24 and rejects wrong/missing Node;
- tunnel profile test proves direct command starts with resolved system Node path;
- docs/plugin tests reject stale v4.13/private-node architecture text;
- parity tests bind to synchronized upstream SHA/version and derive catalog behavior from registry/tool-contract evidence;
- default and Codex-enabled MCP catalog integration tests pass against the shared runtime;
- capability-family tests include new upstream capability families introduced since v4.13;
- existing strict-root, safety, storage, task/continuation, recovery and lifecycle tests remain passing;
- release gate fails if upstream advances materially after the recorded parity snapshot;
- authoritative Windows release verification passes before merge.

## 13. Migration sequence

1. Record current PR #5 as the old v4.13/private-node checkpoint; keep the PR draft.
2. Synchronize runtime code to upstream `21bcbbf...` / v4.31.0 baseline.
3. Reconcile ECO adapter conflicts against the latest upstream CLI/MCP architecture.
4. Write failing tests for the no-custom-EXE runtime contract and latest parity contract.
5. Remove private Node packaging and implement system Node 24 resolution/validation.
6. Update tunnel command/profile/lifecycle code to use resolved system Node.
7. Refresh capability/parity inventory against the latest upstream registry and policies.
8. Update ECO docs/plugin metadata.
9. Run ECO targeted tests, upstream tool-catalog checks, integration suites, and release gate.
10. Re-check upstream `main`; if advanced materially, repeat synchronization/parity validation.
11. Keep PR draft until real supported-Windows ChatGPT Tunnel + Codex Desktop MCP smoke evidence is recorded.
12. Only after MCP foundation passes, begin separate user-specific Skill work.

## 14. Acceptance criteria

ECO is acceptable when all of the following are true:

- `blackryui/Links` runtime baseline is latest verified lnwjud upstream at merge time;
- ChatGPT Web reaches the local runtime through OpenAI Secure MCP Tunnel;
- Codex Desktop can use the same runtime as an MCP client;
- MCP registry/schema/runtime behavior is upstream-derived rather than cloned;
- upstream default/optional tool advertisement policy is preserved;
- no `lnwjud.exe` or Desktop/Electron host is required;
- no ECO-owned runtime `.exe` is built or bundled;
- system Node 24 is validated as the JavaScript host;
- strict roots, permission/destructive safety, state, audit, recovery, tasks and continuation behavior remain upstream-compatible;
- real Windows smoke evidence exists for ChatGPT Tunnel and Codex MCP client paths;
- Skills remain a separate workflow layer.

## 15. Final product statement

> ECO is a thin headless MCP tunnel/plugin layer over the latest lnwjud runtime. ChatGPT and Codex use the same upstream-derived MCP capabilities and local state. ECO removes the Desktop/Electron requirement and does not ship a custom runtime executable; workflow-specific Skills are developed separately above the MCP layer.
