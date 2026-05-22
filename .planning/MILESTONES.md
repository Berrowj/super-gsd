# Milestones

## v1.1 Self-Audit (Shipped: 2026-04-21)

**Phases completed:** 8 phases, 15 plans

**Key accomplishments:**

1. **Phase 1 — Token Foundation and Hook Wiring:** Cross-platform path safety, atomic writes, settings.json merge, SUPER-GSD marker patches, token-audit tooling.
2. **Phase 2 — Memory Layer:** Local BM25 query engine (`brv-query-local`/`brv-curate-local`) over `.brv/context-tree/`, zero-API-key memory retrieval + script-registry wiring.
3. **Phase 3 — Orchestrator Engine:** Dispatch loop with model routing (Opus/Sonnet/Haiku), checkpoint protocol, context cap, compressed agent-report format, end-to-end dry-run integration test.
4. **Phase 4 — ATC Quality Gates:** Haiku-based commit classification (SKIP/LITE/FULL/GATE), complexity floor escalation, tier prompts, ATC spend visibility in token-log.jsonl.
5. **Phase 5 — Strategic Deliberation:** CEO/Board multi-agent debate with 3-round hard cap, mandatory Haiku gate, qualitative risk fields, end-to-end deliberation validation.
6. **Phase 6 — Overwatcher and Monitoring:** Signal-map + Mission Control dashboard spec, tmux split-window monitoring wiring.
7. **Phase 7 — Integration and Installation:** One-command install script, CLAUDE-OVERLAY teaching doc, GSD-2.0 → Super-GSD transition skill, end-to-end installer validation.
8. **Phase 8 — SGSD Self-Audit:** 22-finding gap audit, 6/6 verifier PASS, ATC LITE (0 critical / 2 cosmetic), evidence audit L1 5/5 + L2 7/7 PASS.

**Post-milestone work (landed 2026-04-19 → 2026-04-21, feeds v1.2):**

- DLB-01 Memory topology — git-native filesystem tier, sgsd-recall/sgsd-curate shipped
- DLB-02 MUDA learning loop — write-path probes, WASTE.md, kill-condition signal
- DLB-03 Intent continuity — milestone-intent template + structural injection + cascade rule
- DLB-04 Self-evolving resource substrate — scoped Agents manifest + operator-gated SEPL + trajectory-hypothesis distillation (narrow synthesis, 3-1 vote)
- DLB-05 VTP audit sharpening — `sgsd-conformance-check`, Q4 reopen trigger, SPEC-NOW read-path
- DLB-06 Central distribution — `/sgsd-update` wrapper, overlay refresh, shim
- SGSD v2 Phase A-E — registry scaffold, 8 specialized executors, heartbeat + statusline + mission-control tile
- 2026-04-21 SGSD v2 retro — v1.2-B sequencing locked, FLOOR-per-brief precedent set

**Git tag:** `v1.1` — see `.planning/milestones/v1.1-ROADMAP.md` for full phase details.

---

## v1.2 Evidence-First Sharpening (Shipped: 2026-04-24)

**Phases:** 9-13

**Key accomplishments:**

1. **Phase 9 — ATC-147-Evidence:** Retroactive ATC on external project-clarity-erp Phase 147 produces empirical finding count + 9-gate-bypass audit with token-cost estimates. v1.2 INTENT.md + SHA-pinned evidence registry + 7-invariant mechanical verifier shipped. PASS-WITH-DEVIATIONS: 4-bucket classifier split of 10 findings, 18,940 upper / 9,340 lower token bounds delivered to Phase 10.
2. **Phase 10 — Gate Policy:** Per-gate keep/kill/conditional matrix in `registry/gates.yaml` + edge-guard enforcement layer. 11-row gates.yaml populated per D-01..D-09 + D-12, 3 new lib modules (predicate-eval, gates-registry, edge-guard), 9 SKILL.md call sites wired, 09-verify.mjs retrofitted. PASS.
3. **Phase 11 — Plan Schema v2:** Canonical YAML-frontmatter plan schema at `templates/plan-schema-v2.json` with enforced required/optional fields and v1 classifier fallback. 6 plans / 18 commits, all WR-01..05 + IN-01 closed. PASS.
4. **Phase 12 — Machinery:** Orchestrator Q6a-d sharpenings: classifier-skip, parallel/sequential auto-dispatch, checkpoint schema expansion, adversarial verifier sampling. 3 new lib modules, SKILL.md integrations across 5 sections, Phase 10 WR-01/02/03 ergonomics closed. PASS.
5. **Phase 13 — Governance:** Board registry activated, signed-sum vote synthesis, board agents in 10-field YAML, decision memo template extended, `sgsd-complete-milestone` with VTP tiered fallback, orchestrator Step 6.7 auto-trigger wired. 16/16 verifier green. PASS.

