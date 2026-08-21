# P166 plan review — single round, ATC + MUDA

Read only. Plan: `.planning/milestones/v3.9-substrate-hygiene/phases/166-substrate-call-filters/166-01-PLAN-LOCKED.md`,
CONTEXT.md beside it, `super-gsd/schemas/vtp-mcp-input-schemas.v1.json`, the
P154 shaper in sgsd-triage-runtime.cjs, vtp-context-composer.cjs, and the four
unfiltered caller surfaces (sgsd-vtp-enrichment agent, gsd-phase-researcher,
gsd-planner, sgsd-board-researcher).

Checks, in order of importance:
1. ENFORCEMENT, not advice: does the plan tighten the declared schema /
   conformance seam so an unfiltered substrate emission FAILS mechanically?
   Prompt-text-only "please filter" is the named-insufficient approach (agents
   forget; that is the F2 defect reborn).
2. Coverage: ALL callers found by grep, not just the four named — the SAC must
   enumerate call sites from the repo, and the policy lives in ONE place.
3. T2 cap semantics: a 900k+ chunk yields a degraded-note artifact naming the
   doc, never a failed artifact and never silent truncation.
4. No relaxation of P152/P154 contracts; no VTP-repo changes; triage runtime's
   existing correct behaviour untouched.
5. MUDA: 2 tasks right-sized.

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
