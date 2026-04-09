# Phase 5 Context: Strategic Deliberation

## What This Phase Delivers

CEO/Board multi-agent debate system for architecture decisions with automatic gating.

## Existing Assets

- `super-gsd/skills/gsd-deliberate/SKILL.md` — full 6-step deliberation flow
- `super-gsd/agents/gsd-ceo.md` — CEO orchestrator (Opus, manages rounds, synthesizes memos)
- `super-gsd/agents/board-architect.md` — technical feasibility/risk
- `super-gsd/agents/board-pragmatist.md` — timeline/scope/delivery
- `super-gsd/agents/board-contrarian.md` — challenge assumptions, find blind spots
- `super-gsd/agents/board-moonshot.md` — ambitious options with concrete first steps
- `super-gsd/templates/brief-template.md` — Situation/Stakes/Constraints/Key Questions
- `super-gsd/templates/decision-memo.md` — full memo format with frontmatter
- `.planning/briefs/` — brief storage directory (exists)
- `.planning/decisions/` — memo storage directory (exists)
- `.planning/deliberations/` — debate log storage (exists)

## What Is Missing

1. **Termination conditions** — no hard cap on rounds (infinite loop risk)
2. **Haiku gate** — no phase-impact scoring before spawning board (trivial triggers)
3. **Gate wiring in SKILL.md** — step 1 has no pre-flight check
4. **Brief template** — no termination metadata fields
5. **End-to-end test** — no verified flow from brief creation to memo output

## Design Decisions Already Made

- Board runs in parallel on Sonnet (cost control)
- CEO runs on Opus (synthesis quality)
- Gate runs on Haiku (cheap pre-flight)
- Token budget: 10,400 (1 round) to 16,400 (2 rounds)
- Memos land in `.planning/decisions/DLB-{NN}-{slug}.md`
- Debate logs in `.planning/deliberations/{date}-{slug}/`

## Phase Boundary

Phase 5 does NOT build the ATC quality gates (Phase 4). The Haiku gate here is deliberation-specific: it checks whether a decision has 3+ phase impact before spawning the board. This is separate from the commit classification gate in Phase 4.
