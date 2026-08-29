---
name: lnwjud-windows
description: Use when ChatGPT needs to observe or automate the user's Windows desktop through lnwjud, including windows, accessibility, screenshots, Set-of-Marks, input, clipboard, notifications, file dialogs, services, registry or event-log context.
---

# lnwjud Windows

Windows actions are local side effects owned by lnwjud Desktop. Observe first and preserve the native approval boundary.

## Workflow

1. Observe the target with window/accessibility/vision capabilities before acting.
2. Prefer semantic accessibility targets or Set-of-Marks / target-bound actions over blind screen coordinates when available.
3. For target-bound actions, use a fresh observation when lnwjud requires an observation hash or expiring target reference.
4. Perform only the requested action, then observe again when confirmation is useful.

## Boundaries

- Never bypass or weaken lnwjud native exact-action approval, permission profiles, or Active Project scope.
- Treat input, window manipulation, shell/system actions, registry/service actions, and other opaque native mutations as higher risk than read-only observation.
- The Windows lock/sign-in screen and UAC secure desktop are outside normal automation. Do not claim control when Windows integrity/session isolation blocks it.
- If the target application is elevated while lnwjud is not, semantic UI access may be limited; report the boundary instead of retrying blindly.
- Do not use repeated coordinate clicking to compensate for missing semantic evidence.
