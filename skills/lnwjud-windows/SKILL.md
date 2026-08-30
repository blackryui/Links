---
name: lnwjud-windows
description: Use when ChatGPT or Codex needs to observe or automate Windows through the shared lnwjud MCP runtime, including windows, accessibility, vision, Set-of-Marks, input, clipboard, notifications, file dialogs, services, registry, or event-log context.
---

# lnwjud Windows

Windows actions are local side effects owned by the shared lnwjud runtime and its MCP permission/approval boundary. The Desktop/Electron host is not required for ECO headless operation.

## Workflow

1. Observe the target with window, accessibility, vision, or other read-oriented capabilities before acting.
2. Prefer semantic accessibility targets or Set-of-Marks / target-bound actions over blind screen coordinates when available.
3. Refresh observations before target-bound actions when the UI may have changed or the runtime requires fresh target evidence.
4. Perform only the requested action, then observe again when confirmation is useful.

## Boundaries

- Never bypass or weaken lnwjud approval, permission profiles, strict-root/Active Project scope, or destructive policy.
- Treat input, window manipulation, shell/system actions, registry/service actions, and other opaque native mutations as higher risk than read-only observation.
- The Windows lock/sign-in screen and UAC secure desktop remain outside normal automation; do not claim control when Windows isolation blocks it.
- If the target application runs at higher integrity than the MCP runtime, semantic UI access may be limited; report the boundary instead of retrying blindly.
- Do not use repeated coordinate clicking to compensate for missing semantic evidence.
