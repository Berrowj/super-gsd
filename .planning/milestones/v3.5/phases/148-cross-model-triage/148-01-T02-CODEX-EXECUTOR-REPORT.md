DONE_WITH_CONCERNS

Implemented T148-02 in the requested files:

- Created `super-gsd/scripts/lib/triage-verdict-schema.cjs`
- Extended `super-gsd/scripts/codex-exec.sh` with `--contract triage-verdict-v1`
- Extended `super-gsd/tests/triage-runtime/assert-real-triage-runtime.cjs`

Schema bounds stated in code: stdout envelope `1 MiB`, string fields/items `4096 chars`, arrays `50 items`.

Verification:

- `node --check super-gsd/scripts/lib/triage-verdict-schema.cjs` -> exit `0`
- `node --check super-gsd/tests/triage-runtime/assert-real-triage-runtime.cjs` -> exit `0`
- Schema scenarios manual run -> exit `0`
- Schema CLI valid -> exit `0`
- Schema CLI invalid path -> exit `6`
- Existing `vtp-fallback-contained-degradation` scenario -> exit `0`
- `git diff --check` -> exit `0`

Blocked by sandbox:

- `bash -n super-gsd/scripts/codex-exec.sh` -> Bash `$LASTEXITCODE=256`, `CreateFileMapping ... Win32 error 5`
- `bash super-gsd/scripts/codex-exec.sh --self-test --skip-network` -> Bash `$LASTEXITCODE=256`, same error
- New focused wrapper fixture -> exit `1`, `spawnSync bash EPERM`
- WSL fallback probe -> exit `-1`, `Wsl/Service/CreateInstance/E_ACCESSDENIED`

Unrelated dirty files were left untouched.
