Implemented the surgical fix in the three allowed files.

Changed:
- `codex-exec.sh` now honors `SGSD_CODEX_COMMAND` first and skips WSL fallback rewrite when set.
- Runtime normalizes `SGSD_CODEX_COMMAND` across Node to Git Bash and no longer treats override-backed EPERM as `codex_missing`.
- Fixtures now use explicit fake/missing command paths, contained HOME/USERPROFILE, and marker assertions: `SGSD_FIXTURE_CODEX_MARKER_T14803_NO_REAL_CODEX`.

Verification exit codes:
- `node --check super-gsd/tests/triage-runtime/assert-real-triage-runtime.cjs`: 0
- `node --check super-gsd/scripts/sgsd-triage-runtime.cjs`: 0
- `bash -n super-gsd/scripts/codex-exec.sh`: 1, blocked by Git Bash `CreateFileMapping ... Win32 error 5`
- Full 16-scenario suite: overall 1. 13/16 passed; failing scenarios were Bash-backed sandbox failures: `codex-contract-json-schema`, `codex-missing-single-model`, `runtime-dispatch-reconciliation`.
- `codex-exec.sh --self-test --skip-network`: 1, same Git Bash startup failure.
- Marker assertion path `planning-codex-agreement`: 0

No real Codex dispatch occurred in this sandbox; Bash could not start for wrapper-backed paths.
