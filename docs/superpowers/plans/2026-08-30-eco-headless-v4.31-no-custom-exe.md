# ECO Headless v4.31 No-Custom-EXE Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Synchronize ECO Headless with the latest verified lnwjud v4.31.0 runtime, remove the ECO-owned `eco-node.exe`, and preserve upstream MCP ToolRegistry/capability behavior for ChatGPT Secure MCP Tunnel and Codex Desktop.

**Architecture:** Start from exact upstream `engasnm111/lnwjud@21bcbbf67862404bf5814d41bd65d0cd0962c81c`, then re-apply only the ECO thin headless adapter. ECO uses system Node 24.x as the JavaScript host and reuses upstream runtime/tool/state/safety code.

**Tech Stack:** TypeScript, Node.js 24, pnpm 10.15.0, Vitest, PowerShell 5.1+, MCP TypeScript SDK v2, OpenAI Secure MCP Tunnel, GitHub Actions Windows release verification.

**Spec:** `docs/superpowers/specs/2026-08-30-eco-headless-latest-upstream-no-custom-exe-design.md`

## Global Constraints

- Baseline: `engasnm111/lnwjud@21bcbbf67862404bf5814d41bd65d0cd0962c81c`, v4.31.0.
- Node: `>=24.0.0 <25`.
- No ECO-owned runtime executable (`eco-node.exe`, `eco.exe`, renamed Node, or required `lnwjud.exe`).
- Desktop/Electron is not required for ECO Headless.
- Upstream/system executables (`node.exe`, `rg.exe`, optional OCR, tunnel-client, Codex) remain valid dependencies where required.
- ToolRegistry and schemas remain upstream-owned.
- v4.31 checkpoint is 231 definitions / 195 default / 201 Codex-enabled, but counts are measured evidence rather than permanent constants.
- Strict allowed roots remain default.
- PR #5 remains Draft until real Windows ChatGPT/Codex smoke evidence exists.

---

### Task 1: Synchronize baseline

**Files:** repository baseline and design/plan docs.

**Produces:** upstream v4.31 runtime with ECO delta not yet re-applied.

- [x] Preserve prior PR head as `backup/eco-headless-v4.13-private-node`.
- [x] Verify fork accepts upstream `21bcbbf...` directly via `sync/lnwjud-v4.31.0`.
- [x] Force `feat/eco-headless-runtime` to upstream `21bcbbf...`.
- [x] Restore the v4.31 no-custom-EXE design and this plan.
- [ ] Verify root `package.json` is v4.31.0 and catalog docs show MCP 2026-07-28 with the current 231/195/201 checkpoint.

---

### Task 2: Re-apply tests first (RED)

**Files:**
- Create/restore `tests/packaging/eco-headless-packaging.test.ts`
- Create/restore `tests/packaging/eco-tunnel-profile.test.ts`
- Create `apps/cli/tests/eco-system-node-runtime.test.ts`

**Target API:**

```ts
export type EcoNodeRuntime = { nodePath: string; version: string };
export async function resolveEcoNodeRuntime(
  explicitPath?: string,
  env?: NodeJS.ProcessEnv,
): Promise<EcoNodeRuntime>;
```

- [ ] Add packaging assertions that `dist/eco-headless/eco-node.exe` does not exist and `PACKAGE.json` has no `privateNode*` fields.
- [ ] Add runtime resolver tests: valid explicit Node 24, reject non-24, PATH fallback, fail closed when missing.
- [ ] Add tunnel profile test proving the command starts with validated system Node then `eco-mcp.cjs` and contains no `eco-node.exe`.
- [ ] Run targeted tests and confirm they fail for missing/new behavior.

Commands:

```text
corepack pnpm@10.15.0 vitest run tests/packaging/eco-headless-packaging.test.ts tests/packaging/eco-tunnel-profile.test.ts
corepack pnpm@10.15.0 --filter @lnwjud/cli exec vitest run tests/eco-system-node-runtime.test.ts
```

---

### Task 3: Implement system Node runtime (GREEN)

**Files:**
- Create `apps/cli/src/runtime/eco-system-node-runtime.ts`
- Restore/adapt `scripts/build-eco-headless.mjs`
- Restore/adapt `scripts/lib/eco-runtime-package.ps1`
- Restore/adapt `scripts/setup-eco-headless.ps1`
- Restore/adapt `apps/cli/src/runtime/packaged-runtime-env.ts` only if required.