**Retroactive close note:** v1.2 (Phases 9-13) shipped per ROADMAP.md checkboxes but was never formally closed via `/gsd-complete-milestone v1.2`. This entry is the retroactive close recorded during v1.4 CLEAN-06 (2026-04-24). The staged v1.3 handoff packet (`.planning/proposals/v1.3-multimodal-review/`) became activatable as intended.

**Git tag:** `v1.2` at commit `0191168` — see `.planning/milestones/v1.2-ROADMAP.md` for full phase details.

---

## v1.3 Multimodal Review (Shipped: 2026-04-24)

**Phases completed:** 3 phases (14, 15, 16), 12 plans, 66 commits, 41 files changed (5,414 insertions / 177 deletions)

**Key accomplishments:**

1. **Phase 14 — Codex CLI Provider Substrate:** Reviewer-provider abstraction shipped DARK (`codex_enabled: false`) — `codex-exec.sh` wrapper, `review-providers.yaml` registry, `providers-registry.cjs` dispatch indirection, `gates.yaml` `reviewer_provider:` schema extension, `contract-check.mjs` pure-parser harness with fixtures. 4 plans, 6/6 V-predicates verified.
2. **Phase 15 — Codex-Routed Gates + Qualitative MUDA Probe:** Flipped the switch LIVE — 3 gates.yaml rows route to `codex-cli-reviewer`, SKILL.md Steps 6.5+9.5 wired via `resolveReviewerProvider` + `shellDispatch` + `GATE_PROVIDER_FALLBACK` (HiveMind centralized-retry), Step 9.6 adversarial challenger always non-primary vendor, sgsd-muda-audit 4th qualitative probe, token-log provider field + Multimodal Review Offload dashboard tile, sgsd-token-audit `--milestone-close-check` kill condition + sgsd-complete-milestone Step 3 renumbering. 5 plans across 4 serialized waves, 6/6 V-predicates, verify.mjs 9/9 invariants.
3. **Phase 16 — VTP Enrichment as Cross-Phase Primitive:** VTP became a first-class planning input. `vtp-context-composer.cjs` + `callVtp` MCP-wrapper, `sgsd-triage` Step 0 VTP router, 4 agent patches (`gsd-phase-researcher`, `gsd-planner`, `gsd-codebase-mapper`, `gsd-assumptions-analyzer`) with frontmatter-declared tool access, `/sgsd-vtp-advise` standalone skill, `sgsd-sepl` advise-enrich hook, `vtp-routing-log.jsonl` telemetry. 3 plans across 3 waves, 6/6 V-predicates (retroactive).

**Historic artifact:** First live Codex invocation captured 2026-04-24T02:39:05Z during MUDA qualitative probe run. `.planning/metrics/codex-log.jsonl` + `codex-live.json` prove the config → `resolveReviewerProvider` → `shellDispatch` → `codex-exec.sh` → `codex exec` pipe is operational end-to-end (`model: gpt-5.4, provider: openai, sandbox: read-only`). Invocation timed out at 60s on a 35KB qualitative-analysis prompt — tuning is tech debt, not wiring failure.

