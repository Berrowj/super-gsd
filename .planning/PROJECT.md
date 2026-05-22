# Super GSD Framework

## What This Is

A typed, auditable autonomous software-delivery engine. You give it a roadmap,
say *go*, and it researches, plans, builds, reviews, gates, and closes the work
phase after phase while keeping a complete, evidence-backed record of everything
it did and everything it deliberately did not do.

It is built on one architectural rule: **the control plane and the execution
fabric are two different things.** A stateful orchestrator (Claude / Opus 4.7)
owns state, gates, memory, and promotion — and never writes code. A stateless
executor (Codex GPT-5.5 at xhigh) does the bounded code work, one locked plan at
a time. Nothing reaches the main branch without evidence a human or a
deterministic gate can re-check.

Built on the GSD 1.0 skill base, it adds the autonomous orchestrator loop,
CEO/Board deliberation, a project-local memory tier with role-filtered mesh
memory, ATC quality gates, the Chronicle Layer, and the answer-first Cockpit.

## Core Value

Ship an autonomous framework that any Claude Code Max plan user can install with
one command and immediately start building software — with the AI managing its
own token efficiency, provider routing, memory, quality gates, crash recovery,
and operator comprehension.

## Current State

**Shipped:** v3.2 Operator Comprehension System (2026-05-22) — 8 phases
(P120-P127). DLB-12 complete: the chronicle HTML upgraded to a book-mined gold
reference (chronicle self-test 111/111) and the live cockpit rebuilt answer-first
(cockpit self-test 18/18), both governed by one shared design system and 12
book-grounded comprehension rules. Cross-surface conformance machine-checked.
See `.planning/milestones/v3.2/SUMMARY.md`.

**The v3.x line (operator-facing):**
- v3.0 SGSD-PRO (2026-05-21) — DLB-08 Mesh Memory Lite + DLB-09 Codex Pro Mode +
  DLB-10 Context Authority. 7 phases (P106-P112); 232 self-test assertions
  across 4 integrated runners; 4/4 MVP fixtures green.
- v3.1 Chronicle Layer (2026-05-21) — DLB-11. 7 phases (P113-P119); every phase
  close ships a validated HTML projection of SGSD truth; 96/96 self-test.
- v3.2 Operator Comprehension System (2026-05-22) — DLB-12.

**Earlier line:** v1.1-v1.5 (foundation, evidence-first sharpening, multimodal
Codex review, VTP knowledge primacy), v1.6-v2.1 (cockpit, command contracts,
gate fitness, research routing, failure injection, distribution — ROADMAP
COMPLETE 2026-04-29), v2.2-v2.8 Warp integration, v2.9 Agentic Harness Evolution.
Full history in `.planning/MILESTONES.md`.

**Provider model (current).** Claude / Opus 4.7 orchestrates only — judgment,
dispatch, synthesis, gates, promotion. Codex GPT-5.5 at xhigh reasoning effort
is the execution fabric for all research, planning, plan-check, code execution,
verification, spec-review, ATC, and gate work. Sonnet/Haiku are not default
providers; the legacy Claude worker agents are disabled for code execution.

## Next Milestone

v3.3 scoping is an open operator decision. Queued debt from v3.2:
conformance-gate promotion (advisory → binding on the chronicle path), cockpit
live-data threading (`prior_fog_high` from STATE/ledger), a full canonical
STATE.md re-sync, and resolving the Windows Codex `CreateProcessAsUserW 216`
read-block so executor dispatches stop needing full-file in-report emission.

## Key Decisions

- D001: Claude/Opus 4.7 orchestrates only (never writes code); Codex GPT-5.5/xhigh is the execution fabric — research, planning, code, verification, gates
- D002: Compressed XML plans (~800 tokens vs ~2,000 prose); v2 YAML-frontmatter plan schema is canonical
- D003: Structured 300-word agent reports
- D004: JSONL token logging
- D005: Frontmatter-only reads + `sgsd-recall` over `.planning/memory/`
- D006: No API keys — Max plan OAuth only
- D007 (DLB-01): Git-native filesystem memory tier at `.planning/memory/`, no MCP, 40-file tripwire (ByteRover removed)
- D008 (DLB-02): MUDA write-path only with kill condition
- D009 (DLB-03): Structural intent injection + cascade rule + coverage kill check
- D010 (DLB-04): Scoped Agents manifest + operator-gated SEPL + trajectory-hypothesis distillation
- D011 (2026-04-21 retro): FLOOR gate operates per-brief; cascade does not trigger re-inheritance
- D012 (2026-04-21 retro): AGP-P-02 resource-protocol scope is a floor, not a ceiling
- D013 (2026-04-21 retro): Lightweight decision-note format `YYYY-MM-DD-slug.md` sits alongside `DLB-NN` for below-FLOOR revertable decisions
- D014 (DLB-07): Semantic verification — plans need real-data `semantic_acceptance_criteria`; structural pass alone cannot close a phase
- D015 (DLB-08): Mesh Memory Lite — 7 typed CMB classes; a claim CMB is never treated as an observation CMB; hard operator carve-outs survive any confidence level
- D016 (DLB-11): A phase is not cognitively complete until the operator can understand it — chronicle validation is a binding phase-close gate

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
*Last updated: 2026-05-22 after v3.2 milestone close*
