# ECO ChatGPT Web Plugin Setup

ECO is the ChatGPT-facing plugin identity for the existing lnwjud Windows runtime. The runtime, MCP ToolRegistry, internal skill namespaces, local permissions, and Windows execution model remain lnwjud-compatible; only the user-facing ChatGPT plugin identity is branded ECO.

## Architecture

```text
ChatGPT Web / Codex
  -> ECO plugin metadata + lnwjud routing skills
  -> workspace-associated OpenAI Secure MCP Tunnel
  -> bundled tunnel-client
  -> lnwjud Desktop loopback HTTP MCP
  -> selected Active Project(s) on the user's Windows machine
```

The Desktop MCP endpoint remains loopback-only. ECO does not publish `127.0.0.1` or `localhost` to the Internet and does not require a public inbound port.

## Prerequisites

- Windows 10/11 x64.
- lnwjud Desktop v4.13.0 or a newer compatible release.
- At least one registered workspace selected as an Active Project.
- A reviewed lnwjud permission profile.
- An OpenAI Secure MCP Tunnel associated with the ChatGPT workspace that will use ECO.
- A runtime API key with the permissions required by the current OpenAI tunnel setup.

Never commit the runtime key, tunnel credentials, connector credentials, or other secrets to this repository.

## 1. Start the local runtime

1. Launch lnwjud Desktop.
2. Register/select the project that ECO is allowed to inspect.
3. Set Active Project(s) and Primary Project as needed.
4. Review the Desktop permission profile before connecting ChatGPT.

ECO adds no new authority. Effective authority is still bounded by ChatGPT permissions, workspace capability, Secure MCP Tunnel availability, the lnwjud permission profile, Active Project boundaries, and native exact-action approval.

## 2. Configure the OpenAI Secure MCP Tunnel

In lnwjud Desktop, open **Settings -> OpenAI Secure MCP Tunnel**.

1. Create or select the OpenAI tunnel for the intended Platform organization and ChatGPT workspace.
2. Create the restricted runtime API key required to use that tunnel.
3. Save the runtime key in lnwjud; do not paste it into Git or documentation.
4. Enter the real tunnel ID and run **Configure Tunnel**.
5. Start/reconnect the tunnel and confirm the Desktop MCP/tunnel path is healthy.

The tunnel must target the Desktop loopback MCP selected by lnwjud. Do not replace this with a public reverse proxy to the local MCP port.

## 3. Create the ChatGPT connection as ECO

In the ChatGPT workspace that will use the connection:

1. Enable Developer mode when required for custom connections.
2. Open Plugins/Connections.
3. Create a connection using **Tunnel**.
4. Select the existing tunnel or paste the real tunnel ID when requested.
5. Use the connection name **ECO**.
6. Confirm that ChatGPT can discover the lnwjud MCP tools through ECO.

If lnwjud is upgraded or its tool schemas change, use **Refresh connector**. If a conversation still has stale tool metadata, open a new chat after refreshing.

## 4. Load the ECO plugin package

The repository package entrypoint is `.codex-plugin/plugin.json`. It exposes the plugin machine name `eco`, display name `ECO`, and six internal `lnwjud-*` routing skills.

The internal skill names stay `lnwjud-*` deliberately so existing runtime/tool behavior is not forked or duplicated.

### Stage A: package-ready

The public repository contains:

- `.codex-plugin/plugin.json`
- six routing skills
- static validation/tests
- this setup guide

The public repository intentionally contains no guessed `.app.json` connector identifier.

### Stage B: workspace-bound app binding

After ChatGPT creates a real app/connector identity for the ECO connection, use that verified identifier only if the package-loading flow requires `.app.json`.

Do not commit a placeholder connector ID. If the identifier is workspace-specific and should remain private, keep the binding private and leave the public repository at Stage A.

## 5. Verify read-only access first

Use a low-risk smoke prompt first:

```text
Use ECO to list registered workspaces, report Git status for the active project, and summarize the top-level project tree. Do not modify anything.
```

This verifies the path:

```text
ChatGPT -> ECO -> Secure MCP Tunnel -> lnwjud Desktop MCP -> local workspace tools
```

## 6. Verify one controlled write

After read-only access succeeds, test one exact text change in a disposable or version-controlled project. Ask ECO to make the change with lnwjud file-edit tools, run a narrow verification, and show the Git diff.

ChatGPT permission prompts and lnwjud native exact-action approval are separate controls. Denial at either layer must stop the action.

## Tool count: 221 default / 227 configurable

lnwjud v4.13.0 contains **227 configurable MCP tools**. The normal runtime advertises **221** because the six `codex_*` delegation tools remain opt-in.

ECO does not change that default. The live lnwjud MCP ToolRegistry remains the source of truth; ECO only supplies plugin metadata and workflow routing.

## Security boundaries

```text
ChatGPT plugin permissions
AND ChatGPT workspace capabilities
AND Secure MCP Tunnel availability
AND lnwjud Desktop permission profile
AND Active Project mutation boundary
AND native exact-action approval where required
```

The most restrictive layer wins. ECO must not route around any denial by substituting shell, browser, UI, or coordinate automation.

## Troubleshooting

- **Tunnel offline:** check lnwjud Desktop MCP health, saved tunnel configuration, runtime key availability, and tunnel process state.
- **Old tools/schema in ChatGPT:** use **Refresh connector** and open a new chat if the old schema remains cached.
- **ChatGPT denies an action:** review ChatGPT/plugin permissions and workspace capability.
- **lnwjud denies an action:** review the Desktop permission profile and Active Project scope.
- **Native approval denied/cancelled:** keep the operation blocked.
- **`codex_*` tools missing:** normal when delegation is disabled; runtime remains at 221 advertised tools.

## Repository validation

```text
corepack pnpm@10.15.0 test:plugin
corepack pnpm@10.15.0 validate:plugin
```

The release verification gate also runs the plugin checks before broader lnwjud release checks.
