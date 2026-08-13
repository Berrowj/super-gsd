# Codex Spec-Compliance + ATC review — P152-T2 KB-triage shadow classifier

You are an INDEPENDENT reviewer. Do NOT trust the executor's self-summary. Judge
the raw artifacts only. Read:
- Plan/contract: `.planning/milestones/v3.6-vtp-bridge/phases/152-kb-triage-shadow/152-01-PLAN-LOCKED.md`
- Governing memo: `.planning/decisions/2026-08-12-kb-triage-gate-MEMO.md`
- Raw diff: `.planning/milestones/v3.6-vtp-bridge/phases/152-kb-triage-shadow/152-T2-DIFF.txt`
- Source as committed: `super-gsd/hooks/sgsd-intent-classifier.cjs`,
  `super-gsd/registry/session-governance-hooks.yaml`,
  `super-gsd/tests/kb-triage-shadow/assert-shadow.cjs`

## Spec-compliance checks (each PASS/FAIL with a one-line reason)
1. The shadow kind can NEVER inject: `shadow` is NOT in CLASSIFIER_ENFORCEMENT_KINDS;
   validateRouteShape's shadow branch forbids a directive and sets classifierUsable=false.
2. evaluateShadowRoutes never reaches stdout/the model (no safeStdout; wired in a
   try/catch that cannot alter emitClassification's return or output).
3. TEXT-FREE telemetry: the ledger row contains ONLY {ts, decision_id, matcher_version,
   matched_signature_ids, soft_path_action, latency_ms, operator_label}; decision_id is
   an opaque uuid; matched_signature_ids are ROUTE ids, never prompt substrings; no
   prompt text/excerpt/entity is written anywhere.
4. Matcher tiering: a STRONG KB positive matches even when a start-anchored verb
   (build|fix|run|test|file) opens the prompt; a WEAK positive is suppressed by that
   start-anchored verb; no positive never matches. Confirm "what did X say about fixing…"
   matches and "fix the failing test" does not.
5. Scope: no hard gate, no /triage alias, no raw-query logging, no KB entity lookup in
   the trigger; the global VTP skill is untouched.

## ATC (anti-slop) over the diff
Flag any: dead code, unused params, orphan functions, unjustified abstraction,
duplicated logic, ΔComplexity>0, or anything a senior would mass-delete. Note if the
shared matchesRoute was wrongly reused (it must NOT be — its exclusion-beats-trigger
semantics are inverted for shadow).

## Verdict
Return: `VERDICT: GO` or `VERDICT: NOGO`, then FINDINGS (numbered, most-severe first,
or "none"), then a one-line ONE_LINER. Under 250 words.
