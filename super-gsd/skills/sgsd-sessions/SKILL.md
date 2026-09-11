---
name: sgsd-sessions
description: Use when opening, restoring after reboot, attaching, handing over or checking SGSD sessions in DEVCP/Linux worktrees, including missing tmux workspaces, remembered sessions, sg boot health or uncertain Atlas attachment.
---

<objective>
One registered orchestrator per real worktree, under the host's shared fleet
identity. Preserve work and show observed evidence, not a generic green badge.
The coordinator is a private ownership record, not another paid agent.
</objective>

<reboot_recovery>
After a server reboot, use `sg --sessions` from any directory to inspect the
remembered workspaces before starting providers. The first interactive `sg`
offers all, selected entries or not now. It never selects all implicitly.
Every new successfully bound managed workspace is remembered automatically;
this is not limited to a fixed list of projects.

With the operator's selection, use `sg --restore all` or
`sg --restore PROJECT_ID,PROJECT_ID` using IDs from that list. A bare
`sg --restore` needs an interactive choice; noninteractive callers must supply
selection. Restore opens detached paused owners and returns attach choices;
it does not also start a local owner or resume business work. Ordinary `sg`
still keeps Claude in the calling terminal.
Without a TTY, ordinary `sg` skips the menu and retains its single-workspace
launch path; it never chooses or restores a fleet implicitly.

Inspect each result separately: already running, restored/bound, pending,
blocked or failed. Retry only the selected entries through the same restore
command. Never replay a consumed launch ticket, reuse an old run ID, delete a
pending claim, kill tmux or hand-edit a pin to force recovery. A missing worktree
stays listed; repair its actual path/provenance before retrying. An uncertain
same-boot pending owner or interrupted lock-reclaim guard remains blocked.

Check the fresh run's previous-run/context-reference lineage. Saved handovers
are references, not recovered in-memory conversation or permission to retry an
interrupted operation. Preserve task approval holds and require a new operator
instruction before business work. No automatic worker, deployment or posting replay.

`sg --forget PROJECT_ID` removes restore intent only, not files, evidence or a
running owner. Normal exit never means forget. The same run must not re-add a
forgotten entry; a genuinely new managed binding can remember it again.
</reboot_recovery>

<process>
1. Resolve the requested existing worktree using current directory and Git's
   worktree inventory. Never default to the main checkout. Read that worktree's
   state and handover; if they name another task/worktree, hold business work
   until clarified. Do not rewrite inherited state or guess approval decisions.

2. Read ownership before starting anything:
   `node ~/.claude/tools/telemetry-atlas/fleet.cjs status --project-dir ABSOLUTE_WORKTREE`.
   A claimed worktree cannot gain a second orchestrator, even a greeting-only
   one under a different tmux name. Use the restore path for reboot recovery;
   it proves obsolete ownership before release. Unknown claims/locks remain
   blocked; never delete locks, reset sessions or adopt by PID.

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
   Match native evidence to `projects[].runs[].run_id`, not merely a recent
   project aggregate. Missing/stale monitor evidence stays unknown or pending.
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
