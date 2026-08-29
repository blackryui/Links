---
name: lnwjud-development
description: Use for software-development work through lnwjud: Git inspection, code navigation, implementation, project test/lint/typecheck/build commands, review context, affected tests, or optional local Codex delegation.
---

# lnwjud Development

Route development work to the existing lnwjud code, Git, project-command, and context tools without duplicating their schemas.

## Workflow

1. Inspect `git_status` and the relevant code/context before changing anything.
2. Prefer semantic/code-navigation tools (`symbol_search`, definitions, references, dependency/context tools) when they answer the question more precisely than broad file scans.
3. Make focused edits with the core file-routing rules.
4. Run the narrowest meaningful verification first: affected tests or project-specific test/lint/typecheck/build commands, then broaden only when needed.
5. Review the resulting Git diff and affected modules before reporting completion.

## Codex delegation

- Treat the six `codex_*` tools as optional. The runtime advertises 221 tools by default and exposes all 227 only when Codex delegation is enabled.
- Check Codex capability/status before delegating. Do not assume the local Codex runtime exists or is authenticated.
- Never read or copy Codex credential files to make delegation work.
- A delegated task remains subject to lnwjud workspace, command, and approval policy.

## Boundaries

- Do not alter ToolRegistry defaults merely to satisfy one development request.
- Do not use opaque shell commands for source edits when `edit_file`, `apply_patch`, or `write_file` is appropriate.
- Do not claim tests passed unless a completed verification result supports it.
