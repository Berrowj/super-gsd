# Roadmap: Super GSD Framework

## Milestones

- ✅ **v1.1 Self-Audit** — Phases 1-8 (shipped 2026-04-21) — [archive](milestones/v1.1-ROADMAP.md)
- ✅ **v1.2 Evidence-First Sharpening** — Phases 9-13 (shipped 2026-04-24 retroactive close) — [archive](milestones/v1.2-ROADMAP.md) · `git tag v1.2`
- ✅ **v1.3 Multimodal Review — Codex Integration** — Phases 14-16 (shipped 2026-04-24) — [archive](milestones/v1.3-ROADMAP.md) · [requirements](milestones/v1.3-REQUIREMENTS.md) · [audit](milestones/v1.3-MILESTONE-AUDIT.md)
- ✅ **v1.4 Clean Close + Codex Visibility + Autonomous Handoff** — Phases 17-20 (shipped 2026-04-24) — [summary](milestones/v1.4/SUMMARY.md) · [requirements](milestones/v1.4-REQUIREMENTS.md) · `git tag v1.4`
- 🚧 **v1.5 VTP Knowledge Primacy + Post-v1.4 Hardening** — Phases 21-25 (in progress, 21 REQ-IDs across VTPE/SEC/MUDAC/CONTRACT/CARRY/INSTR)

## Phases

### 🚧 v1.5 VTP Knowledge Primacy + Post-v1.4 Hardening (Phases 21-25)

Scope: elevate VTP knowledge library from passive MCP server into active enrichment gate on every research + audit decision; close Phase 20 Codex-acknowledged security surfaces; calibrate MUDA aggregation across 3-phase accumulated findings; fully adopt richer-output contract Codex began emitting spontaneously in v1.4 Phase 20; land Phase 17-19 carryover WARNs; wire edge-guard layer + dashboard math audit + timeout observability.

- [x] **Phase 21: VTP Enrichment Gates** — VTPE-01..06 (6/6 requirements delivered, 4 plans shipped) ✓ 2026-04-24
  - 21-01: Research→Planning boundary gate (VTPE-01)
  - 21-02: Audit workflow cross-reference + milestone-close xref (VTPE-02, VTPE-03)
  - 21-03: Design-policy config + empty-hit artifact discipline (VTPE-04, VTPE-05)
  - 21-04: Researcher board member for deliberation (VTPE-06)
- [ ] **Phase 22: Security Hardening** — SEC-01..02 (2 requirements, 2 plans)
  - 22-01: Symlink canonicalize (handoff paths)
  - 22-02: fs flock concurrent-write guard (handoff-log)
- [ ] **Phase 23: MUDA Calibration** — MUDAC-01..04 (4 requirements, 2 plans)
  - 23-01: 5-probe aggregation + inventory threshold recal (MUDAC-01, MUDAC-02)
  - 23-02: probe flat-path mirror-fix + summary text accuracy (MUDAC-03, MUDAC-04)
- [ ] **Phase 24: Richer Output Contract** — CONTRACT-01..03 (3 requirements, 2 plans)
  - 24-01: FINDINGS_DETAIL prompt-engineering (CONTRACT-01)
  - 24-02: validateContract extended parsing + ATC-REVIEW rendering (CONTRACT-02, CONTRACT-03)
- [ ] **Phase 25: Carryover + Telemetry** — CARRY-01..03 + INSTR-01..03 (6 requirements, 3 plans)
  - 25-01: Carryover WARNs (CARRY-01 awk sentinel, CARRY-02 JSDoc audit, CARRY-03 dogfood strictness) — LITE docs-heavy
  - 25-02: Edge-guard layer wiring (INSTR-01)
  - 25-03: Dashboard math + timeout observability (INSTR-02, INSTR-03)

**Dependencies:** Phase 21 (VTPE) ∥ Phase 22 (SEC) ∥ Phase 23 (MUDAC) ∥ Phase 24 (CONTRACT) — all four independent. Phase 25 serializes AFTER 22+23 (INSTR-01 edge-guard consumes dispatch hooks that SEC/MUDAC may touch). Design invariant preserved: `/gsd-discuss-phase` remains interactive; VTPE gates + audit cross-ref + all other stages run autonomous. VTP enrichment `challenger_mode: false` (enrich-only) per Q2=B scoping.

