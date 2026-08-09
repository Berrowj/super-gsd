Patched only [assert-real-triage-runtime.cjs]($HOME/AppData/Roaming/warp/Warp/data/worktrees/GSDedits/cholla-racer/super-gsd/tests/triage-runtime/assert-real-triage-runtime.cjs).

Root cause: `codex-nonzero-single-model` asserted fake provider exit `41`, but the runtime row records the wrapper’s documented generic failure exit `1`; the fixture-specific stderr marker still guards the nonzero path. I also fixed `all` to run aliases as well as primary scenarios: 20 scenario selectors + 6 `ac-*` aliases = 26 CLI selectors; `all` runs the other 25.

Verification:
- `node --check super-gsd\tests\triage-runtime\assert-real-triage-runtime.cjs` exit `0`
- Full suite `node ... --scenario all` exit `1` in this sandbox: `spawnSync bash EPERM` before final count
- Supplemental non-Bash alias check `ac-null-reflection-fallback` exit `0`
- Shimmed host-behavior nonzero check exit `0`

Unrelated preexisting untracked P148 files were left untouched.
