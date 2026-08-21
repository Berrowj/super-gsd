# P162 plan review — single round, ATC + MUDA

Read only. Plan: `.planning/milestones/v3.8-fleet-cockpit/phases/162-fleet-service/162-01-PLAN-LOCKED.md`,
CONTEXT.md and HANDOVER.md (sections 4-7, 9 step 1) beside it,
`super-gsd/tools/cockpit-state/adapter.cjs`.

Checks, in order of importance:
1. HARD CONSTRAINTS as violations-not-suggestions: any require beyond
   node:http/fs/path (+other node: builtins where justified) is CRITICAL; any
   mutating route handler is CRITICAL; snapshot must be verbatim under
   /api/lane/:name (derived beside, never inside).
2. Status derivation SACs: the four noise filters and the conflict rule each a
   NAMED fixture (Bash-as-agent exclusion; absent-tokens as no-data; empty
   gates as no-gate-data; artifacts source reason; projection_stale =>
   conflict:true with both values + confidence). These are the product; a plan
   treating them as prose is NOGO material.
3. Cache structure: never-build-on-request, timer + bounded concurrency 4,
   roll-up-first stagger, cache_age_seconds everywhere; one broken lane never
   blanks the fleet (error-row SAC).
4. Discovery: git worktree list --porcelain via fixture repo; skipped
   no-.planning lanes REPORTED in /healthz.
5. MUDA: 3 tasks right-sized; adapter untouched (its 19/19 baseline in
   verification_cmds).

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
