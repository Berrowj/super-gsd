---
phase: 170
plan: "170-07"
status: ACTIVE
authorized_by: operator
authorized_at: 2026-09-09
scope: DEVCP_LINUX_ACCEPTANCE_REPAIR_AND_OPERATIONAL_COVERAGE_AUDIT
formal_phase_close: NOT_CLAIMED
windows: OPEN_REQUIRED
---

# Trial readiness: bounded receiver repair, isolated diagnostics, coverage evidence

The operator approved fixing both defects from the immutable B1-blocked
benchmark, publishing through the existing guarded Linux update, and one fresh
acceptance run. The same request requires evidence that SGSD operations,
including gates, MUDA and ATC, support a trustworthy weekly economics trial.
The original approved hybrid Atlas design already specifies these semantics;
P171 correlation and P172 reporting are still pending, not implicitly completed.

Use subagent-driven-development for the bounded source repair: implementation,
independent specification review, then quality review. Root owns planning,
coverage census, integration and deployment. Use the existing isolated release
worktree. Preserve user `.planning/tmp/` and every old benchmark and live pane.

## Task 1 — Restore the approved timeout and diagnostic-isolation contracts

Allowed source files: `super-gsd/tools/telemetry-atlas/global.cjs`, its
`global.test.cjs`, `lifecycle.cjs` only if the verified cause requires it,
`super-gsd/scripts/codex-exec.sh`, `codex-executor.sh` only if its self-test shares
the leak, `super-gsd/tests/codex-worker/launch.test.cjs`, and the Atlas README.
Refresh an existing mechanically generated hook witness only if the dependency
closure actually changes. No other source changes without a plan amendment.

- [x] Reproduce and instrument the actual deadline defect in an isolated Linux
  fixture. Original failure: the 20 ms transition with a 35 ms prepared observer
  returned after the existing 1000 ms assertion. Whole-test duration is not the
  restart duration. Test synchronous work beyond deadline, identity revalidation,
  foreign port takeover, pending-journal recovery and explicit retry.
- [x] Add regression tests that fail on the current source. Keep the existing
  return bound; do not loosen assertions or bypass process/socket ownership.
  Stop doing work after deadline, including before any signal/spawn. Preserve
  durable journal, same-port transition, exact identity, compiled dependency
  coherence, graceful shutdown and no foreign process termination.
- [x] Reproduce offline fake-peer self-tests leaking registrations under an
  enabled parent Atlas root. Isolate the diagnostic boundary so all child
  wrappers and the top-level offline summary cannot write production Atlas or
  project metrics. Test a populated parent root and metrics file unchanged,
  absent default root not created, no real model/auth/network calls, unchanged
  exit/report contracts, and ordinary enabled production capture still working.
  Do not delete or rewrite any existing diagnostic evidence.
- [x] Run RED/GREEN focused tests on native Linux, full Atlas and worker suites,
  board/routing regressions, syntax and diff checks. Record counts and skips.
  Seven existing propagation snapshot-helper digest failures remain visible;
  no changes to those guards or formal gate results.
- [ ] Independent specification review, then quality review. Resolve Critical
  and Important findings. Freeze and commit only reviewed task-owned files.

## Task 2 — Evidence-backed SGSD operational coverage census

Documentation-only output under `.planning/analyses/`. Inspect existing gate
registry, harness component catalogue, hooks, dispatch paths, evidence writers,
Atlas intake/schema/audit and the approved design. Do not execute production
gates or mutate their decisions just to create telemetry.

- [x] Map actual registered components and invocation boundaries to existing
  source evidence and canonical Atlas intake. Cover orchestration, research,
  planning, execution, board, spec/ATC/verifier/MUDA and release/edge gates,
  state/checkpoint, tools, context/VTP and observer/runtime operations.
- [x] Record observed / source-ledger-only / missing instrumentation / unknown
  separately. Never call an empty denominator PASS or assign provider usage to
  a gate based only on nearby timestamps. Preserve unknown tokens, quotas and
  model identity. Distinguish disabled, not eligible, skipped and missing.
- [x] Record fixture contamination exclusions without altering canonical
  evidence. Inventory defaults/global delivery and local-shadow/fleet limits.
- [x] Present the smallest implementation sequence needed to complete the
  already-approved correlation/reporting design. Any new substantive design
  choice or activation of P171/P172 must be explicit; no silent phase close.

Task 2 evidence: `.planning/analyses/2026-09-09-atlas-operational-coverage-census.md`
and `2026-09-09-devcp-atlas-live-coverage-observation.md`. Result PARTIAL:
13 registered gates (8 empty emitted-path declarations), 35 catalog components,
additional runtime gates outside the registry, no SGSD semantic ledger adapter.
Live Clarity global events have no phase/plan/task/gate attribution. Existing
source evidence includes malformed legacy rows. Weekly baseline NOT_ESTABLISHED.

## Task 3 — Reviewed publication and guarded Linux update

- [ ] Recheck origin identity, captured upstream revision, worktree and exact
  candidate hashes. Preserve unrelated edits, auth, model defaults, other pins,
  all twelve existing panes and previous Fable processes. No CLI install/remove.
- [ ] Publish reviewed commits to origin/master without force. Use the normal
  trusted updater from Clarity, proving source/install hashes, loaded receiver
  fingerprint and unchanged endpoints before success. Preserve prior evidence.
- [ ] Do not claim all DEVCP worktrees current from a per-user global install.

## Task 4 — One fresh Fable acceptance benchmark

- [ ] New immutable evidence directory and new launcher session; never reset an
  existing session. B0 uses explicit read-only commands: no bare global.cjs
  default-prepare call and no unplanned wrapper diagnostics.
- [ ] B1 runs the existing four offline suites; optional native initialize only
  remains distinct from a model turn. If B0/B1 fails, stop live steps and report
  exact evidence; no repeated acceptance runs to obtain green.
- [ ] If prerequisites pass, follow the existing B2–B7 specification with at
  most five live worker attempts, 180 seconds each, twenty minutes live total.
  Prove actual two-way Fable supervision and native accounting, not dry-run model
  labels. Preserve real outcomes and coverage WARNs; no auto-answerer.
- [ ] Verify manifest and protected-state snapshots independently; update this
  plan and STATE with observed results, remaining coverage work and Windows open.

## Completion boundary

Acceptance of the bridge does not certify the weekly trial. A complete trial
requires the operation/correlation/reporting coverage specified in the original
design, real denominators, and a frozen calibrated collection window. No savings
or gate-removal recommendation follows from synthetic fixtures or partial data.
