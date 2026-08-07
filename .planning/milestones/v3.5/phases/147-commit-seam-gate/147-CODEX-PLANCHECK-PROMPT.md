# P147 Plan-Check + Final ATC/MUDA Review (combined gate)

<intent milestone="v3.5">
Always-On Orchestration — governance as runtime mechanism in all session modes.
</intent>

BUDGET (hard): read ONLY the four files named below (reading is required — use
whatever read command your environment provides). Do NOT run any command,
self-test, or benchmark. Emit the 5 contract lines FIRST, then detail, then stop.

Three checks in one pass over the plan set:
(A) Plan-check — goal-backward: does executing this plan achieve AC-147
    (a) warn rows accumulate on real commits in both repos; (b) --shadow-report
    computes the falsifier verdict mechanically; (c) block mode cannot activate
    before the falsifier passes; (d) sentinel bypass is logged?
(B) ATC 7-step on the PLAN as execution contract (delete/simplify/anti-slop).
(C) MUDA waste review.

## Read
1. .planning/milestones/v3.5/phases/147-commit-seam-gate/147-01-PLAN-LOCKED.md
2. .planning/milestones/v3.5/phases/147-commit-seam-gate/CONTEXT.md
3. .planning/milestones/v3.5/phases/147-commit-seam-gate/147-RESEARCH.md
4. .planning/milestones/v3.5/phases/147-commit-seam-gate/147-VTP-ENRICHMENT.md
(Schema already validates — do NOT re-verify schema mechanics.)

## Interrogate specifically
1. STUB-SATISFIABILITY (the P146 plan-check rejected a draft for this; P146's
   phase then still shipped stub-shaped gaps). For EACH semantic AC: can a stub
   pass it? The bar: a real temp GIT repo, real staged files, the real hook
   run by git (or its exact entrypoint), asserting on real shadow-row field
   values with negative controls. Name any AC satisfiable by hardcoded output
   or a self-test flag.
2. Board-binding violations: block-before-falsifier possible? silent
   activation? sentinel unlogged? rollback passing through the gate?
   hardcoded devcp convention? nonzero exit in a non-SGSD repo?
3. VTP directives honored: per-PATH evidence in shadow rows; mechanical
   promotion; sentinel logs WHICH paths waived; one-layer framing (no
   overclaimed coverage given --no-verify)?
4. RESEARCH findings honored: linked-worktree hook path (common dir — install
   scope is ALL worktrees; does the plan say how it handles that?); POSIX
   trampoline on Windows; existing-hook policy decided (not punted); NUL-safe
   staged-diff parsing; binaries hashed?
5. P146 carry-forward: every writer via resolveContainedPath; distinct reason
   codes for every degraded path (the "silent success" class shipped 7 times —
   look for an 8th in this plan's design)?
6. DAG: single unambiguous serial order; owning task named for every shared
   file; task sizing sane?
7. Open decisions punted into execution? (source-touching predicate,
   DEFERRED-F/G disposition must be DECIDED in the plan.)

## Verdict rules
GO only if executable as-is. NOGO if any board-binding constraint can be
violated, any AC is stub-satisfiable, or an open decision was punted.

## Report contract (exact — 5 lines FIRST)
FINDINGS: <int>
CRITICAL: <int>
WARNINGS: <int>
PASS_RATE: <n>/<m>
ONE_LINER: <verdict GO|NOGO + one-line reason>
FINDINGS_DETAIL: [severity] [dimension] <description>  (one per CRIT/WARN)
