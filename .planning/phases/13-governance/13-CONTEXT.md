# Phase 13: Governance — Context

**Gathered:** 2026-04-22
**Status:** Ready for planning
**Scope note:** Expanded from original ROADMAP scope by operator directive to include a new `/sgsd-complete-milestone` skill with bidirectional VTP MCP integration. See D-16 below.

<domain>
## Phase Boundary

Final phase of v1.2 Evidence-First Sharpening. Turns the deliberate skill's board into a first-class registered resource and closes the milestone lifecycle loop.

Seven GOV requirements, plus an operator-directed scope expansion:

1. **GOV-01** — Escalate-not-spawn board with `board-members.yaml#escalation_policy`
2. **GOV-02** — Confidence-weighted vote synthesis (signed-sum threshold) + retro DLB-01..06 rescore validation
3. **GOV-03** — Decision memos require `## Falsifier` + `## Dead Ends` sections
4. **GOV-04** — Board roster resolved at runtime from `board-members.yaml`, not hardcoded in SKILL.md
5. **GOV-05** — Post-deliberation scoring audit (milestone-close hook → `.planning/metrics/deliberation-outcomes.jsonl`)
6. **GOV-06** — Board member responses become structured YAML with the 10-field schema
7. **GOV-07** — CEO post-synthesis reflection pass ("what blind spots did this deliberation have?")
8. **SCOPE+** — New `/sgsd-complete-milestone` skill: integrates GOV-05 audit, MUDA recurrence check, cross-phase integration check, and **bidirectional VTP MCP** (ingest prior articles as enrichment, publish milestone summary as research artifact). Replaces the existing milestone-close workflow with something that reflects the full SGSD 2.0 stack.

**Not in scope:** New board archetypes beyond Architect/Contrarian/Pragmatist/Moonshot. Running the new `/sgsd-complete-milestone` skill on v1.0/v1.1 retroactively (skill ships in v1.2; applies forward from milestone close). CEO agent redesign (reflection pass is a prompt-append, not a new agent type).
</domain>

<canonical_refs>
## Canonical References

- `.planning/REQUIREMENTS.md` GOV-01..GOV-07 — success criteria this phase must satisfy.
- `.planning/ROADMAP.md` §Phase 13 — the 7 Q7a-g sharpenings.
- `super-gsd/registry/board-members.yaml` (137 lines, `schema_version: 2`, `board_version: v1-static`, 4 members in `state: draft`) — activation + escalation_policy target for GOV-01/04.
- `super-gsd/skills/sgsd-deliberate/SKILL.md` (211 lines; hardcoded Architect/Contrarian dispatches at lines 103-112) — GOV-04 migration target.
- `super-gsd/templates/decision-memo.md` (50 lines) — GOV-03 + GOV-07 template extension target.
- `super-gsd/agents/sgsd-board-{architect,contrarian,moonshot,pragmatist}.md` — 4 board member agent definitions. GOV-06 updates their response schema.
- `.planning/decisions/DLB-01..06.md` — 6 prior decision memos. GOV-02 retroactive rescore targets.
- `super-gsd/skills/sgsd-orchestrate/SKILL.md` — milestone-close hook insertion point (though the new /sgsd-complete-milestone skill is primary).
- VTP MCP tools: `mcp__vtp-kb__vtp_research_brief`, `mcp__vtp-kb__vtp_ingest_research`, `mcp__vtp-kb__vtp_search`, `mcp__vtp-kb__wiki_search`, `mcp__vtp-kb__vtp_list_research` — bidirectional integration surface.
- `.planning/metrics/deliberation-outcomes.jsonl` (new) — GOV-05 output target.
- Existing `/sgsd-complete-milestone` skill (if any) in `~/.claude/skills/` or `.claude/skills/` — the new one supersedes it.
</canonical_refs>

<decisions>
## Implementation Decisions

### GOV-01 — Escalation Policy (D-01, D-02)

- **D-01** — **Structured vote-pattern rules** in `board-members.yaml#escalation_policy`. Machine-readable predicates (not CEO prose discretion). Format:
  ```yaml
  escalation_policy:
    add_pragmatist:
      trigger: "any(m.role=='Contrarian' AND m.position=='OPPOSE' AND m.confidence>=4)"
      reason: execution-feasibility dissent
    add_moonshot:
      trigger: "count(unique(m.position))==1 AND size(board)>=2"
      reason: consensus-risk (groupthink)
  ```
