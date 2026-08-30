---
name: lnwjud-office
description: Use when Microsoft Office or local workbook/document work should run through the shared lnwjud MCP runtime, including inspection, controlled edits, exports, and Office automation on Windows.
---

# lnwjud Office

Prefer the current structured `office` capability and document/runtime tools over ad-hoc shell or UI automation when they cover the requested operation.

## Workflow

1. Inspect the target workbook/document and relevant metadata before mutation when inspection is supported.
2. Confirm the active workspace/path boundary and intended input/output paths.
3. Use the narrow structured Office or document action needed for the request.
4. Preserve checkpoints, Recovery Trash, or replacement-recovery evidence when the runtime provides them.
5. Re-inspect or verify the saved/exported result before reporting completion.

## Boundaries

- Microsoft Office availability is dependency-gated; do not claim an Office action is available merely because the tool definition exists.
- Never silently overwrite files outside the authorized mutation boundary.
- Do not weaken application or lnwjud approval/scope checks to automate a write.
- Do not use clipboard, blind keystrokes, or raw shell automation when a structured Office capability provides a safer equivalent.
- Treat macros, external links, and opaque document-owned scripts as execution, not as harmless document editing.
