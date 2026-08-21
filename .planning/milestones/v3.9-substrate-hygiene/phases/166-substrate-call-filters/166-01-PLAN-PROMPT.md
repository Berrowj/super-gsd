# P166 planning task — author 166-01-PLAN-LOCKED.md

You are the planner. You WRITE the plan file and VALIDATE it yourself. No source
changes. Node works; no claude spawning (EPERM).

## Read first

1. `.planning/milestones/v3.9-substrate-hygiene/phases/166-substrate-call-filters/CONTEXT.md`
   — authoritative scope (F1 megachunk landmine, F2 unfiltered callers, T1/T2,
   the ingest-side fix explicitly OUT).
2. Find every vtp_search_substrate caller in super-gsd: grep agents/, skills/,
   scripts/ (known: sgsd-vtp-enrichment agent, gsd-phase-researcher, gsd-planner,
   sgsd-board-researcher prompts; sgsd-triage-runtime.cjs already filtered;
   vtp-context-composer.cjs if it composes substrate calls).
3. `super-gsd/schemas/vtp-mcp-input-schemas.v1.json` + the P154 shaper in
   sgsd-triage-runtime.cjs — the enforcement seam: the declared schema for
   vtp_search_substrate can REQUIRE source_types + bounded limit so an
   unfiltered emission fails conformance.
4. `super-gsd/scripts/lib/vtp-context-composer.cjs` — the composer the
   sgsd-vtp-advise path uses; a shared policy helper belongs here or beside it.
5. `super-gsd/templates/plan-schema-v2.json`; P160-P163 plans as house style.

## Plan shape guidance

Likely 2 tasks per CONTEXT: (T1) one shared substrate-call policy (source_types
by intent family + bounded limit) consumed by every caller — agent prompt texts
updated to instruct the filter AND the schema/conformance seam tightened so
unfiltered emissions fail; (T2) defensive per-hit payload cap with
truncate-and-flag naming the oversized doc in the degraded note, never a failed
artifact. Real-data SACs: a fixture response containing a 900k+ char chunk must
produce a degraded-note artifact, not a failure; the conformance test must
refuse a substrate emission lacking source_types. Boundaries: no VTP-repo
changes; no relaxation of P152/P154 contracts; every task revertable;
depends_on STRINGS.

## Validate before you finish

    node super-gsd/tools/plan-schema/validate.cjs \
      --plan-file .planning/milestones/v3.9-substrate-hygiene/phases/166-substrate-call-filters/166-01-PLAN-LOCKED.md \
      --project-dir . --mode write

Exit 0 required. Report: FILES_CHANGED / VERIFICATION / DEVIATIONS / BLOCKERS /
ONE_LINER, max 150 words.
