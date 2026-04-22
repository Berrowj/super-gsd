# Milestone v1.2 Requirements — Evidence-First Sharpening

**Source:** 2026-04-21 SGSD v2 retro (`decisions/2026-04-21-sgsd-v2-retro.md`) RQ4 v1.2-B sequencing + the `briefs/2026-04-21-orchestrator-contract.md` parent brief.

**Strategic frame:** Phase 147 (external project-clarity-erp) ran autonomously overnight and skipped ~9 CLAUDE-OVERLAY gates without audit. v1.2 closes the evidence gap: measure first, then keep/kill each gate, then sharpen the plan-schema → orchestrator → deliberate contract around that evidence.

---

## v1 Requirements (v1.2 scope — 23 requirements across 5 phases)

### ATC-EVIDENCE (Phase 9 — retroactive ATC on Phase 147)

- [ ] **ATC-147-01**: Retroactive ATC review of `project-clarity-erp` Phase 147 produces a finding count with each finding classified as real-bloat vs nit vs false-positive.
- [ ] **ATC-147-02**: ATC review output lives at `.planning/phases/147-clarity-relay-map-w1/147-ATC-REVIEW.md` in the external project and is cross-linked from this milestone's evidence registry.
- [ ] **ATC-147-03**: Gate-bypass audit captures the 9 skipped gate categories with token-cost estimates for each, so Phase 10 can make keep/kill calls against concrete numbers.

### GATE-POLICY (Phase 10 — Q2 keep/kill matrix)

- [ ] **GATE-01**: Per-gate decision matrix declares every CLAUDE-OVERLAY gate as HARD-HALT, SOFT-WARN, or CONDITIONAL, with the empirical trigger (finding count from ATC-147-01) explicit per row.
- [ ] **GATE-02**: ATC gate firing policy (per-dispatch Step 9.5 and phase-level Step 6.5) lands in `super-gsd/registry/gates.yaml` with enforcement mode, not prose.
- [ ] **GATE-03**: Non-ATC gates routed — classifier (Step 2), context-selector (Step 4), ByteRover queries (Step 5), INTENT injection (Step 5.5), MUDA audit (Step 6.55), sgsd-curate (Step 10), token-log (Step 11) — each gets an explicit keep/kill/conditional verdict backed by the matrix.
- [ ] **GATE-04**: Edge-guard enforcement layer writes `.planning/metrics/edge-guard-log.jsonl` per step transition with `{from_step, to_step, missing_emits, context, resolution}`; skipped gates that should have fired trigger rollback or halt per the matrix.

### PLAN-SCHEMA (Phase 11 — Q3 plan schema v2)

- [x] **SCHEMA-01**: Canonical plan schema v2 published at `super-gsd/templates/plan-schema-v2.json` as YAML frontmatter with `schema_version: 2` + `tasks: [...]` contract; rest of PLAN.md remains human narrative.
- [x] **SCHEMA-02**: Required task fields (`id`, `agent`, `model`, `files_touched`, `input_contract`, `output_contract`, `hypothesis`, `falsifier`, `stop_rule`) enforced by parser; malformed tasks fail at plan-load time.
- [x] **SCHEMA-03**: Optional task fields (`depends_on`, `known_deadends`, `lessons_path`, `prior_errors_lookup`, `expected_ATC_tier`, `verification_cmd`, `skip_gates: []`) supported with documented defaults.
- [ ] **SCHEMA-04**: Backward-compatible fallback — plans with no `schema_version` or `schema_version: 1` route through the existing Haiku classifier; v2 plans skip the classifier entirely. No bulk migration of the 146 existing plans.
- [x] **SCHEMA-05**: `superpowers:writing-plans` updated to emit v2 by default; `sgsd-orchestrate` consumes v2 natively. Schema is versioned and pinned identically in both repos.

### MACHINERY (Phase 12 — Q6 orchestrator sharpenings)

- [ ] **MACH-01** (Q6a): Classifier skip policy implemented — either per-plan cached verdict (Q6a-iii, simpler) or entropy-gated (Q6a-ii). Decision recorded in phase PLAN, not re-litigated per milestone.
- [ ] **MACH-02** (Q6b): Parallel/sequential dispatch auto-detection — orchestrator reads `depends_on` + `files_touched` from schema v2, parallelizes independent tasks, serializes dependents; falls back to sequential for v1 plans.
- [ ] **MACH-03** (Q6c): Checkpoint schema expanded with `approaches_tried_and_abandoned: []`, `rules_learned_this_session: []`, `dispatches_summary: {total, by_agent, by_outcome}`; trigger changes from `context >70%` to `(phase_boundary OR plan_boundary) AND context >70%`.
- [ ] **MACH-04** (Q6d): Adversarial verifier sampling — N% of verifier "pass" verdicts (starting N=20%) get a contrarian-challenger second pass; sampling rate tunable in `config.json`.

### GOVERNANCE (Phase 13 — Q7 deliberate-skill sharpenings)

