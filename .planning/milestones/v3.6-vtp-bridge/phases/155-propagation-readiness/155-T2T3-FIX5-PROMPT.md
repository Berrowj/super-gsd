# P155-T2-T3 fix5 — one fixture-isolation change, root-caused by instrumentation

Fresh context. Do NOT commit. ONE change only.

Root cause, proven by spawn instrumentation: in
`super-gsd/tests/propagation-readiness/assert-dual-root-resolvers.cjs` around line 447,
`runDistillMissingCorpus` builds its fixture via
`createFixture(path.join(tmp, tool), 'milestone-only', '42', 'integer')`, which resolves
to the SAME projectDir (`tmp/distill/milestone-only-integer`) that the standard
milestone-only case and the EACCES fault-injection case already used. The shared root
still contains corpus when the missing-corpus case runs, so distill CORRECTLY exits 0
with a full prompt. The product is right; the fixture is contaminated.

Fix: give the missing-corpus case an isolated base directory, e.g.
`createFixture(path.join(tmp, tool, 'missing-corpus'), 'milestone-only', '42', 'integer')`
(or equivalent unique path). Touch nothing else — no product files, no other cases.

Verify: `node super-gsd/tests/propagation-readiness/assert-dual-root-resolvers.cjs --tool distill --case full-matrix`
should show the missing-corpus case pass (state-resolver tier cases remain T4b-pending
and are not yours). Sandbox may block bash spawns; report honestly if so.

Report: FILES_CHANGED / VERIFICATION / DEVIATIONS / BLOCKERS / ONE_LINER, max 80 words.
