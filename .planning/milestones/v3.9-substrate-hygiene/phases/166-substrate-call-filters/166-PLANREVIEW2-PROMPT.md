# P166 plan review — ROUND 2, confirmation only

Round 1 returned NOGO with two required changes. Revision 2 of the plan claims
to have applied both. Your job is to confirm those two changes ONLY, not to
re-open settled ground.

Read only. No file changes, no commands that mutate anything.

Read:
- `.planning/milestones/v3.9-substrate-hygiene/phases/166-substrate-call-filters/166-01-PLAN-LOCKED.md` (revision 2)
- `.planning/milestones/v3.9-substrate-hygiene/phases/166-substrate-call-filters/166-PLANREVIEW-REPORT.md` (round-1 verdict)
- `super-gsd/scripts/lib/vtp-context-composer.cjs` (the callVtp seam the plan makes authoritative)
- `super-gsd/schemas/vtp-mcp-input-schemas.v1.json` (frozen; v2 must not edit it)
- The eight enumerated sites/branches named in the plan's first SAC, to confirm
  each one actually exists where the plan says it does.

## Confirm exactly these two

1. EXECUTABLE GATEWAY, RAW CALLS BLOCKED. Does revision 2 put v2 schema
   validation in the CALL PATH (callVtp, immediately before mcpInvoke), such
   that an unfiltered or malformed substrate payload cannot reach transport?
   Where a markdown agent must retain the raw MCP tool because its runtime
   cannot inject a transport callback into Node callVtp, is that raw use
   mechanically tied to composer gateway evidence (schema version, intent
   family, payload digest), and does the conformance test REJECT a recorded
   raw call that is direct, missing evidence, digest-mismatched, or unfiltered?
   A plan that validates only inside tests, or that relies on prompt wording,
   has NOT applied this change.

2. EXPLICIT SITE ENUMERATION. Does the SAC name every production call site and
   branch by file (enrichment agent; board-researcher; audit.cjs installed
   phase-researcher; audit.cjs installed planner; triage runtime fallback;
   classify.cjs architecture_challenge; classify.cjs book_lookup; composer
   callVtp substrate seam), and does caller-coverage grep the production
   surfaces AT TEST TIME and FAIL on any occurrence that is neither one of
   those classifications nor an exact allowlist entry? Confirm the allowlist
   cannot swallow a genuine new caller.

## Out of scope this round

T2 cap semantics, P152/P154 preservation, MUDA sizing, and task count were all
accepted in round 1. Do not re-litigate them. Raise them only if revision 2
REGRESSED one of them relative to round 1 — if so, that is a CRITICAL.

## Output

Contract lines first, then max 200 words.

```
FINDINGS: <int>
CRITICAL: <int>
WARNINGS: <int>
PASS_RATE: <n>/<n>
ONE_LINER: <summary>
VERDICT: GO | GO-WITH-CHANGES | NOGO
REQUIRED_CHANGES: none | <numbered>
```

VERDICT rules: GO only if BOTH changes are fully applied and nothing regressed.
GO-WITH-CHANGES if applied but with a non-blocking gap the executor can absorb.
NOGO if either change is still advisory rather than mechanical.
