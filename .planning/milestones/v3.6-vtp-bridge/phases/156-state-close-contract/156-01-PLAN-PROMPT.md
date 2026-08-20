# P156 planning task — author 156-01-PLAN-LOCKED.md

You are the planner. You WRITE the plan file and VALIDATE it yourself. No source
changes in this task. You CANNOT spawn `claude` (EPERM); node works.

## Read first

1. `.planning/milestones/v3.6-vtp-bridge/phases/156-state-close-contract/CONTEXT.md`
   — authoritative scope: T1 state.write() primitive, T2 SUMMARY.md close-gate
   alignment (plan-review change 6 quoted verbatim there).
2. `super-gsd/tools/state-resolver/resolve.cjs` and
   `super-gsd/tools/state-resolver/decision-state.cjs` — the read side you must NOT
   merge into. state.write() is a new write-side tool.
3. `super-gsd/scripts/gsd-phase-boundary.sh` line 25 — the advisory echo that today is
   the only "enforcement".
4. `.planning/milestones/v3.6-vtp-bridge/phases/154-mcp-arg-contract/SUMMARY.md` and
   `.planning/milestones/v3.6-vtp-bridge/phases/155-propagation-readiness/SUMMARY.md`
   — the passing SUMMARY frontmatter shape T2 must encode.
5. `super-gsd/templates/plan-schema-v2.json` — your frontmatter contract.
6. `155-01-PLAN-LOCKED.md` as house style for real-data SACs.

## Plan shape guidance, not a straitjacket

Likely 2 tasks:
- T1 state.write(): new tool (suggested super-gsd/tools/state-write/write.cjs) with
  atomic tmp+rename, idempotent re-run, refuse-backwards-re-sync (consume resolver,
  do not reimplement), self-test with a red-then-green contractual run against a
  fixture STATE.md; wire the orchestrator close path and gsd-phase-boundary.sh:25.
- T2 close-gate alignment: gate script/check that refuses phase close when SUMMARY.md
  is absent or malformed (frontmatter: phase, slug, milestone, status, closed, commits,
  gates); falsifier exercises the ACTUAL close route both ways (refused without,
  passes with). Write-atomicity-only tests are explicitly insufficient.

Boundaries from CONTEXT: read-side untouched, no registry/renumber, every task
revertable, depends_on values are STRINGS. Real-data semantic_acceptance_criteria
per DLB-07/SCHEMA-09 — fixtures must be devcp-shaped where relevant (a phase closed
with AUDIT.md and no SUMMARY.md must be refused).

## Validate before you finish

    node super-gsd/tools/plan-schema/validate.cjs \
      --plan-file .planning/milestones/v3.6-vtp-bridge/phases/156-state-close-contract/156-01-PLAN-LOCKED.md \
      --project-dir . --mode write

Exit 0 required. Report: FILES_CHANGED / VERIFICATION / DEVIATIONS / BLOCKERS /
ONE_LINER, max 150 words.
