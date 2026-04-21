# Roadmap: Super GSD Framework

## Milestones

- ✅ **v1.1 Self-Audit** — Phases 1-8 (shipped 2026-04-21) — [archive](milestones/v1.1-ROADMAP.md)
- 📋 **v1.2 Evidence-First Sharpening** — Phases 9-13 (scoping → planning)

## Phases

<details>
<summary>✅ v1.1 Self-Audit (Phases 1-8) — SHIPPED 2026-04-21</summary>

- [x] Phase 1: Token Foundation and Hook Wiring — 2/2 plans
- [x] Phase 2: Memory Layer — 2/2 plans
- [x] Phase 3: Orchestrator Engine — 3/3 plans
- [x] Phase 4: ATC Quality Gates — 2/2 plans
- [x] Phase 5: Strategic Deliberation — 2/2 plans
- [x] Phase 6: Overwatcher and Monitoring — 1/1 plan
- [x] Phase 7: Integration and Installation — 2/2 plans
- [x] Phase 8: SGSD Self-Audit — audit + ATC LITE + 6/6 verifier + evidence L1/L2 PASS

Full details: [milestones/v1.1-ROADMAP.md](milestones/v1.1-ROADMAP.md)

</details>

### 📋 v1.2 Evidence-First Sharpening (Phases 9-13)

Per `.planning/decisions/2026-04-21-sgsd-v2-retro.md` RQ4 (v1.2-B sequencing):
ATC-147-evidence → Q2-gate-policy → Q3-plan-schema → Q6-machinery → Q7-governance.

**Summary checklist:**

- [ ] **Phase 9: ATC-147-Evidence** — Retroactive ATC on external project-clarity-erp Phase 147 produces empirical finding count + 9-gate-bypass audit with token-cost estimates
- [ ] **Phase 10: Gate Policy** — Per-gate keep/kill/conditional matrix landed in `registry/gates.yaml` + edge-guard enforcement layer catches silent skip-drift
- [x] **Phase 11: Plan Schema v2** — Canonical YAML-frontmatter plan schema at `templates/plan-schema-v2.json` with enforced required/optional fields and v1 classifier fallback (SHIPPED 2026-04-21 — 6 plans / 18 commits; PASS after 11-06 gap closure: WR-01..05 + IN-01 all closed, 0 ATC warnings remain; IN-03 distribution gap deferred to Phase 12+)
- [ ] **Phase 12: Machinery** — Orchestrator Q6a-d sharpenings: classifier-skip, parallel/sequential auto-dispatch, checkpoint schema expansion, adversarial verifier sampling
- [ ] **Phase 13: Governance** — Deliberate-skill Q7a-g sharpenings: escalate-not-spawn board, confidence-weighted votes, falsifier memos, board-as-resource, post-deliberation scoring, structured responses, CEO reflection pass

## Phase Details

### Phase 9: ATC-147-Evidence

**Goal:** Close the evidence gap from Phase 147's silent-gate-skip by running a retroactive ATC review and a bypass-cost audit, producing the empirical finding count that Phase 10's keep/kill matrix will key against.

**Depends on:** External `project-clarity-erp` Phase 147 retroactive ATC landing in that repo (out-of-scope-to-this-repo execution). This phase is SCOPED now; execution deferred until the external dep is unblocked. Operator must verify `project-clarity-erp/.planning/phases/147-clarity-relay-map-w1/147-ATC-REVIEW.md` exists before dispatching Phase 9 plans.

**Requirements:** ATC-147-01, ATC-147-02, ATC-147-03

