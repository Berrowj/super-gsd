**FILES_CHANGED:** [runtime-provenance.test.cjs](/C:/Users/jack.berrow/AppData/Roaming/warp/Warp/data/worktrees/GSDedits/cholla-racer/super-gsd/tests/propagation/runtime-provenance.test.cjs:87) — added the curate index fixture structure and MSYS-safe provenance assertions.

**VERIFICATION:** `node --check` passed. Windows/MSYS regex simulation passed. Independent spec and quality reviews approved. The exact test command was attempted but failed before executing tests with `spawn EPERM` from the managed sandbox’s Node worker restriction.

**DEVIATIONS:** None in code scope. `sgsd-boot.sh` was not changed.

**BLOCKERS:** The exact command must be rerun outside this sandbox to confirm 5/5.

**SCRIPTS_CREATED:** None.

**ONE_LINER:** Added the required memory index section and normalized fixture-relative doctor path matching without weakening vendored-path detection.

**STATUS:** PATCH COMPLETE — 5/5 ENVIRONMENTAL VERIFICATION PENDING.
