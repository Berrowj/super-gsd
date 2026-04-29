---
schema_version: 2
phase: 60
plan: 1
type: execute
wave: 1
model: sonnet
expected_ATC_tier: FULL
depends_on: [59]
autonomous: true
prior_errors_lookup: true
skip_gates: []
lessons_path: null
files_modified:
  - examples/hello-world/PROJECT.md
  - examples/hello-world/ROADMAP.md
  - examples/hello-world/.planning/STATE.md
  - super-gsd/docs/EXAMPLE-DEMO-WALKTHROUGH.md
  - super-gsd/scripts/sgsd-complete-milestone.cjs
requirements:
  - DEMO-01
  - DEMO-02
  - DEMO-03
  - DEMO-04
  - V2-1-THIRD-GATE-01
tags:
  - example-project
  - walkthrough
  - third-gate-v2.1
  - phase-60
  - v2.1
tasks:
  - id: T1
    agent: gsd-executor
    model: sonnet
    files_touched:
      - examples/hello-world/PROJECT.md
      - examples/hello-world/ROADMAP.md
      - examples/hello-world/.planning/STATE.md
    input_contract: 60-CONTEXT.md goal + locked decision 60=B
    output_contract: examples/hello-world/ scaffolded with PROJECT.md (~80L), ROADMAP.md (~60L), .planning/STATE.md skeleton (~33L); all ASCII-only; .planning/ directory exists so wizard runWizard precondition is satisfied
    hypothesis: A minimal scaffold (3 files, 1 hidden subdirectory) is sufficient for the wizard to succeed against the fixture, because runWizard only checks .planning/ directory existence as a filesystem precondition.
    falsifier: If the wizard returns reason=planning_dir_missing OR reason=existing_not_object on the fixture's first --defaults run, the scaffold is insufficient.
    stop_rule: ls -A examples/hello-world shows .planning/, PROJECT.md, ROADMAP.md AND ls examples/hello-world/.planning/ shows STATE.md AND running --defaults exits 0 with written=true.
    verification_cmd: "ls -A examples/hello-world && ls examples/hello-world/.planning && node super-gsd/scripts/sgsd-new-project-wizard.cjs --defaults --project-dir examples/hello-world"
  - id: T2
    agent: gsd-executor
    model: sonnet
    files_touched:
      - super-gsd/docs/EXAMPLE-DEMO-WALKTHROUGH.md
    input_contract: 60-CONTEXT.md goal + scaffolded fixture from T1 + Phase 59 wizard CLI surface
    output_contract: super-gsd/docs/EXAMPLE-DEMO-WALKTHROUGH.md (~250L) with Steps 0-10 each listing exact command, expected stdout (OS-dependent prefixes marked), and expected exit code; ASCII-only
    hypothesis: An 11-step walkthrough covering verify/first-run/inspect/re-run/sha256/dry-run/self-test/orchestrate-degraded/cleanup/milestone-close is sufficient for an operator with no prior SGSD context to bootstrap a project end-to-end.
    falsifier: If any of the 11 documented commands fails to exit 0 OR if the documented expected output diverges from the actual output (modulo path-separator prefixes), the walkthrough is broken.
    stop_rule: Every documented command tested end-to-end on this machine, all exit 0, all expected outputs match actual to within OS-prefix tolerance.
    verification_cmd: "see 60-VERIFICATION.md raw captures"
  - id: T3
    agent: gsd-executor
    model: sonnet
    files_touched:
      - super-gsd/scripts/sgsd-complete-milestone.cjs
    input_contract: existing v2.1 second-gate from Phase 59-01 (sgsd-complete-milestone.cjs:299-313) + scaffolded fixture from T1
    output_contract: sgsd-complete-milestone.cjs extended with v2.1 THIRD-GATE (example-walkthrough self-test) inserted between the existing second-gate green message and the original process.exit(0); v1.9 dual-gate path + v2.0 sept-gate path + v2.1 first-gate + second-gate paths preserved byte-equality up to the insertion point
    hypothesis: A surgical insertion (additive only, ~165 lines, zero deletions) inside the existing milestone==='v2.1' block preserves all earlier gate invariants while making v2.1 close require ALL THREE gates to be green AND degrades gracefully (green-with-skip) when the fixture is absent.
    falsifier: If running --milestone v1.9 changes any observable output vs the Phase 59 baseline OR if --milestone v2.0 changes any observable output OR if --milestone v2.1 fails to exit 0 when the fixture exists and is canonical OR if --milestone v2.1 fails to exit 0 when the fixture is absent (Lock 13 graceful degrade), the contract is broken.
    stop_rule: node sgsd-complete-milestone.cjs --milestone v2.1 exits 0 with first-gate + second-gate + third-gate all green AND --milestone v1.9 + --milestone v2.0 still exit 0 (no regression) AND git diff --stat shows only insertions in the v2.1 block, zero deletions.
    verification_cmd: "node super-gsd/scripts/sgsd-complete-milestone.cjs --milestone v2.1"
