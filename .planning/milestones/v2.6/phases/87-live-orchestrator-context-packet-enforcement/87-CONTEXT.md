---
phase: 87
phase_name: Live Orchestrator Context-Packet Enforcement
milestone: v2.6
created: 2026-04-29
status: queued (auto-authored at Phase 86 close per operator override 2026-04-29T21:35Z; awaits dispatch)
created_by: phase 86 auto-creation gate (Operator Override Item 4)
deviation_from_standard: re-scoped from "Watchdog And Attention Alerts" — operator override demands live wire-in BEFORE attention vocab work
---

# Phase 87 -- Live Orchestrator Context-Packet Enforcement (CONTEXT)

## Background (operator override 2026-04-29T21:35Z)

Phase 86 shipped detection / warnings / stale-state probes — but
**deferred** the actual wire-in of:
- token-waste/check (Phase 42 product)
- context-packet/build (Phase 45 product)

into the LIVE orchestrator dispatch path.

Operator override: this is the core failure. Token-control tooling
existed but was NOT active in the live orchestrator path. Phase 86's
observability is necessary but insufficient. Phase 87 ships the
runtime boundary.

## Locked Scope (D87.0-D87.6)

**Mandatory deliverables**:

- **D87.0**: Add a dynamic effective-state resolver before any more
  live dispatch work. This prevents stale Markdown projections from
  poisoning cockpit/MCP/recovery again.

  Proposed path: `super-gsd/tools/state-resolver/resolve.cjs`.

  Inputs, in priority order:
  1. `.planning/ORCHESTRATOR-CHECKPOINT.md` when present and active.
  2. Latest `.planning/metrics/orchestrator-pulse.jsonl` row.
  3. Latest `.planning/metrics/activity-log.jsonl` phase/artifact paths.
  4. Newest phase folders and standard artifacts under
     `.planning/milestones/*/phases/`.
  5. `git log --oneline` phase-close commits.
  6. Top-level `STATE.md` fields.
  7. Nested `STATE.md roadmap_run` fields as legacy projection only.

  Output shape:
  ```json
  {
    "milestone": "v2.6",
    "phase": "87",
    "phase_name": "Live Orchestrator Context-Packet Enforcement",
    "phase_status": "queued|in-progress|complete|paused",
    "confidence": "high|medium|low",
    "source": "orchestrator-pulse|phase-folder|state-top-level|state-roadmap-run",
    "conflicts": [],
    "stale_sources": [],
    "recommended_repair": null
  }
  ```

  Rule: cockpit, MCP status tools, recovery packet, and future dashboards
  read effective state, not raw `STATE.md roadmap_run`. `STATE.md` is a
  human-readable projection and durable notes file, not the sole truth.

- **D87.1**: Wire `super-gsd/tools/token-waste/check.cjs` (Phase 42)
  into the orchestrator dispatch loop. Concretely:
  - Add a hook point at `sgsd-orchestrate/SKILL.md` Step 11 (UPDATE
    STATE) that invokes `node ... token-waste/check.cjs --milestone <ms>`
    after each commit.
  - On verdict `block` or `warn`, emit ORCHESTRATOR-LIVE.jsonl
    `token_threshold_crossed` event (Phase 74 contract).
  - On `block`, write a checkpoint and stop (per CLAUDE.md exit condition 2 — hard blocker).

- **D87.2**: Wire `super-gsd/tools/context-packet/build.cjs` (Phase 45)
  into the orchestrator dispatch path. Concretely:
  - Add a hook point at `sgsd-orchestrate/SKILL.md` Step 6 (DETERMINE
    DISPATCH) BEFORE composing sub-agent prompts.
  - For each sub-agent dispatch, build a context packet using the
    existing Phase 45 builder.
  - Append to `.planning/metrics/context-packet-log.jsonl` per builder's
    contract.
  - Verify `context_packet_builder_freshness` warp-doctor probe
    (Phase 86 D86.2) returns PASS after a single live dispatch.

- **D87.3**: New milestone-close enforcement. Update
  `super-gsd/scripts/sgsd-complete-milestone.cjs` to add a v2.6 gate:
  - At v2.6 close, run warp-doctor live and assert
    `context_packet_builder_freshness` is PASS.
  - At v2.6 close, scan crit-backlog.jsonl for open rows with
    `kind:v2_6_debt` AND summary matching `context_packet_builder_dormant`
    OR `context_bench_full_mode_unproven`. If any found:
    - Refuse `SHIPPED` clean.
    - Emit `SHIPPED-WITH-CRIT-DEBT` status with explicit row enumeration.
    - Exit non-zero (operator must reconcile or accept-with-debt).
  - Phase 86 added the rows; Phase 87 ships the enforcement.

