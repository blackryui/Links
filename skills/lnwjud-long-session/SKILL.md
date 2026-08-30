---
name: lnwjud-long-session
description: Use when a durable lnwjud goal may span multiple ChatGPT turns and must continue safely through checkpoints, leases, tracked tasks, and host-owned one-time scheduled successors.
---

# lnwjud Long Session

Use lnwjud durable goal state for continuity. The authoritative continuation workflow is `.agents/skills/lnwjud-scheduled-continuation/SKILL.md`; read and follow that current skill rather than duplicating its lease durations, scheduling delays, collision rules, receipt semantics, or terminal-state protocol here.

## Routing workflow

1. Use `run_goal` to create or resume one stable durable goal for the work.
2. Record meaningful progress and tracked work through `checkpoint_goal` using the current goal revision/lease contract.
3. When automatic scheduled continuation is active, apply the bundled `lnwjud-scheduled-continuation` skill exactly as the current runtime directs.
4. Recover background work through its recorded provider/task ID instead of restarting mutations blindly.
5. Before reporting completion, inspect terminal task results, satisfy the requested acceptance evidence, call `finish_goal`, and require the durable goal to be terminal.

## Boundaries

- Never invent or hard-code continuation timing when the authoritative bundled skill/runtime provides it.
- Never expose lease tokens, credentials, private source text, or internal session identifiers in user-visible or scheduled-task prompts.
- Never use Windows Task Scheduler, `schtasks.exe`, cron, shell timers, or browser automation as a substitute for the host-owned ChatGPT scheduled-continuation contract.
- Never allow overlapping mutation ownership for the same durable goal/workspace.
- Cancelling a scheduled successor and cancelling the durable goal are separate operations; follow the runtime result for each.
- Do not report completion while the durable goal remains active or required task/cancellation evidence is unresolved.
