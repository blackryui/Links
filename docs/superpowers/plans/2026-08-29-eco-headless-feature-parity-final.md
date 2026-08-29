# ECO Headless Feature-Parity Final Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the current lnwjud v4.13.0 Windows agent runtime into ECO Headless: the same runtime behavior, capabilities, state, recovery, tasks, safety model, and optional Codex delegation, hosted as one stdio MCP project for ChatGPT and Codex without requiring Desktop/Electron.

**Architecture:** Keep `apps/cli/src/bin/mcp-stdio.ts`, `apps/cli/src/runtime/stdio-mcp-runtime.ts`, and `packages/mcp-server` as the authoritative execution path. Build a thin ECO packaging/lifecycle layer around that path. ChatGPT uses OpenAI Secure MCP Tunnel -> `eco-mcp` stdio; Codex local uses the same `eco-mcp` stdio entrypoint. Desktop UI responsibilities are replaced by CLI/setup/status surfaces, not by a second runtime.

**Tech Stack:** Node.js 24, TypeScript 6, pnpm 10.15.0, Vitest 3.2.4, esbuild 0.25.x, PowerShell 5.1+, MCP SDK 2.0.0, SQLite, OpenAI Secure MCP Tunnel, Windows 10/11 x64.

**Spec:** `docs/superpowers/specs/2026-08-29-eco-headless-windows-design.md`

**Normative amendment:** `docs/superpowers/specs/2026-08-29-eco-headless-feature-parity-amendment.md`

**Verified plan-time upstream baseline:** `engasnm111/lnwjud@edbc739b6df599e8b824c7c2c75cda1cd9e6d493`, root package version `4.13.0`.

## Global Constraints

- At execution start, refresh upstream `main` and record its exact SHA before production edits; if it moved after `edbc739b6df599e8b824c7c2c75cda1cd9e6d493`, review all runtime-relevant changes before continuing.
- ECO must not intentionally downgrade, fork, or reduce shared lnwjud runtime behavior.
- Every runtime category must be classified as `shared`, `headless-adapter`, `ui-replaced`, `optional-dependency`, or `blocked`; release mode permits no `blocked` or unexplained category.
- Reuse the current `packages/mcp-server` ToolRegistry and schemas. Never duplicate tool implementations or schemas in ECO-owned code.
- Derive current tool catalog/count from ToolRegistry/catalog generation; preserve upstream default/optional rules, including `codex_*` behavior.
- The same `eco-mcp` stdio entrypoint must serve both ChatGPT Secure MCP Tunnel and local Codex MCP.
- ECO primary runtime must import no Electron, Desktop renderer, tray, Desktop IPC, or Desktop Settings dependency.
- First-run setup requires explicit strict allowed roots. Unrestricted mode remains opt-in.
- Do not auto-enable delete/destructive approvals or weaken critical-file/Git/path protections.
- Keep runtime API keys, tunnel IDs, connector IDs, and Codex credentials out of Git and command-line history where feasible.
- Preserve compatible SQLite/state formats and internal `LNWJUD_*` names unless a tested migration requires change.
- Follow RED -> GREEN -> refactor for each production behavior change.
- Do not call ECO feature-parity complete until Task 12 acceptance gates run successfully on a supported Windows host with ChatGPT and Codex smoke evidence.

---

## Task 1: Refresh Upstream Baseline and Establish the Parity Inventory

**Files:**
- Create: `docs/eco-headless-parity.json`
- Create: `scripts/verify-eco-parity.mjs`
- Create: `apps/cli/tests/eco-headless-parity.test.ts`
- Modify: `package.json`

**Interfaces:**
- Produces `docs/eco-headless-parity.json` with exact upstream/local SHAs, versions, categories, evidence paths, and tests.
- Produces `node scripts/verify-eco-parity.mjs --root . [--release]`.

- [ ] **Step 1: Resolve current SHAs before any production edit**

Use Git/GitHub to resolve current upstream `engasnm111/lnwjud` `main` SHA and current ECO implementation-branch base SHA. Write those exact 40-character SHAs into the inventory. Confirm upstream root `package.json` version is still `4.13.0`; if not, update the plan execution baseline and inspect upstream runtime changes first.

