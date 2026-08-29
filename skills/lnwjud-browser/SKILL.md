---
name: lnwjud-browser
description: Use when browser or web-app work should run through ECO Headless managed Chrome/CDP capabilities, including DOM snapshots, accessibility observations, Set-of-Marks, console/network context, browser debugging, and controlled target actions.
---

# ECO Browser

Use the managed browser session provided by the shared runtime and prefer semantic page state over screenshot-only automation.

## Workflow

1. Inspect the page with DOM, accessibility, network, console, or browser-debug context appropriate to the problem.
2. Prefer DOM/accessibility selectors and annotated target observations over pixel coordinates.
3. Refresh observations before target-bound actions when the page may have changed or the runtime requires a fresh observation hash.
4. Perform the smallest requested browser action and re-inspect the resulting state.

## Boundaries

- Stay inside the managed browser/session plus the current ECO and host permission scope.
- Do not assume arbitrary personal Chrome profiles, cookies, or credentials are available.
- Do not bypass target-expiry, `userConfirmed`, host approval, or safety checks by falling back to blind input.
- Treat navigation, downloads, form submission, authenticated mutations and remote writes according to current host and shared runtime policy.
- If a browser action is denied, do not route around the denial through low-level Windows input.
