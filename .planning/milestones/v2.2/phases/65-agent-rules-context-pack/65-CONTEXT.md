---
phase: 65
phase_name: Agent Rules Context Pack
milestone: v2.2
roadmap: warp-integration
created: 2026-04-29
operator: user
status: in-progress
deviation_from_standard: docs-only (Step 1 pattern-mapper skipped, Step 7 MUDA skipped, ATC docs-only LITE tier)
unblocked: yes (does not depend on M1-M5 manual UI checks)
---

# Phase 65 — Agent Rules Context Pack (CONTEXT)

## Goal

Make Warp Agent and other local agents (Codex, Claude Code, future ACP clients)
understand SGSD without loading the full ~3000-line CLAUDE.md handbook. Establish
the rule-file hierarchy and codify the don't-duplicate-SGSD-gates / read-state-from-.planning
/ VTP-optional constraints in a tool-neutral file.

## Locked Scope (D65.1-D65.5)

- **D65.1**: AGENTS.md is the new tool-neutral all-agent rules file. Strict
  compactness target: ≤ 150 lines. Must NOT copy or paraphrase CLAUDE.md beyond
  what is essential to the agent-neutral contract.
- **D65.2**: WARP.md remains Warp-specific operator guidance and continues to
  take priority in Warp if both files are present (Warp documented behavior).
  Phase 65 update is additive only — no removal of existing daily-commands
  content; add a "Rule Hierarchy" section near the top explaining the layering.
- **D65.3**: CLAUDE.md is untouched. It remains Claude Code's deep orchestrator
  contract. AGENTS.md must explicitly point readers at CLAUDE.md for orchestrator
  behavior rather than duplicating it.
- **D65.4**: VTP / private knowledge bank optionality is a first-class rule.
  AGENTS.md must say: "VTP / private KB is optional; agents must degrade
  gracefully when it is absent." This protects non-operator installs (the v2.1
  Phase 61 README refresh did the user-facing version of this; AGENTS.md does
  the agent-instruction version).
- **D65.5**: SGSD truth locations are explicit. AGENTS.md lists the canonical
  files agents must read from (`.planning/STATE.md`, `.planning/ROADMAP-AGENT.md`,
  `.planning/ORCHESTRATOR-CHECKPOINT.md`, `.planning/metrics/*.jsonl`,
  per-phase artifact folders). Forbids agents from inventing phase status or
  reading SGSD state from terminal scrollback.

## Inputs Consumed

- `.planning/analyses/2026-04-29-warp-ecosystem-atlas.md` (Layer 3 / Rules section)
- `.planning/analyses/2026-04-29-sgsd-warp-convergence-audit.md` (§Crossover-2 Warp Rules vs CLAUDE.md)
- `.planning/milestones/warp-integration/ROADMAP.md` (Phase 65 task list + acceptance)
- `WARP.md` (current state; will be updated)
- `CLAUDE.md` (referenced; not modified)
- `README.md` (referenced for VTP-optional language patterns established in Phase 61)
- `.planning/milestones/v2.2/WARP-SMOKE.md` (Phase 63 evidence; informs M5 / Codebase-Context guidance)

## Outputs

- `AGENTS.md` (NEW, repo root)
- `WARP.md` (UPDATED, additive rule-hierarchy section)
- Phase 65 standard artifacts: 65-CONTEXT.md (this file), 65-01-…-PLAN.md,
  65-RESEARCH.md, 65-VERIFICATION.md, 65-ATC-REVIEW.md

## Acceptance

1. `AGENTS.md` exists at repo root, ≤ 150 lines, with these sections:
   - Project + truth locations
   - Rule hierarchy (AGENTS.md → WARP.md → CLAUDE.md priority)
   - Daily-commands pointer (delegate to WARP.md, do not duplicate)
   - Hard rules: do-not-duplicate-SGSD-gates / read-state-from-.planning /
     VTP-optional / preserve-sg-topology / no-source-mutations-without-plan
   - SGSD command catalogue summary (5-10 lines max)
   - Pointer to CLAUDE.md for Claude Code orchestrator contract
2. `AGENTS.md` does NOT contain a copy of the CLAUDE.md content (verified via
   diff/wc — AGENTS.md must not exceed 30% the byte-size of CLAUDE.md).
3. `WARP.md` gains a "Rule Hierarchy" section near the top, listing the three
   files and which one wins in Warp.
4. `WARP.md` daily-commands and project-shape sections preserved verbatim
   (additive update only).
5. Phase 65 artifacts complete; standard SGSD frontmatter; close commit
   atomic + isolated under `.planning/milestones/v2.2/phases/65-…/` plus
   the two repo-root files (AGENTS.md, WARP.md).

## Hard Boundaries (from operator brief)

- Rule 2 ("Do not duplicate features already implemented in SGSD") — AGENTS.md
  must POINT to existing SGSD primitives, not re-implement them.
- Rule 6 ("Keep VTP/private KB optional") — first-class in AGENTS.md.
- Rule 9 ("Do not make Warp Agent task lists or plans canonical SGSD state") —
  encoded as an explicit AGENTS.md rule.
- Rule 10 (".planning remains durable source of truth") — encoded as an explicit
  AGENTS.md rule.

## Out Of Scope

- Modifying CLAUDE.md (D65.3).
- Authoring `.warpindexingignore` (deferred to a v2.2 follow-up phase, see
  Phase 63 finding E.1).
- Adding new workflows (Phase 64 owns this).
- Building warp-doctor (Phase 67).
- Building MCP server (v2.3).

## Decisions Locked At Phase Open

- D65.6: Phase 65 is dispatched without operator confirmation per `/sgsd-orchestrate go`
  auto-mode contract. M1-M5 manual UI checks do NOT block Phase 65 because
  AGENTS.md / WARP.md authorship does not depend on Warp Command Search /
  utility-bar visibility / Codebase Context indexing — those are M1/M2/M3/M5
  Warp-runtime concerns, not authoring concerns.
- D65.7: AGENTS.md cap = 150 lines. Hard cap. If draft exceeds, executor
  must compress before commit. Reason: agents loading this file every session
  pay context cost; ~150 lines ≈ ~2k tokens is the right ceiling.