- [ ] **Step 2: Write the failing inventory test**

Require exactly these category IDs:

```ts
const requiredCategories = [
  'mcp-transport-protocol',
  'tool-registry-schemas',
  'workspace-project',
  'files-checkpoints-recovery',
  'git',
  'process-project-commands',
  'search-index-context',
  'browser-cdp',
  'windows-native-accessibility-input-vision',
  'wsl',
  'office-document-workbook',
  'system-event-log-scheduler-web-fetch',
  'extensions-skills-child-mcp',
  'audit-activity',
  'sqlite-settings-backups',
  'goals-continuations-tasks',
  'codex-delegation',
  'tunnel-lifecycle',
  'upgrade-update-runtime-state',
  'security-permission-destructive-policy',
] as const;
```

Each category must have non-empty `evidence` and `tests`, and a classification from the approved set.

- [ ] **Step 3: Verify RED**

Run:

```text
corepack pnpm@10.15.0 --filter @lnwjud/cli exec vitest run tests/eco-headless-parity.test.ts
```

Expected: fail because inventory/validator is not complete.

- [ ] **Step 4: Populate initial inventory from existing shared runtime**

Use concrete evidence from:

```text
apps/cli/src/bin/mcp-stdio.ts
apps/cli/src/runtime/stdio-mcp-runtime.ts
packages/mcp-server/src/server.ts
packages/mcp-server/src/stdio.ts
packages/mcp-server/src/tool-registry.ts
packages/application/src/**
packages/capabilities/src/**
packages/codex/src/**
packages/extensions/src/**
packages/storage/src/**
```

Desktop presentation becomes `ui-replaced`; optional external binaries are `optional-dependency` only when upstream uses the same availability rule.

- [ ] **Step 5: Implement parity validator**

`verify-eco-parity.mjs` must reject malformed/missing SHA metadata, missing categories, empty evidence/tests, unknown classifications, `blocked` in `--release`, missing shared CLI/MCP entrypoints, plugin identity drift from eco/ECO, and parity proof based only on a hard-coded tool count.

- [ ] **Step 6: Add scripts**

```json
"test:eco:parity": "corepack pnpm@10.15.0 --filter @lnwjud/cli exec vitest run tests/eco-headless-parity.test.ts",
"validate:eco:parity": "node scripts/verify-eco-parity.mjs --root ."
```

- [ ] **Step 7: Verify GREEN**

Run:

```text
corepack pnpm@10.15.0 test:eco:parity
corepack pnpm@10.15.0 validate:eco:parity
```

Expected: pass.

- [ ] **Step 8: Commit**

```text
git add docs/eco-headless-parity.json scripts/verify-eco-parity.mjs apps/cli/tests/eco-headless-parity.test.ts package.json
git commit -m "test: establish ECO headless parity baseline"
```

---

## Task 2: Extract One Shared Headless Bootstrap

**Files:**
- Create: `apps/cli/src/runtime/headless-mcp-bootstrap.ts`
- Create: `apps/cli/tests/eco-headless-entrypoint.test.ts`
- Modify: `apps/cli/src/bin/mcp-stdio.ts`
- Modify only on proven gap: `apps/cli/src/runtime/stdio-mcp-runtime.ts`

**Interfaces:**
- Produces `runHeadlessMcp(argv: readonly string[], env: NodeJS.ProcessEnv): Promise<HeadlessMcpHandle>`.
- Existing lnwjud CLI entrypoint and ECO distribution both call this function.

- [ ] Write a failing test proving the bootstrap imports no `apps/desktop`, Electron, renderer, tray, or Desktop IPC module and still reaches `createStdioMcpRuntime()` + `startMcpStdio()`.
- [ ] Run the entrypoint test and confirm RED.
- [ ] Extract only argument/environment parsing, workspace selection, scheduled restore, runtime creation, stdio lifecycle, and shutdown orchestration from `mcp-stdio.ts` into `headless-mcp-bootstrap.ts`.
- [ ] Preserve `--profile`, `--strict-roots`, repeated `--allowed-root`, `--workspace`, reset-workspace flags, `LNWJUD_*` variables, activity lease, SQLite state, and shutdown behavior.
- [ ] Keep `mcp-stdio.ts` as a thin upstream-compatible adapter calling `runHeadlessMcp()`.
- [ ] Assert runtime service families still include workspace/project/file/checkpoint/goals/continuations/search/index/git/process/codex/capabilities/extensions.
- [ ] Run:

