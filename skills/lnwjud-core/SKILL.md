---
name: lnwjud-core
description: Use when ChatGPT or Codex needs to inspect, search, read, edit, recover, or understand files and registered workspaces through the shared lnwjud MCP runtime, or when exact lnwjud tool selection is uncertain.
---

# lnwjud Core

Use the shared lnwjud MCP runtime as the local execution boundary. The live MCP ToolRegistry is authoritative; this skill routes intent and never redefines tool names, schemas, permissions, availability, or catalog counts.

## Workflow

1. Start read-only. Discover the registered/active workspace and inspect permission state when it matters.
2. Use workspace, search, context, and read tools to collect only the context needed for the request.
3. If the exact capability is unclear, use current registry/tool discovery before guessing a tool name.
4. For source/config/text mutation, prefer guarded file tools such as `edit_file`, `apply_patch`, or `write_file` rather than terminal-based text rewriting.
5. Use checkpoint/recovery capabilities when supported and appropriate to the mutation risk.
6. Verify the resulting state with a read, diff, or the narrow project check relevant to the change.

## Boundaries

- Never use shell, PowerShell, Node, Python, `sed`, or similar terminal text-rewrite tricks as a substitute for guarded lnwjud file-edit tools.
- Respect the selected workspace, strict roots, permission profile, Active Project rules where applicable, approval boundary, and recovery policy.
- Do not infer that read permission implies write/execute permission.
- Do not expose credentials or raw secret-bearing local files unless the request and current policy explicitly permit the exact read.
- Do not hard-code or alter ToolRegistry catalog counts from this skill; follow the synchronized live registry.
