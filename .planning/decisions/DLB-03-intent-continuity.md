---
type: deliberation-memo
date: 2026-04-19
brief: .planning/briefs/2026-04-19-intent-continuity.md
board: [architect, pragmatist, contrarian, moonshot]
rounds: 2
vote: "4-0 CONVERGENT on structural-injection synthesis (Architect R2 pattern adopted by all)"
decision: "Ship outcome_delivered field + executor prompt injection + cascade CLAUDE.md rule as one Day 3 commit. Defer V-model, pre-mortem, runtime scoring gate. Accept Contrarian's content-quality kill condition."
---

# DLB-03: Intent Continuity — Structural Injection, Not Presence Checks

## Recommendation

Ship a **3-part minimal intervention** that maps Christopher Alexander / Commander's Intent / Hoshin Kanri onto concrete SGSD primitives without ceremony:

1. **Add `outcome_delivered:` field** to milestone INTENT artefact (`.planning/milestones/{id}/INTENT.md`). One-line product-outcome framing ("users can do X in ≤N clicks"), not a task description. Required; planner refuses milestone open without it.
2. **Structural injection into every executor prompt header.** The orchestrator's dispatch composition function reads the milestone's `outcome_delivered` and pastes it verbatim into every executor prompt header under an `<intent>` XML tag. No scoring, no regex check. Drift becomes opt-in because the context window enforces presence — a lazy author who writes "deliver value" gets that exact string injected into 50 dispatches, which surfaces the problem faster than any gate would catch.
3. **Cascade CLAUDE.md rule**: "Before planning any phase, read PROJECT.md core-value + milestone INTENT.md + last completed phase SUMMARY.md." Two lines, zero runtime cost, handles the read-side of intent continuity at session start.

**Explicitly deferred**: V-model traceability gate (no trace data exists yet — deferred to phase where it does), pre-mortem formalisation (Architect's stub idea deferred to when SUMMARY.md history is richer), runtime intent-score gate (Moonshot's 8h MVP deferred until 20-30 real dispatch pairs exist for threshold calibration).

**Content-quality kill condition** (from Contrarian): after one full milestone, measure whether injected `outcome_delivered` is actually referenced in executor deviations / verifier reports. If not — i.e. the field passed through as decoration — the intervention needs redesign, not more machinery.

## Board Stances — how the convergence happened

This was the cleanest deliberation of the three. Each agent moved significantly toward the others; the final synthesis came from Architect R2 and was implicitly accepted by all.

| Agent | R1 → R2 Shift |
|---|---|
| **Architect** | R1: ship INTENT block + prefix with hard-blocks. R2: abandoned presence-check as "theater", adopted Contrarian's outcome_delivered field, invented **structural injection** as the non-theatre enforcement primitive. Biggest shift of the session. |
| **Pragmatist** | R1: INTENT + prefix paired Day 3 drop (~4h). R2: staged — Contrarian's 2 changes first (1h), hard-block prefix added later with evidence. Conceded pre-mortem as 20-min add-on. Corrected Moonshot's effort estimate (16h not 8h for runtime gate). |
| **Contrarian** | R1: "hard-blocks are enforcement theater"; ship cascade only. R2: **withdrew** the CLAUDE.md-rule-only alternative as "worse theater" (soft instructions collapse under token pressure). Restricted the theater critique to content quality. **Proposed the kill condition.** |
| **Moonshot** | R1: runtime `intent_score()` gate blocking dispatches below 0.6. R2: honest retrenchment — ambitious version is 12-16h; without 20-30 calibration pairs a 0.6 threshold will false-positive on creative pivots. 8h MVP deferred. Accepted Pragmatist's "4h for 70% value wins today". |

**The convergence point** — Architect's **structural injection** — satisfies every agent's primary concern:
- Contrarian's "enforcement theater" critique: structural injection isn't a presence check, so it can't be gamed by writing "deliver value" to satisfy a regex. The content is *used*, not *verified*.
- Moonshot's "exogenous gate, agent can't rationalise past it": the prompt window IS the exogenous constraint. Every executor sees the outcome.
- Pragmatist's "what ships this week": injection is ~20 lines in the dispatch-composition function. Cheap.
- Architect's "structurally impossible drift": built in.

## Unresolved Tension — residual

**Content-quality enforcement**. Contrarian's sharpest remaining point: agents will write `outcome_delivered` fields to satisfy the schema, not to carry meaning. Structural injection amplifies good authorship but doesn't enforce it. No agent proposed a mechanism to detect "shallow outcome statements" — the closest thing is the kill condition: *after one milestone*, check whether the injected text was actually referenced in deviation reports.

This is accepted as an acknowledged gap, not a reason to defer. Fixing author discipline is a social problem, not an engineering one. Ship the engineering now; let the kill-condition metric pressure-test the authorship.

## Trade-offs Accepted