```text
corepack pnpm@10.15.0 --filter @lnwjud/cli test
corepack pnpm@10.15.0 --filter @lnwjud/cli typecheck
corepack pnpm@10.15.0 test:eco:parity
```

- [ ] Commit: `refactor: share headless MCP bootstrap`.

---

## Task 3: Package `eco-mcp` Without Electron

**Files:**
- Create: `scripts/build-eco-headless.mjs`
- Create: `tests/packaging/eco-headless-packaging.test.ts`
- Modify: `apps/cli/package.json`
- Modify: `package.json`

**Interfaces:**
- Produces `dist/eco-headless/eco-mcp.cjs`, `eco-mcp.cmd`, and `PACKAGE.json`.

- [ ] Write failing packaging tests requiring all three artifacts, source/version metadata, and zero Desktop/Electron dependency in the headless bundle path.
- [ ] Run packaging test and verify RED.
- [ ] Bundle the shared CLI stdio entrypoint with the existing esbuild approach; do not bundle Desktop merely to obtain CLI output.
- [ ] Ensure `eco-mcp.cmd` forwards every argument and launches protocol-only stdout behavior.
- [ ] Add `build:eco` and `test:eco:packaging` scripts.
- [ ] Run build + packaging test + CLI tests/typecheck.
- [ ] Commit: `feat: package ECO headless MCP runtime`.

---

## Task 4: Generate a Secure MCP Tunnel stdio Profile

**Files:**
- Create: `scripts/lib/eco-headless-common.ps1`
- Create: `scripts/setup-eco-headless.ps1`
- Create: `tests/packaging/eco-tunnel-profile.test.ts`

**Interfaces:**
- Produces user-local tunnel profile `eco` whose MCP target is the `eco-mcp.cmd` stdio command with strict-root arguments.

- [ ] Write failing tests requiring profile name `eco`, stdio command target, explicit `--strict-roots`, one `--allowed-root` per configured root, no Desktop `server_urls`, no `lnwjud.exe`, no Electron, and no plaintext runtime API key.
- [ ] Verify RED.
- [ ] Implement shared helpers for profile directory, profile name, log path, bundle resolution, safe command quoting, owner metadata, and Windows-private runtime-key path.
- [ ] Implement setup so it requires at least one existing explicit workspace root, canonicalizes roots, locates/builds ECO bundle, locates tunnel client, creates/updates profile, securely captures runtime API key without normal CLI argument, runs `tunnel-client doctor`, and prints non-secret effective configuration.
- [ ] Run profile/packaging tests.
- [ ] Commit: `feat: configure ECO headless tunnel profile`.

---

## Task 5: Implement Headless start / stop / status Lifecycle

**Files:**
- Create: `scripts/start-eco-tunnel.ps1`
- Create: `scripts/stop-eco-tunnel.ps1`
- Create: `scripts/status-eco-tunnel.ps1`
- Create: `tests/packaging/eco-tunnel-lifecycle.test.ts`
- Modify: `scripts/lib/eco-headless-common.ps1`

**Interfaces:**
- Lifecycle commands manage only the ECO profile owner and never start Desktop.

- [ ] Write failing tests for no Desktop launch, bounded restart, ownership lock, targeted stop, read-only status, delayed secret decryption until ownership claim, environment cleanup in `finally`, `doctor` before `run`, and no secret logging.
- [ ] Verify RED.
- [ ] Implement start with bounded rapid-restart policy and stdio profile execution.
- [ ] Implement stop with owner/profile identity verification; never kill all `tunnel-client.exe` processes by name.
- [ ] Implement status returning profile/secret/bundle/client existence, owner/process state, allowed roots, and bounded last diagnostic without secret contents.
- [ ] Run lifecycle tests.
- [ ] Commit: `feat: manage ECO headless tunnel lifecycle`.

---

## Task 6: Prove Real MCP Project Work Under Strict Roots

