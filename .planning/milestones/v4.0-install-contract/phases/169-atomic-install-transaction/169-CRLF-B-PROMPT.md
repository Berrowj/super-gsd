# CRLF digest fix, dispatch B: the regression tests. One file. Patch mode, one unified diff.

## What landed (dispatches A/A2), take as given

A shared CRLF->LF-only normalized digest is now used at every file-read comparison against
a pinned sha256: audit.cjs source-pin check and `--write-source-pins` generator,
hook-install-contract.cjs manifest generation / candidate rows / delivery validation /
inspection, and substrate-invocation-witness-store.cjs readiness (:234 area). Committed
pins were regenerated: both overlay sgsd_source_sha256 values are now
fd147b8d8abf4c3b84a012e62fee222b83f9adb53b289092e3636ae16b1139aa (the LF-normalized
witness hook digest), and hook-manifest.json was rewritten by its generator.

Verified by the orchestrator: real empty-tree install exit 0, 17 hooks + 9 modules.

## Add to assert-installer-registration-guard.cjs (choose the fitting existing case or a
new small case wired into --all):

1. PIN CANONICALITY: for every sgsd_source_sha256 in repo-settings-overlay.json and every
   sha256 row in hook-manifest.json, assert the value equals the CRLF->LF-normalized
   digest of the corresponding source file. This fails on any OS if a future regeneration
   pins platform-variant bytes.
2. CROSS-PLATFORM ACCEPTANCE: with a fixture whose installed witness hook differs from
   the pinned content ONLY by line endings (write the CRLF variant if the source is LF,
   and vice versa), the readiness/capability check must report the source as CURRENT, not
   source_drift/pretooluse_stale.
3. TAMPER REJECTION: the same fixture with a one-byte content change (not a line ending)
   must still be rejected as drift.

Constraints: never weaken an assertion; fixture paths contain SPACES; do not touch
production files. Report: case name(s) and assertion count added, max 100 words.
