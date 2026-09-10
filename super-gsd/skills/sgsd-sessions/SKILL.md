---
name: sgsd-sessions
description: Use when opening, creating, attaching, handing over or checking SGSD sessions in DEVCP/Linux worktrees, including requests for new tmux workspaces, sg boot health, or uncertain Atlas attachment.
---

<objective>
One registered orchestrator per real worktree, under the host's shared fleet
identity. Preserve work and show observed evidence, not a generic green badge.
The coordinator is a private ownership record, not another paid agent.
</objective>

<process>
1. Resolve the requested existing worktree using current directory and Git's
   worktree inventory. Never default to the main checkout. Read that worktree's
   state and handover; if they name another task/worktree, hold business work
   until clarified. Do not rewrite inherited state or guess approval decisions.

2. Read ownership before starting anything:
   `node ~/.claude/tools/telemetry-atlas/fleet.cjs status --project-dir ABSOLUTE_WORKTREE`.
   A claimed worktree cannot gain a second orchestrator, even a greeting-only
   one under a different tmux name. Pending, stale and unknown claims require
   explicit handover/recovery; never delete locks, reset sessions or adopt by PID.

3. For an existing owner, verify its run/project, current provider PID/start
   identity and tmux pane relationship. For replacement, collect a private
   handover and pause acknowledgement, drain owned workers/questions, preserve
   evidence, then stop only the approved old provider. Release its exact run
   using `fleet.cjs release --run-id RUN`. `--allow-pending` is only for a proved
   never-started launch, not an unidentified live process. No blanket tmux kills.

4. Use `sg --project ABSOLUTE_WORKTREE` for Claude in the current terminal.
   For a separate tmux workspace use:
   `bash ~/.claude/super-gsd/scripts/sgsd-remote-tmux.sh --project ABSOLUTE_WORKTREE --source-dir ~/.claude/super-gsd/source --greet --no-attach`.
   Start with the briefing, not unattended work. Normal provenance, exact-run
   reservation and additive monitor enrollment must pass. If source/pin is
   inconsistent, use normal update after the publishing owner finishes; never
   hand-edit pins. New skills/hooks require a fresh provider session.

5. Check the session-start binding and existing Atlas briefing, then read
   `node ~/.claude/tools/telemetry-atlas/monitor-schedule.cjs snapshot`.
   Report receiver health; this exact project/run registration; native delivery
   timestamp or pending/stale; operational delivery, gaps and backlog separately.
   Registration is not delivery; project-level gate evidence is not exact-session
   attribution. An idle session need not generate a synthetic heartbeat.

6. Report configured/selected worker executable and model separately from live
   proof. Use existing worker status/control receipts for communication; applied
   means forwarded, not consumed. Show ATC/MUDA/gates as observed, degraded or
   not exercised. No paid model canaries, repeated full audits or fabricated gate
   rows just to make startup green. Off-host backup freshness is a separate check.
</process>

<success_criteria>
Return a short per-worktree summary: owner/run, task/hold, source/pin, native and
operational observations, worker/gate gaps and attach command. Bare Claude/Codex
cannot be retrofitted by a hook: offer supported handover/relaunch, not a claim
of past capture. Retain historical gaps. Windows execution remains unverified.
</success_criteria>
