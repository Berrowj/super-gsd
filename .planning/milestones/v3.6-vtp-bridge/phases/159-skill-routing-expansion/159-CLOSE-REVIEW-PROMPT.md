# P159 consolidated close review — spec (T2/T3/T4) + phase ATC + MUDA + close verdict

Read only. Four task commits: `git log --oneline -8` shows feat(159-T1) d-hash,
feat(159-T2) d81d4d2, feat(159-T3) 6a136da, feat(159-T4) 26edb1f. Inspect with
`git show` and direct reads. Orchestrator verification of record (all exit 0):
guard 53/53, erp family 37/37, lint clean + 9/9, vtp registered 26/26,
unavailable 19/19, ledger 16/16, registry 18/18, classifier 25/25, P152
shadow contract green after T4C ordering restoration.

1. Spec compliance vs tasks P159-T2/T3/T4 (159-01-PLAN-LOCKED.md rev 2):
   - LOCKED: no cosine/embeddings anywhere; hooks never invoke MCP/skills; MCP
     availability is registration-only (scan for net/http/dns imports in the
     classifier and registry loader — any is CRITICAL).
   - Layer-routing rule encoded verbatim (five families); shadow-tier for tool
     routes; demand rows on fired routes; text-free ledgers throughout.
   - T3 lint read-only with stable reason codes.
2. Phase ATC (Delete/Simplify + anti-slop) over the four commits; WARNs recorded
   not fixed.
3. MUDA beyond recorded items (note: T2 took four dispatches, T4 three — the
   artifact trail is intentionally complete, do not count honest failure records
   as waste).
4. Phase goal (CONTEXT.md, operator-locked): coverage extended shadow-first with
   availability guards; met by shipped code?
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
