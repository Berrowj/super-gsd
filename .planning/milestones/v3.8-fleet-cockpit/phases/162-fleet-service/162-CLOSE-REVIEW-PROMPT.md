# P162 consolidated close review — spec (T1-T3) + phase ATC + MUDA + close verdict

Read only. Task commits: bc58e6f (T1), af9d836 (T2), 7998b25 (T3). Inspect with
git show and direct reads of super-gsd/tools/fleet-cockpit/. Orchestrator
verification of record: fleet suite 215/215 exit 0; adapter baseline 19/19
untouched (git status clean on cockpit-state).

1. Spec vs tasks P162-T1/T2/T3 (162-01-PLAN-LOCKED.md rev 2): hard-constraint
   audit is the priority — grep server.cjs/fleet.cjs/status.cjs for ANY require
   beyond node: builtins (CRITICAL); any POST/PUT/PATCH/DELETE handler
   (CRITICAL); confirm /api/lane snapshot is the adapter output verbatim with
   derived fields beside it, never inside; requests never trigger builds.
2. The five product filters + conflict rule: verify the FIXTURES assert what
   the handover demands (no-data never rendered as zero; Bash never an agent;
   conflict carries both values + confidence), not weakened shapes.
3. Handover step-1 acceptance checklist: which items are proven here vs
   legitimately deferred to run-home (devcp load delta)? List any not covered.
4. Phase ATC + MUDA over the three commits.
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