- [ ] Implement Node resolution: explicit path first, otherwise system `node`/`node.exe`, execute `--version`, require major 24.
- [ ] Remove copying/renaming `process.execPath` into `eco-node.exe`.
- [ ] Remove `privateNode`, `privateNodeMajor`, `privateNodeSha256` metadata.
- [ ] Make `.cmd` convenience launchers call system `node`.
- [ ] Make tunnel setup store the validated absolute Node executable path as `CommandArgs[0]`.
- [ ] Keep upstream helper handling (`rg.exe`, optional OCR) separate and upstream-compatible.
- [ ] Re-run Task 2 tests and confirm PASS.

---

### Task 4: Re-apply ECO headless bootstrap against v4.31 APIs

**Files:**
- `apps/cli/src/bin/mcp-stdio.ts`
- `apps/cli/src/bin/eco-config.ts`
- `apps/cli/src/runtime/headless-mcp-bootstrap.ts`
- `apps/cli/src/runtime/headless-config.ts`
- relevant ECO CLI tests.

- [ ] Compare backup v4.13 ECO code to current v4.31 CLI/runtime APIs before copying.
- [ ] Restore tests first for strict roots, permission profile, config, shared registry, and Codex delegation behavior.
- [ ] Implement the smallest compatible adapter by reusing upstream services.
- [ ] Ensure no Electron/Desktop runtime import is needed.
- [ ] Run:

```text
corepack pnpm@10.15.0 --filter @lnwjud/cli exec vitest run tests/eco-headless-entrypoint.test.ts tests/eco-headless-config.test.ts tests/eco-headless-config-cli.test.ts tests/eco-codex-tools-option.test.ts
```

---

### Task 5: Rebuild parity gates from current upstream behavior

**Files:**
- `docs/eco-headless-parity.json`
- `scripts/verify-eco-parity.mjs`
- `apps/cli/tests/eco-headless-parity.test.ts`
- `tests/integration/eco-capability-catalog.test.ts`
- `tests/integration/eco-headless-mcp-flow.test.ts`
- `tests/integration/eco-codex-mcp-flow.test.ts`

- [ ] Record upstream SHA/version v4.31.0 checkpoint.
- [ ] Reject version/SHA mismatch, private-node artifacts, duplicate tool schemas, blocked capability categories.
- [ ] Derive catalog from ToolRegistry/tool-contract generation rather than immutable counts.
- [ ] Preserve default/optional tool policy exactly.
- [ ] Cover newer v4.31 computer-use/native/browser/task/continuation capability families.
- [ ] Run:

```text
corepack pnpm@10.15.0 validate:eco:parity
corepack pnpm@10.15.0 test:eco:parity
corepack pnpm@10.15.0 test:eco:integration
corepack pnpm@10.15.0 docs:tools:check
```

---

### Task 6: Tunnel lifecycle, plugin and docs

**Files:**
- `scripts/setup-eco-headless.ps1`
- `scripts/start-eco-tunnel.ps1`
- `scripts/status-eco-tunnel.ps1`
- `scripts/stop-eco-tunnel.ps1`
- `scripts/lib/eco-headless-common.ps1`
- `.codex-plugin/plugin.json`
- `docs/eco-headless.md`
- `docs/eco-codex.md`
- `docs/chatgpt-plugin.md`
- plugin/tunnel tests.

- [ ] Add tests rejecting stale v4.13/private-node current-architecture text.
- [ ] Update setup/status output to report `ECO system Node` and MCP script path.
- [ ] Document `ChatGPT -> Tunnel -> system Node 24 + eco-mcp.cjs -> shared runtime` and `Codex Desktop -> same MCP runtime`.
- [ ] Document Skills as a separate workflow layer after MCP parity.
- [ ] Run plugin validation and tunnel tests.

---

### Task 7: Release verification and PR refresh

**Files:** CI/release tests, acceptance evidence, PR #5 body.

- [ ] Run lint, typecheck, ECO release gate, and `docs:tools:check`.
- [ ] Run authoritative Windows `scripts/verify-release.ps1` via GitHub Actions.
- [ ] Re-check upstream main before claiming parity; if it advanced materially, resync and repeat affected gates.
- [ ] Rewrite PR #5 body to remove v4.13, private-node and old 221/227 claims.
- [ ] Keep PR Draft until real Windows ChatGPT Tunnel + Codex Desktop smoke evidence exists.

## Self-review

All spec requirements are covered: latest upstream, no custom runtime EXE, system Node 24, single ToolRegistry, upstream feature flags, shared state/safety, strict roots, parity gate, docs/plugin, CI and separate Skills layer. No implementation placeholder changes behavior outside these boundaries.
