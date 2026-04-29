---
phase: 60
name: Example Project + Demo
milestone: v2.1
type: waste-audit
audited_at: 2026-04-29
auditor: gsd-executor (compressed-phase dispatch)
verdict: GREEN
---

# Phase 60 MUDA Audit - Example Project + Demo

## Summary

**GREEN** - 0 overproduction probes triggered, 0 transport hops,
0 duplicated logic, 0 over-engineering. The fixture ships the
absolute minimum scaffold the wizard needs (3 files, 1 hidden
subdir) and the third-gate is a strict additive surgical
extension (~179 lines, 0 deletions) that re-uses the existing
spawnSync + try/catch pattern from Phase 58 and Phase 59 gates.

## 7 MUDA Categories

| Category        | Probe                                                | Result                                                |
| --------------- | ---------------------------------------------------- | ----------------------------------------------------- |
| Overproduction  | Did we ship features not in 60-CONTEXT.md?           | NONE - fixture + walkthrough + third-gate only        |
| Inventory       | Untested branches, dead code paths?                  | NONE - all third-gate branches reachable; fixture-missing path statically verified |
| Transport       | Cross-module require() of Phase 41-59?               | NONE - third-gate spawnSync's the wizard binary, never imports |
| Waiting         | Sync I/O blocking unrelated work?                    | NONE - third-gate fs.readFileSync only on tiny config.json (~330 bytes) |
| Motion          | Operator must run >2 commands to demo?               | NONE - cd + node = 2 commands total                   |
| Over-Processing | Schema validation when canonical-sha256 works?       | NONE - sha256 byte-equality is the canonical anchor   |
| Defects         | Self-test FAILs, non-deterministic asserts?          | NONE - all 11 walkthrough steps deterministic; v2.1 triple-gate exit 0 |

## Lines-of-code accounting

| File                                                | Lines | Justification                                    |
| --------------------------------------------------- | ----- | ------------------------------------------------ |
| examples/hello-world/PROJECT.md                     | 78    | 1-page demo description as specified by 60=B    |
| examples/hello-world/ROADMAP.md                     | 60    | Minimal 2-phase example roadmap as specified    |
| examples/hello-world/.planning/STATE.md             | 33    | Frontmatter + progress block skeleton only      |
| super-gsd/docs/EXAMPLE-DEMO-WALKTHROUGH.md          | 250   | 11 steps each with command + expected output + exit code (within 200-300L budget) |
| super-gsd/scripts/sgsd-complete-milestone.cjs delta | +179  | v2.1 third-gate try/catch + fixture-missing skip path + observation-only restore |
| 60-RESEARCH.md                                      | 130   | Locked decision narrative + prior art + architecture |
| 60-01-...-PLAN.md                                   | 110   | schema_v2 valid frontmatter + 3 tasks with hypothesis/falsifier/stop_rule |
| 60-VERIFICATION.md                                  | 220   | 11 must-haves + raw stdout captures from end-to-end run |
| WASTE.md                                            | 90    | This file                                       |
| commit-reviews.jsonl                                | 3-row | one row per atomic commit                       |

The third-gate at +179 lines includes ~30 lines of comment/
documentation, ~50 lines of fixture state capture + restore
(observation-only invariant), and ~99 lines of try/catch
fences for Lock 13 / never-throws-upward. No dead code; every
branch is reachable.

## Architectural waste avoided

- **Did NOT** ship the fictional `src/greet.js` and
  `bin/hello.js` files referenced in ROADMAP.md. They are
  illustrative only - their existence would create maintenance
  surface (test for greet returns the right string, test for
  CLI prints expected output) without adding value. The fixture
  exists to exercise the wizard, not to be a runnable Node
  service.
- **Did NOT** create a separate fixture-walkthrough harness
  module. The walkthrough's commands ARE the harness; reading
  them is the contract; running them is the test. A separate
  `walkthrough-harness.cjs` would duplicate the steps and
  introduce drift potential.
- **Did NOT** import the wizard module directly from the
  third-gate. spawnSync of the wizard binary is the same
  pattern Phase 58 (installer-audit) and Phase 59 (wizard
  self-test) already use; consistency over efficiency for an
  observability surface.
- **Did NOT** auto-generate the canonical sha256 by parsing the
  wizard's output. The sha256 is a hardcoded anchor
  (`fe16729a...`); if the wizard's output ever changes, the
  gate red-fails and the operator updates the anchor in a
  separate Phase. This is the desired observability.
- **Did NOT** mutate the fixture during gate runs. The third-
  gate captures the fixture's prior config bytes, runs the
  wizard, verifies the sha256, and then restores the prior
  bytes. This means roadmap-staleness scans see the fixture
  as untouched after each milestone close.

## Recurrence guards

- ASCII-only check on all 5 changed files catches future
  smart-quote drift in the doc or scaffold files.
- The `sha256 fe16729a...` anchor catches drift in the wizard's
  `_buildProjectAdditions()` shape. Any change to PANEL_KINDS,
  schema_version, default_boot_mode, or operator_preferences
  will change the hash and red-fail the gate.
- Observation-only restore catches the failure mode where a gate
  silently mutates fixture bytes between runs (would surface as
  spurious mtime bumps in roadmap-staleness scans).
- Lock 13 fixture-missing skip path catches partial-checkout
  scenarios without blocking milestone close. Operators on full
  checkouts always exercise the full triple-gate; operators on
  sparse clones get a degraded-OK signal.

## What we INTENTIONALLY did NOT add

- A `verify-fixture.cjs` standalone runner. The third-gate inside
  sgsd-complete-milestone.cjs is sufficient; a standalone runner
  would create a second invocation surface and risk drift.
- A `--regenerate-fixture` flag on the wizard. The fixture is
  produced by `--defaults` already; a separate regenerate flag
  would be a second code path to maintain.
- A snapshot test framework. The sha256 anchor IS the snapshot;
  no jest, no vitest, no mocha needed.
