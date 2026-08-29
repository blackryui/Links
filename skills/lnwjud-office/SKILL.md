---
name: lnwjud-office
description: Use when Microsoft Office or local workbook/document work should run through lnwjud, including inspection, controlled edits, exports, and document-oriented automation on the user's Windows machine.
---

# lnwjud Office

Prefer lnwjud's Office/document capabilities over ad-hoc shell or UI automation when a structured Office action exists.

## Workflow

1. Inspect the target workbook/document and relevant metadata before mutation when inspection is supported.
2. Confirm the active workspace/path boundary and intended output path.
3. Use the narrow structured Office action needed for the requested change.
4. Preserve checkpoints/backups/recovery evidence when lnwjud provides them for the operation.
5. Re-inspect or verify the saved/exported result before reporting completion.

## Boundaries

- Never silently overwrite files outside the active mutation boundary.
- Do not disable application or lnwjud safety prompts to automate a write.
- Do not use clipboard or keystroke automation when a structured Office capability provides a safer equivalent.
- Treat macros, external links, and opaque document-owned scripts as execution, not as harmless document editing.
