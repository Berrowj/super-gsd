# P159-T2 — ERP/VTP skill-family shadow+suggestion rows, red-then-green

You are the implementer for ONE task. Fresh context. Node works; no `claude`
spawning (EPERM). Sandbox-denied spawns: fail loud, never self-fulfil; the
orchestrator re-runs unsandboxed. Do NOT commit.

Task P159-T2 in `159-01-PLAN-LOCKED.md` (same dir, revision 2) is your VERBATIM
contract. T1 is COMMITTED (availability guard live) — build on it, do not regress
its 53-assertion case.

Scope essentials from the operator-locked CONTEXT:
- Anchored-lexical rows for: quote-shaped intents (/create-quote), record
  resolution (/erp-resolve), engine/RAG lookups (/clarity-engines), meeting import
  (/vtp-implementation-pack), procurement status (/jcl-procurement-report), and the
  explainer-vs-diagram boundary (/vtp-html-explainer vs /diagram-design).
- Suggestion-tier only for low-risk; shadow-tier where a wrong fire would mislead.
  Reuse the strong-positive-beats-verb tiering from kb-lookup-triage. NO cosine.
- Every row availability-guarded through T1's mechanism (these skills are often
  instance-local).
- Text-free ledger discipline throughout.

Red-first: extend the test with the erp-vtp-skill-family case, run red against the
row-less registry, then add the rows/wiring and re-run green.

## Verify before reporting

    node super-gsd/tests/skill-routing-expansion/assert-skill-routing-expansion.cjs --case erp-vtp-skill-family
    node super-gsd/tests/skill-routing-expansion/assert-skill-routing-expansion.cjs --case availability-guard
    node super-gsd/scripts/lib/skill-routing-registry.cjs --self-test
    node super-gsd/hooks/sgsd-intent-classifier.cjs --self-test

Report: FILES_CHANGED / VERIFICATION (RED preserved) / DEVIATIONS / BLOCKERS /
ONE_LINER, max 200 words.