---

<details>
<summary>✅ v1.4 Clean Close + Codex Visibility + Autonomous Handoff (Phases 17-20) — SHIPPED 2026-04-24</summary>

### v1.4 Clean Close + Codex Visibility + Autonomous Handoff (Phases 17-20)

Scope: sweep v1.3 carry-over tech debt, harden Codex path to full operational reliability on real task loads, wire Codex activity into mission-control visibility surfaces, close the autonomous-handoff loop so every non-discuss phase runs across session boundaries without operator intervention.

- [x] **Phase 17: Debt Sweep** — CLEAN-01..CLEAN-07 (7/7 requirements delivered, 3 plans shipped) ✓ 2026-04-24
  - [x] 17-01: Code debt (CLEAN-01 providers-registry refresh, CLEAN-02 WASTE.md display) — Codex ATC cleared after fix-up
  - [x] 17-02: Process debt (CLEAN-03 plan SUMMARYs, CLEAN-04 P5 artifact backfill, CLEAN-05 REQUIREMENTS hygiene) — LITE, no ATC
  - [x] 17-03: Milestone close debt (CLEAN-06 v1.2 retroactive close + tag, CLEAN-07 codex_timeout tiers) — Codex ATC cleared after fix-up
  - **Phase ATC**: 0 CRITICAL + 3 WARNINGS deferred to Phase 18 (awk anchor brittleness, step-name tier calibration, richer output contract)
  - **Codex dogfood**: 6 invocations, 622.9s wall-clock, retroactively satisfies CXOPS-03 and partially CXOPS-04
- [x] **Phase 18: Codex Hardening** — CXOPS-01..CXOPS-04 (4/4 requirements delivered, 2 plans shipped) ✓ 2026-04-24
  - [x] 18-01: Self-test + contract validator (CXOPS-01 --self-test 4-probe harness, CXOPS-02 validateContract at Steps 6.5/9.5 + parse_failure single-retry fallback)
  - [x] 18-02: Dogfood proof (CXOPS-03/04 retroactively satisfied via DOGFOOD-AUDIT.md citing 5+1 Codex evidence rows)
  - **Phase ATC**: 0 CRITICAL + 2 WARNINGS deferred to Phase 19 richer-output-contract scope
  - **Codex dogfood**: 2 invocations this phase (1 meta-dogfood per-dispatch + 1 phase-level), both exit 0, validateContract first-live-fire clean
