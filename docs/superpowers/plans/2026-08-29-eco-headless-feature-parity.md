# ECO Headless Feature-Parity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build ECO as the current lnwjud v4.13.0 Windows agent runtime hosted headlessly over MCP for ChatGPT and Codex, preserving runtime, capability, state, recovery, task, safety, and Codex behavior while replacing Desktop/Electron interaction surfaces with headless setup/lifecycle commands.

**Architecture:** Reuse `apps/cli/src/bin/mcp-stdio.ts`, `apps/cli/src/runtime/stdio-mcp-runtime.ts`, and the existing `packages/mcp-server` ToolRegistry as the execution path. OpenAI Secure MCP Tunnel launches the same ECO stdio MCP entrypoint used by local Codex; no Desktop/Electron process is required. A parity inventory and release gate compare ECO against `engasnm111/lnwjud` `main` before implementation and again before merge.

**Tech Stack:** Node.js 24 ESM, TypeScript 6, pnpm 10.15.0, Vitest 3.2.4, esbuild 0.25.x, PowerShell 5.1+, MCP SDK 2.0.0, SQLite-backed lnwjud runtime, OpenAI Secure MCP Tunnel, Windows 10/11 x64.

**Spec:** `docs/superpowers/specs/2026-08-29-eco-headless-windows-design.md`

**Normative amendment:** `docs/superpowers/specs/2026-08-29-eco-headless-feature-parity-amendment.md`

## Global Constraints

- Authoritative parity baseline is `engasnm111/lnwjud` `main`, currently package version `4.13.0`; record the exact upstream commit SHA at execution start.
- `blackryui/Links` must not intentionally downgrade or fork shared lnwjud runtime behavior.
- ECO is not a reduced CLI edition; every runtime-relevant upstream capability must be `shared`, `headless-adapter`, `ui-replaced`, `optional-dependency`, or `blocked` in the parity inventory.
- There must be no unexplained `missing` parity category at release time.
- Reuse the existing `packages/mcp-server` ToolRegistry and schemas; do not duplicate MCP tool schemas or implementations in ECO-owned code.
- Tool count is derived from the current ToolRegistry. Preserve upstream default/optional behavior, including optional `codex_*` delegation; do not hard-code 221/227 as a permanent product constant.
- The same ECO stdio MCP entrypoint must serve OpenAI Secure MCP Tunnel and local Codex MCP configuration.
- ECO primary path must not require `lnwjud.exe`, Electron, renderer, tray, Desktop IPC, or Desktop Settings.
- Default first-run configuration must use explicit strict allowed roots; unrestricted mode remains opt-in.
- Do not auto-enable AI delete approvals or weaken destructive Git/file protections.
- Runtime API keys, tunnel IDs, connector IDs, Codex credentials, and other secrets must never be committed to Git.
- Preserve existing compatible SQLite/state formats and `LNWJUD_*` internal compatibility names unless a verified migration requirement exists.
- TDD is mandatory for production behavior changes: failing test first, verify RED, minimal implementation, verify GREEN, then refactor.
- Before claiming completion, run the full release/parity verification required by the final task and record outputs; do not infer pass status from static review.

---

## Planned File Map

### Create

- `docs/eco-headless.md` — user/operator setup, ChatGPT and Codex connection, lifecycle, troubleshooting.
- `docs/eco-headless-parity.json` — machine-readable parity inventory and baseline metadata.
- `scripts/verify-eco-parity.mjs` — parity inventory validator and registry/version checks.
- `scripts/build-eco-headless.mjs` — bundles the existing CLI stdio entrypoint as ECO headless distribution.
- `scripts/setup-eco-headless.ps1` — explicit root/profile/tunnel setup without Desktop.
- `scripts/start-eco-tunnel.ps1` — starts the Secure MCP Tunnel against ECO stdio command.
- `scripts/stop-eco-tunnel.ps1` — stops only the ECO-owned tunnel process/session.
- `scripts/status-eco-tunnel.ps1` — reports profile, runtime, tunnel and log state without GUI.
- `scripts/lib/eco-headless-common.ps1` — shared profile paths, lock/process helpers, secret-loading helpers.
- `apps/cli/tests/eco-headless-parity.test.ts` — runtime/service/tool parity contract tests.
- `apps/cli/tests/eco-headless-entrypoint.test.ts` — headless entrypoint/no-Desktop dependency tests.
- `tests/packaging/eco-headless-packaging.test.ts` — distribution layout/content checks.
- `tests/packaging/eco-tunnel-profile.test.ts` — tunnel stdio profile and secret-safety checks.
- `tests/integration/eco-headless-mcp-flow.test.ts` — real stdio MCP read/write/strict-root integration.
- `tests/integration/eco-codex-mcp-flow.test.ts` — local Codex MCP configuration/entrypoint contract.

