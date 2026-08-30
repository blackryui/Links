# ECO Headless v4.31 No-Custom-EXE Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Synchronize ECO Headless with the latest verified lnwjud v4.31.0 runtime, remove the ECO-owned `eco-node.exe`, and preserve upstream MCP ToolRegistry/capability behavior for ChatGPT Secure MCP Tunnel and Codex Desktop.

**Architecture:** Start from the exact upstream runtime snapshot `engasnm111/lnwjud@21bcbbf67862404bf5814d41bd65d0cd0962c81c`, then re-apply only the ECO thin headless adapter. ECO uses system Node 24.x as the JavaScript host and keeps upstream runtime/tool/state/safety code shared rather than cloned.

**Tech Stack:** TypeScript, Node.js 24, pnpm 10.15.0, Vitest, PowerShell 5.1+, MCP TypeScript SDK v2, OpenAI Secure MCP Tunnel, GitHub Actions Windows release verification.

**Spec:** `docs/superpowers/specs/2026-08-30-eco-headless-latest-upstream-no-custom-exe-design.md`

## Global Constraints

- Upstream design checkpoint: `engasnm111/lnwjud@21bcbbf67862404bf5814d41bd65d0cd0962c81c`, version `4.31.0`.
- Node requirement: `>=24.0.0 <25`.
- ECO must not build, rename, ship, or require an ECO-owned runtime executable such as `eco-node.exe`.
- `lnwjud.exe` and Desktop/Electron must not be required for ECO Headless.
- System/upstream executables such as `node.exe`, `rg.exe`, optional OCR helpers, tunnel-client, and Codex remain valid dependencies where upstream requires them.
- Upstream ToolRegistry/schema/service code remains the source of truth; do not clone tool implementations into ECO.
- Upstream tool advertisement policy is preserved; the v4.31.0 checkpoint measures 231 definitions, 195 default advertised tools, and 201 with the six `codex_*` tools enabled, but these are not permanent constants.
- Strict allowed roots remain the ECO setup default; unrestricted mode is not enabled by setup.
- PR #5 remains Draft until real supported-Windows ChatGPT Tunnel and Codex Desktop smoke evidence exists.

---

### Task 1: Synchronize the runtime baseline before re-applying ECO

**Files:**
- Preserve: current `feat/eco-headless-runtime` head as a backup branch/reference.
- Replace runtime baseline with: `engasnm111/lnwjud@21bcbbf67862404bf5814d41bd65d0cd0962c81c`.
- Re-apply only ECO-specific files/deltas after synchronization.

**Interfaces:**
- Consumes: upstream commit `21bcbbf67862404bf5814d41bd65d0cd0962c81c`.
- Produces: branch runtime whose root `package.json` reports `4.31.0` and whose MCP/runtime files match upstream before ECO deltas are reintroduced.

- [ ] **Step 1: Preserve the current ECO checkpoint**

Create a backup ref from the current PR head before rewriting/synchronizing the implementation branch.

Expected backup name:

```text
backup/eco-headless-v4.13-private-node
```

- [ ] **Step 2: Move the implementation baseline to the upstream v4.31.0 commit**

The synchronized root must contain:

```json
{
  "name": "lnwjud",
  "version": "4.31.0",
  "engines": { "node": ">=24.0.0 <25" }
}
```

- [ ] **Step 3: Verify baseline identity before ECO changes**

Verify at minimum:

```text
package.json version = 4.31.0
upstream SHA = 21bcbbf67862404bf5814d41bd65d0cd0962c81c
docs/mcp/MCP_TOOL_CATALOG.md documents MCP 2026-07-28
```

Expected tool-catalog checkpoint text:

```text
231 total tool definitions
195 advertised by default
201 advertised with codex_* delegation enabled
```

- [ ] **Step 4: Re-apply the ECO spec and plan documents first**

Restore:

```text
docs/superpowers/specs/2026-08-30-eco-headless-latest-upstream-no-custom-exe-design.md
docs/superpowers/plans/2026-08-30-eco-headless-v4.31-no-custom-exe.md
```

- [ ] **Step 5: Commit the synchronized baseline checkpoint**

Commit message:

```text
chore: sync ECO runtime baseline to lnwjud v4.31.0
```

---

### Task 2: Add failing tests for the no-custom-EXE contract

**Files:**
- Create/Modify: `tests/packaging/eco-headless-packaging.test.ts`
- Create/Modify: `tests/packaging/eco-tunnel-profile.test.ts`
- Create/Modify: `apps/cli/tests/eco-system-node-runtime.test.ts`