**Integration evidence (exercised live this session):**
- Phase 14 → 15 — `codex-exec.sh` invoked via Phase 15's new wiring
- Phase 16 → 15 — `vtp_route_and_retrieve` returned real doc-IDs to Phase 15's planner dispatch (query frame `qf_08971fd9c2`, 4 citable docs, 8 AGP principles, reflection verdict surfaced honestly)

**Milestone audit:** `passed` (initial audit `gaps_found` due to Phase 16 missing VERIFICATION.md artifact; closed retroactively via `gsd-verifier` dispatch, status flipped to `passed`). See `.planning/milestones/v1.3-MILESTONE-AUDIT.md`.

**Tech debt carried to v1.4 (7 items, all non-blocking):** codex_timeout_seconds tuning, providers-registry.cjs WR-01/WR-02 (stale JSDoc + dead branch), MUDA WASTE.md display inconsistency, 2 missing plan SUMMARYs (15-01, 15-03), P5 Codex Monitor artifact backfill (commit c8b2d25 without `.planning/` artifact), REQUIREMENTS.md staleness (still v1.2 scope).

**Git tag:** `v1.3` — see `.planning/milestones/v1.3-ROADMAP.md` and `.planning/milestones/v1.3-REQUIREMENTS.md` for full details.

---

## v1.4 Clean Close + Codex Visibility + Autonomous Handoff (Shipped: 2026-04-24)

**Phases:** 17-20 (10 plans, ~110 commits). Swept v1.3 tech debt, hardened the
Codex path, wired Codex activity into mission-control surfaces, and closed the
autonomous-handoff loop (Stop hook + safety rails + telemetry; disabled by
default). 17/17 REQ-IDs, 16 Codex invocations, all CRITs cleared.
**Git tag:** `v1.4`.

## v1.5 VTP Knowledge Primacy + Post-v1.4 Hardening (Shipped: 2026-04-25)

**Phases:** 21-25 (13 plans, 21 REQs). Elevated the VTP knowledge library from a
passive MCP server into an active enrichment gate on every research + audit
decision; closed Phase 20 security surfaces; calibrated MUDA aggregation;
adopted the richer Codex output contract; wired the edge-guard layer.

## v1.6 Cockpit 2.0 + Startup Verification (Shipped: 2026-04-27)

**Phases:** 26-30. SHIPPED-WITH-DEBT-10 after a post-hoc Codex rerun cleared
8 codex-unavailable rows.

## v1.7 Stable Command Contracts + Route Intelligence (Shipped: 2026-04-27)

**Phases:** 31-35. Stable command contracts + route intelligence. Phase 35
introduced the auto-generated `.planning/SYSTEM-MAP.md` catalog.

## v1.8 Gate Fitness + MUDA Pruning (Shipped: 2026-04-27)

**Phases:** 36-40.

## v1.9 SGSD-Research — Context Compression + Token Governance + Research Routing (Shipped: 2026-04-28)

**Phases:** 41-52.

## v2.0 Failure Injection (Shipped: 2026-04-29)

**Phases:** 53-57. Release-readiness score 97-98/100 GREEN.

## v2.1 Distribution + New-User Onboarding (Shipped: 2026-04-29)

**Phases:** 58-62. ROADMAP COMPLETE 2026-04-29 — all 30 phases (26-62) closed
across 6 milestones (v1.6 SHIPPED-WITH-DEBT-10; v1.7-v2.1 SHIPPED clean).

## v2.2–v2.8 Warp Integration (Shipped: 2026-04-29 → 2026-05)

**Phases:** 63-97. The Warp-integration roadmap — Warp launch topology, workflow
pack, MCP wiring, capability smoke tests, and the v2.8 release gate (Phase 97;
149/149 self-tests; READY-WITH-DEFERRED). See
`.planning/milestones/warp-integration/`.

## v2.9 Agentic Harness Evolution (Shipped: 2026-05-18)

**Phases:** 97.5, 98-105 (ALL-PHASES-CLOSED PASS-WITH-DEFERRED-2).

