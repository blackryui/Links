---
name: lnwjud-development
description: Use when software-development work should run through the shared lnwjud MCP runtime, including Git inspection, code navigation, implementation, project verification, review context, or optional local Codex delegation.
---

# lnwjud Development

Route development work through the current lnwjud code, Git, project-command, context, and optional Codex tools without duplicating their schemas or advertisement policy.

## Workflow

1. Inspect `git_status` and the relevant code/context before changing anything.
2. Prefer semantic/code-navigation tools when they answer the question more precisely than broad file scans.
3. Make focused edits through guarded file tools.
4. Run the narrowest meaningful verification first, then broaden only when the task requires it.
5. Review the resulting Git diff and affected modules before reporting completion.

## Codex delegation

- Treat `codex_*` tools as optional upstream capabilities controlled by shared lnwjud settings and runtime availability.
- Check Codex capability/status before delegating. Do not assume Codex is installed or authenticated.
- Never read or copy Codex credential files to make delegation work.
- Delegated work remains subject to the same workspace, permission, command, approval, and recovery boundaries.
- Codex Desktop acting as an MCP client is separate from optional `codex_*` delegation tools.

## Boundaries

- Do not alter ToolRegistry defaults merely to satisfy one development request.
- Do not hard-code advertised tool counts; use the live synchronized registry.
- Do not use opaque shell commands for source edits when guarded file tools are appropriate.
- Do not claim tests or builds passed unless completed verification evidence supports it.
