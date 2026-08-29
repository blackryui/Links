# ChatGPT Plugin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Package lnwjud v4.13.0 as a ChatGPT/Codex plugin layer with six routing skills, static validation, CI coverage, and Secure MCP Tunnel setup documentation without duplicating any MCP tool implementation or schema.

**Architecture:** Keep `packages/mcp-server` and the live ToolRegistry as the only source of truth for the 227 configurable MCP tools. Add only declarative plugin metadata, intent-routing skills, a repository validator, and documentation; ChatGPT Web reaches the existing Desktop loopback MCP through an OpenAI Secure MCP Tunnel, and no `.app.json` is committed until a verified connector ID exists.

**Tech Stack:** Node.js 24 ESM, TypeScript 6, Vitest 3.2.4, pnpm 10.15.0, existing lnwjud Desktop MCP/Secure Tunnel runtime, ChatGPT/Codex plugin manifest format.

**Spec:** `docs/superpowers/specs/2026-08-29-chatgpt-plugin-design.md`

## Global Constraints

- Work only on branch `feat/chatgpt-plugin`; do not modify `main` directly.
- Do not change `.codex/config.toml`.
- Do not duplicate any MCP tool input schema or implementation into the plugin layer.
- Preserve the runtime default of 221 advertised tools; the six `codex_*` tools remain opt-in so 227 is configurable, not silently enabled.
- Do not commit a fake `.app.json`, hard-coded tunnel ID, Runtime API key, or other credential.
- Plugin authority must remain bounded by ChatGPT permissions, workspace capability, Secure MCP Tunnel availability, lnwjud permission profile, Active Project scope, and native exact-action approval.
- Reuse the existing `assets/logo/logo-256x256.png`; do not add new binary assets in V1.
- Plugin metadata version must match root `package.json` (`4.13.0` at implementation time).

---

## Planned File Map

### Create

- `.codex-plugin/plugin.json` — plugin package metadata and skill discovery entrypoint.
- `skills/lnwjud-core/SKILL.md` — workspace/file/tool-discovery and safe mutation routing.
- `skills/lnwjud-development/SKILL.md` — Git, project verification, code navigation, review, optional Codex delegation.
- `skills/lnwjud-windows/SKILL.md` — Windows UI/vision/input/native action routing.
- `skills/lnwjud-browser/SKILL.md` — managed browser/CDP/DOM/accessibility routing.
- `skills/lnwjud-office/SKILL.md` — Office and local document/workbook routing.
- `skills/lnwjud-long-session/SKILL.md` — durable goal and native Scheduled Task continuation rules.
- `scripts/validate-chatgpt-plugin.mjs` — static package validator with optional `--root` fixture support.
- `tests/plugin/plugin-package.test.ts` — plugin contract and validator regression tests.
- `docs/chatgpt-plugin.md` — ChatGPT Web + Secure MCP Tunnel setup and troubleshooting.

### Modify

- `package.json` — add `test:plugin` and `validate:plugin` scripts.
- `scripts/verify-release.ps1` — include the plugin test and validator stages in the authoritative verification gate.

---

### Task 1: Add plugin contract tests first (RED)

**Files:**
- Create: `tests/plugin/plugin-package.test.ts`
- Modify: `package.json`
- Modify: `scripts/verify-release.ps1`

**Interfaces:**
- Consumes: repository files from the planned plugin package.
- Produces: `pnpm test:plugin` as the narrow verification command and `pnpm validate:plugin` as the static validator command.

- [ ] **Step 1: Create the failing contract test**

The test must check real repository behavior without throwing on missing files. It should include helpers equivalent to:

```ts
async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}
```

Required assertions:

```ts
expect(await fileExists(path.join(root, '.codex-plugin', 'plugin.json'))).toBe(true);
expect(manifest.version).toBe(rootPackage.version);
expect(manifest.skills).toBe('./skills/');
expect(manifest.interface.capabilities).toEqual(expect.arrayContaining(['Interactive', 'Read', 'Write']));
expect(requiredSkills).toEqual([
  'lnwjud-core',
  'lnwjud-development',
  'lnwjud-windows',
  'lnwjud-browser',
  'lnwjud-office',
  'lnwjud-long-session',
]);
expect(await fileExists(path.join(root, '.app.json'))).toBe(false);
```

The test must also execute `node scripts/validate-chatgpt-plugin.mjs --root <repo>` through a helper that catches process failure and converts it into an assertion result, so a missing validator fails as an assertion rather than crashing test discovery.

- [ ] **Step 2: Add narrow package scripts**

Add exactly these scripts to `package.json`:

```json
"test:plugin": "vitest run tests/plugin/plugin-package.test.ts",
"validate:plugin": "node scripts/validate-chatgpt-plugin.mjs --root ."
```

- [ ] **Step 3: Wire plugin verification into release verification**

In `scripts/verify-release.ps1`, after `typecheck` and before the broad release tests, add:

```powershell
Invoke-ReleaseStage 'test:plugin' @('test:plugin')
Invoke-ReleaseStage 'validate:plugin' @('validate:plugin')
```

- [ ] **Step 4: Verify RED**

Run:

```text
corepack pnpm@10.15.0 test:plugin
```

Expected: FAIL because `.codex-plugin/plugin.json`, the six plugin skill files, and `scripts/validate-chatgpt-plugin.mjs` do not exist yet.

- [ ] **Step 5: Commit the RED state**

```text
test: define ChatGPT plugin package contract
```

---

### Task 2: Implement manifest, skills, and validator (GREEN)

**Files:**
- Create: `.codex-plugin/plugin.json`
- Create: six `skills/*/SKILL.md` files
- Create: `scripts/validate-chatgpt-plugin.mjs`
- Test: `tests/plugin/plugin-package.test.ts`

**Interfaces:**
- Consumes: root `package.json`, existing `assets/logo/logo-256x256.png`, optional `.app.json`.
- Produces: a valid plugin package rooted at the repository root and a CLI validator that exits 0 only when the package contract is satisfied.

- [ ] **Step 1: Create the manifest**

Use this contract:

```json
{
  "name": "lnwjud",
  "version": "4.13.0",
  "description": "ChatGPT and Codex workflows for the lnwjud Windows-first local MCP gateway.",
  "author": {
    "name": "Adisorn / lnwjud project",
    "url": "https://github.com/engasnm111/lnwjud"
  },
  "homepage": "https://github.com/blackryui/Links",
  "repository": "https://github.com/blackryui/Links",
  "license": "MIT",
  "keywords": ["mcp", "chatgpt", "codex", "windows", "automation", "local-agent", "development"],
  "skills": "./skills/",
  "interface": {
    "displayName": "lnwjud",
    "shortDescription": "Use ChatGPT with lnwjud on your Windows machine",
    "longDescription": "Routes ChatGPT and Codex workflows to the connected lnwjud MCP runtime. Files, processes, Windows automation, browser control, Office actions, and other side effects continue to run on the user's Windows machine under lnwjud permissions and approval boundaries.",
    "developerName": "lnwjud project",
    "category": "Developer Tools",
    "capabilities": ["Interactive", "Read", "Write"],
    "defaultPrompt": [
      "Use lnwjud to list registered workspaces, report Git status for the active project, and summarize the top-level project tree. Do not modify anything.",
      "Use lnwjud to inspect this project, make the requested code change, run the narrow relevant tests, and show the resulting Git diff.",
      "Use lnwjud to observe the current Windows target first, then perform only the requested UI action within the active permission boundaries."
    ],
    "brandColor": "#0078D4",
    "composerIcon": "./assets/logo/logo-256x256.png",
    "logo": "./assets/logo/logo-256x256.png",
    "logoDark": "./assets/logo/logo-256x256.png",
    "screenshots": []
  }
}
```

- [ ] **Step 2: Create the six routing skills**

Each `SKILL.md` must have YAML frontmatter with the exact directory name and a trigger-oriented description. The bodies must encode these boundaries:

```text
core: read-first; edit_file > apply_patch > write_file; no shell text rewrites; tool discovery when uncertain.
development: inspect Git/code first; narrow verification; codex_* optional; do not alter registry defaults.
windows: observe before action; semantic UI targets before coordinates; preserve native approval; respect secure desktop/elevation boundaries.
browser: prefer DOM/accessibility; fresh observation for target-bound actions; stay in managed browser session.
office: inspect before mutation; preserve backups/checkpoints; never silently overwrite outside active scope.
long-session: run_goal/checkpoint/finish; one native Scheduled Task successor; claim before mutation; no Windows scheduler fallback; no overlapping leases.
```

- [ ] **Step 3: Implement the validator CLI**

`scripts/validate-chatgpt-plugin.mjs` must accept `--root <path>` and validate:

```text
.codex-plugin/plugin.json exists and parses
manifest.version === package.json.version
manifest.skills === './skills/'
all six required skill files exist and declare matching frontmatter names
manifest icon paths exist
.app.json is optional, but if present it must parse and contain no placeholder-style connector id
plugin files contain no actual-looking OpenAI/runtime secrets or hard-coded tunnel IDs
```

On success print:

```text
ChatGPT plugin package validation passed.
```

On failure print each bounded error to stderr and set exit code 1.