Turned SGSD from a hand-improved orchestrator into an observability-driven
harness with a closed AHE loop (component → evidence → predicted edit →
measured outcome → keep/revert/pivot). Six `harness-*` tools shipped a 35-row
component registry, evidence distiller, falsifiable change manifest, attribution
+ rollback gate, evolution runner, and ablation + transfer evaluator —
131/131 new self-test assertions PASS. A protected-surface contract keeps
scoring oracles, verifiers, model config, and budget un-editable by the loop.
P97.5 + **DLB-07** added the semantic verification gate (`semantic_acceptance_criteria`
mechanically enforced via `plan-schema-v2.json` / `validate.cjs`;
`sgsd-audit@v2` Layer 4). See `.planning/milestones/v2.9/SUMMARY.md`.

## v3.0 SGSD-PRO — Codex-native + Mesh Memory Lite + Context Authority (Shipped: 2026-05-21)

**Phases:** 106-112 (ALL-PHASES-CLOSED PASS; 4/4 MVP fixtures green; 0 deferred).

Three subsystems beneath the control plane:
- **DLB-08 Mesh Memory Lite** — a lineaged, role-filtered cognitive memory
  ledger (`.planning/mesh/memory/cmbs.jsonl`); 7 typed CMB classes, a CAT7
  envelope, a lineage DAG with O(1) echo detection, and an evidence validator
  that classifies reviewer claims VERIFIED/REFUTED/STALE/UNVERIFIED/GUARDED so a
  reviewer hallucination can no longer block promotion.
- **DLB-09 Codex Pro Mode** — 10 typed Codex lanes (`codex-profiles.yaml`), a
  GREEN/AMBER/RED earned-execution stoplight, 5 fail-CLOSED Codex hooks, and the
  PLAN-LOCKED schema extending plan-schema-v2.
- **DLB-10 Context Authority** — 6 per-milestone YAML capsule templates
  projected into `context_anchor` CMBs.

232 self-test assertions green across 4 integrated runners. Fixture D proved a
production-SAP write still escalates to the real operator even at LLM-judge
confidence 0.95. See `.planning/milestones/v3.0/SUMMARY.md`.

## v3.1 SGSD Chronicle Layer (Shipped: 2026-05-21)

**Phases:** 113-119 (ALL-PHASES-CLOSED; 96/96 self-test).

**DLB-11** added the Operator Chronicle Layer: every phase close ships a
validated HTML projection of SGSD truth (mesh memory + artefacts + git evidence)
that the operator reads to keep cognitive grip. The chronicle is a deterministic
projection — written by `render-html.cjs`, re-checked by `validate-chronicle.cjs`
as a binding gate (`REPORT_UNGROUNDED` halts the close), citing every claim by
CMB ID, with a denominator panel and a deterministic per-phase **Fog Score**.
Offline-survivable: inline SVG, committed PlantUML source. See
`.planning/milestones/v3.1/SUMMARY.md`.

## v3.2 Operator Comprehension System (Shipped: 2026-05-22)

**Phases:** 120-127 (ALL-PHASES-CLOSED PASS).

**DLB-12** made SGSD's self-explanation world-class across both operator-facing
surfaces. One shared design system (`sgsd-design-system.css` + `design-rules.json`
— 12 book-mined comprehension rules R01-R12, machine-checked by
`conformance-check.cjs`) backs two answer-first surfaces:
- **Workstream A** rebuilt the chronicle HTML to a book-grounded gold reference
  (Operator Decision Panel first, 11-section answer-first order, SCQA, fog
  gauge) — chronicle self-test 111/111.
- **Workstream B** rebuilt the live cockpit (`cockpit-sidecar.cjs`) answer-first
  — a North-Star banner, one alert, `--brief`/`--html` modes — cockpit self-test
  18/18.

Cross-surface conformance machine-checked: cockpit `--html` and the chronicle
gold-reference both `binding_fail=0`. See `.planning/milestones/v3.2/SUMMARY.md`.

---