- **D-02** — Predicates parse via the same structured-clause evaluator as Phase 10's `predicate-eval.cjs` (reuse the pattern). Extend the evaluator's operator set if needed (`count`, `any`, `unique`, field access on array members). New operators are additive — don't break Phase 10's gates.yaml triggers.

### GOV-02 — Confidence-Weighted Synthesis (D-03, D-04)

- **D-03** — **Signed-sum threshold formula.** Each member self-rates 1-5 confidence on their position. CEO sums: `SUPPORT = +confidence, OPPOSE = -confidence, ABSTAIN = 0`. Decision:
  - `sum > 0`: SUPPORT (confidence-weighted)
  - `sum < 0`: OPPOSE
  - `sum == 0`: CEO breaks tie with explicit rationale
- **D-03a** — Ties noted as `VOTE_TIE` in memo header; CEO tiebreak logged separately from the member tally so future auditing can distinguish "unanimous machine decision" from "CEO judgment call."
- **D-04** — Implementation: a new helper `super-gsd/scripts/lib/vote-synthesis.cjs` exposes `synthesize(members) → { decision, sum, tiebreaker_applied, raw_votes }`. Pure function; ~40 LOC. Called from the CEO synthesis section in sgsd-deliberate SKILL.md.

### GOV-02 Retroactive Rescore (D-05)

- **D-05** — **Re-dispatch each board agent on the ORIGINAL brief** of DLB-01..06 with the new rubric (self-rate 1-5 confidence). Produces empirically-grounded confidences rather than inferred-from-prose. Cost: 6 DLBs × 4 agents = 24 sub-agent dispatches at Sonnet. Budget: ~50k tokens. Output: `DLB-NN-RESCORE.md` alongside each original DLB.
- **D-05a** — Each rescore writes:
  ```yaml
  original_vote: "{from DLB-NN frontmatter}"
  original_decision: "{SUPPORT|OPPOSE}"
  rescored:
    members: [{role, position, confidence, rationale_summary}]
    signed_sum: N
    new_decision: SUPPORT | OPPOSE | TIE
    diverges_from_original: bool
    notes: "why the rescore changed (or didn't) the decision"
  ```
- **D-05b** — If ≥2 of 6 DLBs diverge, flag as "formula calibration concern" — operator reviews whether signed-sum is the right shape or needs tuning. Diverge-count is empirical evidence for the formula's adoption worth.

### GOV-03 — Decision Memo Template Extension (D-06)

- **D-06** — `super-gsd/templates/decision-memo.md` gains two new sections (between "Unresolved Tensions" and the implementation plan):
  - `## Falsifier` — "What concrete evidence would prove this decision wrong? If that evidence shows up, reopen the decision."
  - `## Dead Ends / Paths Ruled Out` — "Approaches considered and rejected during deliberation. Link to the reasoning."
- **D-06a** — CEO synthesis rubric updated to EXPLICITLY produce these sections. A memo without a falsifier is a memo without skin in the game.

### GOV-04 — Runtime Board Roster Resolution (D-07, D-08)

- **D-07** — Board members resolved at deliberation-start from `super-gsd/registry/board-members.yaml`. `gates-registry.cjs` pattern is the template — new `super-gsd/scripts/lib/board-registry.cjs` exposes `{ loadBoard, getMember, resolveRoster(brief) }`. ~50 LOC. Cached singleton like gates-registry.
- **D-08** — `sgsd-deliberate/SKILL.md` lines 103-112 (hardcoded Architect + Contrarian Agent() dispatches) rewrite to iterate over `boardRegistry.resolveRoster(brief)`. The iteration respects the escalation_policy: minimal-2 roster first (Architect + Contrarian), then check escalation predicates after first-round results, optionally add Pragmatist/Moonshot for second round.
- **D-08a** — `board_version` in board-members.yaml flips from `v1-static` to `v2-runtime-resolved` when this plan lands. Members' `state: draft` flips to `active`.

### GOV-05 — Post-Deliberation Scoring Audit (D-09 through D-11)

- **D-09** — Milestone-close scoring audit reads every DLB-NN fired since the prior milestone close and writes one row per DLB to `.planning/metrics/deliberation-outcomes.jsonl`:
  ```json
  {
    "ts": "{ISO}",
    "milestone": "v1.2",
    "dlb_id": "DLB-07",
    "q1_impl_hours_actual": N,
    "rework_fired": bool,
    "falsifier_fired": bool,
    "revisions_needed": N,
    "confidence_weighted_sum": N,
    "raw_vote": "X-Y"
  }
  ```
