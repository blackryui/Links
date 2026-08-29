---
name: lnwjud-office
description: Use when Microsoft Office or local workbook/document work should run through ECO Headless, including inspection, controlled edits, exports, and document-oriented automation on the user's Windows machine.
---

# ECO Office

Prefer the shared structured Office/document capability over ad-hoc shell, clipboard, or UI automation when a structured Office action exists.

## Workflow

1. Inspect the target workbook/document and relevant metadata before mutation when inspection is supported.
2. Confirm the configured workspace/path boundary and intended output path.
3. Use the narrow structured Office action needed for the requested change.
4. Satisfy the required host confirmation / `userConfirmed` contract for writes and preserve replacement backup, checkpoint, or recovery evidence supplied by the runtime.
5. Re-inspect or verify the saved/exported result before reporting completion.

## Boundaries

- Never silently overwrite files outside the configured strict roots or Active Project/workspace boundary.
- Do not disable Office security prompts, host permission checks, or shared ECO safety/destructive policy to automate a write.
- Do not use clipboard or keystroke automation when a structured Office capability provides a safer equivalent.
- Treat macros, external links, Outlook sends, and opaque document-owned scripts as execution or external mutation rather than harmless document editing.
