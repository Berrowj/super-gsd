---
created_at: "2026-04-23T19:45:00.000Z"
active_milestone: v1.3
active_phase: 15
last_completed: "Phase 14 — all 4 plans shipped + all phase-close gates green"
next_unit: "Phase 15 discuss — consume the 5 phase-14-ATC warnings as entry conditions, dispatch VTP-enriched research chain"
phase_state: "not-yet-discussed"
units_this_session: 16
estimated_tokens_used: ~180000
---

## Completed This Session

- **Phase 14 planning chain** (commits 1c5c12f, 4a1b6b3, a999247, 1330102, 40f4384, 1a07d0d):
  - 14-VTP-EVIDENCE.md bypass stub (VTP-agnostic-by-design + vtp-kb tooling bug now fixed upstream)
  - RESEARCH.md — Codex CLI contract findings, 3 risk surfaces, 1 naming-drift surface
  - PATTERNS.md — 9 targets mapped + 4 divergences
  - 4 v2-schema plans + PLAN-INDEX.md (3 waves, 4 deviations P1..P4)
  - VALIDATION.md — PASS-WITH-WARNINGS

- **Phase 14 execution** (Wave 1+2+3):
  - Wave 1 parallel: 14-01 codex-exec.sh wrapper (c95debe + 06dd9c6), 14-03 config.json review_providers block + known-keys patch (8fb7d49 + f6488d0)
  - Wave 2 solo: 14-02 review-providers.yaml + providers-registry.cjs + 2 agent stubs + gates.yaml extension (4 commits)
  - Wave 3 solo: 14-04 contract-check.mjs + fixtures + make-fixtures.sh + verify.mjs (~4 commits, including +x fix on codex-exec.sh)

- **Phase 14 close gates** (commit 96312dd):
  - Per-dispatch ATC 14-01: PASS-WITH-WARNINGS (0 critical, 2 warnings, 3 info)
  - Per-dispatch ATC 14-02: PASS-WITH-WARNINGS (0 critical, 3 warnings, 3 info)
  - Phase-level ATC (Step 6.5): PASS-WITH-WARNINGS (0 critical, 5 warnings)
  - Verifier: clean PASS — all 6 V-predicates green, 0 D-24 leaks, VTP bypass preserved
  - MUDA (Step 6.55): 0 WARN, 0 FAIL
  - Browser verify (Step 6.6): SKIPPED (no frontend globs)

## 5 Phase-14-ATC Warnings — Phase 15 Entry Conditions

Read `.planning/milestones/v1.3/phases/14-codex-cli-provider-substrate/14-ATC-REVIEW.md` for full detail. Rollup:

1. **W-1 (semantic)** — `providers-registry.resolveReviewerProvider` returns the default `claude-sonnet-reviewer` for gates that have NO `reviewer_provider:` field (e.g. `intent-injection`, classifier, MUDA gates). Should return null for non-reviewer-shaped gates. Fix: add shape detection via gate-name prefix or explicit opt-in field.
2. **W-2 (doc drift)** — `gates.yaml` `registry_version` / `last_updated` header not bumped despite Plan 14-02 T3 directing it. Cosmetic; no runtime impact.
3. **W-3 (plan typo)** — Plan 14-02 T2 verification command used `g.invocation_type` instead of actual field `g.invocation`. Plan-document bug; executor followed the real field.
4. **Phase-ATC W-4** — Codex-exec.sh JSONL `--phase` / `--plan` passthrough unvalidated — if caller passes non-numeric, JSONL row becomes invalid. Input validation needed before Phase 15 lets orchestrator call it live.
5. **Phase-ATC W-5** — `contract-check.mjs` divergence emitted informationally per D-15a (correct) but no follow-up surface records divergence trends across time. Consider a divergence-log.jsonl for Phase 15 to track Claude/Codex contract drift.

## Next Action

Start Phase 15 discuss: `/sgsd-discuss-phase 15`

Phase 15 (Codex-Routed Gates + Qualitative MUDA Probe) should:

1. **Consume VTP evidence** (no longer bypassed — Codex's upstream fix to Voice-Text-Plan lets `mcp__vtp-kb__*` tools resolve kb-data correctly). Before discuss, orchestrator writes real `15-VTP-EVIDENCE.md` via `vtp_route_and_retrieve`.
2. **Address the 5 Phase-14-ATC warnings** as scoped decisions (especially W-1 semantic gap and W-4 JSONL validation — these are correctness-adjacent).
3. **Answer the VTP-consumption-by-codex-reviewer question** (deferred in Phase 14 14-CONTEXT line 269): should `sgsd-codex-reviewer` read `VTP-EVIDENCE.md` as prompt-file context? Options include `--vtp-evidence` arg on codex-exec.sh, `vtp_consumes:` field on review-providers.yaml, or skip entirely.
4. **Wire `sgsd-orchestrate/SKILL.md` Steps 6.5 / 9.5 / 9.6** to honor the registry's `invocation_type` discriminator — this is the "flip the switch" work Phase 14 explicitly deferred per D-11.
5. **Set config.review_providers.codex_enabled = true** on test machines with both CLIs authenticated.

## Remaining Work

**v1.3 milestone**:
- Phase 14 ✓ COMPLETE
- Phase 15 ⏳ NEXT (context may already be staged — check `.planning/milestones/v1.3/phases/15-codex-routed-gates/` for existing `15-CONTEXT.md` and `15-DISCUSSION-LOG.md`)
- Phase 16 ✓ SHIPPED

**Post-Phase-15 — milestone close**:
- `/sgsd-audit-milestone v1.3`
- `/gsd-complete-milestone`

## VTP Status (for Phase 15)

- **vtp-kb MCP**: OPERATIONAL as of 2026-04-23. Codex fixed `process.cwd()` root-resolution bug upstream at `Voice-Text-Plan/src/mcp/project-root.ts`. Verified via `mcp__vtp-kb__vtp_list_projects` + `mcp__vtp-kb__vtp_search` returning clean semantic results (no ENOENT).
- Phase 15 MUST consume VTP evidence (per `feedback_vtp_enriched_dispatch.md` memory rule — silent bypass regresses the primitive).
- Write real `15-VTP-EVIDENCE.md` with `selected_query` + top-3 doc-IDs + evidence bundle before the first Phase 15 research/pattern/plan dispatch.
