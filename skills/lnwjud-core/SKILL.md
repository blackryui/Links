---
name: lnwjud-core
description: Use when ChatGPT or Codex needs to inspect, search, read, edit, recover, or understand files and configured workspaces through ECO Headless, or when exact shared MCP tool selection is uncertain.
---

# ECO Core

Use ECO Headless as the local Windows execution boundary. The shared lnwjud-compatible MCP ToolRegistry is authoritative; this skill routes intent and never redefines tool schemas.

## Workflow

1. Start read-only. Discover configured workspaces and the current Active Project/workspace before mutation.
2. Use workspace, search, context, and read tools to collect only the context needed for the request.
3. If the exact capability is unclear, use shared tool discovery such as `tool_search`, `tool_categories`, `tool_describe`, or equivalent registry discovery instead of guessing.
4. For source/config/text mutation, prefer `edit_file` for exact edits, `apply_patch` for reviewed multi-file or whole-file replacements, and `write_file` for creation or intentional replacement.
5. Use checkpoint/recovery capabilities when supported and appropriate for the mutation.
6. Verify the resulting state with a read, Git diff, or the narrow project check relevant to the change.

## Boundaries

- Never use shell, PowerShell, Node, Python, `sed`, or similar terminal text-rewrite tricks as a substitute for guarded file-edit tools.
- Respect ChatGPT/Codex host permission decisions, the ECO permission profile, explicit strict allowed roots, Active Project/workspace boundaries, secret/path guards, destructive policy, and recovery rules.
- Do not infer that read permission implies write/execute permission.
- Do not expose credentials or raw secret-bearing local files unless the user's request and current policy explicitly permit the exact read.
- Follow the live ToolRegistry catalog and optional-tool policy; do not freeze a historical tool count in this skill.
