# P146 PHASE-ATC RE-REVIEW — confirm the structural fix, or say it is still patching

You MUST read the files listed (reading is required — use whatever read command
your environment provides). Do NOT run self-tests, benchmarks, node, or bash —
all suites pass on the host and sandbox runs produce false failures (adapter
A7/A10 fail in-sandbox, pass 19/19 on host; Git Bash dies with
CreateFileMapping). Emit the 5 contract lines FIRST, then FINDINGS_DETAIL, then stop.

## Files
- super-gsd/scripts/lib/sgsd-state.cjs           (NEW `resolveContainedPath` + `_realpath`)
- super-gsd/scripts/lib/gate-evidence-log.cjs    (destination via shared helper; skip accounting)
- super-gsd/hooks/sgsd-intent-classifier.cjs     (route-shape validation)
- super-gsd/hooks/sgsd-quality-gate.js           (milestone-scoped plan lookup)
- super-gsd/tools/cockpit-state/adapter.cjs      (skipped-line degraded signal)

## Your prior verdict was: "the hooks work as PATCHES, but root/write
validation and registry/ledger degradation are not STRUCTURALLY solved."
That is the claim to re-test. For EACH prior finding, state CLOSED or OPEN with
line evidence:

CRIT-1 root/write containment not one contract (`findSgsdRoot` used bare
  `statSync`; `logGateEvidence` derived its path with no realpath/symlink
  containment; intent + quality called the weaker resolver).
CRIT-3 corrupt-but-parseable registry at ROUTE level (parser accepted any `id`;
  malformed trigger/enforcement silently coerced to empty/skipped; only
  zero-route-COUNT degraded).
WARN-1 ledger silently dropped malformed JSONL lines; cockpit detected only the
  all-or-nothing case.
WARN-2 plan detection ignored milestone scope (`findPlanLockedFiles(root,
  state.phase)` searched all milestones).

CRIT-2 (MultiEdit) was REJECTED by the orchestrator with evidence: no
`MultiEdit` exists in this harness (the orchestrator session's own tool set is
Edit/Write/NotebookEdit; research Q1 documents Claude Code 2.1.222 PostToolUse
payloads without it; the only repo references are historical file snapshots
under `~/.claude/file-history/`), and the locked plan names including it as an
explicit FALSIFIER. Do NOT re-raise it. If you believe the rejection is wrong,
you must cite live harness evidence, not inference.

## The question that decides the verdict
Is containment now STRUCTURAL — i.e. is there exactly ONE path by which any
writer in this phase can obtain a destination, and is it impossible to bypass —
or is `resolveContainedPath` simply a sixth patch that callers may still skip?
Name any writer that does not route through it.

## Also check for regressions introduced by this fix
- Does `resolveContainedPath` reject legitimate repos in any realistic case
  (Windows 8.3 short names, UNC paths, drive-relative paths, a `.planning` that
  is itself a junction to a legitimate location, case differences)?
- Does route-shape validation now reject routes that USED to work? The corpus
  still passes 13/13 + 11/11 on the host — but is any legitimate future route
  shape now impossible to express?
- Is the skipped-line signal distinguishable from a genuinely empty ledger?
- Did milestone scoping break the flat `.planning/phases/` layout, or T146-06's
  retraction behavior?

## Verified by the orchestrator (do NOT re-run)
18/18 structural checks: real NTFS junction on `.planning/metrics` refused with
ZERO files at the escape destination and no stack; registry with present-but-
invalid routes emits a degraded row; ledger with corrupt lines surfaces as
degraded rather than clean; a stale same-numbered PLAN-LOCKED in a NON-active
milestone no longer suppresses missing_plan while a plan in the ACTIVE
milestone still does; recall 13/13 and precision 11/11; both hooks silent with
zero writes outside an SGSD repo; bench p95<1000 at 200 iterations; adapter
still surfaces a real row; no MultiEdit anywhere; adapter `--self-test` 19/19;
the shared registry file is unmodified.

## Report contract (exact — 5 lines FIRST)
FINDINGS: <int>
CRITICAL: <int>
WARNINGS: <int>
PASS_RATE: <n>/<m>
ONE_LINER: <summary>
FINDINGS_DETAIL: [severity] [dimension] <description>  (one per CRIT/WARN)
