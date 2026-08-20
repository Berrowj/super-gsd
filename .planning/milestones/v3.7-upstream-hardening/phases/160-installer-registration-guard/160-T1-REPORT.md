FILES_CHANGED

- [hook-registration-preflight.cjs](C:/Users/jack.berrow/AppData/Roaming/warp/Warp/data/worktrees/GSDedits/luminaria-hogback/super-gsd/scripts/lib/hook-registration-preflight.cjs)
- [merge-settings.js](C:/Users/jack.berrow/AppData/Roaming/warp/Warp/data/worktrees/GSDedits/luminaria-hogback/super-gsd/scripts/merge-settings.js)
- [assert-installer-registration-guard.cjs](C:/Users/jack.berrow/AppData/Roaming/warp/Warp/data/worktrees/GSDedits/luminaria-hogback/super-gsd/tests/installer-registration-guard/assert-installer-registration-guard.cjs)

VERIFICATION

- `node --check`: PASS, all three files.
- In-process injected load: PASS; Node/Bash enumeration and three aggregated refusals.
- Static/name checks: PASS; pre-write ordering, four error codes/cases, 9/16 fixtures, hash/temp/non-leak assertions.
- Task changes limited to the three contracted files.

DEVIATIONS

- Spawn-bound suites and merge self-test not run, per instruction.
- Existing unrelated `.planning/` changes preserved.
- No commit created.

BLOCKERS

- None for edits. Unsandboxed orchestrator verification remains pending.

ONE_LINER

Atomic preflight now refuses the entire realized hook overlay before any target read or write.
