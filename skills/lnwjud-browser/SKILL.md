---
name: lnwjud-browser
description: Use when browser or web-app work should run through lnwjud's managed Chrome/CDP capabilities, including DOM snapshots, accessibility observations, Set-of-Marks, console/network context, browser debugging, and controlled target actions.
---

# lnwjud Browser

Use the managed browser session and prefer semantic page state over screenshot-only automation.

## Workflow

1. Inspect the page with DOM, accessibility, network, console, or browser-debug context appropriate to the problem.
2. Prefer DOM/accessibility selectors and annotated target observations over pixel coordinates.
3. Refresh observations before target-bound actions when the page may have changed or lnwjud requires a fresh observation hash.
4. Perform the smallest requested browser action and re-inspect the resulting state.

## Boundaries

- Stay inside the browser/session and permission scope managed by lnwjud.
- Do not assume arbitrary system Chrome profiles, cookies, or credentials are available.
- Do not bypass target-expiry or approval checks by falling back to blind input.
- Treat navigation, downloads, form submission, and authenticated mutations according to the current lnwjud/host approval policy.