- **D87.4**: Re-run v1.9 context-bench in real/full mode if Claude CLI
  available. If unavailable, mark `context_bench_full_mode_unproven`
  resolution as `accepted-environmental` in CRIT-BACKLOG.

- **D87.5**: Self-test for new enforcement: synthetic scenario where
  context_packet_builder_dormant row exists; verify
  sgsd-complete-milestone.cjs --milestone v2.6 exits non-zero with
  SHIPPED-WITH-CRIT-DEBT status.

- **D87.6**: Projection repair, not projection trust. Add either:
  - a read-only `state-resolver --json` CLI used by MCP/cockpit/recovery, and
  - an optional `sgsd-state-sync` projection writer that updates
    `STATE.md roadmap_run` atomically from effective state after phase close.

  The writer must never be required for correctness. If it fails, readers
  still use effective state and surface `projection_stale:true`.

## Inputs

- Phase 42 token-waste/check.cjs (the wire-in target)
- Phase 45 context-packet/build.cjs (the wire-in target)
- super-gsd/tools/state-resolver/resolve.cjs (new effective-state resolver)
- super-gsd/skills/sgsd-orchestrate/SKILL.md (the orchestrator skill — wire-in points)
- super-gsd/scripts/sgsd-complete-milestone.cjs (gate enforcement target)
- Phase 74 ORCHESTRATOR-LIVE.jsonl writer (event emit target)

## Outputs

- super-gsd/tools/state-resolver/resolve.cjs (NEW -- effective state resolver)
- super-gsd/tools/warp-mcp/server.cjs (UPDATED -- current_state/current_phase/recovery use effective state)
- super-gsd/tools/cockpit-state/adapter.cjs (UPDATED -- objective/artifacts use effective state)
- optional super-gsd/scripts/sgsd-state-sync.cjs (projection writer, if needed)

- super-gsd/skills/sgsd-orchestrate/SKILL.md (UPDATED — token-waste check hook + context-packet build hook)
- super-gsd/scripts/sgsd-complete-milestone.cjs (UPDATED — v2.6 enforcement gate)
- super-gsd/tools/context-packet/build.cjs (POSSIBLY UPDATED — wire-in helper if needed)
- 5 Phase 87 standard artifacts

## Acceptance

1. `state-resolver/resolve.cjs --json` returns v2.6 / Phase 87 on this
   live repo even while `STATE.md roadmap_run` still says v2.2 complete.
2. MCP `sgsd_current_phase` returns the effective v2.6 / Phase 87 state,
   and includes stale/conflict metadata when `STATE.md roadmap_run` drifts.
3. Cockpit snapshot objective/artifacts use effective state; stale
   `STATE.md roadmap_run` cannot force "roadmap complete" while live
   pulse/phase artifacts show active work.
4. token-waste/check.cjs is invoked from at least one real dispatch
   point in sgsd-orchestrate (verifiable via grep + activity log).
5. context-packet/build.cjs is invoked from at least one real dispatch
   point (verifiable: context-packet-log.jsonl mtime updates after a
   live `/sgsd-orchestrate go` run).
6. warp-doctor probe `context_packet_builder_freshness` returns PASS
   after at least one such live dispatch.
7. sgsd-complete-milestone.cjs --milestone v2.6 refuses clean SHIPPED
   while crit-backlog has open `v2_6_debt` rows matching the 2 patterns.
8. CONTEXT-BENCH-RESULTS.md status flipped to either `proven` (after
   full-mode rerun) OR `accepted-environmental` (if Claude CLI absent).

## Hard rule (operator override)

DO NOT close v2.6 milestone until D87.0-D87.6 ship. Do NOT advance to
ordinary v2.6 Phase 88 (End-To-End Warp Operator Drill) before Phase 87.
Phase 88 may run AFTER Phase 87 closes; Phase 88 is acceptance testing
that REQUIRES Phase 87's enforcement to be live.

## Why this auto-created (operator override item 4)

> "If context-packet/build is not wired into live dispatch by Phase 86,
> Phase 86 must auto-create and commit Phase 87 CONTEXT+PLAN
> specifically for 'Live Orchestrator Context-Packet Enforcement'."

Phase 86 deferred the wire-in. Per operator override, Phase 87 docs
are auto-authored at Phase 86 close so the work is queued and visible.
Phase 87 dispatch awaits operator confirmation OR auto-mode resumption.
