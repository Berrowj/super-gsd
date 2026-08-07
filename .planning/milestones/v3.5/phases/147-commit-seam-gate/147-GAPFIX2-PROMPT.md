# P147 gap fix 2 — activation scenarios stage into a NON-GIT fixture (test bug)

SDD implementer: fresh context, THIS FIX ONLY. File:
`super-gsd/tests/commit-gate/assert-real-commit-gate.cjs`. Nothing else —
do NOT touch the hook or libs; they are correct.

## Diagnosis (confirmed at source)
`createReportPair` (line ~1253) builds BOTH sides with
`createBareSgsdFixture` (no `git init`). The passing-activation branch
(~1442-1447) then calls `stagePaths(passing.gsd.repoDir, ...)` → `git add`
fails 128 "not a git repository". Both `shadow-report-activation` and
`ac-shadow-report-activation` fail at exactly this step; everything before
(report math, refusal, bare-mode warn, digest assertions) is fine.

## Fix
Make the gsd side of `createReportPair` a REAL git fixture (use the existing
`createTempGitRepo` used elsewhere) so staging works; keep the devcp side
bare (report math only). Preserve every existing assertion — especially the
per-repo floors (102+102=204), the tamper-detection branch, and the
exit-10 honored-activation branch. If `createTempGitRepo` seeds extra files
that alter row counts, account for that WITHOUT weakening the 204 assertion
(adjust seeding, not the assertion).

## Verify (report exact exit codes)
1. `node --check` the file.
2. `--scenario shadow-report-activation` and `--scenario
   ac-shadow-report-activation` → exit 0 (sandbox may block git spawn EPERM —
   say so; the orchestrator re-runs host-side).
3. State which lines you changed.
SURGICAL CONSTRAINT. <200-word report.
