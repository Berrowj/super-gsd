---
phase: 64
phase_name: Workflow Pack Completion
milestone: v2.2
roadmap: warp-integration
created: 2026-04-29
operator: user
status: in-progress
deviation_from_standard: code+docs (workflow YAMLs + lint tool + docs index); FULL tier ATC; READ-ONLY invariant on lint tool
unblocked: dispatched per Rule 15 ("continue with non-blocked work where possible") despite roadmap "partially blocked on M1" label -- workflow YAMLs ship correctly regardless of UI search-time validation; M1 confirms post-ship
---

# Phase 64 -- Workflow Pack Completion (CONTEXT)

## Goal

Make every common SGSD command searchable and runnable through Warp
workflows. Add the 8 missing workflows the roadmap enumerates, fix the
sgsd-token-current.yaml `arguments:`-block defect Phase 63 found, and
ship a dedicated structural lint tool + operator-facing docs index.

## Locked Scope (D64.1-D64.5)

- **D64.1**: Add 8 new workflows per roadmap: Status, Recovery Packet,
  Gate Status, Watchdog Status, Codex Status, Current Phase Artifacts,
  Warp Doctor, Remote Monitor Packet. All follow the shape established
  by the original 5 (name + description + command + tags + arguments
  with `project_dir` default).
- **D64.2**: Fix `sgsd-token-current.yaml` -- add `arguments:` block
  matching the other 4 originals; tighten command to `cd "{{project_dir}}"; node ...`
  so the workflow runs correctly regardless of Warp's launch cwd.
- **D64.3**: Ship dedicated lint tool at
  `super-gsd/tools/warp-workflow-lint/lint.cjs` with its own self-test.
  Lint = structural shape (5 required keys) + collective search-term
  coverage (10 terms). Complements warp-doctor probe 6 (existence) with
  deeper validation.
- **D64.4**: Author `super-gsd/docs/SGSD-WARP-WORKFLOWS.md` as the
  operator-facing docs index: 13-row workflow table + daily/triage/off-machine
  routines + add-a-new-workflow recipe + constraints.
- **D64.5**: All workflow descriptions include search-term keywords so
  Warp Command Search surfaces by intent, not by exact name.

## Inputs Consumed

- `.planning/milestones/warp-integration/ROADMAP.md` Phase 64 task list
- `.planning/milestones/v2.2/phases/63-warp-capability-smoke/63-RESEARCH.md`
  Section D (workflow YAML lint findings)
- Existing `.warp/workflows/*.yaml` (5 originals as shape source)
- `super-gsd/tools/warp-doctor/check.cjs` (Phase 67 -- consumed by the
  new SGSD: Warp Doctor workflow)
- `super-gsd/scripts/sgsd-mission-control.ps1` (referenced for
  cockpit/dashboard pane awareness; not modified)

## Outputs

Workflows -- `.warp/workflows/`:
- `sgsd-token-current.yaml` (UPDATED -- arguments block + cd prefix)
- `sgsd-status.yaml` (NEW)
- `sgsd-recovery-packet.yaml` (NEW)
- `sgsd-gate-status.yaml` (NEW)
- `sgsd-watchdog-status.yaml` (NEW)
- `sgsd-codex-status.yaml` (NEW)
- `sgsd-current-phase-artifacts.yaml` (NEW)
- `sgsd-warp-doctor.yaml` (NEW)
- `sgsd-remote-monitor-packet.yaml` (NEW)

Tools + docs:
- `super-gsd/tools/warp-workflow-lint/lint.cjs` (NEW)
- `super-gsd/docs/SGSD-WARP-WORKFLOWS.md` (NEW)

Phase artifacts:
- 64-CONTEXT.md (this file)
- 64-01-...-PLAN.md
- 64-RESEARCH.md
- 64-VERIFICATION.md
- 64-ATC-REVIEW.md

## Acceptance

1. 13 workflow YAMLs in `.warp/workflows/` (5 originals + 8 new).
2. `node super-gsd/tools/warp-workflow-lint/lint.cjs --project ...`
   reports 13/13 valid + 10/10 search terms covered + exit 0.
3. `node super-gsd/tools/warp-workflow-lint/lint.cjs --self-test`
   reports 7/7 PASS + exit 0.
4. `sgsd-token-current.yaml` has `arguments:` block with `project_dir`
   default (Phase 63 finding D.2 fix).
5. `SGSD-WARP-WORKFLOWS.md` lists all 13 workflows + 3 operator
   routines + add-a-new recipe + constraints.
6. All 10 required search terms (start, auto, cockpit, token, recovery,
   gates, watchdog, codex, blocked, status) present across the
   workflow descriptions.

## Hard Boundaries

- Operator brief Rule 2: Don't duplicate features. The new workflows
  call STABLE SGSD commands (`sg`, `sgsd`, `node super-gsd/tools/...`).
  No ad-hoc logic that drifts from the canonical surfaces.
- AGENTS.md Hard Rule 5: No source mutations outside an active plan.
  Phase 64 IS the active plan; touches `.warp/workflows/` +
  `super-gsd/tools/warp-workflow-lint/` + `super-gsd/docs/` + own
  Phase 64 artifacts. Lock-4 invariant: existing `super-gsd/scripts/*`
  + Phase 41-67 trees byte-untouched.
- READ-ONLY invariant on the lint tool: same as Phase 67 doctor (zero
  fs-write tokens; selfTest A6 enforces).

## Out Of Scope

- PowerShell function aliases for the new workflows (deferred to
  follow-up; the YAMLs alone are sufficient for Warp Command Search).
- Authoring `.warpindexingignore` (Phase 65 follow-up / new
  ignore-pack phase).
- Building MCP server (v2.3).

## Decisions Locked At Phase Open

- D64.6: Phase 64 was originally tagged "partially blocked on M1"
  (Warp Command Search discoverability). Per operator Rule 15
  ("continue with non-blocked work where possible") and the realisation
  that workflow YAMLs ship correctly regardless of M1's UI verification
  -- M1 validates post-ship, not pre-ship -- Phase 64 was dispatched
  in this auto-run.
- D64.7: Implementation strategy = orchestrator-authored at Opus.
  Cumulative deviation count this auto-run: 3 (Phase 65 + 67 + 64).
  Per 67-CONTEXT.md D67.9, this triggers operator review at next
  session start. Logged honestly in 64-VERIFICATION.md DEVIATIONS.
  Justification: workflow YAMLs are formulaic (8 files following a
  pattern); pattern source already loaded; dispatching executor would
  cost ~15k tokens of redundant re-reading. Same trade-off as Phase 65
  + 67. Operator review: when M1-M5 is done, rebalance auto-mode
  preferences (orchestrator-author vs sub-agent-dispatch) for Phase 68+.
