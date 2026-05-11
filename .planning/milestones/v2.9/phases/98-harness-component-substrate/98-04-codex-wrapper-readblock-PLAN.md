---
plan_id: 98-04
phase: 98
title: Fix Codex wrapper rc0 read-block and patch apply false success
type: runtime-bugfix
expected_ATC_tier: full
files_touched:
  - super-gsd/scripts/codex-executor.sh
  - super-gsd/scripts/codex-patch-executor.sh
  - super-gsd/docs/CODEX-EXECUTOR.md
  - super-gsd/tests/cockpit-regression/check.cjs
  - super-gsd/tests/codex-executor-readblock-fallback.sh
  - super-gsd/tests/codex-patch-executor-apply-failure.sh
---

# Plan 98-04

| # | Task | Acceptance |
|--:|---|---|
| 1 | Detect Windows read-block even when Codex exits 0 | Fake Codex rc0 read-block test routes through patch fallback and replaces the report |
| 2 | Fail closed on invalid Codex patches | Corrupt patch test exits non-zero and never writes `SGSD_PATCH_APPLY: success` |
| 3 | Use hunk recount on patch apply | `git apply --recount --check` and `git apply --recount` are used for Codex diffs with bad hunk counts |
| 4 | Keep static regression coverage | Cockpit regression asserts rc0 read-block and explicit apply failure guards |

## Stop Rule

Do not checkpoint auto mode for this class of failure until the direct wrapper
has checked stdout/report-body read-blocks and patch mode has failed closed.
