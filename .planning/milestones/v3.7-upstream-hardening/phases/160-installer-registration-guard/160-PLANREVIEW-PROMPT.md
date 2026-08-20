# P160 plan review — single round, ATC + MUDA

Read only. Plan: `.planning/milestones/v3.7-upstream-hardening/phases/160-installer-registration-guard/160-01-PLAN-LOCKED.md`,
CONTEXT.md beside it, `super-gsd/install.sh` (both merge sites),
`super-gsd/scripts/merge-settings.js`, both settings overlays.

Checks, in order of importance:
1. T1's falsifier must use the vendored-9-hook fixture (Clarity shape: only
   sgsd-session-start.js present of the four) AND prove NOTHING is written on
   refusal — a partial registration surviving a failed guard is the defect
   reborn. Also the canonical-16 positive fixture.
2. Guard placement argued (installer vs merge-settings vs preflight) and applied
   at BOTH merge sites; `node --check` resolvability, not just existence.
3. T2 tripwire is mechanical (stale-marker scan failing installer self-test),
   not prose; overlay refresh respects the provider lock (no haiku/sonnet
   dispatch, no ByteRover routing).
4. T3 respects the sandbox division of labour (orchestrator runs spawn-bound
   smoke; executor writes it).
5. MUDA: 3 tasks right-sized? Real-data SACs per DLB-07; every task revertable.

Output, contract lines first, then max 200 words:
```
FINDINGS: <int>
CRITICAL: <int>
WARNINGS: <int>
PASS_RATE: <n>/<n>
ONE_LINER: <summary>
VERDICT: GO | GO-WITH-CHANGES | NOGO
REQUIRED_CHANGES: none | <numbered>
```
