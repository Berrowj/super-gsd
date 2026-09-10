# DEVCP fleet handover — operator-authorized operations

Status: IN_PROGRESS; coordinator: this Codex conversation; fleet ID: devcp-20260910-handover.

Authority: Jack requested handovers from every tmux session/worktree and fresh SGSD sessions under one owner. Follow-up requests a reusable SGSD session-creation skill. This document authorizes no SGSD source edits and changes no active milestone/state. New skill/launcher implementation needs its own reviewed numbered plan; 170-13 remains owned by quote-oppty.

## Scope and invariants

- One fleet coordinator; one active Fable work owner per real worktree; subordinate Codex workers use the existing owner-checked bridge.
- Inventory exact pane IDs, provider processes, real worktrees, project pins, run registrations and receipt timestamps. Receiver health alone proves neither attachment nor delivery.
- Collect separate handover documents from productive owners, preserving existing checkpoints and dirty files. Distinguish owner-attested notes from external reconstruction. Do not launch pending UI suggestions as work requests.
- Coordinate 170-13 publication through its current owner. No competing source writes/pushes, provenance bypass, fabricated gate passes, or blind pin edits.
- New sessions begin paused/read-only. Verify identity, native delivery and operational delivery separately before work resumes. Record unexercised gate/communication paths honestly.
- Keep old sessions until handover is acknowledged and replacement verified. No force-stop of active workers; no service/cockpit/tmux-server shutdown. Benchmark sessions are inventoried separately, not promoted into production work.
- Never export prompts, credentials or handover bodies into Atlas. Keep existing raw evidence and historical gaps; the new fleet baseline is not retrospective coverage.

## Ordered tasks

- [x] Discover live sessions and source/release condition.
- [x] Coordinate release owner and pause competing automatic relaunches.
- [x] Collect per-owner handovers, including original task, branch/state conflicts, protected files, pending workers, approval holds and exact safe next action.
- [ ] Validate published/installed runtime via normal updater and supported launcher.
- [ ] Start/reconcile replacements serially with unique identities; validate original worktree and handover before resumption.
- [ ] Verify native, worker-communication metadata and genuine operational gate evidence with source/receipt/canonical linkage; report remaining unknowns.
- [ ] Retire only handed-over obsolete provider sessions; retain recovery artifacts and inventory benchmarks separately.
- [ ] Deliver fleet register and explicit readiness/gap report.

## Initial inventory (observed, not a coverage claim)

Nine tmux sessions, forty panes. Productive legacy panes: %2 main/email, %3 dce-freshness-fix, %31 Opportunity Hub plus SGSD 170-13 release, %32 design, %1 sql-data Codex. Fresh launcher sessions already exist at %33 Opportunity Hub and %37 sql-data. Six other sessions are prior acceptance/benchmark sessions on the main checkout. These counts must be refreshed before any mutation.

At discovery the canonical source was HEAD 26864847, ahead of origin/master e9da2c94, with 170-13 source edits and worker evidence uncommitted. No fleet restart is inferred from a healthy shared receiver.

## Coordination record

14:59:50Z: handover/coordination requests submitted to exact panes %31, %32 and %1. %31 remains release owner; %32 asked to pause its competing automated relaunch. Submission is not acknowledgement or quiescence.

Preserved input-line text before handover (uncertain whether suggestions or unsubmitted drafts; NOT authorized for execution by this handover):

- %2: `continue v30-07 from where the opportunity hub session left off`
- %3: `this session owns dce-freshness-fix, resume the reconciliation recovery`

Do not classify work solely by tmux session name: %16 is named as an acceptance session but its recent work includes a business returns report. Each owner must state actual current task before archival/replacement decisions.

15:08Z checkpoint: all thirteen notes collected into the private Windows directory `C:/Users/jack.berrow/.local/state/sgsd/fleet-handovers/devcp-20260910-handover/`, with source SHA-256 values in `manifest.json`. No git staging/publication of these private handovers. Pane %32 acknowledged stopping its independent relaunch monitor. Other task owners report quiescence; %31 remains active sole release owner with ATC re-review worker 5a30e7bd. No session/process terminated by this coordinator, no business task resumed.

Monitor configuration now preserves main/Opportunity/design and adds DCE/sql-data/canonical SGSD source. Private preimage retained. Configuration is reporting scope, not attachment. At monitor 15:08:01Z, fresh SQL and Opportunity runs have observed native delivery and degraded operational capture; Design and DCE have no registered runs; manual email has no run environment despite other main-project native records. Five legacy productive provider processes remain unregistered. Future session skill design is proposed separately in `2026-09-10-sgsd-sessions-DESIGN.md`, not implemented or installed.