### Modify

- `package.json` — add ECO build/test/validate scripts and release-gate wiring.
- `apps/cli/package.json` — expose narrow ECO test/build commands where needed.
- `apps/cli/src/bin/mcp-stdio.ts` — only if a reusable/exported headless bootstrap seam is required.
- `apps/cli/src/runtime/stdio-mcp-runtime.ts` — only for verified parity gaps; preserve shared behavior.
- `.codex-plugin/plugin.json` — update wording from Desktop-hosted to ECO Headless, no schema duplication.
- `docs/chatgpt-plugin.md` — make headless stdio path primary; Desktop becomes legacy/optional.
- `scripts/validate-chatgpt-plugin.mjs` — validate headless docs/package invariants.
- `scripts/verify-release.ps1` — add ECO parity/headless/integration gates.
- `.github/workflows/ci.yml` — run ECO parity/headless gates if Actions is enabled in the fork.

### Prefer not to modify

- `packages/mcp-server/src/tool-registry.ts`
- `packages/mcp-server/src/tools/**`
- `packages/application/**`
- `packages/capabilities/**`
- `packages/codex/**`

Modify these only when a failing parity test proves a real headless defect that cannot be fixed in an adapter/bootstrap layer.

---

### Task 1: Record Upstream Baseline and Build the Parity Inventory

**Files:**
- Create: `docs/eco-headless-parity.json`
- Create: `scripts/verify-eco-parity.mjs`
- Create: `apps/cli/tests/eco-headless-parity.test.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: upstream repo metadata, local root `package.json`, local ToolRegistry/tool-catalog sources.
- Produces: `docs/eco-headless-parity.json`; command `node scripts/verify-eco-parity.mjs`; script `test:eco:parity`.

- [ ] **Step 1: Capture exact parity baseline before editing production code**

Record in the inventory metadata:

```json
{
  "schemaVersion": 1,
  "upstream": {
    "repository": "engasnm111/lnwjud",
    "ref": "main",
    "commit": "<exact SHA fetched at execution time>",
    "version": "4.13.0"
  },
  "ecoBase": {
    "repository": "blackryui/Links",
    "commit": "<current implementation-branch base SHA>",
    "version": "4.13.0"
  },
  "categories": []
}
```

Do not substitute a release tag for `main` unless the user explicitly changes the parity policy.

- [ ] **Step 2: Write the failing parity inventory test**

Create `apps/cli/tests/eco-headless-parity.test.ts` with required categories:

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

expect(inventory.categories.map((entry) => entry.id)).toEqual(requiredCategories);
expect(inventory.categories.every((entry) =>
  ['shared', 'headless-adapter', 'ui-replaced', 'optional-dependency', 'blocked'].includes(entry.classification),
)).toBe(true);
expect(inventory.categories.some((entry) => entry.classification === 'missing')).toBe(false);
```

Each category object must also include `evidence` with concrete repository paths and `tests` with exact test/script names.

- [ ] **Step 3: Run the narrow test and verify RED**

Run:

```text
corepack pnpm@10.15.0 --filter @lnwjud/cli exec vitest run tests/eco-headless-parity.test.ts
```

Expected: FAIL because the parity inventory is incomplete or validator does not exist yet.

- [ ] **Step 4: Populate the initial parity matrix from shared runtime evidence**

Use existing paths as evidence, including at minimum:

```text
apps/cli/src/bin/mcp-stdio.ts
apps/cli/src/runtime/stdio-mcp-runtime.ts
packages/mcp-server/src/server.ts
packages/mcp-server/src/stdio.ts
packages/mcp-server/src/tool-registry.ts
packages/capabilities/src/**
packages/application/src/**
packages/codex/src/**
packages/storage/src/**
packages/extensions/src/**
```

Classify Desktop presentation responsibilities as `ui-replaced`; classify optional binaries such as OCR/Codex availability as `optional-dependency` where upstream behaves that way.

- [ ] **Step 5: Implement `scripts/verify-eco-parity.mjs`**

It must fail when:

```text
- upstream/local version metadata is absent;
- a required category is absent;
- classification is not one of the approved values;
- any category is `blocked` during release mode;
- evidence/tests arrays are empty;
- plugin manifest is not eco/ECO;
- required CLI/MCP shared entrypoints are missing;
- a permanent hard-coded tool count is used as parity proof instead of registry/catalog evidence.
```

