# ECO Headless — Latest Upstream, No Custom EXE Design

**Date:** 2026-08-30  
**Repository:** `blackryui/Links`  
**Verified upstream baseline:** `engasnm111/lnwjud@21bcbbf67862404bf5814d41bd65d0cd0962c81c`, version `4.31.0`

## Goal

ECO is a thin headless MCP tunnel/plugin layer between ChatGPT Web and the local lnwjud-compatible runtime. Codex Desktop can register the same local stdio MCP runtime as an MCP client.

ECO must not become a second implementation of lnwjud. ToolRegistry, schemas, runtime services, state, permissions, recovery, tasks, continuation logic and capability availability stay upstream-derived. User/domain Skills are a separate workflow layer added only after MCP parity is proven.

## Architecture

```text
ChatGPT Web -> OpenAI Secure MCP Tunnel -> ECO thin adapter -> lnwjud stdio MCP runtime
Codex Desktop -------------------------------------------> same stdio MCP runtime
                                                          -> same ToolRegistry
                                                          -> same local state/audit/recovery/tasks
```

ChatGPT and Codex are independent MCP clients. Optional `codex_*` delegation tools are an upstream capability and are not the mechanism by which Codex Desktop becomes an MCP client.

## Upstream contract

At this checkpoint:

- upstream SHA: `21bcbbf67862404bf5814d41bd65d0cd0962c81c`;
- version: `4.31.0`;
- Node: `>=24.0.0 <25`;
- MCP protocol: `2026-07-28`;
- registry: 231 total definitions;
- default advertised catalog: 195;
- Codex-enabled advertised catalog: 201.

The counts are checkpoint evidence, not permanent ECO constants. ECO must preserve upstream feature/availability policy and derive parity from the live synchronized ToolRegistry/tool contract.

## Synchronization policy

Use upstream-first synchronization. The fork runtime is synchronized to an exact upstream snapshot first, then only a small ECO adapter delta is applied. Do not cherry-pick only visible tool additions and do not clone MCP schemas or tool implementations into ECO-owned files.

Before merge, re-check upstream `main`. A material upstream runtime change blocks a parity-complete claim until resynchronized or explicitly classified as blocked.

## No-custom-EXE contract

ECO must not build, rename, ship or require an ECO-owned runtime executable such as `eco-node.exe`, `eco.exe`, `lnwjud.exe`, or an Electron/Desktop host.

This does not ban normal Windows/upstream executable dependencies. System Node (`node.exe`), PowerShell/cmd, tunnel-client, Codex, ripgrep (`rg.exe`) and optional native/OCR helpers remain valid where the platform/upstream runtime requires them.

ECO's JavaScript host is a validated system Node 24.x runtime. The production tunnel command starts with the absolute system Node path followed by the ECO MCP JavaScript entrypoint.

## Runtime strategy

The current upstream `apps/cli/src/bin/mcp-stdio.ts` is the headless runtime source of truth. It already owns current v4.31 workspace selection, strict roots, permission profile, runtime/task/safety behavior and shared ToolRegistry startup. ECO should wrap/bundle that entrypoint rather than recreate the old v4.13 headless bootstrap.

ECO-specific code is limited to:

- system Node resolution/validation;
- optional packaged-helper environment preparation where needed;
- JS/CJS build entrypoints and convenience launchers;
- Secure MCP Tunnel setup/start/stop/status;
- headless config surface over shared lnwjud settings/state;
- plugin metadata/docs;
- parity/release verification.

## Security and state

Setup requires explicit allowed roots and strict-root behavior by default. Unrestricted/full-bypass behavior is not silently enabled. ChatGPT Tunnel and Codex clients converge on the same lnwjud-compatible SQLite/state, workspace boundaries, permission/destructive policy, audit, checkpoints, recovery, goals and task/continuation state unless an upstream-supported per-process override is intentionally supplied.

Secrets must not be stored in Git, documentation, normal command-line arguments or parity evidence.

## Parity gate

Release validation must prove:

1. recorded upstream SHA/version matches the synchronized runtime checkpoint;
2. ToolRegistry/tool-contract generation succeeds;
3. normal and Codex-enabled catalogs follow upstream policy;
4. no duplicated ECO MCP schemas/tool implementations exist;
5. required capability families are classified and tested;
6. no release category is blocked;
7. no Electron/Desktop runtime import is required by ECO production entrypoints;
8. packaging contains no ECO-owned runtime executable;
9. final upstream-main re-check is performed before parity completion.

Representative families include workspace/project, files/checkpoints/recovery, Git, process/project commands, search/index/context, browser/CDP, Windows native/accessibility/input/vision/computer-use, WSL, Office/document/workbook, system/event-log/scheduler/web-fetch, extensions/skills/child MCP, audit/activity, SQLite/settings/backups, goals/continuations/tasks, Codex delegation and upgrade/runtime state.

## Acceptance

ECO is acceptable when ChatGPT Web reaches the local v4.31+ runtime through Secure MCP Tunnel, Codex Desktop uses the same runtime as an MCP client, upstream tool advertisement/safety/state behavior is preserved, no ECO-owned runtime `.exe` exists, and real supported-Windows smoke evidence is recorded. PR #5 remains Draft until that final real-machine evidence exists.

After this MCP foundation passes, user-specific Skills can be built separately above the MCP layer.