**Interfaces:**
- Produces: `resolveEcoNodeRuntime(explicitPath?: string, env?: NodeJS.ProcessEnv)` returning `{ nodePath: string; version: string }` or throwing a descriptive error.

- [ ] **Step 1: Write packaging assertions that reject private Node artifacts**

Required assertions:

```ts
expect(await exists(path.join(distRoot, 'eco-node.exe'))).toBe(false);
expect(metadata.privateNode).toBeUndefined();
expect(metadata.privateNodeMajor).toBeUndefined();
expect(metadata.privateNodeSha256).toBeUndefined();
```

Also assert that `eco-mcp.cjs`, `eco-config.cjs`, lifecycle/config scripts and valid upstream helper assets remain present as required.

- [ ] **Step 2: Write runtime-resolution tests**

Test cases:

```ts
it('accepts an explicit Node 24 executable');
it('rejects an explicit Node executable outside major 24');
it('resolves node from PATH when no explicit path is supplied');
it('fails closed when no valid Node 24 runtime can be resolved');
```

The version validation contract is:

```ts
major === 24
```

- [ ] **Step 3: Write tunnel profile assertions**

The generated direct MCP command must begin with the resolved system Node executable and then `eco-mcp.cjs`:

```text
"C:\\Program Files\\nodejs\\node.exe" "C:\\...\\eco-mcp.cjs" --strict-roots ...
```

Assert it does not contain `eco-node.exe`.

- [ ] **Step 4: Run targeted tests and confirm RED state**

Run:

```text
corepack pnpm@10.15.0 vitest run tests/packaging/eco-headless-packaging.test.ts tests/packaging/eco-tunnel-profile.test.ts
corepack pnpm@10.15.0 --filter @lnwjud/cli exec vitest run tests/eco-system-node-runtime.test.ts
```

Expected: failures caused by old private-node packaging / missing runtime resolver.

- [ ] **Step 5: Commit tests only**

Commit message:

```text
test: define ECO system-node runtime contract
```

---

### Task 3: Implement system Node 24 resolution and remove private-node packaging

**Files:**
- Create: `apps/cli/src/runtime/eco-system-node-runtime.ts`
- Modify: `scripts/build-eco-headless.mjs`
- Modify: `scripts/lib/eco-runtime-package.ps1`
- Modify: `scripts/setup-eco-headless.ps1`
- Modify: `apps/cli/src/runtime/packaged-runtime-env.ts` if private-node assumptions remain.

**Interfaces:**
- Produces TypeScript helper:

```ts
export type EcoNodeRuntime = { nodePath: string; version: string };
export async function resolveEcoNodeRuntime(
  explicitPath?: string,
  env?: NodeJS.ProcessEnv,
): Promise<EcoNodeRuntime>;
```

- Produces PowerShell runtime package object containing `nodePath`, `scriptPath`, and capability helper paths, but no private-node fields.

- [ ] **Step 1: Implement Node path/version validation**

Behavior:

```ts
const major = Number.parseInt(version.replace(/^v/, '').split('.')[0] ?? '', 10);
if (major !== 24) throw new Error(`ECO Headless requires Node.js 24.x; got ${version}`);
```

Resolve an explicit path first; otherwise resolve `node`/`node.exe` from the environment. Execute `<nodePath> --version` and validate before returning.

- [ ] **Step 2: Remove private Node copy from build script**

Delete behavior equivalent to:

```js
const nodeTarget = path.join(distRoot, 'eco-node.exe');
await copyFile(process.execPath, nodeTarget);
```

Remove `privateNode`, `privateNodeMajor`, and `privateNodeSha256` from `PACKAGE.json` metadata.

- [ ] **Step 3: Change local `.cmd` launchers to use system Node**

Launcher shape:

```bat
@echo off
setlocal
set "BASE=%~dp0"
node "%BASE%eco-mcp.cjs" %*
```

The launcher is convenience-only; production tunnel setup must store the validated absolute Node executable path.

- [ ] **Step 4: Change PowerShell runtime resolution**

`Resolve-EcoRuntimePackage` must no longer resolve adjacent `eco-node.exe`. It must resolve/validate a system Node 24 path and return it as `nodePath`.

- [ ] **Step 5: Keep upstream helper handling separate**

Do not remove `rg.exe` or optional OCR solely because they are executables. Keep or adapt them according to v4.31.0 upstream capability packaging/availability behavior.

- [ ] **Step 6: Run targeted tests and confirm GREEN state**

Run the Task 2 commands again.

Expected: PASS.

- [ ] **Step 7: Commit**

Commit message:

```text
feat: run ECO headless through system Node 24
```

