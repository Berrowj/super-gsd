# P159 plan review — single round (overnight contract), ATC + MUDA

Read only. Plan: `.planning/milestones/v3.6-vtp-bridge/phases/159-skill-routing-expansion/159-01-PLAN-LOCKED.md`,
CONTEXT.md beside it (OPERATOR-LOCKED scope), `super-gsd/hooks/sgsd-intent-classifier.cjs`,
`super-gsd/registry/skill-routing.yaml`, `super-gsd/registry/vtp-services.yaml`.

Checks, in order of importance:
1. LOCKED CONSTRAINTS: any cosine/embedding/similarity scoring is CRITICAL
   (Phase 47/48 lock). Any hook invoking MCP or a skill is CRITICAL
   (suggest-never-call). Any liveness/network check in availability guards is
   CRITICAL (registration-only, cheap config read).
2. T1 availability guard falsifier both ways (available fires; unavailable is
   silent PLUS a written text-free skill_unavailable row — absent-row negatives
   rejected). T4 layer-routing encodes the recorded rule verbatim, not a
   rediscovered variant.
3. Tiering: shadow-first for new tool-level routes; suggestion only where CONTEXT
   allows; no directives.
4. Regression protection: classifier (incl. P158 origin gate), KB-shadow, routing
   registry self-tests all in verification_cmds.
5. MUDA: 4 tasks vs scope; name any mergeable pair or padded task.

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
