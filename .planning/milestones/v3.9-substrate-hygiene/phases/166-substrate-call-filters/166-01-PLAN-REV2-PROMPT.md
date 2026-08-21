# P166 planning revision — NOGO round 1, two required changes

Revise your own 166-01-PLAN-LOCKED.md IN PLACE (revision 2, provenance note in
body). No source changes.

Review verdict (166-PLANREVIEW-REPORT.md): NOGO. Cap/preservation/MUDA sound;
two changes:

1. EXECUTABLE GATEWAY, RAW CALLS BLOCKED: every substrate invocation must flow
   through a v2-schema-validating gateway (the composer/callVtp seam), and
   prompt surfaces must LOSE the raw mcp__vtp-kb__vtp_search_substrate tool
   where feasible (agent frontmatter tools lists swap the raw tool for the
   gateway-mediated path, or where an agent must keep MCP access, its prompt's
   verification requires gateway evidence and the conformance test rejects any
   recorded raw unfiltered call). callVtp forwarding payloads unvalidated is
   the named defect — validation happens IN the call path, not only in tests.
2. EXPLICIT SITE ENUMERATION: the SAC lists every production call site/branch
   by file (enrichment agent, board-researcher, phase-researcher, planner,
   triage runtime, both Phase-48 branches, composer) and the coverage check
   FAILS on any unclassified occurrence found by grep at test time.

Keep T2 and everything else as reviewed.

Validate before finishing:
    node super-gsd/tools/plan-schema/validate.cjs \
      --plan-file .planning/milestones/v3.9-substrate-hygiene/phases/166-substrate-call-filters/166-01-PLAN-LOCKED.md \
      --project-dir . --mode write

Exit 0 required. Report: FILES_CHANGED / VERIFICATION / DEVIATIONS / BLOCKERS /
ONE_LINER, max 100 words.
