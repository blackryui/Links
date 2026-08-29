---
name: lnwjud-core
description: Use when ChatGPT needs to inspect, search, read, edit, recover, or understand files and registered workspaces through the lnwjud MCP runtime, or when exact lnwjud tool selection is uncertain.
---

# lnwjud Core

Use lnwjud as the local execution boundary. The live MCP ToolRegistry is authoritative; this skill routes intent and never redefines tool schemas.

## Workflow

1. Start read-only. Discover the registered/active workspace and inspect permission state when it matters.
2. Use workspace, search, context, and read tools to collect only the context needed for the request.
3. If the exact capability is unclear, use lnwjud tool discovery such as `tool_search`, `tool_categories`, `tool_describe`, or equivalent registry discovery before guessing a tool name.
4. For source/config/text mutation, prefer `edit_file` for exact edits, `apply_patch` for reviewed multi-file or whole-file replacements, and `write_file` for creation or intentional replacement.
5. Use recovery/checkpoint capabilities when the planned mutation is supported by them and the risk warrants it.
6. Verify the resulting state with a read, diff, or the narrow project check relevant to the change.

## Boundaries

- Never use shell, PowerShell, Node, Python, `sed`, or similar terminal text-rewrite tricks as a substitute for lnwjud file-edit tools.
- Respect the selected Active Project, permission profile, path boundaries, trusted-host approval, and recovery policy.
- Do not infer that a read permission implies write/execute permission.
- Do not expose credentials or raw secret-bearing local files unless the user's request and current policy explicitly permit the exact read.
- Do not change the 221-default / 227-configurable ToolRegistry policy from this skill.
