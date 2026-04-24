# Super GSD Framework

## What This Is

A token-efficient, multi-agent autonomous orchestrator built on GSD 1.0.
Combines the best of GSD 1.0 (68 skills, 24 agents), GSD 2.0's orchestrator
patterns (auto loop, checkpoint survival, dispatch rules), and new capabilities
(CEO/Board deliberation, ByteRover memory, model routing, ATC quality gates,
Overwatcher signal maps). Post-v1.1: adds self-auditing discipline, evidence
gates, FLOOR governance, and a trajectory-distillation substrate for
cross-milestone learning.

## Core Value

Ship an autonomous framework that any Claude Code Max plan user can install with
one command and immediately start building software — with the AI managing its own
token efficiency, model selection, memory, quality gates, and crash recovery.

## Current State

**Shipped:** v1.4 Clean Close + Codex Visibility + Autonomous Handoff (2026-04-24) — 4 phases (17-20), 10 plans, ~110 commits, 17/17 REQ-IDs, 16 Codex invocations + ~32k Claude tokens saved, all CRITs cleared, handoff disabled by default. See `.planning/milestones/v1.4/SUMMARY.md`.

**Previously shipped:**
- v1.1 Self-Audit (2026-04-21) — 8 phases, 15 plans, full gap audit + 6/6 verifier + evidence L1/L2 PASS + ATC LITE clean
- v1.2 Evidence-First Sharpening (Phases 9-13, formally closed 2026-04-24 via v1.4 CLEAN-06 — `git tag v1.2`)
- v1.3 Multimodal Review — Codex Integration (2026-04-24) — 3 phases (14-16), 12 plans, first live Codex invocation + provider substrate shipped

**v1.3 Historic moment:** First live Codex sub-agent invocation captured 2026-04-24T02:39:05Z via the MUDA qualitative probe path. The config → `resolveReviewerProvider` → `shellDispatch` → `codex-exec.sh` → `codex exec` pipe is operational end-to-end (`model: gpt-5.4, sandbox: read-only`). SGSD is now cross-vendor at review-shaped gate surfaces.

**Post-milestone landing (pre-v1.3):** DLB-01..06 deliberations shipped (memory topology, MUDA write-path, intent continuity, resource substrate, VTP audit sharpening, central distribution) plus SGSD v2 Phase A-E (registry + 8 executors + heartbeat + statusline + mission-control tile).

## Current Milestone: v1.5 VTP Knowledge Primacy + Post-v1.4 Hardening

**Goal:** Elevate the VTP knowledge library (operator-curated books, papers, prior research) from passive MCP server into active enrichment gate on every research + audit decision, close Phase 20 Codex-acknowledged security surfaces, calibrate MUDA aggregation across 3-phase accumulated findings, fully adopt richer-output contract Codex began emitting spontaneously in v1.4 Phase 20, and close Phase 17-19 carryover WARNs + wire edge-guard + dashboard math + timeout observability. Operator directive 2026-04-24: *"lean on VTP MCP for enrichment of ideas, problem solving, forward thinking... extra gates towards the end of each research phase that calls on the MCP to enrich or come up with a better idea from our library."*

**Design posture (Q1-Q4 locked during scoping):**
- Q2=B enrich-only — no challenger mode (preserves autonomy)
- Q3=A hard-required artifact — VTP-ENRICHMENT.md MUST exist; empty-hit continues autonomously with explicit zero-hits statement; only VTP API errors block

**Target features (6 categories, 21 REQ-IDs, 5 phases, 13 plans):**

- **VTPE (Phase 21 — VTP Enrichment Gates):** research→planning enrichment gate, audit workflow cross-reference (sgsd-audit + sgsd-muda-audit + gsd-audit-milestone), milestone-close library cross-reference, design-policy config locks, empty-hit artifact discipline, **sgsd-board-researcher 5th deliberation voice** (queries VTP library during CEO/Board rounds)
- **SEC (Phase 22 — Security Hardening):** symlink canonicalize on handoff paths, fs flock concurrent-write guard on handoff-log.jsonl
- **MUDAC (Phase 23 — MUDA Calibration):** 5-probe aggregation loop completeness, inventory threshold recalibration, sgsd-muda-probe.sh flat-path mirror-fix, summary text accuracy vs raw JSON verdict
- **CONTRACT (Phase 24 — Richer Output Contract):** FINDINGS_DETAIL prompt-engineering follow-up, validateContract extended parsing, ATC-REVIEW.md detail rendering
- **CARRY + INSTR (Phase 25 — Carryover + Telemetry):** awk anchor sentinel-replace, providers-registry JSDoc narrative audit, dogfood audit strictness (filter fallback rows), edge-guard layer wiring, dashboard offload math audit, timeout observability metric

**Dependencies:** Phase 17 ∥ Phase 18 (independent). Phase 19 benefits from Phase 18's real Codex activity. Phase 20 serializes after Phase 19 (needs MC surfaces to extend).

**Success criteria for milestone close:**
- Zero v1.3 carry-over tech debt items remaining open
- `git tag v1.2` exists; v1.2 archive files in place
- At least one `.planning/phases/*/commit-reviews.jsonl` row with `provider: openai-codex` and valid FINDINGS contract
- Mission-control dashboard visibly reflects Codex activity during autonomous runs
- **Autonomous handoff proven end-to-end:** at least one emergency_halt checkpoint during v1.4's own phases triggers the Stop hook, spawns a fresh claude session, resumes at next_unit without operator intervention. `.planning/metrics/handoff-log.jsonl` contains the chain event as evidence.

## Key Decisions

- D001: Opus orchestrates, Sonnet executes, Haiku classifies
- D002: Compressed XML plans (~800 tokens vs ~2,000 prose)
- D003: Structured 300-word agent reports
- D004: JSONL token logging
- D005: Frontmatter-only reads + brv-query-local
- D006: No API keys — Max plan OAuth only
- D007 (DLB-01): Git-native filesystem memory tier, no MCP, 40-file tripwire
- D008 (DLB-02): MUDA write-path only with kill condition
- D009 (DLB-03): Structural intent injection + cascade rule + coverage kill check
- D010 (DLB-04): Scoped Agents manifest + operator-gated SEPL + trajectory-hypothesis distillation
- D011 (2026-04-21 retro): FLOOR gate operates per-brief; cascade does not trigger re-inheritance
- D012 (2026-04-21 retro): AGP-P-02 resource-protocol scope is a floor, not a ceiling
- D013 (2026-04-21 retro): Lightweight decision-note format `YYYY-MM-DD-slug.md` sits alongside `DLB-NN` for below-FLOOR revertable decisions

## Constraints

- No API keys — everything via Claude Code Max plan OAuth
- Must work on Windows (WSL2), macOS, Linux
- Must not break existing GSD 1.0 skills
- Token efficiency is the load-bearing architectural constraint
- FLOOR-gate governance: revertable (≤2h) below-floor decisions ship with lightweight note; reopen triggers recorded per decision

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition:**
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Current State + Next Milestone Goals refreshed
4. Key Decisions audit

---
*Last updated: 2026-04-21 after v1.1 milestone archive*