**Success Criteria** (what must be TRUE when this phase completes):
1. A retroactive ATC review exists at `project-clarity-erp/.planning/phases/147-clarity-relay-map-w1/147-ATC-REVIEW.md` with every finding classified as real-bloat / nit / false-positive (ATC-147-01).
2. The v1.2 milestone's evidence registry cross-links to that external review file via a relative or operator-resolvable path (ATC-147-02).
3. A gate-bypass audit enumerates the 9 CLAUDE-OVERLAY gates Phase 147 skipped (Haiku classifier, context-selector, ByteRover query, INTENT injection, per-dispatch ATC, phase-level ATC, MUDA, sgsd-curate, token-log) with a token-cost estimate per gate (ATC-147-03).
4. The finding count is surfaced in a form Phase 10 can consume (a single number keyed against the ≥3 / 1-2 / 0 thresholds from the parent brief's Q2 proposal).

**Plans:** TBD

---

### Phase 10: Gate Policy

**Goal:** Convert the Phase 9 empirical finding count into an enforceable, per-gate keep/kill/conditional matrix, landed as YAML registry (not prose), and wire an edge-guard layer that catches the Phase-147-style silent skip-drift going forward.

**Depends on:** Phase 9 (needs finding count from ATC-147-01 to fill the matrix's empirical-trigger column).

**Requirements:** GATE-01, GATE-02, GATE-03, GATE-04

**Success Criteria** (what must be TRUE when this phase completes):
1. Every CLAUDE-OVERLAY gate has a row in the decision matrix declaring it HARD-HALT / SOFT-WARN / CONDITIONAL with the empirical trigger (finding count from Phase 9) explicit per row (GATE-01).
2. `super-gsd/registry/gates.yaml` exists and encodes per-gate enforcement mode for both per-dispatch Step 9.5 and phase-level Step 6.5 — read by sgsd-orchestrate at dispatch time, not parsed from prose (GATE-02).
3. Every non-ATC gate in the loop (classifier Step 2, context-selector Step 4, ByteRover Step 5, INTENT Step 5.5, MUDA Step 6.55, sgsd-curate Step 10, token-log Step 11) has an explicit keep/kill/conditional verdict recorded, backed by matrix entries (GATE-03).
4. An edge-guard enforcement layer emits `.planning/metrics/edge-guard-log.jsonl` rows on every step transition with `{from_step, to_step, missing_emits, context, resolution}`, and skipped gates that the matrix says should have fired trigger rollback or halt per their enforcement mode (GATE-04).

**Plans:** TBD

---

### Phase 11: Plan Schema v2

**Goal:** Publish the canonical v2 plan schema as YAML frontmatter, enforce required task fields at plan-load, support documented optional fields with defaults, and establish a backward-compatible fallback so the 146 existing v1 plans keep running unchanged.

**Depends on:** Nothing (can start in parallel with Phase 9 evidence collection). Enables Phase 12 Q6a/b classifier-skip + dispatch-routing and Phase 13 board-members.yaml registry-ownership precedent.

**Requirements:** SCHEMA-01, SCHEMA-02, SCHEMA-03, SCHEMA-04, SCHEMA-05

**Success Criteria** (what must be TRUE when this phase completes):
1. `super-gsd/templates/plan-schema-v2.json` exists and defines a `schema_version: 2` YAML-frontmatter contract with a `tasks: [...]` list; the rest of PLAN.md remains free-form human narrative (SCHEMA-01).
2. The parser enforces required per-task fields — `id`, `agent`, `model`, `files_touched`, `input_contract`, `output_contract`, `hypothesis`, `falsifier`, `stop_rule` — and rejects malformed tasks at plan-load time rather than at dispatch time (SCHEMA-02).
3. Optional per-task fields (`depends_on`, `known_deadends`, `lessons_path`, `prior_errors_lookup`, `expected_ATC_tier`, `verification_cmd`, `skip_gates: []`) are supported with documented defaults (SCHEMA-03).
4. Plans with no `schema_version` or `schema_version: 1` route through the existing Haiku classifier; v2 plans skip the classifier entirely. No bulk migration of the 146 existing plans is performed (SCHEMA-04).
5. `superpowers:writing-plans` emits v2 by default, `sgsd-orchestrate` consumes v2 natively, and the schema version is pinned identically in both repos (SCHEMA-05).

**Plans:** 0/1 plans executed

---

### Phase 12: Machinery

**Goal:** Apply four orchestrator-internal sharpenings (Q6a-d) that compound on top of the v2 schema and gate matrix — classifier-skip, parallel/sequential dispatch, checkpoint-schema expansion, and adversarial verifier sampling — to reduce per-phase overhead and catch verifier blind spots.

**Depends on:** Phase 11 (MACH-01 classifier-skip and MACH-02 dispatch auto-detect both consume schema v2 fields), Phase 10 (MACH-01 kill-condition precedent is keyed off the gate matrix's classifier row).

**Requirements:** MACH-01, MACH-02, MACH-03, MACH-04

**Success Criteria** (what must be TRUE when this phase completes):
1. Classifier-skip policy is implemented — either per-plan cached verdict (Q6a-iii) or entropy-gated (Q6a-ii). The choice is recorded in the phase PLAN and the implementation matches it; v1 plans continue to hit the classifier every loop (MACH-01).
2. Parallel/sequential dispatch auto-detection works on v2 plans — orchestrator reads `depends_on` + `files_touched`, dispatches independent tasks in parallel and dependents in sequence. v1 plans fall back to the existing sequential-only path (MACH-02).
3. The checkpoint schema is expanded with `approaches_tried_and_abandoned: []`, `rules_learned_this_session: []`, and `dispatches_summary: {total, by_agent, by_outcome}`, AND the checkpoint trigger changes from `context >70%` to `(phase_boundary OR plan_boundary) AND context >70%` (MACH-03).
4. Adversarial verifier sampling is live — N% of verifier "pass" verdicts (starting N=20%) receive a contrarian-challenger second pass, with the sampling rate tunable in `config.json` (MACH-04).

**Plans:** TBD

---

### Phase 13: Governance

**Goal:** Apply seven deliberate-skill sharpenings (Q7a-g) that turn the board into a registered resource with escalate-not-spawn defaults, confidence-weighted votes, falsifier-bearing memos, structured responses, and a post-deliberation scoring loop feeding back into future calibration.

**Depends on:** Phase 10 (gates.yaml is the registered-resource precedent), Phase 11 (schema-as-resource ownership model is the precedent for `board-members.yaml` registration).

**Requirements:** GOV-01, GOV-02, GOV-03, GOV-04, GOV-05, GOV-06, GOV-07

**Success Criteria** (what must be TRUE when this phase completes):
1. Minimal-2 default board (Architect + Contrarian) is live with an escalation policy declared in `super-gsd/registry/board-members.yaml#escalation_policy` — +Pragmatist on execution-feasibility dissent, +Moonshot on consensus-risk (GOV-01).
2. Board members self-rate 1-5 confidence on every position; CEO synthesis weights votes by confidence rather than raw count; DLB-01..06 are re-scored under the new method to validate adoption (GOV-02).
3. Every decision memo (DLB-NN and lightweight decision notes) now includes `## Falsifier` and `## Dead Ends / Paths Ruled Out` sections; `super-gsd/templates/decision-memo.md` is updated accordingly (GOV-03).
4. Board members are resolved at deliberation-start from `super-gsd/registry/board-members.yaml` rather than hardcoded in SKILL.md prose; the CEO roster-resolution path reads the registry at every deliberation (GOV-04).
5. A milestone-close hook audits every DLB fired since the prior close and writes `{q1_impl_hours_actual, rework_fired, falsifier_fired, revisions_needed}` rows to `.planning/metrics/deliberation-outcomes.jsonl` (GOV-05).
6. Board member responses are structured YAML with `position`, `confidence`, `risks_raised`, `evidence_cited`, `falsifier`, `implementation_concerns`, `known_deadends`, `intuition`, `why_principled`, `rationale` fields; CEO synthesis is rubric-driven (GOV-06).
7. Every CEO memo footer carries a post-synthesis reflection pass — "what blind spots did this deliberation have?" — cross-fed into the GOV-05 scoring log for later validation (GOV-07).

**Plans:** TBD

---

## Dependency Chain

```
Phase 9  (ATC-147-Evidence) ──┐
                               ├──► Phase 10 (Gate Policy) ──┐
Phase 11 (Plan Schema v2) ─────┼──► Phase 12 (Machinery)    │
                               │                             ├──► Phase 13 (Governance)
                               └─────────────────────────────┘
```

- **9 → 10:** Phase 10 cannot set gate enforcement modes without Phase 9's empirical finding count.
- **11 → 12:** Phase 12's classifier-skip (MACH-01) and parallel/sequential dispatch (MACH-02) both consume schema v2 task fields.
- **10 → 12:** Phase 12's classifier kill-condition is keyed off Phase 10's gate matrix.
- **10 → 13:** Phase 13's `board-members.yaml` follows the Phase 10 `gates.yaml` registered-resource precedent.
- **11 → 13:** Phase 13's schema-ownership model for board-members.yaml mirrors Phase 11's plan-schema ownership.
- **9 ∥ 11:** Phase 9 (externally blocked on project-clarity-erp) and Phase 11 (no external dep) can proceed in parallel — operator should discuss/plan Phase 11 first while Phase 9 execution is gated.

## Execution Order

Recommended sequence honoring the retro-locked v1.2-B phase order AND the external block on Phase 9:

1. **Phase 11** (no dependencies, no external block) — discuss + plan + execute first to unblock Phase 12.
2. **Phase 9** (external block) — scope fully now; execute as soon as `project-clarity-erp` Phase 147 retroactive ATC lands.
3. **Phase 10** — execute immediately after Phase 9 returns findings.
4. **Phase 12** — execute after Phase 11 AND Phase 10 are green.
5. **Phase 13** — execute last; requires Phase 10 + Phase 11 registry precedents.

Note: retro RQ4 sequencing (ATC-147-evidence → Q2-gate-policy → Q3-plan-schema → Q6-machinery → Q7-governance) remains the canonical *identity and numbering* order. The execution-order swap above is pragmatic (unblock Phase 11 while waiting on external Phase 9) and does not re-decide the phase identity.

## Progress

| Milestone | Phases | Plans | Status | Shipped |
|-----------|--------|-------|--------|---------|
| v1.1 Self-Audit | 8 | 15 | Complete | 2026-04-21 |
| v1.2 Evidence-First | 5 | TBD | Scoping | - |

### v1.2 Phase Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 9. ATC-147-Evidence | 0/TBD | Scoped — externally blocked | - |
| 10. Gate Policy | 0/TBD | Scoped — waits on Phase 9 | - |
| 11. Plan Schema v2 | 0/1 | Planned    |  |
| 12. Machinery | 0/TBD | Scoped — waits on Phase 11 + 10 | - |
| 13. Governance | 0/TBD | Scoped — waits on Phase 10 + 11 | - |
