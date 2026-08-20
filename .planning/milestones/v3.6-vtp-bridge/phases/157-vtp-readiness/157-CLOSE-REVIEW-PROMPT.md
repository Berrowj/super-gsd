# P157 consolidated close review — T3 spec + phase ATC + MUDA + close verdict

Read only. Commits: 94f?? T1 registry (git log --oneline -8 will show:
"feat(157-T1)...", "feat(157-T2)... 94c8516", "feat(157-T3)... b167ebd"). Inspect
with `git show` and direct reads. Phase artifacts under
`.planning/milestones/v3.6-vtp-bridge/phases/157-vtp-readiness/`.

1. T3 spec compliance against task P157-T3 (157-01-PLAN-LOCKED.md rev 2): hook
   count-only, exact stdout, silent fail-open, NO net/http/dns/fetch/child_process
   imports (read sgsd-vtp-pending.js in full), overlay registration matches the
   existing style, test/installer/merge-settings untouched by T3B. The honest-red
   division of labour is documented in 157-T3-FINAL-REPORT.md.
2. Phase ATC (Delete/Simplify + anti-slop) over the three commits: orphans, dead
   imports, YAGNI, duplication vs existing helpers. WARNs are recorded, not fixed
   tonight.
3. MUDA over phase artifacts (beyond already-recorded items).
4. Phase goal (CONTEXT.md): topology contract durable + three probes on BOTH
   surfaces + SessionStart depth. Met by shipped code?
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
A CRITICAL gets ONE fix round; second failure => BLOCKED-WITH-GAP-PLAN.