- [ ] **Step 4: Add validator negative tests**

Extend `tests/plugin/plugin-package.test.ts` with temporary fixtures that prove the validator rejects:

```text
manifest version drift
placeholder .app.json connector id
secret-like API key text in a plugin skill
```

Each fixture must use `mkdtemp` under the OS temp directory and clean up with `rm(..., { recursive: true, force: true })`.

- [ ] **Step 5: Verify GREEN**

Run:

```text
corepack pnpm@10.15.0 test:plugin
corepack pnpm@10.15.0 validate:plugin
```

Expected: PASS.

- [ ] **Step 6: Commit the plugin package**

```text
feat: add ChatGPT plugin package
```

---

### Task 3: Add ChatGPT Web setup documentation and keep version sync safe

**Files:**
- Create: `docs/chatgpt-plugin.md`
- Modify: `scripts/set-version.mjs`
- Test: `tests/plugin/plugin-package.test.ts`

**Interfaces:**
- Consumes: existing Secure MCP Tunnel behavior and plugin manifest.
- Produces: reproducible setup guidance plus automatic manifest version synchronization when `set-version` runs.

- [ ] **Step 1: Write the failing version-sync assertion**

Add a static assertion that `scripts/set-version.mjs` contains an explicit update path for `.codex-plugin/plugin.json` so future release bumps cannot leave the manifest stale.

Expected before implementation: FAIL because the current version synchronizer does not touch the plugin manifest.

- [ ] **Step 2: Update `set-version.mjs` minimally**

After updating the root package version, add a guarded plugin-manifest update using the existing `updatePackageJson` helper:

```js
const pluginManifestPath = path.join(rootDir, '.codex-plugin', 'plugin.json');
try {
  await updatePackageJson(pluginManifestPath, version);
} catch {
  // plugin package is optional in upstream-compatible checkouts
}
```

- [ ] **Step 3: Create `docs/chatgpt-plugin.md`**

The document must cover:

```text
1. lnwjud Desktop v4.13.0+ and Active Project selection
2. permission profile review
3. Secure MCP Tunnel runtime key + tunnel configuration without committing secrets
4. ChatGPT Developer mode / Plugins connection using Tunnel
5. plugin package loading/installation where supported
6. read-only smoke prompt first
7. controlled write verification second
8. 221 advertised by default vs 227 configurable; codex_* remains opt-in
9. Stage A package-ready vs Stage B verified .app.json binding
10. troubleshooting: tunnel offline, stale schema, ChatGPT permission denial, lnwjud permission denial, native approval denial
```

It must explicitly state that `127.0.0.1` is not exposed publicly and that the public repository intentionally has no fake `.app.json`.

- [ ] **Step 4: Verify documentation contract**

Extend the plugin test to assert the doc contains the exact concepts `Secure MCP Tunnel`, `221`, `227`, `codex_*`, `.app.json`, and `Refresh connector`.

- [ ] **Step 5: Run narrow checks**

```text
corepack pnpm@10.15.0 test:plugin
corepack pnpm@10.15.0 validate:plugin
```

Expected: PASS.

- [ ] **Step 6: Commit docs/version sync**

```text
docs: add ChatGPT plugin setup guide
```

---

### Task 4: Final verification and PR readiness

**Files:**
- No new production files unless verification exposes a defect.

**Interfaces:**
- Consumes: complete branch state.
- Produces: evidence that the plugin layer is additive and does not regress the existing runtime contract.

- [ ] **Step 1: Run plugin-specific verification**

```text
corepack pnpm@10.15.0 test:plugin
corepack pnpm@10.15.0 validate:plugin
```

Expected: PASS.

- [ ] **Step 2: Run repository static gates**

```text
corepack pnpm@10.15.0 lint
corepack pnpm@10.15.0 typecheck
corepack pnpm@10.15.0 docs:tools:check
```

Expected: PASS; tool catalog remains 227 configurable / 221 advertised by default.

- [ ] **Step 3: Inspect PR diff**

Confirm:

```text
no .app.json
no .mcp.json pointing at localhost
no changes to .codex/config.toml
no duplicated tool schemas
no credential-like strings
only additive plugin package files plus narrow verification/version-sync wiring
```

- [ ] **Step 4: Observe GitHub Actions on PR #1**

Expected: authoritative Windows verification completes successfully for the implementation head commit. If the workflow fails, inspect the failing job before declaring completion.

- [ ] **Step 5: Update PR summary and mark ready only after verification**

The final PR description must list implemented files, narrow test results, full CI status, and the remaining manual Stage B action: add a verified `.app.json` only after the actual ChatGPT connector ID exists.
