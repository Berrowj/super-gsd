# P150-T150-03c — Final continuation: 2 remaining reds, both test-side

3/5 green. The 2 reds are TEST defects, not implementation defects:

1. 'global launcher defaults to canonical runtime paths': boot output shows CORRECT provenance (paths/HEAD/pin all right) but exits 4 at PREFLIGHT '[FAIL] curate write-pipe smoke test — DLB-04 Day 0 blocker'. The fixture home/project lacks whatever sgsd-boot's curate write-pipe smoke needs (inspect the preflight in sgsd-boot.sh; replicate the minimal memory-tree/INDEX structure it probes in the fixture). Do NOT weaken the preflight.

2. 'remote doctor reports only the selected runtime provenance': doctor prints the CORRECT scripts path but in MSYS POSIX form (/tmp/sgsd-runtime-provenance-XXX/home/.claude/super-gsd/scripts) while the assertion regex expects the Windows form (C:/Users/.../Temp/...). Fix the assertion to normalize both to forward slashes and match on the fixture-relative suffix (e.g. /home\/\.claude\/super-gsd\/scripts$ anchored to the fixture temp name), accepting the MSYS /tmp mapping.

Make it 5/5. Touch only super-gsd/tests/propagation/runtime-provenance.test.cjs and (if the fixture needs structure) fixture-setup code within it; sgsd-boot.sh only if the smoke probes something genuinely wrong.

## Verify: node --test super-gsd/tests/propagation/runtime-provenance.test.cjs -> 5/5.

## Report contract: FILES_CHANGED / VERIFICATION / DEVIATIONS / BLOCKERS / SCRIPTS_CREATED / ONE_LINER / STATUS
