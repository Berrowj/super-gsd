# P161 consolidated close review — spec (T1-T3) + phase ATC + MUDA + close verdict

Read only. Task commits: 23de93b (T1), a39549d (T2), 71f940f (T3). Inspect with
git show and direct reads. Orchestrator verification of record: all ELEVEN guard
cases exit 0 (list in .planning/tmp/161-suite-final.log shape); global install
measured 6m04 -> 1m49 after T1's batching.

1. Spec vs tasks P161-T1/T2/T3 (161-01-PLAN-LOCKED.md): .cjs shipped; manifest
   reconciles with reasoned native surfaces; the recovery case drives the REAL
   sgsd-update (broken exit 5 -> repaired exit 0, pin advance, dead rows
   preserved); P160 guard not weakened (verify semantics: ownership scoping
   NARROWED what SGSD validates to what it owns — confirm no sgsd-owned check
   was lost, especially vendored-nine refusal and smoke fail-loud).
2. The ownership-scope change (T3I) is the largest semantic delta: audit it —
   operator rows byte-preserved and unparsed; overlay/managed/coverage paths
   still fully validated.
3. Phase ATC over the three commits; MUDA beyond the honest nine-round trail.
4. Phase goal (CONTEXT.md): D1/D2 closed, sgsd-update recovery proven?
5. Safe to close PASS with deferred WARNs?

Output, contract lines first, then max 150 words:
```
FINDINGS: <int>
CRITICAL: <int>
WARNINGS: <int>
PASS_RATE: <n>/<n>
ONE_LINER: <summary>
CLOSE_VERDICT: PASS | PASS-WITH-DEFERRED | BLOCKED
REQUIRED_BEFORE_CLOSE: none | <numbered>
```
