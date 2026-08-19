# P155 planning task — author 155-01-PLAN-LOCKED.md

You are the planner for ONE phase. You WRITE the plan file and VALIDATE it yourself.
Do not modify any source code in this task — the deliverable is the plan document only.

## Environment constraint

You CANNOT spawn `claude` (spawn EPERM, confirmed repeatedly). Nothing in this task
needs it. Node is available.

## Read first, in this order

1. `.planning/milestones/v3.6-vtp-bridge/phases/155-propagation-readiness/CONTEXT.md`
   — the authoritative scope. Six tasks T1-T6, with T4 split into T4/T4b/T4c. Every
   claim in it was verified against source this session; line numbers are real.
2. `.planning/milestones/v3.6-vtp-bridge/phases/155-propagation-readiness/155-VTP-ENRICHMENT.md`
3. `.planning/decisions/2026-08-19-canonical-work-identity-MEMO.md` and its ADDENDUM —
   the governing decision and its boundaries (no registry, no alias map, no renumber,
   D7 deferred).
4. `super-gsd/templates/plan-schema-v2.json` — the schema your frontmatter must satisfy.
5. The defect sites named in CONTEXT: `super-gsd/tools/state-resolver/resolve.cjs`
   (lines 329, 349, 356, 473), `super-gsd/install.sh` (467, 572),
   `super-gsd/scripts/sgsd-conformance-check.sh:61`,
   `super-gsd/scripts/sgsd-agent-dashboard.sh:208`,
   `super-gsd/scripts/sgsd-distill-milestone.sh:101`,
   `super-gsd/tools/phase-verifier/phase-verifier.mjs:157`,
   `super-gsd/tools/phase-folder-audit/audit.cjs` (the copyable dual-root pattern),
   `super-gsd/config/repo-settings-overlay.json`, `super-gsd/config/claude-ups-overlay.json`,
   `super-gsd/hooks/sgsd-intent-classifier.cjs` (route predicates for T6).

## Deliverable

Write `.planning/milestones/v3.6-vtp-bridge/phases/155-propagation-readiness/155-01-PLAN-LOCKED.md`:

- YAML frontmatter conforming to plan-schema-v2.json: `schema_version: 2`, `tasks[]`
  each with id/agent/model/files_touched/input_contract/output_contract/hypothesis/
  falsifier/stop_rule, plus top-level `semantic_acceptance_criteria` (SCHEMA-09) where
  every entry is a real-data claim with a runnable `verification_cmd` — no structural
  greps standing in for behaviour.
- Tasks map to CONTEXT's T1, T2, T3, T4, T4b, T4c, T5, T6. Order them by dependency:
  T4b (resolver phase model) must land BEFORE T4 wires consumers to the resolver —
  wiring first would propagate confident wrongness, which is the devcp finding.
- T4b's semantic AC must use a fixture replicating devcp's shape: flat layout, v-named
  and decimal phases mixed with legacy integers — resolver returns the v-scheme active
  phase, never the highest legacy integer, never a backwards re-sync recommendation.
- T1's AC: after unifying the overlay, `assert-registration.cjs` and the six
  `assert-live-dispatch.cjs` modes still pass (the orchestrator runs the live ones).
- Every task independently git-revertable. Serial Codex execution.
- Respect the boundaries verbatim: no registry, no alias map, no renumbering, no
  archiving legacy trees, no new automatic MCP invocations, D7 deferred.

## Validate before you finish

Run:

    node super-gsd/tools/plan-schema/validate.cjs \
      --plan-file .planning/milestones/v3.6-vtp-bridge/phases/155-propagation-readiness/155-01-PLAN-LOCKED.md \
      --project-dir . --mode write

Exit 0 is required. If it exits 1, fix the frontmatter and re-run. Do not report DONE
with a failing validation.

## Report format, exactly this, max 250 words, no preamble

```
FILES_CHANGED: path (created|modified)
VERIFICATION: `cmd` exit N pass|fail
DEVIATIONS: [constraint] description | none
BLOCKERS: description | none
ONE_LINER: substantive summary
```
