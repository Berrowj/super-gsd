---
phase: "166"
slug: substrate-call-filters
milestone: v3.9-substrate-hygiene
status: ACTIVE
opened: 2026-08-21
depends_on: []
source: Clarity instance VTP report 2026-08-21 (F1 megachunk landmine, F2 unfiltered callers)
---

# P166 Context (seed) — Substrate Call Filters

## Defects (verified live on Clarity)

- F1: wiki/LINT-REPORT.md ingested as ONE 949,815-char chunk; machine-generated
  slug list contains nearly every vocabulary word, takes lexical rank 1 on
  almost any query; an unfiltered limit:5 substrate call returned 960,867 chars
  and failed on the token cap. Mitigation verified: source_types filter dropped
  the payload to ~12k with better results.
- F2: of eight vtp_search_substrate callers, only sgsd-triage-runtime.cjs
  passes source_types. Unfiltered: the VTP enrichment gate,
  gsd-phase-researcher, gsd-planner, sgsd-board-researcher — each one unlucky
  query from a failed enrichment artifact mid-phase.

## Scope

- T1: every super-gsd substrate call site (agent prompts + any composer,
  vtp-context-composer.cjs, enrichment gate) passes explicit source_types
  appropriate to its intent AND a bounded limit; a shared helper/policy in one
  place, not four copies. The P154 declared input schemas are the seam: extend
  the emission contract so an unfiltered substrate call fails conformance.
- T2: defensive payload cap — callers truncate-and-flag any single hit above a
  sane per-chunk ceiling rather than failing the artifact, with the oversized
  doc named in the degraded note.
- OUT: removing/fixing LINT-REPORT.md at ingest is a VTP-host change
  (operator-side; the report recommends removal or chunk-splitting at ingest).

## Also carried from that report

Herman Van Driel's design-fee statements (Luke closes design fees; commission
in lieu of sales commission) are business signal for the Clarity fee spine,
already in the KB — operator routes that, not super-gsd.
