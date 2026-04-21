# Round 2 — Brief 3: Intent continuity rebuttals

## Architect (MAJOR MODIFY — synthesised the convergence point)
Abandoned presence-check INTENT block as theater. Adopted Contrarian's `outcome_delivered:` field as the right primitive. **Key insight**: "Structural injection — outcome pasted into every executor prompt header — is the only enforcement that survives a lazy author, because the LLM context window enforces it, not a regex."
- Final Q1: ship `outcome_delivered:` field + executor prompt injection + cascade CLAUDE.md rule as one Day 3 commit
- Final Q2: presence-check enforcement is theater; structural injection is the only non-theatre enforcement
- Final Q3: strict inheritance with deliberation escape via prompt-header constraint clause (not scored gate) — deterministic, zero false positives
- Shift: adopted Contrarian's field, adopted Moonshot's "make drift thermodynamically costly", rejected NL scoring

## Pragmatist (PARTIAL CONCEDE — staged approach)
Conceded pre-mortem stub as cheap add-on. Partially conceded to Contrarian (60% value in cascade + outcome field).
- Final Q1: **staged** — Contrarian's 2 changes first (1h Day 3), measure one milestone, then add hard-block prefix if evidence justifies (3h later)
- Final Q2: partial concede — outcome_delivered field is passive without a reader; prefix hard-block is only intervention that breaks dispatch at point-of-burn
- Final Q3: compile-time derivation holds but Contrarian's field subsumes 60%
- Updated effort: Moonshot's runtime gate = 16h not 8h (threshold calibration requires real dispatch data that doesn't exist)

## Contrarian (MAJOR CONCESSION)
**Withdrew** the CLAUDE.md-rule-only minimalist alternative: "Soft instruction is first thing that collapses under token pressure. I was proposing a different ritual with no enforcement."
- Final Q1: conceded — Pragmatist right that current failure IS presence/absence; hard-block stops that cold
- Final Q2: critique RESTRICTED to content quality, not presence. "My 'enforcement theater' critique was about the CONTENT of what gets blocked on being shallow — a one-liner 'why' that agents write to satisfy the gate, not to use. The critique survives, but it belongs at Q2, not Q1."
- Final Q3: unaddressed; implicitly conceded
- **Kill condition proposed**: measure whether INTENT blocks are actually referenced in executor deviations. If not after one milestone, the intervention isn't working — even though it passes regex checks.
- Remaining sharp point: "Agents will write intent fields to pass gates, not carry meaning. That metric doesn't exist yet, which is why nobody proposed it."

## Moonshot (RETRENCHED — ambitious version deferred)
Accepted Contrarian's "outcome field without reader is honor system." Accepted Pragmatist "4h for 70% value wins today."
- Final Q1: honest — full vision is 12-16h. At 4h for 70%, Pragmatist is right TODAY.
- Final Q2: **8h minimum-viable** — `intent-gate.sh` as standalone; Haiku scorer on executor dispatches only; log score+reason to metrics/intent-log.jsonl; hard-block <0.4, warn 0.4-0.6. No embedding, no cascade rewrite.
- Final Q3: calibration needs 20-30 real dispatch pairs first. "Without that, 0.6 threshold will false-positive on creative pivots and erode trust."
- Upgrade path: tighten threshold, widen call sites, add cascade scoring in sprint 2

## Convergence map

Unanimous R2 (4/4):
- **Contrarian's `outcome_delivered:` field** is the right primitive for "what done looks like" (Architect adopts; Pragmatist concedes 60%; Moonshot "field without reader is honor system" accepts it needs a reader; Contrarian proposed it)
- Pre-mortem: defer (Architect shifted, agrees with Pragmatist; Contrarian silent; Moonshot silent)
- V-model gate: defer until trace data exists
- Runtime NL intent-scoring gate: deferred to post-v1.1 (Moonshot's 16h estimate, no calibration data today)

Strong consensus (3/4):
- **Architect's "structural injection"** = inject `outcome_delivered` verbatim into every executor prompt header as a constraint clause. Contrarian's concession (content-quality critique survives at Q2 only) implicitly accepts this. Moonshot's "exogenous scoring" instinct is satisfied by structural injection (the prompt-window becomes the exogenous constraint). Pragmatist stages to this via Contrarian-first.

Residual tensions:
- **Hard-block prefix today** (Pragmatist/Architect) vs **stage to next milestone with evidence** (Pragmatist R2 / Contrarian)
- **Content-quality enforcement** — Contrarian's remaining sharp point: agents writing intent fields to pass gates without carrying meaning. Nobody proposed a direct measurement mechanism.
