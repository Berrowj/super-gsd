# P155-T2-T3 completion pass — the prior fix dispatch was killed mid-run

Fresh context. Do NOT commit. Most of the fix already landed and is verified:
resolve.cjs:429 and the 619/625 region route through phase-name.cjs; the resolver is in
the dual-root matrix; the first glob slash is fixed. Complete ONLY what remains:

1. `super-gsd/scripts/sgsd-distill-milestone.sh:146` — the same line still has TWO more
   missing slashes: `"$pd"*VERIFICATION.md` and `"$pd"WASTE.md` must become
   `"$pd/"*VERIFICATION.md` and `"$pd/"WASTE.md`.
2. If not already present, harden the distill self-check so an EMPTY corpus fails: for
   a fixture phase dir containing a SUMMARY.md, the emitted corpus must contain >0
   documents; assert the count, not just the header.
3. Re-check resolve.cjs for ANY remaining private phase-name regex that bypasses
   phase-name.cjs (the spec review named 429, 619, 625 — confirm all three and any
   siblings). Tier priorities/confidence/repairs stay bit-identical.

Run what the sandbox allows; report honestly. Report format: FILES_CHANGED /
VERIFICATION / DEVIATIONS / BLOCKERS / ONE_LINER, max 150 words.