- **No runtime intent-scoring gate.** Moonshot's ambitious design is correct in spirit but requires calibration data that doesn't exist. Deferred until 20-30 dispatch pairs accumulate, at which point the 8h MVP can ship on validated threshold.
- **No V-model traceability gate.** Unanimous defer — bidirectional trace requires SUMMARY.md history richness that doesn't exist in pending phases (4, 5, 7, 8). Revisit post-v1.1.
- **No pre-mortem formalisation.** Architect's PRE-MORTEM.md stub idea is good but Pragmatist correctly noted: a pre-mortem written before trace data exists is a guess document. Wire it into the verifier dispatch (rule 7) once SUMMARY.md history exists.
- **Hard-block on INTENT presence deferred.** Pragmatist's staged approach: ship Contrarian's 2 changes (outcome_delivered field + CLAUDE.md cascade rule) + Architect's injection, measure one milestone, then decide on presence-check hard-blocks based on evidence. Silent-skipping failure mode may be moot once injection makes outcome omnipresent in every executor prompt.
- **Compile-time vs runtime inheritance.** Architect's structural injection makes this moot — outcome is pasted at dispatch, not validated at compile. If the outcome changes mid-milestone, subsequent dispatches see the new version. Conflict detection is explicit: phase plans that contradict the milestone outcome trigger `/sgsd-deliberate`, not a silent override.
- **First-phase cold start.** First phase of a milestone has no prior SUMMARY.md to cascade from. The cascade CLAUDE.md rule needs a documented skip path: "if no prior phase, reference milestone INTENT.md only" — 2 lines in the rule text, not a separate mechanism.

## Risks Acknowledged

- **Shallow outcome statements.** Contrarian's unresolved concern. *Mitigation*: Moonshot R2's `intent-log.jsonl` idea can be repurposed — log every injection, then after one milestone grep executor deviations to measure whether the injected text appears as a referenced constraint. If <50%, author discipline needs intervention (new skill, stricter template, or deliberation trigger).
- **Injection content bloat.** If `outcome_delivered` grows into a paragraph, every executor prompt eats 100+ tokens of repeated context. *Mitigation*: enforce a ≤120-character limit on the field via a lint rule in the planner.
- **Cross-DLB coupling.** DLB-03 references DLB-01's `sgsd-curate` (for outcome_delivered writes? no — writes are via plain Write of INTENT.md) and DLB-02's metrics logging (for the kill-condition measurement). Both dependencies are light but real — executing DLB-03 requires DLB-01's INDEX.md and DLB-02's install-blocker fixes first.
- **The combustion-engine metaphor isn't fully captured here.** The user's framing — Otto/Diesel/EFI refining generation-over-generation — implies *refinement*, not just intent propagation. This DLB ships intent propagation. Refinement (each phase starts from "last phase + what we learned") requires MUDA lessons (DLB-02) to be live, which is a separate precondition. Acknowledged as next-order work.

## Next Actions

### Day 3 (after DLB-02's install-blocker + MUDA write-path work)
- [ ] Create `.planning/milestones/v1.1/INTENT.md` with schema: `why`, `outcome_delivered` (≤120 chars), `milestone_ref`
- [ ] Backfill v1.1 INTENT.md from existing PROJECT.md content
- [ ] Write 20-line injection logic in `sgsd-orchestrate` dispatch composition function: read milestone INTENT.md once per phase, inject `<intent>{outcome_delivered}</intent>` into every executor prompt header
- [ ] Add 2-line cascade rule to `CLAUDE.md` (global or super-gsd/CLAUDE-OVERLAY.md): "Before planning any phase, read PROJECT.md core-value + milestone INTENT.md + last completed phase SUMMARY.md. For first phase of milestone, milestone INTENT.md only."
- [ ] Smoke-test against Phase 4 dry-run — verify outcome string appears in executor prompt
- [ ] Commit atomically: `feat(intent-continuity): outcome_delivered injection + cascade rule (DLB-03)`

### Kill-condition instrumentation
- [ ] `metrics/intent-log.jsonl` — append one line per dispatch logging the injected outcome text + dispatch ID
- [ ] At milestone close, `sgsd-intent-check.sh` greps executor deviation reports and verifier outputs for literal matches of injected outcome text; reports coverage %
- [ ] If coverage < 50% after one milestone: escalate — outcome_delivered content is decoration not signal; needs template tightening or author deliberation

### Deferred (evidence-gated)
- [ ] Hard-block on INTENT presence — after one milestone, if silent skipping resurfaces despite injection, add hard-block to planner
- [ ] Pre-mortem integration — after SUMMARY.md history richness reaches 3+ phases
- [ ] V-model traceability gate — after MUDA (DLB-02) produces structured trace data
- [ ] Runtime intent-score gate (Moonshot's 8h MVP) — after 20-30 real dispatch pairs exist for threshold calibration; log from day one to build this dataset

### Future-state (user's combustion-engine refinement goal)
- [ ] Each phase's planner pre-read step includes prior phase's `outcome_delivered` + MUDA findings + open deferrals — this is "refinement, not reinvention" operationalised
- [ ] Requires: DLB-01 live retrieval + DLB-02 findings populated + this DLB's INTENT.md cascade. All three must ship.

## Deliberation Metadata

- Agents: Architect, Pragmatist, Contrarian, Moonshot (all Sonnet)
- Rounds: 2
- Estimated cost: ~105k tokens across both rounds
- Phases affected: 5 (discuss-phase, plan-phase, execute-phase-via-prefix, verify-phase, + new continuity artefacts)
- Depends on: DLB-01 (memory tier), DLB-02 install-blocker fixes
- Blocks: nothing — but unlocks the "combustion-engine refinement" framing when paired with DLB-01 and DLB-02
