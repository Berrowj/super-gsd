# P156-T1B — production deadlock fix: seeded future dirs must not block forward close

You are the implementer. Fresh context. Node works; no `claude` spawning. Do NOT
commit. Scope is EXACTLY write.cjs + assert-state-write.cjs. Resolver files are
untouchable.

## The defect (reproduced live, first production use)

`node super-gsd/tools/state-write/write.cjs --event-json '{"event":"phase-close",...,"evidence_phase":"156","current_phase":"157",...}'`
refused with `evidence_ahead` (resolved_phase 159) in THIS repo, because
phases 157/158/159 exist as seeded directories (CONTEXT.md only, frontmatter
status PENDING, no PLAN-LOCKED, no SUMMARY) and the resolver's phase_folders tier
(confidence 0.7, phase_status "in-progress", conflicts naming state_md at 156)
resolves the HIGHEST folder. write.cjs:435 refuses whenever
`resolvedAt.index > evidenceAt.index`, so no forward close can EVER pass while a
later seed exists. That is the "deadlock every future close" blast-radius risk the
P155 plan review named.

## The contract you must preserve (amended SAC-2 stays red-proof)

The refusal exists to stop BACKWARDS re-sync: STATE projection at v30-08 while
stronger resolver evidence AND the incoming event are at v30-07 must still refuse
non-zero (projection_ahead) with byte-identical STATE. Do not weaken that case.

## The fix direction (yours to implement cleanly)

Distinguish evidence-backed "ahead" from seed-inflated "ahead" WITHOUT copying
resolver internals or editing resolver files. Acceptable inputs: the resolver
result's fields (source, confidence, phase_status, conflicts, stale_sources) plus
cheap direct checks write.cjs may make itself (e.g. the resolved-ahead phase's
directory lacking any of PLAN-LOCKED/SUMMARY/close evidence, or its CONTEXT
frontmatter status PENDING). Rules:
- Backwards event (requested/current_phase behind the STATE projection or behind
  evidence-backed resolver truth): refuse, unchanged.
- Forward event whose evidence_phase matches the STATE projection, where the only
  "ahead" signal is folder-tier resolution of a phase with no substantive
  execution evidence: proceed, but include the classification in the success
  envelope (e.g. resolver_ahead_discounted: {phase, reason}) so nothing is silent.
- Ahead signal that IS evidence-backed (the ahead phase has SUMMARY or PLAN-LOCKED
  + commits-shaped evidence): still refuse evidence_ahead.

## Tests (extend assert-state-write.cjs)

1. NEW fixture: seeded-future-dirs — closing phase N with CONTEXT-only dirs at
   N+1..N+3 succeeds forward (STATE advances), envelope carries the discount
   classification. Record it failing against current write.cjs (red) in your report.
2. NEW fixture: evidence-backed-ahead — an ahead dir WITH a SUMMARY.md refuses.
3. All existing cases stay green: atomic-idempotent, refuse-backwards,
   refuse-ambiguity, orchestrator-hook-wire.

## Verify before reporting

    node super-gsd/tests/state-close-contract/assert-state-write.cjs --case all

Report: FILES_CHANGED / VERIFICATION (RED for fixture 1 preserved) / DEVIATIONS /
BLOCKERS / ONE_LINER, max 200 words.