- [x] **Phase 19: Mission Control Visibility** — MC-01..MC-05 (5/5 requirements delivered + 6 richer-output deferrals addressed) ✓ 2026-04-24
  - [x] 19-01: Core tiles (MC-01 mission-control Codex tile, MC-02 statusline indicator, MC-05 dashboard offload tile) ✓ 2026-04-24
  - [x] 19-02: Event capture + feed + richer-output hardening (MC-03 narrative Codex events, MC-04 dual-source live-feed, D-05 #3/#4/#5/#6/#7/#9 from Phase 17/18 WARN queue) ✓ 2026-04-24
  - **Phase ATC**: 0 CRITICAL + 5 WARNINGS (PASS_RATE 2/6) deferred to Phase 20 or post-v1.4 (timeout reliability, offload telemetry accuracy, narrative race conditions, retry path edge cases)
  - **Codex dogfood**: 4 invocations, 522.5s wall-clock (1 review-tier timeout + 3 analysis-tier successes). Session cumulative: 11 invocations, 1364s, ~22k Claude tokens saved.
- [x] **Phase 20: Autonomous Session Handoff** — HANDOFF-01..HANDOFF-03 (3/3 requirements delivered) ✓ 2026-04-24
  - [x] 20-01: Stop hook script — sgsd-stop-handoff.sh + Stop hook wiring (disabled by default for safety)
  - [x] 20-02: Safety rails — cooldown + max-chain-depth + operator-abort + discuss-phase guard + config block
  - [x] 20-03: Telemetry + MC integration — handoff-log.jsonl + SGSD-Handoff-Tile + session-start pairing + --MilestoneCloseCheck
  - **Phase ATC**: 2 initial CRITICALs + 1 follow-up CRITICAL raised over 5 review rounds; all cleared via 4 fix commits (90e1293/9a77d0d/aba68c1/74cc627). Remaining surfaces (symlink + concurrency) bounded to Phase 21 security-hardening scope.
  - **Codex dogfood**: 4 invocations, 420s wall-clock. Round 3 emitted file:line detail (richer-output contract showing adoption).

**Dependencies:** Phase 17 ∥ Phase 18 (independent). Phase 19 benefits from Phase 18 producing real Codex activity to visualize. Phase 20 serializes AFTER 19 — MC surfaces must exist before handoff telemetry extends them. **Design invariant:** `/gsd-discuss-phase` remains interactive; Phase 20 handoff explicitly skips it. Everything else (research, plan, plan-check, execute, verify, ATC, MUDA, browser-verify, phase-close, milestone audit, milestone close) becomes cross-session autonomous.

</details>

<details>
<summary>✅ v1.3 Multimodal Review (Phases 14-16) — SHIPPED 2026-04-24</summary>

- [x] Phase 16: VTP Enrichment as Cross-Phase Primitive — 3/3 plans (VTP-01..VTP-10)
- [x] Phase 14: Codex CLI Provider Substrate — 4/4 plans (CODEX-01..CODEX-06, shipped dark)
- [x] Phase 15: Codex-Routed Gates + Qualitative MUDA Probe — 5/5 plans across 4 serialized waves (CODEX-07..CODEX-12, shipped live with first Codex invocation captured 2026-04-24T02:39:05Z)

Full details: [milestones/v1.3-ROADMAP.md](milestones/v1.3-ROADMAP.md)

</details>

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

<details>
<summary>✅ v1.2 Evidence-First Sharpening (Phases 9-13) — SHIPPED 2026-04-24 (retroactive close)</summary>

Per `.planning/decisions/2026-04-21-sgsd-v2-retro.md` RQ4 (v1.2-B sequencing):
ATC-147-evidence → Q2-gate-policy → Q3-plan-schema → Q6-machinery → Q7-governance.

**Summary checklist:**

- [x] **Phase 9: ATC-147-Evidence** — Retroactive ATC on external project-clarity-erp Phase 147 produces empirical finding count + 9-gate-bypass audit with token-cost estimates (SHIPPED 2026-04-22 — 3 plans / 12 commits; PASS-WITH-DEVIATIONS: classifier landed 4-bucket split of 10 findings matching §Q7 mapping exactly, gate-bypass audit delivers 18,940 upper / 9,340 lower token bounds for Phase 10 consumption, v1.2 INTENT.md + SHA-pinned evidence registry + 7-invariant mechanical verifier; ATC WARN: 0 critical, 2 verifier coverage gaps flagged for Phase 10 rubric design)
- [x] **Phase 10: Gate Policy** — Per-gate keep/kill/conditional matrix landed in `registry/gates.yaml` + edge-guard enforcement layer catches silent skip-drift (SHIPPED 2026-04-22 — 3 plans / 12 commits; PASS: 11-row gates.yaml populated per D-01..D-09 + D-12, 3 new lib modules in super-gsd/scripts/lib/ (predicate-eval 10-op evaluator, gates-registry cache-singleton with shouldFire, edge-guard transition-wrapper with --self-test), 9 SKILL.md call sites wired, 09-verify.mjs retrofitted with WR-01/02 invariants, config.byterover deleted; ATC WARN 0 critical / 9.67/10 anti-slop / 3 warnings forwarded to Phase 12 ergonomics; MUDA 1 non-blocking FAIL inventory; cross-repo operator action: 7 keys to core.cjs KNOWN_TOP_LEVEL pending)
- [x] **Phase 11: Plan Schema v2** — Canonical YAML-frontmatter plan schema at `templates/plan-schema-v2.json` with enforced required/optional fields and v1 classifier fallback (SHIPPED 2026-04-21 — 6 plans / 18 commits; PASS after 11-06 gap closure: WR-01..05 + IN-01 all closed, 0 ATC warnings remain; IN-03 distribution gap deferred to Phase 12+)
- [x] **Phase 12: Machinery** — Orchestrator Q6a-d sharpenings: classifier-skip, parallel/sequential auto-dispatch, checkpoint schema expansion, adversarial verifier sampling (SHIPPED 2026-04-22 — 6 plans / ~24 commits; PASS: 3 new lib modules (classifier-cache per-plan sidecar, dispatch-planner Kahn topo-sort, context-gauge opt-in mechanical 85% threshold), SKILL.md integrations across 5 sections, checkpoint template +4 fields, adversarial verifier Step 9.6 with verifier_adversarial_rate=0.2, patch-gsd-tools-known-keys.sh idempotent installer shipped + README documented; ATC WARN 0 critical / 8.75/10 anti-slop / 2 warnings deferred to ergonomics sweep; MUDA clean; Agent() parallel fan-out confirmed concurrent in 12-02-00 spike; Phase 10 WR-01/02/03 ergonomics closed; Phase 11 IN-03 still deferred to infra phase)
- [x] **Phase 13: Governance** — Deliberate-skill Q7a-g sharpenings: escalate-not-spawn board, confidence-weighted votes, falsifier memos, board-as-resource, post-deliberation scoring, structured responses, CEO reflection pass (SHIPPED 2026-04-23 — board registry activated, signed-sum vote synthesis landed, board agents moved to 10-field YAML, decision memo template extended with falsifier/dead-ends/reflection, `sgsd-complete-milestone` added with VTP tiered fallback, orchestrator Step 6.7 auto-trigger wired, Phase 13 verifier green 16/16)

Full details: [milestones/v1.2-ROADMAP.md](milestones/v1.2-ROADMAP.md)

</details>

<details>
<summary>v1.2 Phases (shipped)</summary>

## Phase Details — v1.2 (Phases 9-13)

Full details archived in [milestones/v1.2-ROADMAP.md](milestones/v1.2-ROADMAP.md).

### Phase 9: ATC-147-Evidence

**Goal:** Close the evidence gap from Phase 147's silent-gate-skip by running a retroactive ATC review and a bypass-cost audit, producing the empirical finding count that Phase 10's keep/kill matrix will key against.

**Depends on:** External `project-clarity-erp` Phase 147 retroactive ATC landing in that repo (out-of-scope-to-this-repo execution). This phase is SCOPED now; execution deferred until the external dep is unblocked. Operator must verify `project-clarity-erp/.planning/phases/147-clarity-relay-map-w1/147-ATC-REVIEW.md` exists before dispatching Phase 9 plans.

**Requirements:** ATC-147-01, ATC-147-02, ATC-147-03

**Success Criteria** (what must be TRUE when this phase completes):
1. A retroactive ATC review exists at `project-clarity-erp/.planning/phases/147-clarity-relay-map-w1/147-ATC-REVIEW.md` with every finding classified as real-bloat / nit / false-positive (ATC-147-01).
2. The v1.2 milestone's evidence registry cross-links to that external review file via a relative or operator-resolvable path (ATC-147-02).
3. A gate-bypass audit enumerates the 9 CLAUDE-OVERLAY gates Phase 147 skipped (Haiku classifier, context-selector, ByteRover query, INTENT injection, per-dispatch ATC, phase-level ATC, MUDA, sgsd-curate, token-log) with a token-cost estimate per gate (ATC-147-03).
4. The finding count is surfaced in a form Phase 10 can consume (a single number keyed against the ≥3 / 1-2 / 0 thresholds from the parent brief's Q2 proposal).

**Plans:** 3 plans

- [x] 09-01-classification.md — Narrow Sonnet classifier + 09-classification.yaml (ATC-147-01)
- [x] 09-02-gate-bypass.md — 9-row gate-bypass token-cost audit YAML (ATC-147-03)
- [x] 09-03-registry-and-intent.md — v1.2 INTENT.md + evidence registry pointer + verify.mjs (ATC-147-02)

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

**Plans:** 3 plans — SHIPPED

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

**Plans:** 6 plans — SHIPPED

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

**Plans:** 6 plans — SHIPPED

---

### Phase 13: Governance

**Goal:** Apply seven deliberate-skill sharpenings (Q7a-g) that turn the board into a registered resource with escalate-not-spawn defaults, confidence-weighted votes, falsifier-bearing memos, structured responses, and a post-deliberation scoring loop feeding back into future calibration. Phase 13 also proves the new milestone-close path that enriches from VTP, publishes the milestone artifact back, and activates the staged v1.3 multimodal-review handoff cleanly.

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

8. `sgsd-complete-milestone` is live, idempotent, and evidence-safe: it can close v1.2 through bidirectional VTP and leave the staged v1.3 packet ready for `/gsd-new-milestone v1.3`.

**Plans:** SHIPPED — verifier green 16/16

</details>

---

### Phase 14: Codex CLI Provider Substrate

**Goal:** Ship the reviewer-provider abstraction dark so review-shaped gates can route through either Claude or Codex without changing evidence contracts, while keeping all live gate behaviour on Claude until the substrate proves out.

**Depends on:** Phase 13 complete. Requires `sgsd-complete-milestone` and the governance/resource-registry precedent to be real, not aspirational.

**Requirements:** CODEX-01, CODEX-02, CODEX-03, CODEX-04, CODEX-05, CODEX-06

**Success Criteria** (what must be TRUE when this phase completes):
1. `super-gsd/scripts/codex-exec.sh` exists with timeout, provenance logging, OAuth-only posture, and report-contract parsing (CODEX-01).
2. `super-gsd/registry/review-providers.yaml` exists with two active providers (`claude-sonnet-reviewer`, `codex-cli-reviewer`) and `gates-registry.cjs` can resolve them at cold start (CODEX-02).
3. `super-gsd/registry/gates.yaml` supports an explicit `reviewer_provider:` field on review-shaped rows, but all live rows still resolve to Claude because Phase 14 ships dark (CODEX-03).
4. `super-gsd/agents/sgsd-codex-reviewer.md` exists and mirrors the existing code-reviewer report contract instead of inventing a new evidence shape (CODEX-04).
5. `super-gsd/tools/provider-contract/contract-check.mjs` can run both providers on the same toy diff and validate structural compatibility of the outputs (CODEX-05).
6. `.planning/config.json` has the `review_providers` block with `codex_enabled: false`, making the entire substrate revertable and behaviour-preserving until Phase 15 flips it on (CODEX-06).

**Plans:** 4 plans, 3 waves (per staged Phase 14 context)

---

### Phase 15: Codex-Routed Gates + Qualitative MUDA Probe

**Goal:** Turn on the staged substrate only at the review-shaped surfaces where cross-vendor signal and quota offload are defensible: phase-level ATC, per-dispatch ATC, adversarial verifier challenge, and a qualitative overproduction probe inside MUDA.

**Depends on:** Phase 14 fully green. In particular, provider registry, wrapper, contract harness, and config kill-switch must all exist before any live routing changes.

**Requirements:** CODEX-07, CODEX-08, CODEX-09, CODEX-10, CODEX-11, CODEX-12

**Success Criteria** (what must be TRUE when this phase completes):
1. `phase-level-ATC` and `per-dispatch-ATC` resolve through `reviewer_provider: codex-cli-reviewer`, with single-retry Claude fallback and no evidence-path drift in `commit-reviews.jsonl` or `{NN}-ATC-REVIEW.md` (CODEX-07).
2. `sgsd-muda-audit.sh` gains a qualitative `overproduction` probe backed by Codex, but still honours DLB-02's non-blocking MUDA discipline and curates findings like the existing probes (CODEX-08).
3. The qualitative MUDA probe only fires behind an explicit gate row keyed to diff size, phase type, and the verdict of the mechanical probes, so Codex spend stays deliberate rather than ambient (CODEX-09).
4. `token-log.jsonl` and `sgsd-token-audit` can compute provider-specific offload, including estimated Claude quota saved by Codex across the active milestone (CODEX-10).
5. Step 9.6 adversarial verifier challenge becomes truly cross-vendor: when it fires, the challenger is the non-primary vendor rather than a second same-vendor pass (CODEX-11).
6. Milestone close can evaluate the multimodal experiment mechanically and disable it if both quality lift and quota-offload miss threshold, documenting the retirement rather than silently carrying dead infrastructure forward (CODEX-12).

**Plans:** 5 plans, 4 waves (per staged Phase 15 context)

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
| v1.3 Multimodal Review | 3 | 12 | Staged (Phase 16 planned) | - |

### v1.2 Phase Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 9. ATC-147-Evidence | 0/3 | Planned | - |
| 10. Gate Policy | 0/TBD | Scoped — waits on Phase 9 | - |
| 11. Plan Schema v2 | 0/1 | Planned    |  |
| 12. Machinery | 0/TBD | Scoped — waits on Phase 11 + 10 | - |
| 13. Governance | 7/7 | Complete | 2026-04-23 |
