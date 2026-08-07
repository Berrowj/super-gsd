# Combined Spec (9.4) + ATC (9.5) — P147 T147-01 convention evaluator + fixture runner

You MUST read the two files below (reading is required — use whatever read
command your environment provides). Do NOT run self-tests, node, bash, or git.
Do NOT read any other file. Emit the 5 contract lines FIRST, then
FINDINGS_DETAIL, then stop.

## Files
- super-gsd/scripts/lib/sgsd-artifact-conventions.cjs (created)
- super-gsd/tests/commit-gate/assert-real-commit-gate.cjs (created)

## PART A — spec compliance
output_contract: convention discovery/evaluation + real temp-git fixture
runner. GSDedits = findPlanLockedFiles (milestone-scoped) + active-phase
`*-ATC-REVIEW*.md`. Other repos runtime-discovered; unprovable →
`convention_unknown`. Source-touching predicate + PER-PATH evaluation records.
falsifier — FAILS if: bare PLAN.md/AUDIT.md satisfies evidence; devcp naming
hardcoded; docs-only commits warn; runtime/config source paths fail to warn.
Required API: discoverConvention(root), evaluatePaths(root, stagedPaths,
state), isSourceTouching(path) — all never-throw.

## PART B — ATC through P146's two shipped defect classes
1. Silent success (7 P146 instances): can "could not determine" ever read as
   "all clear"? Is convention_unknown carried through evaluatePaths, or can an
   unknown-convention repo yield paths marked "backed"/"not_source" that a
   caller would treat as clean? Is every degraded state reason-coded?
2. Writer destination (5 P146 instances): does the fixture runner create/clean
   temp repos safely — bounded to os.tmpdir, no caller-supplied destinations,
   cleanup that cannot escape (e.g. rmSync on a path it derived itself)?
3. Predicate correctness: case-sensitivity on Windows, `../` traversal in
   staged paths, rename records (R100 old→new: which path is evaluated?),
   deleted files (D status — can a deletion of a backed file warn correctly?).
4. Fixture realism: does the runner drive REAL git (init/add) and read REAL
   staged state, or does it shortcut through the filesystem in a way that a
   later task's "real hook through real git" AC could inherit as a stub?
5. Anti-slop: unused exports, speculative options, duplication with
   sgsd-state.cjs helpers.

## Verified by the orchestrator (do NOT re-run)
All 6 real-git scenarios PASS host-side (sandbox blocked git spawn — EPERM —
so the executor could not run them; the orchestrator did). 13 adversarial
probes PASS: predicate positives/negatives incl. super-gsd docs counting as
source per plan; backslash-separator paths do not bypass in either direction;
never-throws on garbage; non-SGSD dir → not-gsdedits with reason_code;
evaluatePaths returns per-path records with evidence_status.

## Report contract (exact — 5 lines FIRST)
FINDINGS: <int>
CRITICAL: <int>
WARNINGS: <int>
PASS_RATE: <n>/<m>
ONE_LINER: <SPEC_VERDICT pass|fix_required|blocked + ATC summary>
FINDINGS_DETAIL: [severity] [dimension] <description>  (one per CRIT/WARN)
