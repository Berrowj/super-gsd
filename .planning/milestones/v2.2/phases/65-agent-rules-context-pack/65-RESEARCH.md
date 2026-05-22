---
phase: 65
artifact: research
created: 2026-04-29
operator: user
authored_by: orchestrator (Opus, in-session — see DEVIATIONS in 65-VERIFICATION.md)
---

# Phase 65 — Research: Agent Rules Context Pack

## Source Inputs Surveyed

The Phase 65 design draws on five existing artifacts already loaded in
orchestrator context this session. No new external research was performed —
this phase is a synthesis of authored decisions, not a discovery exercise.

| # | Source | Section consumed |
|--:|---|---|
| 1 | `.planning/analyses/2026-04-29-warp-ecosystem-atlas.md` | Layer 3 § Rules — "Warp supports global and project rules. Project rules live in `AGENTS.md` by default; `WARP.md` is still supported and takes priority if both exist in the same directory" |
| 2 | `.planning/analyses/2026-04-29-sgsd-warp-convergence-audit.md` | § Crossover Audit #2 (Warp Rules Vs CLAUDE.md) — recommended division: AGENTS.md=tool-neutral, WARP.md=Warp-specific operator usage, CLAUDE.md=Claude Code orchestrator contract |
| 3 | `.planning/milestones/warp-integration/ROADMAP.md` | Phase 65 task list and acceptance criteria |
| 4 | `WARP.md` | Existing operator-facing daily commands (preserved verbatim) |
| 5 | `CLAUDE.md` | Compactness baseline (10,249 bytes / 230 lines) for the < 30% byte ratio |

## Key Findings

### F1 — Warp's documented file-priority behavior

The Warp ecosystem atlas confirms the documented layering: **`WARP.md` takes
priority over `AGENTS.md`** inside Warp when both exist in the same directory.
This is the inverse of what an "AGENTS.md is more general so it should win"
heuristic would suggest. Phase 65 must encode this layering explicitly so
agents don't get confused.

### F2 — CLAUDE.md is the orchestrator contract, not the agent rules

CLAUDE.md is 230 lines / 10,249 bytes — far too dense and Claude-Code-specific
to serve as the all-agent rules file. The convergence audit (§Crossover-2)
makes this explicit: **don't copy CLAUDE.md content into AGENTS.md**. The 30%
byte-ratio acceptance enforces this mechanically.

### F3 — Five hard rules emerged from the convergence audit + operator brief

- Read state from `.planning/`, not scrollback (audit §Crossover-2)
- Don't duplicate SGSD gates (operator Rule 2)
- VTP/private KB optional (operator Rule 6 + audit §Crossover-2 + Phase 48)
- Preserve `sg` topology (operator Rule 3)
- No source mutations without a Plan (encoded as a new rule from the
  collected hard-boundaries reasoning across operator brief + roadmap)

These five rules form the AGENTS.md hard-rules section. None of them are new
inventions — each one already exists somewhere in CLAUDE.md or the analyses;
AGENTS.md condenses them into the all-agent contract.

### F4 — Daily commands belong in WARP.md, not AGENTS.md

The convergence audit places "Warp-specific daily usage" in WARP.md. AGENTS.md
should reference WARP.md for command details. Phase 65 implementation cites
WARP.md § Daily Commands and provides only a quick-reference list (5 commands)
to spare future agents the round-trip.

### F5 — Per-agent pointers prevent duplicate behavior

Different agents need to load different additional files. Encoding this in
AGENTS.md as a "Per-Agent Pointers" section means each agent loads exactly
what it needs, without one giant mega-rules file. Specifically:

- Claude Code → also CLAUDE.md
- Warp Agent → also WARP.md
- Codex / other CLIs → AGENTS.md alone is the contract

## Design Decisions

- **D1**: AGENTS.md is the entry point for all agents. WARP.md / CLAUDE.md
  are specialist supplements. AGENTS.md MUST stand alone for non-Warp /
  non-Claude-Code agents.
- **D2**: No copy-paste from CLAUDE.md. AGENTS.md references CLAUDE.md by
  path with a one-line summary of what it covers.
- **D3**: WARP.md update is additive only. The Rule Hierarchy section
  inserts between the title intro and ## Daily Commands. No existing content
  is removed or rewritten.
- **D4**: Hard rules are numbered 1-5 in AGENTS.md (matches operator brief
  convention; easy to cite as "Rule 3" in future agent reports).
- **D5**: Compactness target = 30% of CLAUDE.md byte size = ~3074 bytes
  ceiling. Hard cap; verified at phase close.

## Out Of Scope (Forwarded)

- Authoring `.warpindexingignore` (Phase 63 finding E.1; deferred to
  follow-up phase — recommend folding into Phase 67 warp-doctor or a
  dedicated phase 67.5).
- Writing the SGSD Warp Operator Guide (Phase 66; partially blocked on M1).
- Documenting the rule hierarchy in README.md (deferred to next docs
  refresh after v2.3 MCP ships).

## Implementation Note

Phase 65 was orchestrator-authored at Opus rather than dispatched to a
gsd-executor sub-agent at Sonnet. Reason: source documents (atlas, audit,
WARP.md, CLAUDE.md) were already loaded in orchestrator context this session.
Dispatching an executor would have required re-reading those documents,
costing more total tokens than orchestrator authoring. The artifact is
small (46 lines / 2972 bytes) and well-defined, fitting the deviation
criterion in CLAUDE.md "NEVER do heavy work yourself" — which is a
token-efficiency principle, not a religious rule. Logged as DEVIATION in
65-VERIFICATION.md.