gates:
  - lock_4_phase_41_59_byte_untouched: "git diff covers only Phase 60 surface + sgsd-complete-milestone.cjs surgical extension inside v2.1 block"
  - lock_11_observation_only_gate: "third-gate restores prior config bytes; no fixture mtime bump"
  - lock_13_walkthrough_degrades_gracefully: "fixture-missing path emits SKIPPED sentinel + exits 0"
  - ascii_only: "all 5 files first_nonascii_idx=-1 verified inline"
  - sha256_anchor_canonical: "fe16729a... matches Phase 59 verification"
  - no_regression_v1_9_v2_0: "both prior gates exit 0 unchanged"
verification:
  - cmd: "node super-gsd/scripts/sgsd-new-project-wizard.cjs --defaults --project-dir examples/hello-world"
    expected: "exit 0 + written=true on first run"
  - cmd: "node super-gsd/scripts/sgsd-new-project-wizard.cjs --defaults --project-dir examples/hello-world (re-run)"
    expected: "exit 0 + written=false + idempotent_skip=true"
  - cmd: "sha256sum examples/hello-world/.planning/config.json"
    expected: "fe16729aff1c12a04eaf10724da297370f6c8f2d16ffab04a6ea381907550be7"
  - cmd: "node super-gsd/scripts/sgsd-complete-milestone.cjs --milestone v1.9"
    expected: "exit 0 + 'v1.9 dual-gate ... green' (no regression)"
  - cmd: "node super-gsd/scripts/sgsd-complete-milestone.cjs --milestone v2.0"
    expected: "exit 0 + 'v2.0 sept-gate ... green' (no regression)"
  - cmd: "node super-gsd/scripts/sgsd-complete-milestone.cjs --milestone v2.1"
    expected: "exit 0 + first-gate + second-gate + third-gate all green"
acceptance:
  - "examples/hello-world/ scaffolded with 3 files (PROJECT.md, ROADMAP.md, .planning/STATE.md)"
  - "Wizard --defaults from examples/hello-world produces working config.json with sha256 fe16729a..."
  - "Walkthrough doc tested end-to-end (every command exits 0)"
  - "v2.1 third-gate green when fixture exists; green-with-skip when fixture absent (Lock 13)"
  - "Lock 4 (Phase 41-59) byte-untouched; v1.9/v2.0 no regression"
  - "ASCII-only across all 5 changed files"
---

# Phase 60-01 Example Project + Demo Plan

This plan scaffolds the `examples/hello-world/` reference fixture,
ships the operator-facing walkthrough doc, and wires the v2.1
third-gate (example-walkthrough self-test) into
`sgsd-complete-milestone.cjs`. The third-gate exercises the wizard
`--defaults` against the fixture, verifies the produced config.json
sha256 matches the canonical `fe16729a...` fingerprint, and
restores the fixture's prior bytes so the gate is observation-only.

The fixture, walkthrough, and gate are designed to compose: the
walkthrough doc is what an operator reads; the fixture is what the
walkthrough commands target; the gate is what CI runs to catch
regressions in either the wizard or the fixture shape.

## Lock invariants honored

- **Lock 4**: Phase 41-59 + sgsd-cockpit-shell.cjs byte-untouched.
  Only Phase 60 surface (3 fixture files + 1 doc + ~180 lines
  inserted into the existing v2.1 branch of
  sgsd-complete-milestone.cjs) is modified.
- **Lock 11**: third-gate is observation-only - the fixture's
  prior config bytes are captured before the wizard runs and
  restored after the gate is green; no mtime bump.
- **Lock 13**: walkthrough commands and the third-gate degrade
  gracefully when the fixture is absent (partial checkout); the
  gate emits a SKIPPED sentinel and exits 0 rather than blocking
  milestone close.
- **ASCII-only**: all 5 changed files have first_nonascii_idx=-1.
