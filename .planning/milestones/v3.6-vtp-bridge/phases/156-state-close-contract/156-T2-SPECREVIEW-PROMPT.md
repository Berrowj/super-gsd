# P156-T2 spec-compliance review — raw artifacts, not executor claims

Read only. T2 changes are UNCOMMITTED: `git diff` for
`super-gsd/scripts/lib/orchestrator-hooks.cjs` and
`super-gsd/skills/sgsd-orchestrate/SKILL.md`; direct reads for new
`super-gsd/tools/phase-close/check.cjs` and
`super-gsd/tests/state-close-contract/assert-phase-close-route.cjs`.

Raw artifacts: task P156-T2 in `156-01-PLAN-LOCKED.md` (revision 2, AMENDMENT-1
change 2 binding); executor report `156-T2-REPORT.md`; orchestrator's unsandboxed
verification: route suite 36/36 exit 0. Known pre-existing failure OUT of T2 scope:
orchestrator-hooks self-test A1 (tokenWasteCheck(null) ok:true) fails on HEAD too —
do not attribute it to T2; verify only that T2 did not touch tokenWasteCheck.

Check against the contract, in order:
1. AMENDMENT-1 change 2: the AUDIT-without-SUMMARY red run drove the REAL exported
   skillRoutingConsult with the production registry loader (report says pre-gate
   ok=true, dispatches=1) — confirm the test harness genuinely calls the production
   export, not a reimplementation.
2. check.cjs read-only: API never writes; CLI exits 0/1/2; js-yaml JSON_SCHEMA with
   duplicate-key rejection; the seven frontmatter fields validated per contract
   (including commits as 7-40 hex STRINGS — note the 81e7210 exponent-coercion trap
   the report mentions; confirm lexical preservation is real).
3. Preflight fires ONLY for moment=phase-close + execute=true; refusal returns
   ok=false with close_contract, zero dispatches, zero state advances.
4. SKILL ordering encoded: SUMMARY after verification/ATC/audit evidence, consult
   validates, state.write advances, close commit includes SUMMARY+STATE, then 6.7.
5. Boundary: no registry changes, no read-side writes, T1 files untouched by T2.

Output, contract lines first, then max 150 words:
```
FINDINGS: <int>
CRITICAL: <int>
WARNINGS: <int>
PASS_RATE: <n>/<n>
ONE_LINER: <summary>
SPEC_VERDICT: pass | fix_required | blocked
REQUIRED_FIXES: none | <numbered>
```