---

### Task 4: Reconcile ECO headless bootstrap with lnwjud v4.31.0 runtime changes

**Files:**
- Modify/Create only as needed: `apps/cli/src/bin/mcp-stdio.ts`
- Modify/Create only as needed: `apps/cli/src/bin/eco-config.ts`
- Modify/Create only as needed: `apps/cli/src/runtime/headless-mcp-bootstrap.ts`
- Modify/Create only as needed: `apps/cli/src/runtime/headless-config.ts`
- Modify/Create only as needed: `apps/cli/src/runtime/packaged-runtime-env.ts`
- Test: `apps/cli/tests/eco-headless-entrypoint.test.ts`
- Test: `apps/cli/tests/eco-headless-config.test.ts`
- Test: `apps/cli/tests/eco-headless-config-cli.test.ts`
- Test: `apps/cli/tests/eco-codex-tools-option.test.ts`

**Interfaces:**
- Consumes: current upstream CLI/MCP runtime services and settings keys.
- Produces: one ECO stdio entrypoint that delegates to upstream runtime services without importing Electron/Desktop IPC.

- [ ] **Step 1: Compare v4.13 ECO bootstrap assumptions with current upstream CLI/runtime APIs**

Check current signatures/imports before restoring old ECO code. Do not force old APIs onto v4.31.0.

- [ ] **Step 2: Add/restore failing ECO entrypoint/config tests against v4.31.0 APIs**

Tests must assert:

```text
same shared ToolRegistry/runtime services
strict roots supported
stored permission profile supported
codex delegation follows upstream enablement
no electron/desktop runtime import
```

- [ ] **Step 3: Implement the smallest compatible headless adapter**

Prefer extracting/reusing upstream CLI stdio orchestration. ECO-specific code should be orchestration/config only.

- [ ] **Step 4: Run CLI ECO tests**

Run:

