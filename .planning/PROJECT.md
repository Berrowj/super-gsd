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

## Next Milestone Goals (v1.4 — to be scoped)

v1.4 will likely bundle v1.3 tech debt + v1.2 retroactive close:

**v1.3 tech debt carry-over (7 items):**
1. `codex_timeout_seconds` tuning (60s → 120-180s for qualitative analysis workloads)
2. `providers-registry.cjs` WR-01 stale JSDoc + WR-02 dead code branch
3. `sgsd-muda-audit.sh` WASTE.md display inconsistency (table vs raw JSON)
4. Missing plan SUMMARYs (15-01, 15-03)
5. P5 Codex Monitor `.planning/` artifact backfill (commit c8b2d25)
6. REQUIREMENTS.md staleness (still v1.2 scope)
7. v1.2 retroactive formal close (archive + tag)

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
