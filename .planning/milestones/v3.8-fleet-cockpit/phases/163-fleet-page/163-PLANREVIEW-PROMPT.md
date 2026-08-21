# P163 plan review — single round, ATC + MUDA

Read only. Plan: `.planning/milestones/v3.8-fleet-cockpit/phases/163-fleet-page/163-01-PLAN-LOCKED.md`,
CONTEXT.md and the in-repo HANDOVER.md (sections 8, 9 step 2) beside it,
committed P162 API (server.cjs, status.cjs, fixtures).

Checks, in order of importance:
1. HONESTY OF BROWSERLESS VERIFICATION: DOM behaviours that genuinely need a
   browser must be either structural source assertions or documented manual
   checks — any SAC that FAKES a browser behaviour (asserting a claim the test
   cannot observe) is CRITICAL. "Usable on a phone over LAN" must be a manual
   check, listed as such.
2. No-data vs zero distinction must be asserted on actual rendering strings;
   conflict branch renders BOTH milestone values + confidence; resume_command
   copyable never executable (no onclick-exec, no forms).
3. Hard constraints as violations: framework/build/remote assets/non-ASCII;
   file:// well-formedness check present.
4. Left rail sort comparator unit-tested (extracted), precedence per section 7.
5. MUDA: 2 tasks right-sized; P162 suite + adapter baseline in
   verification_cmds; HARD STOP after phase honoured (no P164/165 smuggling).

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