**Files:**
- Create: `tests/integration/eco-headless-mcp-flow.test.ts`
- Modify shared CLI runtime only if a failing test proves a real parity gap.

**Interfaces:**
- Spawns `eco-mcp` over stdio and tests the actual MCP protocol with a temporary project.

- [ ] Write integration test launching ECO with `--strict-roots`, one temp allowed root, temp workspace, and existing `full` permission profile.
- [ ] Initialize through MCP client 2.0.0 and list tools.
- [ ] Test workspace/project info, inside-root read, exact inside-root write/edit, Git status, out-of-root denial, destructive-policy behavior, optional Codex-tool default, and a representative process/background-task flow when the environment supports it.
- [ ] Assert runtime state remains usable without Desktop: SQLite, workspace index, activity log, checkpoint/recovery evidence, and narrow goal/task persistence.
- [ ] Run the test before modifying shared runtime. If it already passes, do not change shared runtime.
- [ ] For any failure, compare with upstream main first and reuse upstream behavior rather than creating ECO-specific tool semantics.
- [ ] Run integration + CLI + MCP-server test suites.
- [ ] Update parity evidence and commit: `test: prove ECO headless MCP project flow`.

---

## Task 7: Guard Every Runtime Capability Family

**Files:**
- Create: `tests/integration/eco-capability-catalog.test.ts`
- Modify: `apps/cli/tests/eco-headless-parity.test.ts`
- Modify: `docs/eco-headless-parity.json`

**Interfaces:**
- Produces category-level regression coverage without relying on a permanent tool-count literal.

- [ ] Write representative discovery assertions for browser/CDP, Windows accessibility/input/window/vision/OCR, WSL, Office/document/workbook, system/event-log/scheduler/web-fetch, extensions/child MCP, and PDF/LSP/local providers where current registry supports them.
- [ ] Write a drift test that fails when current registry/runtime evidence introduces a new capability family with no parity classification.
- [ ] Verify RED.
- [ ] Record exact representative tool/capability evidence in parity JSON; use `optional-dependency` only when upstream has the same prerequisite rule.
- [ ] Run GREEN plus `corepack pnpm@10.15.0 docs:tools:check`.
- [ ] Commit: `test: guard ECO runtime capability parity`.

---

## Task 8: Use the Same ECO MCP With Codex

**Files:**
- Create: `tests/integration/eco-codex-mcp-flow.test.ts`
- Create: `docs/eco-codex.md`
- Modify: `docs/eco-headless-parity.json`

**Interfaces:**
- Codex configuration points to the same `dist/eco-headless/eco-mcp.cmd` used by the Secure Tunnel profile.

- [ ] Write failing contract test that rejects any second Codex-specific MCP server implementation.
- [ ] Verify RED.
- [ ] Verify current Codex MCP registration syntax from current installed/documented Codex before writing instructions.
- [ ] Document registration using the same strict-root/workspace arguments and state model; never copy/read Codex credential files.
- [ ] If Codex runtime is available, run a real MCP initialize/list-tools smoke. If absent, mark automated environment test skipped, but do not claim release smoke passed.
- [ ] Update parity inventory and commit: `docs: connect Codex to ECO headless MCP`.

---

## Task 9: Make ChatGPT ECO Documentation Headless-Primary

**Files:**
- Create: `docs/eco-headless.md`
- Modify: `docs/chatgpt-plugin.md`
- Modify: `.codex-plugin/plugin.json`
- Modify: `scripts/validate-chatgpt-plugin.mjs`
- Modify: `tests/plugin/**`

**Interfaces:**
- Primary docs use ECO Headless setup/start/stop/status; Desktop appears only in explicit legacy/optional context.

- [ ] Write failing plugin/docs tests requiring ECO Headless commands, strict roots, Codex, Secure MCP Tunnel, and rejecting primary-path instructions to launch/configure Desktop.
- [ ] Verify RED.
- [ ] Write operator guide covering build/install, roots, secret save, setup/start/stop/status, ChatGPT creation/refresh, read-only smoke, controlled write smoke, Codex registration, prerequisites, state/log paths, troubleshooting, and upgrade/parity policy.
- [ ] Update manifest wording to headless lnwjud-compatible runtime while keeping `name: eco`, `displayName: ECO`.
- [ ] Harden validator against Desktop-required wording regression and continue secret/placeholder checks.
- [ ] Run plugin test + validation.
- [ ] Commit: `docs: make ECO headless the primary ChatGPT path`.