Support:

```text
node scripts/verify-eco-parity.mjs --root .
node scripts/verify-eco-parity.mjs --root . --release
```

- [ ] **Step 6: Add root scripts**

Add:

```json
"test:eco:parity": "corepack pnpm@10.15.0 --filter @lnwjud/cli exec vitest run tests/eco-headless-parity.test.ts",
"validate:eco:parity": "node scripts/verify-eco-parity.mjs --root ."
```

- [ ] **Step 7: Run GREEN verification**

Run both:

```text
corepack pnpm@10.15.0 test:eco:parity
corepack pnpm@10.15.0 validate:eco:parity
```

Expected: PASS with no missing/invalid category.

- [ ] **Step 8: Commit**

```text
git add docs/eco-headless-parity.json scripts/verify-eco-parity.mjs apps/cli/tests/eco-headless-parity.test.ts package.json
git commit -m "test: establish ECO headless parity baseline"
```

---

### Task 2: Extract a Shared Headless Bootstrap Without Changing Runtime Semantics

**Files:**
- Test: `apps/cli/tests/eco-headless-entrypoint.test.ts`
- Modify: `apps/cli/src/bin/mcp-stdio.ts`
- Create or Modify: `apps/cli/src/runtime/headless-mcp-bootstrap.ts`
- Modify only if required: `apps/cli/src/runtime/stdio-mcp-runtime.ts`

**Interfaces:**
- Consumes: existing `createStdioMcpRuntime()`, strict-root helpers, SQLite/state setup, `startMcpStdio()`.
- Produces: `runHeadlessMcp(argv: readonly string[], env: NodeJS.ProcessEnv): Promise<HeadlessMcpHandle>` or an equivalently testable bootstrap used by both lnwjud CLI and ECO distribution.

- [ ] **Step 1: Write a failing no-Desktop dependency test**

The test must statically and behaviorally prove the ECO bootstrap imports no module under:

```text
apps/desktop/
electron
@lnwjud/ipc-contracts Desktop-only host surface
```

It must also prove the bootstrap resolves to `createStdioMcpRuntime()` and `startMcpStdio()` rather than a second ToolRegistry implementation.

- [ ] **Step 2: Run RED**

Run:

```text
corepack pnpm@10.15.0 --filter @lnwjud/cli exec vitest run tests/eco-headless-entrypoint.test.ts
```

Expected: FAIL because there is not yet a reusable ECO bootstrap seam.

- [ ] **Step 3: Extract only orchestration from `mcp-stdio.ts`**

Move argument/environment parsing and runtime lifecycle into a focused reusable module while preserving:

```text
--profile
--strict-roots
--allowed-root
--workspace
--reset-workspaces
--confirm-reset-workspaces
LNWJUD_* compatibility variables
scheduled restore
workspace registration
activity lease
shutdown behavior
```

Do not change tool or service behavior.

- [ ] **Step 4: Keep the existing lnwjud CLI entrypoint as a thin adapter**

`apps/cli/src/bin/mcp-stdio.ts` should call the shared bootstrap so existing upstream-compatible launch behavior remains valid.

- [ ] **Step 5: Add parity assertions for service families**

The test must confirm the resulting runtime still exposes representative service families:

```text
workspaceInfo, workspaceQuery, projectSnapshot, project, file, checkpoint,
goals, scheduledContinuations, search, workspaceIndex, git, process, codex,
capabilities, extensions
```

- [ ] **Step 6: Run CLI tests/typecheck**

Run:

```text
corepack pnpm@10.15.0 --filter @lnwjud/cli test
corepack pnpm@10.15.0 --filter @lnwjud/cli typecheck
```

Expected: PASS.

- [ ] **Step 7: Re-run parity validation**

Run:

```text
corepack pnpm@10.15.0 test:eco:parity
corepack pnpm@10.15.0 validate:eco:parity
```

Expected: PASS.

- [ ] **Step 8: Commit**

```text
git add apps/cli/src/bin/mcp-stdio.ts apps/cli/src/runtime/headless-mcp-bootstrap.ts apps/cli/tests/eco-headless-entrypoint.test.ts
git commit -m "refactor: share headless MCP bootstrap"
```

---

### Task 3: Build the ECO Headless Distribution From the Shared CLI Runtime

**Files:**
- Create: `scripts/build-eco-headless.mjs`
- Create: `tests/packaging/eco-headless-packaging.test.ts`
- Modify: `apps/cli/package.json`
- Modify: `package.json`