- **D-10** — "rework_fired" inference: scan phase commits since DLB for `fix(` / `refactor(` messages that cite the DLB. "falsifier_fired" inference: check DLB's `## Falsifier` section against phase artifacts — did the evidence that would prove it wrong appear? "revisions_needed" counts DLB-NN-REVISION-* files if any.
- **D-11** — q1_impl_hours_actual comes from `git log --format=%aI` on commits tagged to the DLB's scope; estimate as time between first impl commit and last. Rough — good enough for calibration signal, not a contract.

### GOV-06 — Structured YAML Responses + Rubric Synthesis (D-12, D-13)

- **D-12** — Board member responses become structured YAML matching this 10-field schema:
  ```yaml
  position: SUPPORT | OPPOSE | ABSTAIN
  confidence: 1 | 2 | 3 | 4 | 5
  risks_raised: [list]
  evidence_cited: [list]
  falsifier: "what would prove my position wrong"
  implementation_concerns: [list]
  known_deadends: [list]
  intuition: "gut read, even without formal evidence"
  why_principled: "the core principle anchoring my position"
  rationale: "prose — why I vote this way, in context"
  ```
- **D-12a** — Implementation: each of the 4 board agent files (`super-gsd/agents/sgsd-board-*.md`) updates its output-format section to require this schema. CEO synthesis (in `sgsd-deliberate/SKILL.md`) becomes rubric-driven: aggregate each field across members into the memo rather than paraphrasing prose.
- **D-13** — `super-gsd/scripts/lib/deliberation-schema.cjs` validates parsed YAML responses against the 10-field schema. Malformed responses fail loudly (per Phase 10 D-10c pattern); CEO halts and requests a re-emit.

### GOV-07 — CEO Post-Synthesis Reflection (D-14, D-15)

- **D-14** — After writing the memo's Recommendation, Board Stances, Unresolved Tensions, Falsifier, Dead Ends sections, CEO runs a reflection pass. Prompt: "Review your synthesis. What blind spots did this deliberation have? What archetype voices might we have missed? What did the rubric force to the foreground that might NOT matter?"
- **D-14a** — Reflection is appended as `## Post-Synthesis Reflection` section in the memo footer. NOT a separate Agent() dispatch — same CEO-orchestrator context completes the reflection after synthesis. Adds ~200 tokens to the CEO cost budget per deliberation.
- **D-15** — Reflection content is cross-fed to GOV-05: when the scoring audit parses a DLB, it checks the reflection section for content (> 50 chars prose) and logs `reflection_captured: true | false` into the outcome row. Reflection absence is a GOV-07 adherence fail.

### Scope+ — New `/sgsd-complete-milestone` Skill (D-16, D-17, D-18, D-18a, D-18b)

- **D-16** — **New skill: `.claude/skills/sgsd-complete-milestone/SKILL.md`** (sgsd-* prefix per operator correction and per the rename rule: genuinely new skill, v2-native, no v1 predecessor). Supersedes any existing milestone-close workflow. Core responsibilities:
  1. Verify all milestone phases have `[x]` in ROADMAP.md (hard precondition)
  2. Run GOV-05 deliberation scoring audit → write `.planning/metrics/deliberation-outcomes.jsonl`
  3. Run MUDA recurrence check per DLB-02 (`sgsd-muda-recurrence.sh`) → flag skill retirement candidates
  4. Run cross-phase integration check (gsd-integration-checker) → confirm no regressions across the milestone
  5. Generate milestone summary artifact at `.planning/milestones/{version}/SUMMARY.md`
  6. **VTP bidirectional** with NEW `Milestone` classification (per operator correction — not an article):
     - **Ingest (before summary):** `mcp__vtp-kb__vtp_search` and `mcp__vtp-kb__vtp_list_research` with `type: Milestone` filter (if supported) to pull prior milestone artifacts + adjacent research as enrichment. Fall back to untyped search if type filter unsupported and document the gap.
     - **Publish (after summary):** `mcp__vtp-kb__vtp_ingest_research` with `classification: Milestone` (or equivalent field name the VTP API accepts). If VTP MCP does NOT currently support a `Milestone` classification, the skill:
       (a) pushes the summary with best-available classification,
       (b) writes `.planning/milestones/{version}/VTP-CLASSIFICATION-GAP.md` enumerating exactly which VTP API change is needed,
       (c) tags the published item with a `milestone_v1.x` string in whatever metadata field IS writable so future queries can retrieve it.
     - Researcher in plan 13-05 must confirm in 60s which VTP MCP method accepts classification metadata and document the exact call shape.
  7. Archive milestone dir (move `.planning/phases/` items to `.planning/milestones/{version}/phases/`)
  8. Bump STATE.md to next milestone OR set `milestone_status: complete` if final

