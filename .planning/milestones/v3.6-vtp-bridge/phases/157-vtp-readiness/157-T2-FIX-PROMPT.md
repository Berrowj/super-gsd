# P157-T2 fix round (sole round) — ancestor-symlink containment in freshness probe

You are the implementer. Fresh context. Node works; no `claude` spawning. Do NOT
commit. Scope is EXACTLY `super-gsd/tools/vtp-readiness/run.cjs` and
`super-gsd/tests/vtp-readiness/assert-vtp-readiness.cjs`.

Spec finding (157-T2-SPECREVIEW-REPORT.md): run.cjs:59-90 rejects symlink leaves and
traversed entries, but a symlinked Voice-Text-Plan or dist ANCESTOR directory is
followed, so the freshness probe can escape the locked VTP root.

Fix: enforce realpath containment — resolve the VTP root and both probe targets
(src tree walk root and dist/cli.js) via fs.realpathSync and require the resolved
targets to stay under the resolved root; reject symlink or junction ancestors with
the existing stable reason-code style (no path output in the reason).

Test: add an ancestor-symlink fixture (temp dir where the vtp root or dist is a
symlink/junction to an outside dir) proving rejection; on Windows, if symlink
creation is denied in the sandbox, use junctions (fs.symlinkSync type 'junction'
works without privilege) and if THAT is denied fail loud naming the error. Record
the fixture failing against unfixed run.cjs (red) if feasible; otherwise say so.

## Verify before reporting

    node super-gsd/tests/vtp-readiness/assert-vtp-readiness.cjs --case all

Report: FILES_CHANGED / VERIFICATION / DEVIATIONS / BLOCKERS / ONE_LINER, max 150 words.
