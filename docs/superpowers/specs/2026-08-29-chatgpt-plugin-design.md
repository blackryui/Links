# ChatGPT Web Plugin Architecture for lnwjud

**Date:** 2026-08-29  
**Repository:** `blackryui/Links`  
**Base runtime:** lnwjud v4.13.0  
**Target:** ChatGPT Web plugin/package layer over the existing lnwjud MCP gateway

## 1. Goal

Package the existing lnwjud MCP runtime as a ChatGPT/Codex plugin without duplicating its MCP tool implementations. The plugin must preserve lnwjud as the single source of truth for the configurable 227-tool registry while adding discoverable plugin metadata, routing skills, and a clean connection contract for ChatGPT Web through an OpenAI Secure MCP Tunnel.

## 2. Non-goals

- Do not reimplement or copy the 227 MCP tool schemas into plugin-owned code.
- Do not move Windows-local execution into a hosted web runtime.
- Do not bypass lnwjud permission profiles, Active Project boundaries, native approval, or recovery controls.
- Do not put tunnel API keys, runtime keys, local credentials, or secrets in Git.
- Do not invent a ChatGPT app/connector ID before a real connection exists.
- Do not change existing tool semantics merely to make the plugin package installable.

## 3. Architecture

```text
ChatGPT Web / Codex
        |
        | plugin skills + app binding
        v
Links / lnwjud plugin package
        |
        | OpenAI Secure MCP Tunnel
        v
lnwjud Desktop loopback MCP
        |
        +-- workspace/files
        +-- Git
        +-- shell/process/project commands
        +-- Windows UI/vision/browser
        +-- WSL/Office
        +-- goals/continuations
        +-- child MCP/delegation
        +-- tool registry (227 configurable)
        |
        v
User's Windows machine
```

The plugin layer is declarative and instructional. All local side effects remain owned by lnwjud Desktop.

## 4. Plugin package structure

Add the following top-level package files and directories:

```text
.codex-plugin/
  plugin.json
skills/
  lnwjud-core/SKILL.md
  lnwjud-development/SKILL.md
  lnwjud-windows/SKILL.md
  lnwjud-browser/SKILL.md
  lnwjud-office/SKILL.md
  lnwjud-long-session/SKILL.md
scripts/
  validate-chatgpt-plugin.mjs
tests/plugin/
  plugin-package.test.ts
```

An `.app.json` file is added only when a real ChatGPT app/connector ID is available. Until then, the package remains explicit that app binding is pending rather than committing a placeholder identifier.

A `.mcp.json` file is not used to point ChatGPT Web directly at `127.0.0.1`. The Web path is the Secure MCP Tunnel associated with the user's ChatGPT workspace. Local MCP URLs remain local runtime configuration, not plugin distribution metadata.

## 5. Manifest contract

`.codex-plugin/plugin.json` will describe the package itself and reference the skill directory. Required fields:

- `name`: `lnwjud`
- `version`: kept in sync with the repository package version when intentionally released
- `description`: ChatGPT/Codex workflows for the lnwjud Windows-first local MCP gateway
- `author`: preserve upstream attribution while identifying this repository as the package source where appropriate
- `repository`: `https://github.com/blackryui/Links`
- `license`: `MIT`
- `keywords`: include MCP, Windows automation, development, local agent, ChatGPT
- `skills`: `./skills/`
- `interface.displayName`: `lnwjud`
- `interface.shortDescription`: concise user-facing description
- `interface.longDescription`: explain that execution stays on the connected Windows machine
- `interface.capabilities`: `Interactive`, `Read`, `Write`
- `interface.defaultPrompt`: read-only verification prompt first, then development and Windows examples
- icon paths must refer only to files already present in the repository or added intentionally

The manifest must not claim that every ChatGPT plan/workspace can execute every exposed write/execute action. Runtime availability depends on ChatGPT workspace capability, plugin permission settings, tunnel state, lnwjud permission profile, and host approval.

## 6. Routing skills

Skills are deliberately split by intent so ChatGPT does not need the whole 227-tool catalog in prompt context for every request.

### 6.1 `lnwjud-core`

Use for workspace discovery, repository inspection, file search/read/edit routing, permissions, recovery, tool discovery, session context, and safe first-contact diagnostics.

Rules:

- Prefer read-only discovery before mutation.
- Prefer `edit_file` for exact source/config/text edits.
- Prefer `apply_patch` for reviewed multi-file or whole-file replacements.
- Use `write_file` for creation/replacement where exact edit is not appropriate.
- Respect Active Project and permission boundaries.
- Never use shell text-rewrite tricks as a substitute for file tools.

### 6.2 `lnwjud-development`

Use for Git, project build/test/lint/typecheck, code navigation, dependency context, affected tests, review workflows, and optional Codex delegation.

Rules:

- Inspect relevant code and Git state first.
- Run narrow verification before broad suites when practical.
- Treat the six `codex_*` tools as optional capability; never assume they are enabled.
- Do not change tool registry defaults merely to satisfy a development workflow.

### 6.3 `lnwjud-windows`

Use for Windows UI automation, screenshots/vision, input, windows, clipboard, notifications, file dialogs, services, registry/event-log context, and OS-level actions.

Rules:

- Observe before action.
- Use semantic/UI-targeted actions when available instead of blind coordinates.
- Preserve lnwjud native exact-action approval and fail-closed behavior.
- Never imply that UAC secure desktop, lock screen, or inaccessible elevated windows are controllable when Windows blocks access.

### 6.4 `lnwjud-browser`

Use for managed Chrome/CDP, DOM snapshots, accessibility observations, browser debugging, console/network context, Set-of-Marks, and web-app inspection.

Rules:

