# v1.4 Codex Kill-Condition Check (CODEX-12)

## Config state at milestone close

- `review_providers.codex_enabled: true`
- `review_providers.codex_timeout_seconds: 180`
- `review_providers.codex_timeout_tiers: { default: 60, review: 120, analysis: 180 }`

## Decision

**KEEP Codex** — kill-condition does NOT fire.

## Rationale

v1.4 dogfood data:
- 16 Codex invocations, 1925s wall-clock, ~32k Claude tokens saved
- 4 CRITICALs surfaced + 4 cleared (all via operator-directed fix-now cycles)
- 0 fallbacks triggered to claude-sonnet-reviewer
- 0 parse_failures observed in production
- 2 timeouts (both review-tier → analysis-tier retry resolved)
- Richer-output contract: partial adoption in Round 3 of Phase 20 (Codex emitted file:line detail spontaneously)

Kill-condition thresholds (CODEX-12):
- `kill_critical_count_delta: 5` — actual 4 CRIT, all cleared, delta 0 — NO KILL
- `kill_claude_tokens_saved: 50000` — actual ~32k saved, below 50k threshold, but this is a **keep-threshold** not a kill-threshold — NO KILL

Codex stays enabled for v1.5+.
