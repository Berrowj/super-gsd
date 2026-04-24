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

