---
phase: 60
name: Example Project + Demo
milestone: v2.1
type: research
researched_at: 2026-04-29
researcher: gsd-executor (compressed-phase dispatch)
---

# Phase 60 Research - Example Project + Demo

## Goal

Ship a runnable `examples/hello-world/` fixture and an end-to-end
walkthrough doc so that the Phase 59 wizard has a deterministic
target operators can `cd` into, execute, and verify.

## Locked Decision: 60=B

Runnable scaffold (PROJECT.md, ROADMAP.md, .planning/STATE.md
skeleton) plus a step-by-step walkthrough doc plus a third-gate
self-test exercising the wizard --defaults against the fixture
with a canonical sha256 check.

## Prior Art Surveyed

### Phase 59 wizard (target of this fixture)

`super-gsd/scripts/sgsd-new-project-wizard.cjs` ships 5 Lock-13-
wrapped public APIs and the `runWizard` function reads
`.planning/` directory existence as its only filesystem
precondition. The fixture's `.planning/STATE.md` skeleton is
sufficient to pass that check; we do not need a real config or
a real STATE - only the directory must exist.

The wizard's canonical project-block-only output has sha256
`fe16729aff1c12a04eaf10724da297370f6c8f2d16ffab04a6ea381907550be7`.
This hash is the gate-anchor for the Phase 60 third-gate: any
drift on the wizard's `_buildProjectAdditions()` shape (panel
list reorder, schema_version bump, operator_preferences key
rename) will change the hash and red-fail the gate, which is
the desired observability.

### Phase 58 installer-audit (Lock 4 anchor for sgsd-complete-milestone)

`super-gsd/tools/installer-audit/audit.cjs` and the v2.1
first-gate insertion in `sgsd-complete-milestone.cjs:165-247`
are the exact pattern Phase 60 mirrors: insert a try/catch
block inside the `milestone === 'v2.1'` branch, between the
prior gate's green emission and the original `process.exit(0)`.
Bytes 1-312 (up through the second-gate green emission) remain
preserved.

### sgsd-complete-milestone v1.9 + v2.0 (Lock 4 anchor)

The v1.9 dual-gate (lines ~498-688) and v2.0 sept-gate
(lines ~498-880) paths are byte-equality preserved by Phase 60.
The third-gate insertion is strictly additive inside the
`milestone === 'v2.1'` branch and never touches the shared
v1.9/v2.0 preamble.

## Architecture

```
examples/hello-world/                    (NEW fixture)
  PROJECT.md                              1-page demo description
  ROADMAP.md                              minimal 2-phase example
  .planning/STATE.md                      skeleton STATE
  .planning/config.json                   produced by wizard --defaults

super-gsd/docs/EXAMPLE-DEMO-WALKTHROUGH.md  (NEW operator doc)
  Steps 0-10: list / first run / verify / re-run / sha256 /
              dry-run / self-test / orchestrate-degraded /
              cleanup / milestone-close

super-gsd/scripts/sgsd-complete-milestone.cjs  (SURGICAL extension)
  v2.1 third-gate insertion at line 313 (between Phase 59
  second-gate green emission and the original process.exit(0));
  ~165 lines added; 0 deletions; bytes 1-312 byte-untouched
  byte-equality preserved against the Phase 59 baseline.
```

## Idempotency + Observation-Only Strategy

The third-gate is observation-only: it captures the prior
state of `examples/hello-world/.planning/config.json`, runs
the wizard `--defaults`, verifies the produced sha256 matches
canonical, and then restores the prior bytes (or removes the
gate-produced file if there was no prior config). This means:

1. Repeated invocations of `--milestone v2.1` are deterministic
   (same observable output every run).
2. The fixture's mtime is not bumped by the gate, so roadmap-
   staleness scans do not see the fixture as "recently
   modified" after each milestone close.
3. If a prior config is present (e.g., operator ran the
   walkthrough manually before invoking the gate), it is
   restored byte-for-byte.

## Lock 13 / walkthrough-degrades-gracefully

If `examples/hello-world/.planning/` is absent on disk
(partial checkout, sparse clone, manual delete), the gate
emits a SKIPPED sentinel and exits 0. Rationale: the absence
of the fixture is a checkout-shape problem, not a milestone-
close problem; the gate exists to catch regressions in the
wizard's output, and if the fixture is missing there is no
wizard regression to catch.

The skipped path is observable in stdout:

```
milestone_close_gate: v2.1 example-walkthrough self-test SKIPPED
  (fixture missing: examples/hello-world/.planning not present;
   partial checkout suspected; degrading to second-gate only
   per Lock 13)
milestone_close_gate: v2.1 third-gate (example-walkthrough)
  green-with-skip
```

Operators who want to enforce the third-gate strictly can
simply ensure the fixture is present in their checkout (it
ships as part of the repo).

## Walkthrough doc design

Steps 0-10 cover:

- **Step 0**: Verify the fixture exists (`ls -A`).
- **Step 1**: Confirm config does not yet exist.
- **Step 2**: First run - wizard writes config (`written=true`).
- **Step 3**: Inspect config - matches canonical shape.
- **Step 4**: Re-run - idempotent (`written=false`,
  `idempotent_skip=true`).
- **Step 5**: sha256 hash matches canonical fingerprint.
- **Step 6**: Dry-run preview without writing.
- **Step 7**: Wizard `--self-test` (13/13 PASS).
- **Step 8**: Orchestrate session walkthrough (degraded path).
- **Step 9**: Cleanup (optional - delete config to reset).
- **Step 10**: Milestone close exercises the same fixture.

Each step lists the exact command, expected output (with
clearly marked OS-dependent prefixes), and expected exit code.
Every command was tested end-to-end on 2026-04-29; raw stdout
captures live in 60-VERIFICATION.md.

## Files touched

| File                                                   | Lines | Direction |
| ------------------------------------------------------ | ----- | --------- |
| examples/hello-world/PROJECT.md                        | 78    | NEW       |
| examples/hello-world/ROADMAP.md                        | 60    | NEW       |
| examples/hello-world/.planning/STATE.md                | 33    | NEW       |
| super-gsd/docs/EXAMPLE-DEMO-WALKTHROUGH.md             | 250   | NEW       |
| super-gsd/scripts/sgsd-complete-milestone.cjs (delta)  | +180  | SURGICAL  |
| .planning/milestones/v2.1/phases/60-*/                 | -     | NEW       |