- **D-18a** — **Auto-trigger from the orchestrator loop** (per operator correction). `sgsd-orchestrate` SKILL.md Rule 6.g currently handles "verification passed → mark phase complete." Extend the post-mark-complete path:
  ```
  After Rule 6.g marks the last phase of a milestone complete:
    Check: do all milestone phases in ROADMAP.md show [x]?
      NO  → Continue to next phase per existing dispatch rules.
      YES → Auto-dispatch sgsd-complete-milestone (no operator prompt).
  ```
  Auto-trigger runs inside the sgsd-orchestrate loop just like any other Agent() dispatch — TaskCreate wrapper, bypassPermissions mode, report parsed on return. The skill itself remains idempotent (running twice on the same milestone is a no-op with PASS exit), so re-entry during resume is safe.

- **D-18b** — **VTP classification resilience.** Since `Milestone` may not yet exist as a VTP taxonomy entry, the publish path has three behaviours:
  - **If Milestone classification exists** (researcher confirms): publish cleanly with that type. Record `vtp_classification_used: Milestone` in the milestone SUMMARY frontmatter.
  - **If Milestone does NOT exist but VTP supports arbitrary string classifications:** publish with `classification: "Milestone (SGSD v2)"` and record `vtp_classification_used: "Milestone (string)"` in frontmatter. Ship a `VTP-CLASSIFICATION-GAP.md` describing the schema update needed on VTP side.
  - **If VTP only accepts fixed classifications without "milestone" option:** publish with best-fit existing type (likely "research" or "brief"), tag metadata `sgsd_type: milestone`, ship `VTP-CLASSIFICATION-GAP.md` with urgency HIGH since our round-tripping breaks without a real Milestone type.
- **D-17** — **Integration with SGSD 2.0 stack** — the new skill leverages:
  - **v2 plan schema** (Phase 11): precondition gate — all milestone plans must have `schema_version: 2` frontmatter OR a documented `v1_legacy: true` flag
  - **Phase 10 gates.yaml** enforcement: milestone close fails if any gate is in `state: known-gap` without an operator-accepted waiver
  - **Phase 12 classifier-cache**: cache is invalidated at milestone close (plans are archived, sidecar cleaned)
  - **Phase 12 checkpoint template**: final checkpoint before archive captures the milestone's `rules_learned_this_session` and seeds next milestone's cold start
  - **Phase 10 edge-guard**: milestone close reads `.planning/metrics/edge-guard-log.jsonl` — if any gate was repeatedly skip-drifted during the milestone (same gate missed >3 times), flag as governance concern in the summary
- **D-18** — Skill output contract:
  ```
  .planning/milestones/{version}/
    SUMMARY.md              — human-readable milestone retrospective
    deliberation-outcomes.jsonl  — GOV-05 rows
    muda-recurrence.md      — DLB-02 recurrence check output
    gate-drift-audit.md     — edge-guard log summary
    phases/                 — archived phase dirs
    vtp-research-id.txt     — ID returned from vtp_ingest_research for round-tripping
  ```

### Plan Decomposition (D-19 through D-21)

- **D-19** — Seven plans (validated post-Phase 12 PARALLEL_CONFIRMED spike that Wave 1 true-parallel is feasible):
  - **13-01** — board-members.yaml activation + escalation_policy + board-registry.cjs (GOV-01 + GOV-04)
  - **13-02** — vote-synthesis.cjs signed-sum formula (GOV-02 formula)
  - **13-03** — 4 board agent response-schema updates + rubric-driven CEO synthesis + deliberation-schema.cjs validator (GOV-06)
  - **13-04** — decision-memo.md template extension: `## Falsifier` + `## Dead Ends` + `## Post-Synthesis Reflection` (GOV-03 + GOV-07)
  - **13-05** — New /sgsd-complete-milestone skill with bidirectional VTP integration + GOV-05 audit + MUDA recurrence + cross-phase check (D-16 scope expansion)
  - **13-06** — Retro DLB-01..06 rescore validation (GOV-02 validation) — depends on 13-02 + 13-03
  - **13-07** — Phase 13 verify.mjs + full-suite close (all 4 phase verifiers green: 09, 10, 12, 13)