**Interfaces:**
- Consumes: shared headless bootstrap from Task 2.
- Produces: `dist/eco-headless/eco-mcp.cjs`, `dist/eco-headless/eco-mcp.cmd`, package metadata/evidence.

- [ ] **Step 1: Write failing packaging test**

Assert distribution contains:

```text
dist/eco-headless/eco-mcp.cjs
dist/eco-headless/eco-mcp.cmd
dist/eco-headless/PACKAGE.json
```

`PACKAGE.json` must record source commit, version, entrypoint and parity inventory path. Test must reject Electron/Desktop imports in the generated bundle text/dependency metadata.

- [ ] **Step 2: Run RED**

Run:

```text
corepack pnpm@10.15.0 exec vitest run tests/packaging/eco-headless-packaging.test.ts
```

Expected: FAIL because distribution does not exist.

- [ ] **Step 3: Implement `scripts/build-eco-headless.mjs`**

Use the existing esbuild strategy to bundle the CLI stdio entrypoint. Public artifacts:

```text
eco-mcp.cjs
eco-mcp.cmd
PACKAGE.json
```

`eco-mcp.cmd` must preserve arguments verbatim and run without Electron.

- [ ] **Step 4: Add scripts**

Add:

```json
"build:eco": "node scripts/build-eco-headless.mjs",
"test:eco:packaging": "vitest run tests/packaging/eco-headless-packaging.test.ts"
```

- [ ] **Step 5: Build and test**

Run:

```text
corepack pnpm@10.15.0 build:eco
corepack pnpm@10.15.0 test:eco:packaging
```

Expected: PASS.

- [ ] **Step 6: Verify existing CLI behavior remains green**

Run:

```text
corepack pnpm@10.15.0 --filter @lnwjud/cli test
corepack pnpm@10.15.0 --filter @lnwjud/cli typecheck
```

- [ ] **Step 7: Commit**

```text
git add scripts/build-eco-headless.mjs tests/packaging/eco-headless-packaging.test.ts apps/cli/package.json package.json
git commit -m "feat: package ECO headless MCP runtime"
```

---

### Task 4: Implement Secure Tunnel Profile Generation for stdio ECO

**Files:**
- Create: `scripts/lib/eco-headless-common.ps1`
- Create: `scripts/setup-eco-headless.ps1`
- Create: `tests/packaging/eco-tunnel-profile.test.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: `dist/eco-headless/eco-mcp.cmd`, `tunnel-client.exe`, explicit allowed roots.
- Produces: user-local tunnel profile `eco`, encrypted/private runtime-key storage instructions, deterministic stdio MCP command.

- [ ] **Step 1: Write failing profile contract test**

The test must prove generated/templated profile semantics:

```text
profile name = eco
MCP target = stdio command invoking eco-mcp.cmd
arguments include --strict-roots and one --allowed-root per explicit root
no Desktop localhost server_urls
no lnwjud.exe
no Electron
no plaintext Runtime API key
```

- [ ] **Step 2: Run RED**

Run:

```text
corepack pnpm@10.15.0 exec vitest run tests/packaging/eco-tunnel-profile.test.ts
```

Expected: FAIL because ECO setup/profile scripts do not exist.

- [ ] **Step 3: Implement shared PowerShell helpers**

`eco-headless-common.ps1` must centralize:

```text
profile directory
profile name eco
log path
stop marker/ownership metadata
bundle resolution
safe command quoting
secret path
DPAPI/private secret read helpers
```

Do not copy Desktop lifecycle implementation wholesale; extract/reuse generic logic where practical.

- [ ] **Step 4: Implement setup command**

`setup-eco-headless.ps1` must:

```text
- require >=1 explicit workspace root;
- canonicalize and verify each root exists;
- build ECO distribution if requested/necessary or fail with exact build command;
- locate or accept tunnel-client.exe;
- create/update profile eco for stdio command execution;
- save Runtime API key only through an interactive secure/private local flow;
- run tunnel-client doctor;
- print effective data path, roots, profile path, bundle path;
- never launch Desktop.
```

Do not accept Runtime API key as a normal command-line argument because it leaks into process history.

- [ ] **Step 5: Run profile tests**

Run:

```text
corepack pnpm@10.15.0 test:eco:packaging
corepack pnpm@10.15.0 exec vitest run tests/packaging/eco-tunnel-profile.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```text
git add scripts/lib/eco-headless-common.ps1 scripts/setup-eco-headless.ps1 tests/packaging/eco-tunnel-profile.test.ts package.json
git commit -m "feat: configure ECO headless tunnel profile"
```

---

### Task 5: Add Headless start / stop / status Lifecycle With Ownership Safety

