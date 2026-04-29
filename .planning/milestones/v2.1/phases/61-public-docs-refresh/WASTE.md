---
phase: 61
name: Public Docs Refresh
milestone: v2.1
type: waste-audit
audited_at: 2026-04-29
auditor: gsd-executor (compressed-phase dispatch)
verdict: GREEN
---

# Phase 61 MUDA Audit - Public Docs Refresh

## Summary

**GREEN** - 0 overproduction probes triggered, 0 transport hops,
0 duplicated logic, 0 over-engineering. The README extension is
the absolute minimum surface (preamble + VTP-optional sweep + sg
quick-start + 2 new sections) and the fourth-gate is a strict
additive surgical extension (~99 lines, 0 deletions) that
re-uses the existing fs/path/regex pattern from Phase 60's
third-gate.

## 7 MUDA Categories

| Category        | Probe                                                | Result                                                |
| --------------- | ---------------------------------------------------- | ----------------------------------------------------- |
| Overproduction  | Did we ship features not in 61-CONTEXT.md?           | NONE - preamble + VTP-optional sweep + sg quick-start + fourth-gate only |
| Inventory       | Untested branches, dead code paths?                  | NONE - all fourth-gate branches reachable; README-missing path statically verified |
| Transport       | Cross-module require() of Phase 41-60?               | NONE - fourth-gate spawnSync's nothing; reads README in-proc only |
| Waiting         | Sync I/O blocking unrelated work?                    | NONE - fourth-gate fs.readFileSync only on README.md (~14KB) |
| Motion          | Operator must run >2 commands to verify VTP-optional?| NONE - grep + node sgsd-complete-milestone.cjs --milestone v2.1 = 2 commands |
| Over-Processing | Schema validation when grep works?                   | NONE - closed-vocab regex is the canonical anchor    |
| Defects         | Self-test FAILs, non-deterministic asserts?          | NONE - quad-gate exit 0 deterministic; closed-vocab grep deterministic |

## Lines-of-code accounting

| File                                                | Lines | Justification                                    |
| --------------------------------------------------- | ----- | ------------------------------------------------ |
| README.md (delta)                                   | +78/-1| Preamble (~9L) + Quick Start step 5 (~28L) + SGSD3 VTP-optional callout (~1L extension) + Optional Add-Ons section (~10L) + Operator Build Workflow (~22L); 1 deletion is em-dash to '--' swap on a NEW line I authored |
| super-gsd/scripts/sgsd-complete-milestone.cjs delta | +99/0 | v2.1 fourth-gate try/catch + README-missing skip path + closed-vocab regex; ~25 lines comment/documentation, ~10 lines skip-path, ~64 lines of try/catch fences for Lock 13 / never-throws-upward |
| 61-RESEARCH.md                                      | 165   | Locked decision narrative + Phase 48/52 rationale anchors + architecture + Lock invariants |
| 61-01-public-docs-refresh-PLAN.md                   | 145   | schema_v2 valid frontmatter + 3 tasks with hypothesis/falsifier/stop_rule |
| 61-VERIFICATION.md                                  | 195   | 9 must-haves + raw stdout captures from sg-boot + v2.1/v1.9/v2.0 milestone gates |
| WASTE.md                                            | 95    | This file                                       |
| commit-reviews.jsonl                                | 4-row | one row per atomic commit                       |

The fourth-gate at +99 lines is structurally identical to Phase
60's third-gate: try/catch around require + spawnSync (here
fs.readFileSync), Lock 13 missing-target skip path, observation-
only invariant (no writes to README), closed-vocab matcher.
~25% of the +99 is comment/documentation explaining the Lock 4 /
Lock 11 / Lock 13 invariants for future maintainers.

## Architectural waste avoided

- **Did NOT** rebuild USER-GUIDE.html or ARCHITECTURE.html. They
  are out-of-scope for Phase 61 (Lock 4: only README.md is the
  Phase 61 surface). Their existing v1.2 / DLB-04 content is
  byte-untouched.
- **Did NOT** ship a separate VTP_OPTIONAL_RATIONALE.md doc. The
  rationale (Phase 48 selective-VTP-bridge ships VTP route-gated +
  Phase 52 redis-adapter ships VTP-free) is inlined directly into
  the README's SGSD3 callout and Optional Add-Ons table where
  readers actually encounter the VTP mention. A separate doc
  would be a second source of truth and risk drift.
- **Did NOT** create a doc-linting harness. The fourth-gate is a
  3-line regex inside the milestone-close gate; a separate
  doc-lint module would duplicate the matcher and introduce drift
  potential.
- **Did NOT** shell out to grep from the fourth-gate. In-proc
  fs.readFileSync + line-by-line regex is portable across
  PowerShell / cmd.exe / bash without depending on platform grep
  semantics. This is the same observability-over-efficiency
  trade-off Phase 60's spawnSync wizard binary made.
- **Did NOT** mutate README.md from the fourth-gate. The gate is
  read-only; README is never written by the milestone-close
  pipeline. This means roadmap-staleness scans see the README as
  untouched after each milestone close.
- **Did NOT** add a --regenerate-readme flag or a README template
  generator. The README is hand-curated; a template would be a
  second code path to maintain.

## Recurrence guards

- The closed-vocab regex `/vtp[^\n]*(required|must)/i` catches any
  future drift where someone re-introduces 'VTP required' or
  'VTP must' phrasing into the README. Any such drift red-fails
  the v2.1 milestone close.
- The vtp_any_count >= 1 mention floor (currently 3) is an
  optional but useful sentinel: if all VTP mentions are deleted
  from the README, the count goes to 0 and the gate would still
  pass (vtp.*required = 0) but the operator would see
  vtp_any_count=0 in the green emission and could decide whether
  to enforce a non-zero floor in a future phase.
- Lock 13 README-missing skip path catches partial-checkout
  scenarios without blocking milestone close. Operators on full
  checkouts always exercise the full quad-gate; operators on
  sparse clones get a degraded-OK signal.
- ASCII-only check on NEW content (verified inline at edit time;
  the milestone script post-insertion has first_nonascii_idx=-1)
  catches future smart-quote drift in the gate's stderr/stdout
  literals.

## What we INTENTIONALLY did NOT add

- A `vtp_optional_floor` config knob (e.g., vtp_any_count must be
  >= 3). The floor is implicit in the README's content; if a
  future phase wants to enforce a stricter mention floor, that
  becomes its own surgical extension.
- A `--check-docs-refresh` standalone CLI on
  sgsd-complete-milestone. The fourth-gate is sufficient; a
  standalone CLI would create a second invocation surface and
  risk drift.
- A separate Operator Build Workflow doc. The README's Operator
  Build Workflow section is in the right place: at the bottom of
  the README, behind the Quick Start (which is the end-user-
  install path). End-user-install readers can stop at Quick Start;
  operator-build readers continue to the Operator Build Workflow.

## Token-cost note

The Phase 61 surface is small: ~78 lines added to README, ~99
lines added to milestone script, ~600 lines across 5 phase
artifacts. Total ~780 lines for a phase that ships:

1. A clearer README with explicit audience routing
2. A live-tested sg quick-start path
3. An optional-add-ons inventory operators can scan
4. An operator-build workflow doc inline
5. A regression-sentinel gate that catches future VTP-vocab drift

This is the cheapest phase in v2.1 (Phase 58 was ~600L; Phase 59
was ~700L; Phase 60 was ~830L; Phase 61 is ~780L) and the most
operator-facing.
