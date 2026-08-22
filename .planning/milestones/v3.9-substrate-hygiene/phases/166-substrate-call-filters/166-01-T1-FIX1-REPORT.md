FILES_CHANGED: super-gsd/tests/vtp-substrate-policy/assert-vtp-substrate-policy.cjs (modified)

VERIFICATION: `node super-gsd/tests/vtp-substrate-policy/assert-vtp-substrate-policy.cjs --case caller-coverage` -> exit 0; `node super-gsd/tests/vtp-substrate-policy/assert-vtp-substrate-policy.cjs --case executable-emitters` -> exit 1 (sandbox blocks nested Node spawn with EPERM); `node super-gsd/tools/vtp-bridge/classify.cjs --self-test` -> exit 0

DEVIATIONS: none

BLOCKERS: Local sandbox prevents executable-emitters from completing; supplied unsandboxed result was PASS.

ONE_LINER: Added file-scoped, fully anchored allowlist entries for the two exact declaration strings, preserving meaningful self-test output and fail-closed injection coverage.