**Files:**
- Create: `scripts/start-eco-tunnel.ps1`
- Create: `scripts/stop-eco-tunnel.ps1`
- Create: `scripts/status-eco-tunnel.ps1`
- Create: `tests/packaging/eco-tunnel-lifecycle.test.ts`
- Modify: `scripts/lib/eco-headless-common.ps1`

**Interfaces:**
- Consumes: ECO profile and secret created by Task 4.
- Produces: explicit lifecycle commands that manage only ECO-owned tunnel processes and logs.

- [ ] **Step 1: Write failing lifecycle tests**

Test source/contracts for:

```text
- no lnwjud.exe/Desktop/Electron launch;
- bounded rapid restart policy;
- owner metadata/lock prevents duplicate owners;
- stop only targets current ECO profile owner;
- status is read-only;
- runtime key is loaded into process environment only after ownership claim;
- runtime key environment is cleared in finally;
- doctor runs before tunnel-client run;
- stderr/log tail is used for diagnostics without leaking secrets.
```

- [ ] **Step 2: Run RED**

Run:

```text
corepack pnpm@10.15.0 exec vitest run tests/packaging/eco-tunnel-lifecycle.test.ts
```

- [ ] **Step 3: Implement start command**

`start-eco-tunnel.ps1` must run profile `eco`, maintain a bounded retry loop, and use the stdio MCP command embedded in the profile. It must not start a separate MCP server itself.

- [ ] **Step 4: Implement stop command**

Stop must verify ownership metadata/profile identity before terminating a process or setting a stop marker. Never kill arbitrary `tunnel-client.exe` processes by name alone.

- [ ] **Step 5: Implement status command**

Report:

```text
profileExists
secretExists
bundleExists
tunnelClientExists
ownerState
processState
lastLogDiagnostic
configuredAllowedRoots
```

Never print secret contents.

- [ ] **Step 6: Run lifecycle tests**

Run:

```text
corepack pnpm@10.15.0 exec vitest run tests/packaging/eco-tunnel-profile.test.ts tests/packaging/eco-tunnel-lifecycle.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```text
git add scripts/start-eco-tunnel.ps1 scripts/stop-eco-tunnel.ps1 scripts/status-eco-tunnel.ps1 scripts/lib/eco-headless-common.ps1 tests/packaging/eco-tunnel-lifecycle.test.ts
git commit -m "feat: manage ECO headless tunnel lifecycle"
```

---

### Task 6: Prove Strict-Root MCP Read/Write and Runtime State Without Desktop

**Files:**
- Create: `tests/integration/eco-headless-mcp-flow.test.ts`
- Modify only if failing evidence requires: `apps/cli/src/runtime/headless-mcp-bootstrap.ts`
- Modify only if failing evidence requires: `apps/cli/src/runtime/stdio-mcp-runtime.ts`

**Interfaces:**
- Consumes: built ECO stdio command.
- Produces: end-to-end MCP integration proof without Desktop.

- [ ] **Step 1: Write integration test using a temporary workspace**

Spawn ECO stdio MCP with:

```text
--strict-roots
--allowed-root <temp workspace>
--workspace <temp workspace>
--profile full
```

Use MCP client 2.0.0 to initialize and list tools.

- [ ] **Step 2: Add representative read/write assertions**

At minimum:

```text
- workspace/project info succeeds;
- file read succeeds inside root;
- one controlled file write/edit succeeds inside root;
- Git status/inspection succeeds in initialized temp repo;
- out-of-root file access is denied;
- destructive delete remains denied unless explicit existing policy enables it;
- optional codex_* tools follow upstream default state;
- process/background task representative flow works if supported in test environment.
```

- [ ] **Step 3: Verify state/recovery without Desktop**

Assert local state files/repositories needed by headless runtime are created/usable, including applicable:

```text
lnwjud.sqlite
workspace index
activity log
checkpoint/recovery state after a controlled checkpoint-producing mutation
goal/task state for a narrow durable-state test
```

- [ ] **Step 4: Run RED before any headless-specific runtime fix**

Run:

```text
corepack pnpm@10.15.0 exec vitest run tests/integration/eco-headless-mcp-flow.test.ts
```

If it passes without production changes, do not modify shared runtime merely to create work.

- [ ] **Step 5: Fix only demonstrated parity gaps**

Any shared-runtime modification requires:

```text
1. failing test naming the missing behavior;
2. comparison with upstream main implementation;
3. reuse/merge upstream behavior where available;
4. no ECO-only fork of tool semantics.
```

- [ ] **Step 6: Run integration + shared package tests**

Run:

```text
corepack pnpm@10.15.0 exec vitest run tests/integration/eco-headless-mcp-flow.test.ts
corepack pnpm@10.15.0 --filter @lnwjud/cli test
corepack pnpm@10.15.0 --filter @lnwjud/mcp-server test
```

Expected: PASS.

- [ ] **Step 7: Update parity inventory evidence**

Add concrete test names for categories proven by this integration flow.

- [ ] **Step 8: Commit**

```text
git add tests/integration/eco-headless-mcp-flow.test.ts docs/eco-headless-parity.json apps/cli/src/runtime/headless-mcp-bootstrap.ts apps/cli/src/runtime/stdio-mcp-runtime.ts
git commit -m "test: prove ECO headless MCP project flow"
```

Only include runtime files that actually changed.

---

### Task 7: Preserve Capability Families and Detect Parity Regression

**Files:**
- Modify: `apps/cli/tests/eco-headless-parity.test.ts`
- Create: `tests/integration/eco-capability-catalog.test.ts`
- Modify: `docs/eco-headless-parity.json`

**Interfaces:**
- Consumes: current ToolRegistry and capability descriptors/backends.
- Produces: category-level regression gate for browser, Windows, WSL, Office/system/extensions and optional dependencies.

- [ ] **Step 1: Write representative capability-category assertions**

The test should discover representative tool/descriptors for every current runtime category rather than snapshotting a permanent numeric count.

Use explicit representative families based on the current registry, for example:

```text
browser/CDP
Windows accessibility/input/window/vision/OCR
WSL
Office/document/workbook
system/event-log/scheduler/web-fetch
extensions/child MCP
PDF/LSP/local-provider capabilities
```

If exact tool names differ at execution time, derive them from the current catalog and record the chosen representatives in `docs/eco-headless-parity.json`.

- [ ] **Step 2: Add an upstream-category drift test**

The test must fail if a known parity category is removed from the inventory or if current registry/capability evidence contains a new runtime family with no classification.

- [ ] **Step 3: Run RED**

Run:

```text
corepack pnpm@10.15.0 exec vitest run tests/integration/eco-capability-catalog.test.ts apps/cli/tests/eco-headless-parity.test.ts
```

- [ ] **Step 4: Populate representative evidence and optional dependency rules**

Classify unavailable optional binaries as `optional-dependency`, not `missing`, only when upstream follows the same availability rule.

- [ ] **Step 5: Run GREEN**

Run the same test command plus:

```text
corepack pnpm@10.15.0 docs:tools:check
```

Expected: PASS.

- [ ] **Step 6: Commit**

```text
git add apps/cli/tests/eco-headless-parity.test.ts tests/integration/eco-capability-catalog.test.ts docs/eco-headless-parity.json
git commit -m "test: guard ECO runtime capability parity"
```

---

### Task 8: Make the Same ECO stdio Entry Point Work for Local Codex

**Files:**
- Create: `tests/integration/eco-codex-mcp-flow.test.ts`
- Create: `docs/eco-codex.md` or add a focused section to `docs/eco-headless.md`
- Modify: `docs/eco-headless-parity.json`

**Interfaces:**
- Consumes: `dist/eco-headless/eco-mcp.cmd`.
- Produces: documented Codex MCP registration command/config and smoke-test contract.

- [ ] **Step 1: Write failing Codex MCP contract test**

Test that Codex registration examples invoke the same `eco-mcp` artifact as the tunnel profile and do not reference a second server implementation.

- [ ] **Step 2: Verify RED**

Run:

```text
corepack pnpm@10.15.0 exec vitest run tests/integration/eco-codex-mcp-flow.test.ts
```

- [ ] **Step 3: Document local Codex connection**

Document the current supported Codex MCP configuration/CLI syntax after verifying it against the installed/current Codex documentation/runtime at execution time. Preserve:

```text
strict roots
workspace arguments
same data/state model
same optional codex_* delegation policy
no credential-file copying
```

Do not modify the user's global Codex config automatically unless explicitly requested.

- [ ] **Step 4: Add a smoke test when Codex runtime is available**

When the test environment has Codex, verify it can initialize ECO and list tools through stdio. When Codex is absent, the automated suite may mark this environment-dependent smoke as skipped, but the final release gate cannot claim Codex smoke passed without an actual available runtime execution.

- [ ] **Step 5: Update parity inventory**

Set `codex-delegation` evidence/tests to the shared runtime plus this local MCP registration proof.

- [ ] **Step 6: Commit**

```text
git add tests/integration/eco-codex-mcp-flow.test.ts docs/eco-headless-parity.json docs/eco-codex.md
git commit -m "docs: connect Codex to ECO headless MCP"
```

---

### Task 9: Update ECO Plugin and User Documentation to Headless-Primary

**Files:**
- Create: `docs/eco-headless.md`
- Modify: `docs/chatgpt-plugin.md`
- Modify: `.codex-plugin/plugin.json`
- Modify: `scripts/validate-chatgpt-plugin.mjs`
- Modify: plugin tests under `tests/plugin/`

**Interfaces:**
- Consumes: completed ECO distribution/lifecycle commands.
- Produces: accurate ChatGPT-facing setup flow with Desktop marked legacy/optional.

- [ ] **Step 1: Write failing docs/plugin contract tests**

Require docs to contain:

```text
ECO Headless
setup-eco-headless.ps1
start-eco-tunnel.ps1
stop-eco-tunnel.ps1
status-eco-tunnel.ps1
strict roots
Codex
Secure MCP Tunnel
```

And require primary setup docs not to instruct:

```text
Launch lnwjud Desktop
Configure Tunnel in Desktop Settings
Desktop owns Active Project
```

Legacy sections may mention Desktop only when clearly labeled optional/legacy.

- [ ] **Step 2: Run RED**

Run plugin tests.

- [ ] **Step 3: Rewrite setup flow**

`docs/eco-headless.md` must cover:

```text
build/install
explicit workspace root selection
runtime key secure save
setup
start/stop/status
ChatGPT ECO creation/refresh
read-only smoke
controlled write smoke
Codex local MCP registration
capability prerequisites
state/log locations
troubleshooting
upgrade/parity policy
```

- [ ] **Step 4: Update plugin wording**

Manifest and skill/docs wording should say ECO connects to the headless lnwjud-compatible Windows MCP runtime, not Desktop.

- [ ] **Step 5: Harden validator**

Validator must reject regression to Desktop-required primary wording and continue rejecting secrets/placeholder connector IDs.

- [ ] **Step 6: Run plugin validation**

Run:

```text
corepack pnpm@10.15.0 test:plugin
corepack pnpm@10.15.0 validate:plugin
```

Expected: PASS.

- [ ] **Step 7: Commit**

```text
git add docs/eco-headless.md docs/chatgpt-plugin.md .codex-plugin/plugin.json scripts/validate-chatgpt-plugin.mjs tests/plugin
git commit -m "docs: make ECO headless the primary ChatGPT path"
```

---

### Task 10: Wire ECO Gates Into CI and Release Verification

**Files:**
- Modify: `scripts/verify-release.ps1`
- Modify: `package.json`
- Modify: `.github/workflows/ci.yml`
- Create or Modify: `tests/release/eco-headless-release-gate.test.ts`

**Interfaces:**
- Consumes: all tests/scripts from Tasks 1–9.
- Produces: authoritative automated gate before ECO Headless release/merge.

- [ ] **Step 1: Write failing release-gate test**

Require release script/CI to run:

```text
test:plugin
validate:plugin
test:eco:parity
validate:eco:parity --release
build:eco
test:eco:packaging
ECO tunnel profile/lifecycle tests
ECO stdio MCP integration tests
ECO capability catalog tests
CLI/MCP server tests
docs:tools:check
lint
typecheck
```

- [ ] **Step 2: Run RED**

Run the release-gate test only.

- [ ] **Step 3: Wire root scripts**

Add a narrow aggregate command such as:

```json
"verify:eco": "<ordered ECO verification commands>"
```

Keep the authoritative Windows release script explicit about each stage so failures identify the exact gate.

- [ ] **Step 4: Update CI**

When GitHub Actions is enabled, CI on pull requests to `main` must run the ECO verification gates on the supported Windows environment. Do not remove existing upstream-compatible checks.

- [ ] **Step 5: Run release-gate test and static parity validation**

Expected: PASS.

- [ ] **Step 6: Commit**

```text
git add scripts/verify-release.ps1 package.json .github/workflows/ci.yml tests/release/eco-headless-release-gate.test.ts
git commit -m "ci: gate ECO headless parity"
```

---

### Task 11: Rebase/Sync Against Latest Upstream Main and Close Parity Gaps

**Files:**
- Modify: `docs/eco-headless-parity.json`
- Modify shared runtime files only when upstream synchronization requires it.
- Modify relevant tests for newly introduced upstream runtime categories.

**Interfaces:**
- Consumes: current `engasnm111/lnwjud` `main` at final verification time.
- Produces: final recorded upstream SHA and zero unexplained parity gaps.

- [ ] **Step 1: Fetch latest upstream main metadata**

Record the final upstream SHA and package version. Compare it with the Task 1 baseline.

- [ ] **Step 2: Inspect material upstream changes since baseline**

Focus on:

```text
MCP runtime/tool registry
CLI stdio runtime
capabilities
permissions/safety
storage/recovery
Codex
tasks/goals/continuations
tunnel behavior
upgrade/runtime state
```

Ignore purely cosmetic Desktop renderer changes unless they imply runtime state/configuration behavior ECO must replace.

- [ ] **Step 3: Update parity inventory before merging code**

Every new runtime-relevant upstream change must be classified and evidenced. If a gap cannot safely be resolved, classify it `blocked` and stop release.

- [ ] **Step 4: Run parity regression tests**

Run:

```text
corepack pnpm@10.15.0 test:eco:parity
node scripts/verify-eco-parity.mjs --root . --release
corepack pnpm@10.15.0 docs:tools:check
```

Expected: PASS with zero blocked/missing categories.

- [ ] **Step 5: Commit final parity sync**

```text
git add docs/eco-headless-parity.json <only actually synchronized files>
git commit -m "chore: sync ECO parity with upstream main"
```

---

### Task 12: Perform Full Windows, ChatGPT, and Codex Acceptance Verification

**Files:**
- Update: `docs/eco-headless-parity.json` with final verification evidence only if the repository's evidence schema includes runtime evidence.
- Create: `docs/eco-headless-acceptance-evidence.md`.

**Interfaces:**
- Consumes: final ECO build, Secure MCP Tunnel, ChatGPT ECO app/connection, local Codex runtime.
- Produces: release evidence demonstrating the approved product goal.

- [ ] **Step 1: Run full repository verification on supported Windows/Node 24 environment**

Run:

```text
corepack pnpm@10.15.0 lint
corepack pnpm@10.15.0 typecheck
corepack pnpm@10.15.0 test:plugin
corepack pnpm@10.15.0 validate:plugin
corepack pnpm@10.15.0 test:eco:parity
node scripts/verify-eco-parity.mjs --root . --release
corepack pnpm@10.15.0 build:eco
corepack pnpm@10.15.0 test:eco:packaging
corepack pnpm@10.15.0 --filter @lnwjud/cli test
corepack pnpm@10.15.0 --filter @lnwjud/mcp-server test
corepack pnpm@10.15.0 docs:tools:check
corepack pnpm@10.15.0 verify:eco
```

Record exact exit codes and test counts.

- [ ] **Step 2: Verify no Desktop process is required**

Before smoke tests, confirm `lnwjud.exe`/Electron Desktop is not running. Start ECO only through headless scripts.

- [ ] **Step 3: ChatGPT Secure MCP Tunnel smoke**

From ChatGPT using ECO:

```text
1. list registered/active workspace state;
2. inspect Git status;
3. read a known file;
4. perform one exact controlled write inside strict root;
5. verify diff/result;
6. confirm an out-of-root request is denied.
```

Record the ECO connector/app identity without committing secrets.

- [ ] **Step 4: Codex local MCP smoke**

Using local Codex and the same `eco-mcp` stdio artifact:

```text
1. initialize/list ECO tools;
2. inspect the same project;
3. perform a read-only project task;
4. confirm workspace boundary and runtime state are shared/compatible;
5. verify optional `codex_*` delegation behavior matches upstream settings.
```

- [ ] **Step 5: Capability spot checks**

On the Windows host, test representative available categories:

```text
browser/CDP
Windows native/accessibility/vision/input
WSL (if installed)
Office/document/workbook capability (if prerequisite is installed)
system/event-log/web-fetch
extensions/child MCP if configured
```

Unavailable optional prerequisites must be documented as upstream-equivalent optional dependencies, not silently counted as pass.

- [ ] **Step 6: Write acceptance evidence**

`docs/eco-headless-acceptance-evidence.md` must contain:

```text
upstream baseline SHA
ECO commit SHA
version
commands executed and results
ToolRegistry/catalog evidence
ChatGPT smoke result
Codex smoke result
no-Desktop evidence
strict-root denial evidence
capability spot-check matrix
known optional dependency absences
```

No secrets.

- [ ] **Step 7: Final release gate**

Run the authoritative release verification script and parity release validator again after evidence changes.

Only if all required gates pass may the implementation be described as **feature-parity complete**.

- [ ] **Step 8: Commit evidence**

```text
git add docs/eco-headless-acceptance-evidence.md docs/eco-headless-parity.json
git commit -m "docs: record ECO headless acceptance evidence"
```