- Prefer DOM/accessibility context over screenshot-only automation when semantic data exists.
- Require a fresh observation for target-bound actions when lnwjud policy requires one.
- Keep browser automation within the managed session and policy boundaries.

### 6.5 `lnwjud-office`

Use for Office automation and workbook/document-oriented local actions exposed through lnwjud.

Rules:

- Inspect the target document/workbook before mutation when tools support inspection.
- Preserve local file backups/checkpoints where provided by lnwjud.
- Do not silently overwrite user files outside the active workspace boundary.

### 6.6 `lnwjud-long-session`

Adapt the existing `.agents/skills/lnwjud-scheduled-continuation/SKILL.md` workflow for plugin discovery without changing its safety invariants.

Rules:

- Durable goal state remains in lnwjud.
- Native ChatGPT Scheduled Tasks own future wakes.
- At most one successor reservation per continuation step.
- A successor must claim its continuation before local mutation.
- No Windows Task Scheduler fallback.
- No overlapping mutation leases.

## 7. 227-tool compatibility

The plugin must treat `packages/mcp-server` and its ToolRegistry as authoritative.

Acceptance conditions:

1. Plugin packaging does not duplicate tool input schemas.
2. Existing `docs:tools:check` remains authoritative for registry drift.
3. Default runtime behavior remains 221 advertised tools when the six `codex_*` delegation tools are disabled.
4. Documentation may explain how to enable all 227 configurable tools, but V1 must not silently change the current default.
5. Plugin skills route by intent and may use `tool_search`, `tool_categories`, `tool_describe`, or equivalent lnwjud discovery tools when exact tool selection is uncertain.

## 8. Secure MCP Tunnel contract

ChatGPT Web connectivity remains:

```text
ChatGPT Web
  -> workspace-associated OpenAI Secure MCP Tunnel
  -> bundled tunnel-client
  -> lnwjud Desktop loopback HTTP MCP
  -> selected Active Project(s)
```

Requirements:

- No public inbound port is required by this plugin.
- Runtime API keys stay in lnwjud/Windows secret storage and are never committed.
- The plugin repository does not contain a hard-coded tunnel ID.
- Setup documentation instructs users to create/select their own tunnel and associate it with the intended ChatGPT workspace.
- After tool schema changes, documentation instructs users to refresh the ChatGPT connector and open a new chat if stale schema remains cached.

## 9. App binding lifecycle

A ChatGPT plugin app binding requires a real app/connector identifier. Therefore V1 uses a two-stage lifecycle:

### Stage A — package-ready

Committed to Git:

- plugin manifest
- skills
- validation/tests
- setup documentation

No fake `.app.json`.

### Stage B — workspace-bound

After a real ChatGPT connection exists:

- obtain the actual app/connector ID from the connection
- add `.app.json` containing only that verified ID if the package distribution model requires the binding to be committed
- validate the package again

If a workspace-specific ID should not be distributed publicly, keep `.app.json` out of the public branch and document the local/private binding procedure instead.

## 10. Security model

The plugin adds no new authority. Effective authority is the intersection of:

```text
ChatGPT plugin permissions
AND ChatGPT workspace capabilities
AND Secure MCP Tunnel availability
AND lnwjud Desktop permission profile
AND Active Project mutation boundary
AND native exact-action approval where required
```

The most restrictive layer wins.

The plugin skills must not instruct the model to bypass any of these layers.

## 11. Validation and tests

Add a repository validator that fails on:

- missing `.codex-plugin/plugin.json`
- malformed JSON
- missing referenced `skills/` directory
- missing declared skill files
- manifest version drift from root `package.json`
- invalid or nonexistent icon paths
- committed `.app.json` containing an obvious placeholder connector ID
- hard-coded tunnel API keys or runtime keys in plugin package files

Add Vitest coverage for the validator and plugin package contract.

Existing repository checks remain required:

- lint
- typecheck
- relevant plugin tests
- `docs:tools:check`

The plugin change must not require running Windows UI automation tests merely to validate static plugin metadata.

## 12. Documentation

Add a concise `docs/chatgpt-plugin.md` covering:

1. Install/run lnwjud Desktop v4.13.0 or newer compatible release.
2. Select Active Project(s) and permission profile.
3. Configure the OpenAI Secure MCP Tunnel in lnwjud.
4. Create/refresh the ChatGPT connection.
5. Install/load the plugin package where supported.
6. Verify read-only access first.
7. Verify a controlled write action second.
8. Explain 221 default vs 227 configurable tools.
9. Explain app binding and `.app.json` lifecycle.
10. Troubleshoot tunnel offline, stale schema, permission denial, and native approval denial separately.

## 13. Versioning and upstream compatibility

- Do not rename the underlying package from `lnwjud` in V1.
- Keep MIT license and upstream copyright notice.
- Plugin files should be additive so upstream lnwjud updates can be merged with minimal conflict.
- Do not modify `.codex/config.toml` as part of this plugin work; its machine-level policy is independent from plugin packaging.
- Future upstream updates that change the 227-tool registry should require no plugin schema rewrite unless routing guidance itself needs adjustment.

## 14. Acceptance criteria

V1 is complete when all of the following are true:

- `blackryui/Links` contains a valid `.codex-plugin/plugin.json`.
- Six focused lnwjud skills are discoverable from the manifest.
- Existing scheduled-continuation semantics are represented without weakening lease/cancellation safety.
- No MCP tool implementation or schema is duplicated into the plugin layer.
- Static validation and tests pass.
- Existing lint/typecheck/tool-catalog checks pass for affected code.
- Documentation clearly explains the Secure MCP Tunnel path and app-binding lifecycle.
- The package contains no fake connector ID and no secrets.
- The change is delivered through `feat/chatgpt-plugin` and reviewed by pull request before merge.