```text
corepack pnpm@10.15.0 --filter @lnwjud/cli exec vitest run tests/eco-headless-entrypoint.test.ts tests/eco-headless-config.test.ts tests/eco-headless-config-cli.test.ts tests/eco-codex-tools-option.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

Commit message:

```text
feat: adapt ECO bootstrap to lnwjud v4.31 runtime
```

---

### Task 5: Replace static parity checkpoint logic with upstream-derived parity gates

**Files:**
- Modify/Create: `docs/eco-headless-parity.json`
- Modify/Create: `scripts/verify-eco-parity.mjs`
- Modify/Create: `apps/cli/tests/eco-headless-parity.test.ts`
- Modify/Create: `tests/integration/eco-capability-catalog.test.ts`
- Modify/Create: `tests/integration/eco-codex-mcp-flow.test.ts`
- Modify/Create: `tests/integration/eco-headless-mcp-flow.test.ts`

**Interfaces:**
- Produces parity inventory recording exact upstream SHA/version at the current checkpoint.
- Produces verifier that derives actual catalog behavior from local synchronized upstream code rather than permanent count constants.

- [ ] **Step 1: Record the v4.31.0 checkpoint**

Inventory header:

```json
{
  "upstream": {
    "repository": "engasnm111/lnwjud",
    "ref": "main",
    "commit": "21bcbbf67862404bf5814d41bd65d0cd0962c81c",
    "version": "4.31.0"
  }
}
```

- [ ] **Step 2: Add failing parity tests for stale baselines and private-node artifacts**

Assertions must fail when:

```text
root package version != recorded upstream version
recorded SHA is malformed/stale at release check
ECO duplicates MCP tool schemas
production package contains eco-node.exe
upstream-defined capability category lacks ECO classification/evidence
```

- [ ] **Step 3: Derive tool catalog behavior from current runtime**

Use existing upstream tool catalog generation/ToolRegistry tests as the oracle. At the v4.31.0 checkpoint CI output may report:

```text
definitions=231
default=195
codex-enabled=201
```

but the verifier must not encode those values as immortal release constants.

- [ ] **Step 4: Extend representative capability coverage for upstream additions since v4.13**

Include current computer-use/native/browser/task/continuation families exposed by v4.31.0.

- [ ] **Step 5: Run parity/integration tests**

Run:

```text
corepack pnpm@10.15.0 validate:eco:parity
corepack pnpm@10.15.0 test:eco:parity
corepack pnpm@10.15.0 test:eco:integration
corepack pnpm@10.15.0 docs:tools:check
```

Expected: PASS.

- [ ] **Step 6: Commit**

Commit message:

```text
test: enforce latest-upstream ECO parity
```

---

### Task 6: Update tunnel lifecycle, plugin metadata, and user documentation

**Files:**
- Modify/Create: `scripts/setup-eco-headless.ps1`
- Modify/Create: `scripts/start-eco-tunnel.ps1`
- Modify/Create: `scripts/status-eco-tunnel.ps1`
- Modify/Create: `scripts/stop-eco-tunnel.ps1`
- Modify/Create: `scripts/lib/eco-headless-common.ps1`
- Modify: `.codex-plugin/plugin.json`
- Modify/Create: `docs/eco-headless.md`
- Modify/Create: `docs/eco-codex.md`
- Modify/Create: `docs/chatgpt-plugin.md`
- Test: `tests/packaging/eco-tunnel-lifecycle.test.ts`
- Test: `tests/plugin/eco-brand.test.ts`
- Test: `tests/plugin/plugin-package.test.ts`

**Interfaces:**
- Setup accepts explicit allowed roots, tunnel id, optional Node path, optional Codex delegation enablement.
- Status reports the resolved system Node path and MCP script path without referring to private Node.

- [ ] **Step 1: Add tests rejecting stale v4.13/private-node docs and metadata**

Reject strings such as:

```text
lnwjud v4.13.0
eco-node.exe
private Node
```

where they describe the current ECO production architecture.

- [ ] **Step 2: Update setup diagnostics and command generation**

Report:

```text
ECO system Node: <validated absolute node.exe path>
ECO MCP script: <absolute eco-mcp.cjs path>
```

- [ ] **Step 3: Update architecture docs**

Document:

```text
ChatGPT Web -> Secure MCP Tunnel -> system Node 24 + eco-mcp.cjs -> shared lnwjud runtime
Codex Desktop ---------------------> same MCP runtime
```

State explicitly that Skills are a separate layer built after MCP parity.

- [ ] **Step 4: Run plugin/tunnel tests**

Run:

```text
corepack pnpm@10.15.0 test:plugin
corepack pnpm@10.15.0 validate:plugin
corepack pnpm@10.15.0 test:eco:tunnel
```

Expected: PASS.

- [ ] **Step 5: Commit**

Commit message:

```text
docs: align ECO tunnel and plugin with v4.31 runtime
```

---

### Task 7: Run release verification and refresh PR #5 without merging

**Files:**
- Modify as needed: `.github/workflows/ci.yml`
- Modify/Create: `tests/release/eco-headless-release-gate.test.ts`
- Modify/Create: `docs/eco-headless-acceptance-evidence.md`
- Update PR #5 body.

**Interfaces:**
- Produces CI/release evidence for synchronized upstream + no-custom-EXE contract.

- [ ] **Step 1: Run static and targeted release gates**

Run:

```text
corepack pnpm@10.15.0 lint
corepack pnpm@10.15.0 typecheck
corepack pnpm@10.15.0 validate:eco:release
corepack pnpm@10.15.0 test:eco:release-gate
corepack pnpm@10.15.0 docs:tools:check
```

Expected: PASS.

- [ ] **Step 2: Run authoritative Windows release verification**

Run:

```text
powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -File scripts/verify-release.ps1
```

Expected terminal marker:

```text
Release verification gate completed.
```

- [ ] **Step 3: Re-check upstream main immediately before declaring parity**

If upstream main SHA differs materially from `21bcbbf67862404bf5814d41bd65d0cd0962c81c`, update the baseline and repeat affected tasks/gates.

- [ ] **Step 4: Update PR #5 body**

Remove claims tied to `v4.13.0`, `eco-node.exe`, and old 221/227 catalogs. Record the actual synchronized upstream SHA/version and measured catalog behavior from the new run.

- [ ] **Step 5: Keep PR Draft until real-machine smoke evidence exists**

Required real supported-Windows evidence:

```text
ChatGPT Secure MCP Tunnel -> ECO -> local project smoke
Codex Desktop MCP client -> same ECO/runtime smoke
representative Windows/browser/WSL/Office capability checks when prerequisites exist
no lnwjud.exe or Electron host running
no ECO-owned runtime .exe present
```

- [ ] **Step 6: Commit release evidence updates**

Commit message:

```text
chore: refresh ECO v4.31 release evidence
```

---

## Self-review

- Spec coverage: upstream sync, no custom EXE, system Node 24, tool parity, feature flags, security/state, Skills boundary, TDD, packaging, docs, CI, and real Windows acceptance are all mapped to tasks.
- Placeholder scan: no `TBD`, `TODO`, or unspecified implementation step remains.
- Type consistency: `EcoNodeRuntime` and `resolveEcoNodeRuntime()` are defined once and referenced consistently.
