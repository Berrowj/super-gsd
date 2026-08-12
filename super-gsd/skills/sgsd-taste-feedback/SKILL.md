---
name: sgsd-taste-feedback
description: At phase close, label which VTP-injected context (enrichment hits, triage routes, clusters, matches) was actually USED in shipped work — accepted/modified/unused + reason, keyed by artefact. Builds the taste ledger ("the matcher is commodity; the labelled preference ledger is not"). Phase 0 instrumentation.
---

# sgsd-taste-feedback — phase-close usage labelling of VTP context

## When this fires
At phase close (sgsd-orchestrate Step 6.6 / sgsd-complete-phase), AFTER verification, BEFORE
the phase-close commit.

## Protocol
1. Enumerate every VTP artefact injected into this phase's work:
   - enrichment-gate hits ({NN}-VTP-ENRICHMENT.md entries),
   - triage routes recorded by sgsd-triage-first (route-decisions rows with
     boundary 'vtp_triage_advisory' for this phase),
   - (later phases) cross-pollination clusters and problem matches.
2. For each artefact, judge from the ACTUAL shipped diff/plan: was it
   - accepted (visibly shaped the plan/code/decisions),
   - modified (used but reworked), or
   - unused (injected but had no visible effect)?
   Attach a one-line reason. Judge from evidence in the phase artifacts — never from memory
   alone; if you cannot point to where it was used, it was unused.
3. Record each judgement:
   - Where a triage_id exists and no feedback was recorded at dispatch time, call
     `mcp__vtp-kb__vtp_triage_feedback` now (decision per above; override_reason_code for
     modified/rejected).
   - Append one row per artefact to `.planning/metrics/taste-ledger.jsonl`:
     `{ ts, phase, milestone, artefact_kind: 'enrichment_context'|'triage_route'|
     'cross_pollination_cluster'|'problem_match'|'hybrid_synthesis', artefact_ref,
     decision: 'accepted'|'modified'|'unused', reason }` — v1-compatible now; migrate to the
     v2 feedback records (artefact_kind field) when Phase B ships them into the MCP surface.
4. Summarise counts (accepted/modified/unused) in the phase-close notes.

## Hard constraints
- Machine-cadence, human-auditable: rows are append-only JSONL; never rewrite history.
- Precision over volume: judge honestly — an inflated "accepted" count poisons the taste
  model this ledger exists to train (favour five right labels over fifty flattering ones).
- Never write to any live KB store; the ledger lives under .planning/metrics/.

## Why (board-recorded)
The advisory feedback ledger is the defensible asset — supervised labels for which VTP
contributions humans actually value. WRONG_SCOPE = bad match; OPERATOR_PREFERENCE = right
match, wrong moment. This ledger gates Phase C emission precision.
