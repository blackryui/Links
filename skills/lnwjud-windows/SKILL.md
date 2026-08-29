---
name: lnwjud-windows
description: Use when ChatGPT or Codex needs to observe or automate the user's Windows machine through ECO Headless, including windows, accessibility, screenshots, Set-of-Marks, input, clipboard, notifications, file dialogs, services, registry or event-log context.
---

# ECO Windows

Windows actions execute locally through ECO Headless and the shared Windows capability backends. Observe first, prefer semantic targets, and preserve host permissions plus the shared capability/destructive safety rules.

## Workflow

1. Observe the target with window/accessibility/vision capabilities before acting.
2. Prefer semantic Accessibility targets or Set-of-Marks / target-bound actions over blind screen coordinates when available.
3. For target-bound actions, use a fresh observation when the runtime requires an observation hash or expiring target reference.
4. Perform only the requested action, then observe again when confirmation is useful.

## Boundaries

- Never bypass or weaken ChatGPT/Codex host approval, the ECO permission profile, strict allowed roots, Active Project/workspace scope, target-expiry checks, or tool-specific destructive policy.
- Treat input, window manipulation, shell/system actions, registry/service actions, and other opaque native mutations as higher risk than read-only observation.
- The Windows lock/sign-in screen and UAC secure desktop are outside normal automation. Do not claim control when Windows integrity/session isolation blocks it.
- If the target application is elevated while ECO is not, semantic UI access may be limited; report the boundary instead of retrying blindly.
- Do not use repeated coordinate clicking to compensate for missing semantic evidence or a denied action.
