---
name: lnwjud-browser
description: Use when browser or web-app work should run through lnwjud managed Chrome/CDP capabilities, including tabs, DOM state, accessibility observations, Set-of-Marks, console/network context, browser debugging, and controlled target actions.
---

# lnwjud Browser

Use the managed browser runtime and prefer semantic page state over screenshot-only automation.

## Workflow

1. Inspect the current tabs/page with DOM, accessibility, network, console, or browser-debug context appropriate to the request.
2. Select the exact target tab from current runtime evidence rather than relying on visual tab order or OS focus.
3. Prefer DOM/accessibility selectors and annotated target observations over pixel coordinates.
4. Refresh observations before target-bound actions when the page may have changed or the runtime requires fresh target evidence.
5. Perform the smallest requested browser action and re-inspect the resulting state.

## Boundaries

- Stay inside the browser/session and permission scope managed by lnwjud.
- Do not assume arbitrary system Chrome profiles, cookies, or credentials are available.
- Do not bypass target-expiry, protected-tab, or approval checks by falling back to blind input.
- For web navigation prefer managed CDP/tab operations over typing into a browser address bar through native input.
- Treat navigation, downloads, form submission, and authenticated mutations according to the current lnwjud/host approval policy.
