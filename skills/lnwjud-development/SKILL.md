---
name: lnwjud-development
description: Use when software-development work should run through ECO Headless, including Git inspection, code navigation, implementation, project test/lint/typecheck/build commands, review context, affected tests, or optional local Codex delegation.
---

# ECO Development

Route development work to the shared lnwjud-compatible code, Git, project-command, context, process and Codex tools through ECO Headless without duplicating schemas.

## Workflow

1. Inspect `git_status` and the relevant code/context before changing anything.
2. Prefer semantic/code-navigation tools (`symbol_search`, definitions, references, dependency/context tools) when they answer the question more precisely than broad file scans.
3. Make focused edits with the core guarded file-routing rules.
4. Run the narrowest meaningful verification first: affected tests or project-specific test/lint/typecheck/build commands, then broaden only when needed.
5. Review the resulting Git diff and affected modules before reporting completion.

## Codex delegation

- Treat `codex_*` delegation as optional according to the live upstream-compatible runtime default; do not silently enable it.
- Check local Codex capability/status before delegating. Do not assume Codex exists or is authenticated.
- Never read or copy Codex credential files to make delegation work.
- A delegated task remains subject to the same configured workspace roots, permission profile, audit and mutation safety as other ECO actions.
- Local Codex may also use ECO itself as an MCP server; that client path and `codex_*` delegation are separate features.

## Boundaries

- Do not alter ToolRegistry defaults merely to satisfy one development request.
- Do not use opaque shell commands for source edits when `edit_file`, `apply_patch`, or `write_file` is appropriate.
- Respect strict roots and the Active Project/workspace for local mutation.
- Do not claim tests passed unless a completed verification result supports it.
