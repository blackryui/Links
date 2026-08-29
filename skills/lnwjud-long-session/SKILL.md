---
name: lnwjud-long-session
description: Use when a lnwjud goal may exceed one ChatGPT run and must continue safely through durable checkpoints plus one-time native ChatGPT Scheduled Task successors without overlapping local mutations.
---

# lnwjud Long Session

Use lnwjud durable goal state for work continuity and native ChatGPT Scheduled Tasks only for future wakes. Preserve the safety invariants of `.agents/skills/lnwjud-scheduled-continuation/SKILL.md`.

## Initial or manually resumed run

1. Start or resume a stable goal with `run_goal`; do not create a second goal for the same durable work.
2. Work normally and checkpoint meaningful milestones with `checkpoint_goal`.
3. Do not schedule a successor at run start.
4. Only when the host run is genuinely near its handoff boundary and meaningful work remains, call `prepare_scheduled_continuation` once.
5. Create exactly one native one-time ChatGPT Scheduled Task from the returned request, then record the real creation result with `record_scheduled_continuation_receipt`.
6. The predecessor may continue only while its lease remains valid and must stop mutation at the handoff deadline.

## Scheduled successor

1. Call `claim_scheduled_continuation` before any local file, Git, process, UI, or other mutation.
2. `terminal_noop`: stop; the goal is already terminal.
3. `already_claimed`: stop; another run consumed the continuation.
4. `busy_blocked`: do not mutate and do not create a polling loop.
5. `acquired`: resume from the durable checkpoint and work as a normal full run.
6. Prepare another single successor only near this run's own handoff boundary if work remains.

## Completion

- Finish terminal work with `finish_goal`.
- Follow the exact native Scheduled Task cancellation instruction returned by the goal state and record the actual cancellation receipt.
- If cancellation is uncertain, keep the durable goal terminal; a later wake must no-op rather than restart work.

## Hard boundaries

- Never use Windows Task Scheduler, `schtasks.exe`, cron, shell timers, or an undocumented scheduling API as a fallback.
- Never create recurring two-minute retries for continuation.
- Never allow overlapping mutation leases for the same durable goal/workspace.
- Execution preference is not proof of cloud/local execution; record only what the host confirms.
