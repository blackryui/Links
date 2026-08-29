# ECO Headless Acceptance Evidence

**Status:** implementation ready for authoritative Windows acceptance; feature-parity completion is **not yet claimed**.

## Baseline

- Upstream repository: `engasnm111/lnwjud`
- Upstream ref: `main`
- Upstream version: `4.13.0`
- Upstream baseline SHA re-checked before acceptance preparation: `edbc739b6df599e8b824c7c2c75cda1cd9e6d493`
- ECO repository: `blackryui/Links`
- Implementation branch: `feat/eco-headless-runtime`
- ECO version: `4.13.0`
- Design/base SHA: `5ad9e99b4ff717defda149d86469256fe1a943d1`
- Latest reviewed ECO code SHA before this evidence-only update: `9876cded7991a1fcf4dbaf6c66e2a28d5804d56e`

## Implemented acceptance surfaces

The implementation branch contains:

- one shared headless bootstrap using the existing CLI runtime;
- `eco-mcp.cjs` / `eco-mcp.cmd` packaging contract;
- self-contained private Node 24 runtime and verified bundled ripgrep so packaged search/runtime do not depend on system Node/PATH;
- packaged, integrity-checked `windows-capability-bridge.ps1` and optional upstream-equivalent Windows OCR helper;
- `eco-config.cjs` / `eco-config.cmd` headless configuration surface backed by the existing lnwjud SQLite settings repository;
- allowlisted headless configuration for permission/root policy, timeouts, capability roots, PDF/LSP providers, Codex catalog default, destructive policy and extensions/child MCP settings;
- strict validation at the ECO config boundary so malformed/unknown/semantically invalid operator input is rejected before persistence;
- strict-root real MCP project-flow integration contract;
- capability-family parity guard;
- Secure MCP Tunnel stdio setup contract using profile `eco`;
- background start / targeted stop / read-only status lifecycle;
- tunnel owner schema v2 tracking exact worker and tunnel-client child identity, with fail-closed orphan recovery/stop;
- process-level `--enable-codex-tools` / `--disable-codex-tools` overrides while preserving the upstream stored/default behavior;
- shared permission-profile precedence for ChatGPT Tunnel and Codex local MCP, with explicit per-process override still available;
- local Codex registration using the same `eco-mcp.cmd` entrypoint;
- ChatGPT Headless-primary plugin/docs validation;
- parity inventory and `--release` validator;
- authoritative Windows release-gate wiring.

## Upstream re-check

Immediately before this evidence update, upstream `main` remained at `edbc739b6df599e8b824c7c2c75cda1cd9e6d493`, version `4.13.0`. No newer upstream runtime/tool/safety/tunnel/Codex change was found that required synchronization in this implementation round.

## Current CI state

Draft PR #5 is open and mergeable, but GitHub Actions has still created **zero pull-request workflow runs** for the ECO branch. Therefore there is currently no authoritative Windows CI result—pass or fail—to cite. The PR must remain Draft and unmerged until repository Actions execution is enabled/available and the Windows verification job completes.

## Required authoritative commands

These commands must complete successfully on the supported Windows release environment before ECO may be called feature-parity complete:

```text
corepack pnpm@10.15.0 install --frozen-lockfile
corepack pnpm@10.15.0 lint
corepack pnpm@10.15.0 typecheck
corepack pnpm@10.15.0 test:plugin
corepack pnpm@10.15.0 validate:plugin
corepack pnpm@10.15.0 test:eco:parity
corepack pnpm@10.15.0 validate:eco:parity
corepack pnpm@10.15.0 build:eco
corepack pnpm@10.15.0 test:eco:packaging
corepack pnpm@10.15.0 test:eco:tunnel
corepack pnpm@10.15.0 test:eco:integration
corepack pnpm@10.15.0 test:eco:release-gate
corepack pnpm@10.15.0 validate:eco:release
corepack pnpm@10.15.0 docs:tools:check
powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -File scripts/verify-release.ps1
```

Exact exit codes/test counts must be captured from that Windows run; this document intentionally does not fabricate them.

The packaged-runtime smoke must specifically prove the presence and metadata integrity of:

```text
eco-mcp.cjs
eco-mcp.cmd
eco-config.cjs
eco-config.cmd
eco-node.exe
runtime-tools\ripgrep\rg.exe
windows-capability-bridge.ps1
PACKAGE.json
```

## Required headless configuration smoke

On the Windows acceptance host, using an isolated `LNWJUD_DATA_PATH` first:

1. Run `eco-config.cmd show` and confirm no secret values are printed.
2. Set and read one permission profile and one timing value.
3. Confirm unknown keys and invalid semantic structured settings are rejected.
4. Set `codex-tools-enabled=true`, verify catalog exposure, then confirm `--disable-codex-tools` overrides it for one process only.
5. Reset the test settings and confirm other stored state remains intact.

## Required no-Desktop evidence

During the real ECO ChatGPT and Codex smoke tests:

- `lnwjud.exe` must not be running;
- no Electron Desktop process may host the MCP server;
- `status-eco-tunnel.ps1` must identify only the ECO headless worker/profile and exact verified tunnel-client child state;
- the MCP endpoint must be the stdio `eco-mcp` command launched by tunnel-client or Codex.

## Required ChatGPT smoke

With the real Secure MCP Tunnel associated with the target ChatGPT workspace:

1. Start ECO only with `start-eco-tunnel.ps1`.
2. Create/refresh the ChatGPT developer-mode Tunnel app named **ECO**.
3. List workspaces and inspect Git status through ECO.
4. Read a file inside the configured strict root.
5. Perform one exact controlled write/edit inside the strict root and inspect the Git diff.
6. Attempt an absolute read outside all allowed roots and confirm denial.
7. Confirm stored permission profile is honored when the tunnel command supplies no explicit runtime `--profile` override.
8. Confirm no Desktop/Electron process was started as a side effect.

## Required Codex smoke

Using the same built `eco-mcp.cmd`:

1. Register `eco` with the current Codex CLI stdio MCP registration.
2. Verify with `codex mcp get eco --json`.
3. Start a fresh Codex project session.
4. List/inspect ECO tools and the same strict-root project.
5. Perform a read-only project task.
6. Confirm the same local SQLite/workspace/safety/permission boundaries are used.
7. Confirm `codex_*` delegation is absent by default, can be enabled through stored config or `--enable-codex-tools`, and is suppressed by explicit `--disable-codex-tools`.

## Capability spot checks

On a Windows host with each prerequisite available, spot-check representative shared runtime categories:

- Browser/CDP;
- Windows accessibility/window/input/vision;
- WSL when installed;
- Office/document/workbook when Microsoft Office is installed;
- system/event-log/scheduler/web-fetch;
- extensions/child MCP when configured;
- local provider integrations when configured.

Missing external prerequisites are recorded as `optional-dependency`, matching upstream behavior; they are not reported as successful capability tests.

## Completion rule

ECO Headless may be described as **feature-parity complete** only after all required automated Windows gates plus the real ChatGPT and Codex smoke tests above have recorded successful non-secret evidence. Until then, the correct status is **implementation complete enough for authoritative acceptance, acceptance pending**.
