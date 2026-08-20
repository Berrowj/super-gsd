# P154 plan review — single round (overnight contract), ATC + MUDA

Read only. Plan: `.planning/milestones/v3.6-vtp-bridge/phases/154-mcp-arg-contract/154-01-PLAN-LOCKED.md`,
CONTEXT.md beside it, and the defect sites in `super-gsd/scripts/sgsd-triage-runtime.cjs`.

Checks, in order of importance:
1. Do the SACs prove the DEFECT and the FIX? The conformance test must FAIL against
   pre-fix emission; the post-fix evidence must be REAL MCP responses (recorded by the
   orchestrator, validated by the task's command), not schema-only validation.
2. Are the authoritative schemas a versioned declared file the test reads, not
   hand-copied inline blobs that drift?
3. Scope: no routing/predicate changes, no new tools wired. Any task smuggling either
   is a CRITICAL.
4. Division of labour explicit: executor cannot call MCP; orchestrator performs the
   two live calls. If the plan hides that, flag it.
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