- **D-20** — **Wave model** (leveraging Phase 12 PARALLEL_CONFIRMED):
  - **Wave 1 parallel** `{13-01, 13-04, 13-05}` — files disjoint: board-members.yaml / decision-memo.md template / new skill file
  - **Wave 2** `{13-02}` — touches sgsd-deliberate SKILL.md (serial after 13-01 which also touches it)
  - **Wave 3** `{13-03}` — touches 4 agent files + sgsd-deliberate SKILL.md (serial after 13-02)
  - **Wave 4** `{13-06}` — depends on 13-02 (formula) + 13-03 (structured responses); runs retro rescore
  - **Wave 5** `{13-07}` — verify.mjs + full suite + SUMMARY
- **D-21** — Phase 13 ships own `.planning/phases/13-governance/verify.mjs` with ≥10 invariants covering GOV-01..07 + the new skill file existence + the VTP integration call signature + retro rescore output files.

### Out of Scope (D-22)

- **D-22** — Explicit exclusions:
  - New board archetypes (Visionary, Skeptic, etc.) — deferred to post-v1.2
  - CEO agent redesign — reflection pass is prompt-append, not new agent
  - Retroactively running the new /sgsd-complete-milestone skill on v1.0 or v1.1 — applies forward from v1.2 close
  - VTP-side schema changes (assumes VTP MCP tools accept our summary shape as-is)
  - Confidence auto-tuning based on outcome data — manual for v1.2, automate post-v1.3
  - Scoring formula alternatives (Bayesian, weighted-majority) — signed-sum locked for v1.2
  - IN-03 distribution gap (still deferred to its own infra phase)
</decisions>

<specifics>
## References Used

- **Phase 10 predicate-eval.cjs** — D-02 reuses the structured-clause evaluator pattern for escalation predicates.
- **Phase 10 gates-registry.cjs** — D-07 board-registry.cjs mirrors this cached-singleton pattern.
- **Phase 12 PARALLEL_CONFIRMED spike** — D-20 Wave 1 true parallelism validated.
- **Phase 9 verdict_pointer pattern** — D-05 retro rescore surfaces original-vs-rescored comparison in the same form.
- **Phase 11 v2 schema** — D-17 milestone-close precondition requires v2 schema adoption across milestone plans.
- **DLB-02 MUDA recurrence** — D-16 integrates the existing recurrence-check script.
- **DLB-03 INTENT injection** — D-14 reflection pass is a structural append pattern in the same spirit.
- **Phase 12 WR-A (installer confirm step)** and **WR-B (typed-error catch)** remain deferred — Phase 13 does NOT pick these up.
</specifics>

<deferred>
## Deferred Ideas

- **Board archetype discovery** — Q7d+ follow-up: discover new archetypes empirically (e.g., SEPL proposes a Regulator for compliance-heavy decisions). Post-v1.2.
- **Confidence auto-calibration** — after GOV-05 accumulates N outcomes, auto-tune the signed-sum threshold based on forecast-vs-actual accuracy. Post-v1.3.
- **Per-project board-members.yaml** — projects extend super-gsd's default board with domain specialists. Infrastructure need; Phase 14+.
- **VTP integration for intra-phase research briefs** — not just milestone-close. Could ingest VTP context at phase discuss-time too. Deferred; measure utility of milestone-close first.
- **Board visualization dashboard** — render deliberation-outcomes.jsonl as a calibration chart. Nice-to-have; not needed for v1.2.
</deferred>

<next_steps>
## Next Steps

1. **Run `/gsd-plan-phase 13`** — generates 7 plans per D-19. Wave model per D-20.
2. **Run `/sgsd-orchestrate go`** (or `/gsd-execute-phase 13`) — Wave 1 truly parallel (3 plans), Waves 2-5 serial.
3. **Milestone close:** after Phase 13 ships and the orchestrator marks its phase complete, `sgsd-orchestrate` auto-detects "all milestone phases [x]" and auto-dispatches `/sgsd-complete-milestone v1.2` (no operator prompt per D-18a). The skill generates the v1.2 retrospective, publishes to VTP with classification `Milestone`, archives phase dirs, bumps STATE.md to next milestone. Operator can run manually with `/sgsd-complete-milestone {version}` if needed — the skill is idempotent.

Phase 13 success criteria (from ROADMAP):
- GOV-01..07 all green
- board-members.yaml `state: active`, `board_version: v2-runtime-resolved`
- Retro DLB-01..06 rescored with signed-sum formula; divergence rate documented
- New /sgsd-complete-milestone skill functional with bidirectional VTP integration
- Phase 13 verify.mjs green, full suite (09+10+12+13) green
</next_steps>
