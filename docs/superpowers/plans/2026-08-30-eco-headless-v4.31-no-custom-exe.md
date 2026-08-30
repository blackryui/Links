# ECO Headless v4.31 No-Custom-EXE Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep `blackryui/Links` synchronized to the latest verified lnwjud runtime, expose that runtime through ECO for ChatGPT Secure MCP Tunnel and Codex Desktop, and remove the ECO-owned `eco-node.exe` model.

**Architecture:** The runtime baseline is an exact upstream tree applied as a commit on top of `blackryui/main`. ECO remains a thin adapter around upstream `mcp-stdio.ts`, uses system Node 24.x, preserves one ToolRegistry/state/safety model, and adds domain Skills only after MCP parity.

**Tech Stack:** TypeScript, Node.js 24, pnpm 10.15.0, Vitest, PowerShell, MCP TypeScript SDK v2, OpenAI Secure MCP Tunnel, GitHub Actions Windows verification.

**Spec:** `docs/superpowers/specs/2026-08-30-eco-headless-latest-upstream-no-custom-exe-design.md`

## Global Constraints

- Upstream checkpoint: `engasnm111/lnwjud@21bcbbf67862404bf5814d41bd65d0cd0962c81c`, v4.31.0.
- Node: `>=24.0.0 <25`.
- No ECO-owned runtime executable.
- No Desktop/Electron runtime requirement for ECO.
- Upstream/system executables may remain capability dependencies.
- One upstream-derived ToolRegistry; no ECO tool clones.
- 231/195/201 are measured checkpoint values, not permanent constants.
- Strict allowed roots are the ECO setup default.
- PR #5 stays Draft until real Windows ChatGPT/Codex smoke evidence is recorded.

---

### Task 1: Establish a mergeable exact-upstream baseline

- [x] Preserve the v4.13/private-node implementation as `backup/eco-headless-v4.13-private-node`.
- [x] Verify the fork accepts upstream v4.31 objects directly.
- [x] Create commit `4ac7f30bd154892980a7ef63d6cdbc70d9bdd059` with the exact upstream v4.31 tree and `blackryui/main` as parent.
- [x] Point `feat/eco-headless-runtime` at that commit and re-apply this spec/plan.
- [ ] Confirm PR #5 is mergeable again after the ECO delta is re-applied.

### Task 2: Define no-custom-EXE behavior with failing tests

**Files:**
- `apps/cli/tests/eco-system-node-runtime.test.ts`
- `tests/packaging/eco-headless-packaging.test.ts`
- `tests/packaging/eco-tunnel-profile.test.ts`

**Target API:**

```ts
export type EcoNodeRuntime = { readonly nodePath: string; readonly version: string };
export async function resolveEcoNodeRuntime(explicitPath?: string, env?: NodeJS.ProcessEnv): Promise<EcoNodeRuntime>;
export function assertEcoNode24Version(version: string): void;
```

- [ ] Add tests for explicit valid Node 24, invalid major, PATH resolution and missing executable.
- [ ] Add packaging tests proving no `eco-node.exe`/`privateNode*` metadata exists.
- [ ] Add tunnel tests proving the direct command is system Node + `eco-mcp.cjs` + strict roots.
- [ ] Run CI and observe failure caused by the missing new runtime/packaging behavior before production code is added.

### Task 3: Implement system Node and thin packaging

**Files:**
- `apps/cli/src/runtime/eco-system-node-runtime.ts`
- `apps/cli/src/bin/eco-mcp.ts` only if an environment-preparation wrapper is required
- `apps/cli/src/bin/eco-config.ts`
- `apps/cli/src/runtime/headless-config.ts`
- `scripts/build-eco-headless.mjs`
- `scripts/lib/eco-runtime-package.ps1`
- `scripts/setup-eco-headless.ps1`

- [ ] Resolve an explicit Node path first, otherwise resolve from the system environment; run `--version` and require major 24.
- [ ] Build JavaScript/CJS entrypoints without copying/renaming Node.
- [ ] Keep ripgrep/native helper behavior upstream-compatible and separate from the JavaScript host.
- [ ] Generate tunnel commands beginning with the validated absolute system Node executable.
- [ ] Re-run targeted tests to GREEN.

### Task 4: Re-apply only the v4.31-compatible ECO adapter

- [ ] Use upstream `apps/cli/src/bin/mcp-stdio.ts` as the runtime source of truth.
- [ ] Do not restore the v4.13 extracted bootstrap unless a current API gap proves it necessary.
- [ ] Add headless config only for runtime-relevant shared settings.
- [ ] Preserve upstream strict-root, permission, destructive, task, continuation and Codex behavior.
- [ ] Prove no Electron/Desktop runtime import is needed.

### Task 5: Rebuild parity/release gates

- [ ] Record exact upstream SHA/version in `docs/eco-headless-parity.json`.
- [ ] Derive catalog behavior from current ToolRegistry/tool-contract generation.
- [ ] Test default and Codex-enabled catalog parity without immortal count constants.
- [ ] Cover current v4.31 capability families, including newer computer-use/task/continuation behavior.
- [ ] Reject private-node artifacts, duplicate ECO schemas and blocked capability categories.

### Task 6: Restore ECO plugin/tunnel lifecycle/docs on the new baseline

- [ ] Restore ECO ChatGPT plugin identity/validation without changing upstream runtime semantics.
- [ ] Restore setup/start/stop/status scripts using system Node.
- [ ] Document ChatGPT Tunnel and Codex Desktop as two clients of the same runtime.
- [ ] Document Skills as a separate upper layer.

### Task 7: Verify and refresh PR #5

- [ ] Run lint, typecheck, workspace release tests, ECO tests, integration tests and `docs:tools:check`.
- [ ] Run authoritative Windows release verification in CI.
- [ ] Re-check upstream `main` immediately before claiming parity.
- [ ] Rewrite PR #5 body for v4.31/current catalog/system-Node architecture.
- [ ] Keep PR Draft until real Windows ChatGPT Secure MCP Tunnel + Codex Desktop smoke evidence exists.
