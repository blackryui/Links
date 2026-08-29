# lnwjud ChatGPT Web Plugin Setup

This guide explains how the plugin package in this repository connects ChatGPT Web to the existing lnwjud Windows runtime. The plugin does not move local execution into the cloud and does not duplicate the MCP ToolRegistry.

## Architecture

```text
ChatGPT Web / Codex
  -> lnwjud plugin metadata + routing skills
  -> workspace-associated OpenAI Secure MCP Tunnel
  -> bundled tunnel-client
  -> lnwjud Desktop loopback HTTP MCP
  -> selected Active Project(s) on the user's Windows machine
```

The Desktop MCP endpoint remains loopback-only. This package does **not** publish `127.0.0.1` or `localhost` to the Internet and does not require a public inbound port.

## Prerequisites

- Windows 10/11 x64.
- lnwjud Desktop v4.13.0 or a newer compatible release.
- At least one registered project/workspace selected as an Active Project.
- A reviewed lnwjud permission profile appropriate for the work you intend ChatGPT to perform.
- An OpenAI Secure MCP Tunnel associated with the ChatGPT workspace that will use lnwjud.
- A runtime API key with the tunnel runtime permissions required by the current OpenAI tunnel setup.

Do not store the runtime key, tunnel credentials, or other secrets in this repository.

## 1. Start lnwjud and select the local scope

1. Launch lnwjud Desktop.
2. Register/select the project that ChatGPT is allowed to inspect.
3. Set the Active Project(s) and Primary Project as needed.
4. Review the Desktop permission profile before connecting ChatGPT.

The plugin adds no authority. A ChatGPT request can do only what is simultaneously allowed by ChatGPT/plugin permissions, workspace capability, Secure MCP Tunnel availability, the lnwjud permission profile, Active Project boundaries, and native exact-action approval.

## 2. Configure the OpenAI Secure MCP Tunnel

In lnwjud Desktop, open **Settings -> OpenAI Secure MCP Tunnel**.

1. Create or select the OpenAI tunnel that belongs to the intended Platform organization and ChatGPT workspace.
2. Create the restricted runtime API key required to use that tunnel.
3. Save the runtime key in lnwjud. The released Windows app stores it using the existing Windows secret-storage path; never commit it to Git.
4. Enter the real tunnel ID in lnwjud and run **Configure Tunnel**.
5. Start/reconnect the tunnel and confirm that lnwjud reports the Desktop MCP/tunnel path as healthy.

The tunnel should target the Desktop loopback MCP selected by lnwjud. Do not replace this with a public reverse proxy to the local MCP port.

## 3. Create the ChatGPT connection

In a ChatGPT workspace that supports the required developer/plugin capabilities:

1. Enable Developer mode if the workspace requires it for custom connections.
2. Open the Plugins/Connections area.
3. Create a connection using **Tunnel**.
4. Select the existing tunnel or enter the real tunnel ID when the UI requests it.
5. Confirm that ChatGPT can discover the lnwjud MCP tools.

If lnwjud was upgraded or its tool schemas changed, use **Refresh connector** in ChatGPT. If the conversation still has stale tool metadata after the refresh, open a new chat.

## 4. Load the plugin package

The repository contains the package entrypoint at `.codex-plugin/plugin.json` and six intent-routing skills under `skills/`.

Where the current ChatGPT/Codex surface supports loading a plugin package from a repository or local package, load this repository/package after the tunnel connection exists. The package is intentionally declarative: tool calls still route to the connected lnwjud MCP runtime.

### Stage A: package-ready

The public repository contains:

- `.codex-plugin/plugin.json`
- the six routing skills
- static validation/tests
- this setup guide

The public repository intentionally does **not** contain `.app.json` with a guessed connector identifier.

### Stage B: workspace-bound app binding

After ChatGPT creates a real app/connector identity for the lnwjud connection, use that verified identifier if the package-loading flow requires an `.app.json` binding.

Do not commit a placeholder such as `connector_xxxxx`. If the connector identifier is workspace-specific and should not be public, keep the binding private and leave the public repository at Stage A.

## 5. Verify read-only access first

Use a read-only smoke prompt before allowing mutations:

```text
Use lnwjud to list registered workspaces, report Git status for the active project, and summarize the top-level project tree. Do not modify anything.
```

A successful result proves the main path:

```text
ChatGPT -> Secure MCP Tunnel -> lnwjud Desktop MCP -> local workspace tools
```

## 6. Verify one controlled write

After read-only verification succeeds, test a low-risk controlled change in a disposable or version-controlled project. Ask ChatGPT to make one exact text change using lnwjud file-edit tools, run a narrow verification, and show the Git diff.

Approval behavior can occur at more than one layer. A ChatGPT permission prompt and an lnwjud native exact-action approval are separate controls; denial at either layer is expected to stop the action.

## Tool count: 221 default / 227 configurable

lnwjud v4.13.0 contains **227 configurable MCP tools**. The normal runtime advertises **221** because the six `codex_*` delegation tools are opt-in.

The plugin does not change that default. To use all 227, enable the existing Codex delegation capability in lnwjud and verify local Codex availability first. Do not modify the ToolRegistry merely to make the plugin appear to expose more tools.

The six plugin skills route by intent and can use lnwjud's own tool-discovery capabilities when the exact MCP tool is uncertain. Tool schemas continue to come from the live MCP server.

## Security boundaries

Effective authority is the intersection of:

```text
ChatGPT plugin permissions
AND ChatGPT workspace capabilities
AND Secure MCP Tunnel availability
AND lnwjud Desktop permission profile
AND Active Project mutation boundary
AND native exact-action approval where required
```

The most restrictive layer wins. The plugin skills must not instruct ChatGPT to bypass any of these boundaries.

## Troubleshooting

### Tunnel offline

Check lnwjud Desktop first: the Desktop MCP listener, saved tunnel configuration, runtime key availability, and tunnel process/health must all be valid. Reconnect the existing tunnel rather than creating a replacement identity unless the original configuration is genuinely invalid.

### ChatGPT shows old tools or schemas

Use **Refresh connector**. If cached schema remains in the current conversation, open a new chat after refreshing.

### ChatGPT denies a read/write action

Review ChatGPT/plugin permission settings and workspace capability. Do not weaken lnwjud security controls to compensate for a ChatGPT-layer denial.

### lnwjud returns a permission or Active Project denial

Review the Desktop permission profile and selected Active Project. Change the local scope only when the requested target is intentionally trusted.

### Native approval is denied or cancelled

The operation must remain blocked. Retry only after the user deliberately approves the exact action; do not substitute shell, browser, UI, or coordinate automation to bypass the denial.

### `codex_*` tools are missing

This is normal when Codex delegation is disabled. The runtime remains at 221 advertised tools until the existing opt-in delegation feature is enabled.

## Repository validation

Run the narrow plugin checks from the repository root:

```text
corepack pnpm@10.15.0 test:plugin
corepack pnpm@10.15.0 validate:plugin
```

The authoritative release verification also runs these checks before the broader lnwjud release gates.