- [ ] **GOV-01** (Q7a): Escalate-not-spawn board — minimal-2 default (Architect + Contrarian), escalate to +Pragmatist on execution-feasibility dissent, +Moonshot on consensus-risk. Policy declared in `super-gsd/registry/board-members.yaml#escalation_policy`.
- [ ] **GOV-02** (Q7b): Confidence-weighted vote synthesis — each member self-rates 1-5 confidence; CEO weights votes by confidence rather than raw majority. Historical DLB-01..06 re-scored to validate adoption.
- [ ] **GOV-03** (Q7c): Every decision memo gains `## Falsifier` and `## Dead Ends / Paths Ruled Out` sections; templates updated in `super-gsd/templates/decision-memo.md`.
- [ ] **GOV-04** (Q7d): Board members migrate from SKILL.md prose to `super-gsd/registry/board-members.yaml`; CEO resolves roster at deliberation-start via the registry, not hardcoded.
- [ ] **GOV-05** (Q7e): Post-deliberation scoring loop — milestone-close hook audits every DLB fired since the prior close, writes `{q1_impl_hours_actual, rework_fired, falsifier_fired, revisions_needed}` to `.planning/metrics/deliberation-outcomes.jsonl`.
- [ ] **GOV-06** (Q7f): Board member responses become structured YAML (`position`, `confidence`, `risks_raised`, `evidence_cited`, `falsifier`, `implementation_concerns`, `known_deadends`, `intuition`, `why_principled`, `rationale`) — CEO synthesis is rubric-driven, not prose-summarized.
- [ ] **GOV-07** (Q7g): CEO runs a post-synthesis reflection pass — "what blind spots did this deliberation have?" — appended to the DLB memo footer and cross-fed to GOV-05's scoring log.

---

## Future Requirements (deferred to v1.3+)

- **DISTILL-01**: Trajectory-hypothesis distillation at v1.2 close (DLB-04 Wave C) — already gated by DLB-04's triple hallucination safeguard; moves to `trajectory-lesson/` only at v1.3 recurrence confirmation.
- **VTP-Q4**: VTP-audit reopen trigger (DLB-05 Wave E) — fires at v1.3 close if conformance drift re-accumulates.
- **GOV-NOVELTY-KILL**: DLB-04 Contrarian novelty-rating kill condition — fires at v1.2 close if zero-novel-pattern trajectory output; then deletes `sgsd-distill-milestone`.
- **AGP-FULL**: Full AGP spec conformance — DLB-04 RQ4b adopted vocab-only; revisit if Autogenesis revision history shows stabilization.

## Out of Scope (explicit exclusions)

- **Bulk plan migration** — the 146 v1 plans stay free-form; v1 → classifier, v2 → direct-parse (SCHEMA-04). Forcing migration would burn weeks of retrofitting and is explicitly ruled out by the retro constraint set.
- **Self-modifying board roster** — GOV-04 registers board members as resources but SEPL-gated mutation (AGP-P-04) stays operator-gated per DLB-04 Q2 invariant. No autonomous roster changes.
- **Mission Control heartbeat redesign** — R-Q8c/d statusline + live tiles are FLOOR-executable + already partially landed in SGSD v2 Phase E; handled outside v1.2 scope.
- **DEVIATIONS.md gate-awareness (Q4a)** — merged into edge-guard (GATE-04) per R-Q4 refinement; not a separate requirement.
- **Hard-cutover plan migration** — SCHEMA-04 explicitly adopts gradual decay; hard-cutover is ruled out by constraint "146 existing phase plans cannot all be retro-fitted".

---

## Traceability (filled by /gsd-plan-phase as phases scope)

| REQ-ID | Phase | Plan | Status |
|--------|-------|------|--------|
| ATC-147-01 | 9 | 09-01 | Planned |
| ATC-147-02 | 9 | 09-03 | Planned |
| ATC-147-03 | 9 | 09-02 | Planned |
| GATE-01 | 10 | TBD | Pending |
| GATE-02 | 10 | TBD | Pending |
| GATE-03 | 10 | TBD | Pending |
| GATE-04 | 10 | TBD | Pending |
| SCHEMA-01 | 11 | TBD | Pending |
| SCHEMA-02 | 11 | TBD | Pending |
| SCHEMA-03 | 11 | TBD | Pending |
| SCHEMA-04 | 11 | TBD | Pending |
| SCHEMA-05 | 11 | TBD | Pending |
| MACH-01 | 12 | TBD | Pending |
| MACH-02 | 12 | TBD | Pending |
| MACH-03 | 12 | TBD | Pending |
| MACH-04 | 12 | TBD | Pending |
| GOV-01 | 13 | TBD | Pending |
| GOV-02 | 13 | TBD | Pending |
| GOV-03 | 13 | TBD | Pending |
| GOV-04 | 13 | TBD | Pending |
| GOV-05 | 13 | TBD | Pending |
| GOV-06 | 13 | TBD | Pending |
| GOV-07 | 13 | TBD | Pending |

**Dependency notes:**
- Phase 9 (ATC-EVIDENCE) is the empirical gate for Phase 10 (GATE-POLICY). Phase 10 cannot proceed until ATC-147-01 returns findings.
- Phase 11 (PLAN-SCHEMA) enables MACH-01, MACH-02, and GATE-03 classifier/selector kills. Phase 12 depends on Phase 11.
- Phase 13 (GOVERNANCE) depends on the registry work in Phase 10 (gates.yaml) and Phase 11 (board-members.yaml precedent from schema ownership).
