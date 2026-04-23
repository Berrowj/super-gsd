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

## v1.2 Evidence-First Sharpening (Active: 2026-04-22 -> present)

**Phases:** 9-13

**Current shape:**

1. **Phase 9 — ATC-147-Evidence:** empirical bypass audit and finding classification from the silent-gate-skip incident.
2. **Phase 10 — Gate Policy:** `gates.yaml` registry + edge-guard enforcement, converting prose gates into runtime-declarative policy.
3. **Phase 11 — Plan Schema v2:** canonical frontmatter schema + classifier skip-path for v2 plans.
4. **Phase 12 — Machinery:** classifier cache, dispatch planner, checkpoint expansion, adversarial verifier sampling.
5. **Phase 13 — Governance:** board registry, confidence-weighted deliberation, falsifier memos, and `sgsd-complete-milestone` with bidirectional VTP.

**Milestone-close definition:**

- v1.2 is not complete at "Phase 13 code merged." It is complete when `sgsd-complete-milestone` can score deliberation outcomes, run MUDA recurrence, preserve evidence contracts, round-trip the milestone through VTP, and leave a coherent staged v1.3 handoff packet.
- The staged handoff packet is `.planning/proposals/v1.3-multimodal-review/` (`BRIEF.md`, `14-CONTEXT.md`, `15-CONTEXT.md`). v1.2 close should make that packet activatable rather than speculative.

---

## v1.3 Multimodal Review (Staged: drafted 2026-04-23)

**Status:** Staged behind v1.2 close. Not active until `/gsd-new-milestone v1.3` ingests `.planning/proposals/v1.3-multimodal-review/`.

**Phases planned:** 2 phases, 9 plans total

1. **Phase 14 — Codex CLI Provider Substrate:** dark-launch the reviewer-provider abstraction (`codex-exec.sh`, `review-providers.yaml`, `reviewer_provider:` gate schema, contract harness, config kill-switch).
2. **Phase 15 — Codex-Routed Gates + Qualitative MUDA Probe:** flip review-shaped ATC gates to Codex by registry, add the first qualitative overproduction probe, make the adversarial challenger cross-vendor, and ship a milestone-close kill check.

**Intent boundary:**

- v1.3 is a narrow multi-model reviewer lane, not a full provider rewrite of SGSD.
- Claude remains the classifier and the primary mechanical verifier; Codex is introduced only where the work is review-shaped and cross-vendor disagreement is valuable.
- The experiment must earn its keep on both axes: quality lift and Claude quota offload. If both miss threshold at milestone close, the lane is disabled and documented rather than carried as dead substrate.

**Activation preconditions:**

- v1.2 Phase 13 closed cleanly.
- `sgsd-complete-milestone` proved idempotent and VTP-safe at v1.2 close.
- The staged v1.3 brief and both phase-context files remain aligned to the final shipped Phase 13 governance substrate.
