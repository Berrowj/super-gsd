# P154 planning task — author 154-01-PLAN-LOCKED.md

You are the planner. You WRITE the plan file and VALIDATE it yourself. No source
changes in this task. You CANNOT spawn `claude` (EPERM); node works.

## Read first

1. `.planning/milestones/v3.6-vtp-bridge/phases/154-mcp-arg-contract/CONTEXT.md` — the
   authoritative scope, including the acceptance-shape section added after plan-review
   round 2 of P153 (authoritative schemas, pre-fix-failing test, AND successful
   post-fix REAL MCP calls).
2. `super-gsd/scripts/sgsd-triage-runtime.cjs` — the defective emitter. Find where it
   builds args for `vtp_route_and_retrieve` (context.recent_turns emitted as string[]
   where the tool requires {role?,text}[] — hard -32602, reproduced 2026-08-18) and for
   `vtp_search_substrate` (emits raw_query/context/fallback_reason; tool accepts only
   `query` + typed filters).
3. `super-gsd/templates/plan-schema-v2.json` — your frontmatter contract.
4. P155's plan (155-01-PLAN-LOCKED.md) as the house style for real-data SACs.

## Plan shape guidance, not a straitjacket

Likely 2 tasks: (T1) per-tool arg-shaper at the emission seam + authoritative schema
source (the schemas should be DECLARED in a versioned file the test reads, with a note
they mirror the live MCP tools — never hand-copied inline in the test) + conformance
test failing pre-fix; (T2) post-fix REAL MCP call evidence — since the executor sandbox
cannot call MCP tools, the ORCHESTRATOR performs the two live calls and records them;
the task's verification_cmd validates the recorded responses (shape + non-error)
rather than making the call itself. Say this division of labour explicitly in the
task contracts, as P153/P155 did.

Boundaries from CONTEXT: no routing/predicate changes, no new tools wired, does not
depend on P153/P155 code. Every task revertable. depends_on values are STRINGS.

## Validate before you finish

    node super-gsd/tools/plan-schema/validate.cjs \
      --plan-file .planning/milestones/v3.6-vtp-bridge/phases/154-mcp-arg-contract/154-01-PLAN-LOCKED.md \
      --project-dir . --mode write

Exit 0 required. Report: FILES_CHANGED / VERIFICATION / DEVIATIONS / BLOCKERS /
ONE_LINER, max 150 words.
