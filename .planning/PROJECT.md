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

**Shipped:** v1.3 Multimodal Review — Codex Integration (2026-04-24) — 3 phases (14, 15, 16), 12 plans, 66 commits, 41 files changed, first live Codex invocation confirmed. See `.planning/milestones/v1.3-ROADMAP.md`.

**Previously shipped:**
- v1.1 Self-Audit (2026-04-21) — 8 phases, 15 plans, full gap audit + 6/6 verifier + evidence L1/L2 PASS + ATC LITE clean
- v1.2 Evidence-First Sharpening (Phases 9-13, shipped but never formally closed — retroactive close carries to v1.4)

**v1.3 Historic moment:** First live Codex sub-agent invocation captured 2026-04-24T02:39:05Z via the MUDA qualitative probe path. The config → `resolveReviewerProvider` → `shellDispatch` → `codex-exec.sh` → `codex exec` pipe is operational end-to-end (`model: gpt-5.4, sandbox: read-only`). SGSD is now cross-vendor at review-shaped gate surfaces.

**Post-milestone landing (pre-v1.3):** DLB-01..06 deliberations shipped (memory topology, MUDA write-path, intent continuity, resource substrate, VTP audit sharpening, central distribution) plus SGSD v2 Phase A-E (registry + 8 executors + heartbeat + statusline + mission-control tile).

## Current Milestone: v1.4 Clean Close + Codex Visibility

**Goal:** Sweep v1.3 carry-over tech debt, harden Codex to full operational reliability on real task loads, wire Codex activity into mission-control visibility surfaces. No net-new feature scope — this is a sharpening milestone.

**Target features (3 categories, 14 REQ-IDs, 3 phases, 7 plans):**

- **CLEAN (Phase 17 — Debt Sweep):** providers-registry.cjs refresh, sgsd-muda-audit WASTE.md display fix, backfill missing plan SUMMARYs, P5 Codex Monitor retroactive artifact, REQUIREMENTS.md hygiene, v1.2 retroactive milestone close + tag, codex_timeout workload tiers
- **CXOPS (Phase 18 — Codex Hardening):** codex-exec.sh --self-test probe, runtime contract validator + parse_failure fallback, dogfood per-dispatch + phase-level ATC via Codex on a live phase
- **MC (Phase 19 — Mission Control Visibility):** Codex tile in mission-control, statusline Codex indicator, narrative Codex event capture, live-feed codex-log tail, dashboard Multimodal Review Offload tile

**Dependencies:** Phase 17 ∥ Phase 18 (independent). Phase 19 benefits from Phase 18 producing real Codex activity to visualize, but not strictly blocked.

**Success criteria for milestone close:**
- Zero v1.3 carry-over tech debt items remaining open
- `git tag v1.2` exists; v1.2 archive files in place
- At least one `.planning/phases/*/commit-reviews.jsonl` row with `provider: openai-codex` and valid FINDINGS contract
- Mission-control dashboard visibly reflects Codex activity during autonomous runs

**New scope candidates:** To be determined via `/gsd-new-milestone v1.4` questioning + research + requirements definition pass.

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
