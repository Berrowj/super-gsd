# P161-T1D — installer copy loops fork per file; batch them

Files ONLY: super-gsd/install.sh and the P160 guard test. Edits-first; no
spawns; do NOT commit.

## Measured profile (orchestrator, bash -x timestamp aggregation, this machine)

A global install spends its ~6 minutes in process forks, not in node:
cp 165s, mkdir -p 159s, '[' tests ~234s combined, basename 99s, chmod 18s —
per-file copy_file loops forking cp/mkdir/basename/test for every one of
hundreds of files at ~300ms/fork under load. The entire P160 smoke is ~15s.
This is why three test cases hit spawnSync bash ETIMEDOUT: each install-driven
fixture costs minutes.

## Fix

1. Replace per-file copy loops with batched operations preserving EXACT
   semantics: recursive/bulk cp for whole directories where the loop copies
   everything; single mkdir -p per target root; compute skip/overwrite
   decisions in bash without forking (parameter expansion instead of basename;
   [[ ]] builtins); keep executable-bit handling (one chmod with many args),
   the .cjs-inclusive coverage from T1, and the never-overwrite-operator-state
   rules byte-for-byte in behaviour.
2. Do NOT touch the preflight/smoke logic (measured cheap) or the npx call
   (recorded separately).
3. Test budgets: after batching, align the three failing cases' spawn timeouts
   to measured reality with 3x headroom.

Target: full global install under ~90s on this machine; all NINE guard cases
green.

Report: FILES_CHANGED / VERIFICATION (static; bash -n) / DEVIATIONS /
BLOCKERS / ONE_LINER, max 120 words.