---

## Task 10: Wire ECO Into CI and Release Verification

**Files:**
- Create: `tests/release/eco-headless-release-gate.test.ts`
- Modify: `scripts/verify-release.ps1`
- Modify: `package.json`
- Modify: `.github/workflows/ci.yml`

**Interfaces:**
- Produces aggregate `verify:eco` plus explicit authoritative Windows release stages.

- [ ] Write failing gate test requiring plugin validation, parity test/validator release mode, ECO build/packaging, tunnel profile/lifecycle tests, stdio MCP integration, capability catalog, CLI/MCP-server tests, `docs:tools:check`, lint and typecheck.
- [ ] Verify RED.
- [ ] Add `verify:eco` and explicit `verify-release.ps1` stages in deterministic order.
- [ ] Add ECO gates to Windows CI without removing upstream-compatible existing checks.
- [ ] Run release-gate test and static parity validation.
- [ ] Commit: `ci: gate ECO headless parity`.

---

## Task 11: Re-check Latest Upstream Main Before Merge

**Files:**
- Modify: `docs/eco-headless-parity.json`
- Modify shared runtime/tests only when upstream synchronization requires it.

**Interfaces:**
- Final parity baseline must equal latest reviewed upstream `main` at merge time.

- [ ] Fetch latest upstream SHA/version and compare with Task 1 baseline.
- [ ] Review changes touching MCP runtime/tool registry, CLI stdio runtime, capabilities, permissions/safety, storage/recovery, Codex, tasks/goals/continuations, tunnel behavior, and upgrade state.
- [ ] Classify every new runtime-relevant change in parity inventory; unresolved gap becomes `blocked` and stops release.
- [ ] Run:

```text
corepack pnpm@10.15.0 test:eco:parity
node scripts/verify-eco-parity.mjs --root . --release
corepack pnpm@10.15.0 docs:tools:check
```

- [ ] Commit only actual sync/evidence changes: `chore: sync ECO parity with upstream main`.

---

## Task 12: Full Windows + ChatGPT + Codex Acceptance

**Files:**
- Create: `docs/eco-headless-acceptance-evidence.md`
- Modify parity inventory only when recording non-secret evidence is part of its schema.

**Interfaces:**
- Produces final evidence required before the phrase `feature-parity complete` is allowed.

- [ ] On supported Windows with Node 24, run full lint, typecheck, plugin tests/validator, parity tests/release validator, ECO build/packaging, CLI tests, MCP-server tests, tool-catalog check, and `verify:eco`. Record exact exit codes/test counts.
- [ ] Confirm `lnwjud.exe`/Electron Desktop is not running during ECO smoke tests.
- [ ] Start ECO only through headless scripts.
- [ ] ChatGPT ECO smoke: inspect workspace, Git status, read file, exact controlled write inside strict root, verify diff/result, verify out-of-root denial.
- [ ] Codex smoke with same `eco-mcp`: initialize/list tools, inspect same project, perform a read-only project task, verify shared workspace/state boundaries and optional `codex_*` behavior.
- [ ] Spot-check available runtime categories on Windows: browser/CDP, Windows native/accessibility/vision/input, WSL if installed, Office/document/workbook when prerequisite exists, system/event-log/web-fetch, extensions/child MCP when configured.
- [ ] Document unavailable optional prerequisites as upstream-equivalent optional dependencies, not passes.
- [ ] Write acceptance evidence containing upstream SHA, ECO SHA/version, commands/results, catalog evidence, ChatGPT result, Codex result, no-Desktop evidence, strict-root denial, capability matrix, and optional dependency absences. Include no secrets.
- [ ] Re-run authoritative release verification and parity `--release` after evidence changes.
- [ ] Only when all required gates pass, mark ECO Headless `feature-parity complete` and commit evidence: `docs: record ECO headless acceptance evidence`.
