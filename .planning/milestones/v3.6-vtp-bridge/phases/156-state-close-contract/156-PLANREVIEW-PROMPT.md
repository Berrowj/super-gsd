# P156 plan review — single round (overnight contract), ATC + MUDA

Read only. Plan: `.planning/milestones/v3.6-vtp-bridge/phases/156-state-close-contract/156-01-PLAN-LOCKED.md`,
CONTEXT.md beside it, and the touched sites: `super-gsd/scripts/lib/decision-state.cjs`
(render-only boundary), `super-gsd/tools/state-resolver/resolve.cjs`,
`super-gsd/scripts/gsd-phase-boundary.sh` line 25.

Checks, in order of importance:
1. Do the SACs prove the DEFECT and the FIX? T2's falsifier must exercise the ACTUAL
   close route both ways: a devcp-shaped fixture phase with AUDIT.md and NO SUMMARY.md
   refused; the same phase with a well-shaped SUMMARY.md passing. Write-atomicity-only
   tests are a known-insufficient AC (P155 review change 6). Red run contractual.
2. Boundary: state.write() must be a NEW write-side primitive. Any task that makes
   decision-state.cjs or resolve.cjs write STATE is a CRITICAL.
3. Backwards re-sync refusal: does T1 consume the resolver's staleness signal rather
   than reimplement it?
4. Scope: no registry/alias/renumbering, no resolver semantic changes. Smuggling
   either is a CRITICAL.
5. MUDA: is 2 tasks right-sized, or is one padded?

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
Overnight contract: a NOGO here gets ONE planner fix round; a second NOGO closes the
phase BLOCKED-WITH-GAP-PLAN. Weigh findings accordingly — name only what would truly
break execution or produce a false pass.
