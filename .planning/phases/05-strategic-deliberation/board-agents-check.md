# Board Agents Validation Check

CEO spawn template source: `super-gsd/agents/gsd-ceo.md` — `<board_spawn_template>`
CEO expects: BRIEF, PROJECT CONTEXT, RELEVANT EXPERTISE, YOUR ROLE, closing instruction.
CEO expects board responses structured as: Position, Risk, Key Argument, Implementation/Alternative, Blind Spots/Other.

---

## Agent 1: board-architect

**File:** `super-gsd/agents/board-architect.md`
**Model:** `sonnet` — CORRECT (CEO spawns all board on Sonnet)
**Role:** Technical Architect — evaluates feasibility, system design, tech debt, implementation risk.

**Required output sections:**
- `**Position**: SUPPORT | OPPOSE | MODIFY`
- `**Technical Risk**: Low | Medium | High`
- `**Key Argument**: 2-3 sentences`
- `**Implementation Sketch**: if SUPPORT/MODIFY`
- `**Blind Spots**: what brief missed technically`

**CEO compatibility:** CEO reads "Position" and "Key Argument" to populate Board Stances table (Agent | Position | Risk Level | Key Argument). Architect provides `Technical Risk` which maps to `Risk Level`. All 4 required table fields are present in agent output.

**Mismatch:** None.

---

## Agent 2: board-pragmatist

**File:** `super-gsd/agents/board-pragmatist.md`
**Model:** `sonnet` — CORRECT
**Role:** Pragmatist — execution risk, timeline reality, what actually ships.

**Required output sections:**
- `**Position**: SUPPORT | OPPOSE | MODIFY`
- `**Execution Risk**: Low | Medium | High`
- `**Key Argument**: 2-3 sentences`
- `**Simpler Alternative**: if MODIFY`
- `**What Gets Delayed**: existing work that pauses`

**CEO compatibility:** Pragmatist provides `Execution Risk` which maps to Board Stances `Risk Level`. Position and Key Argument both present. All 4 table fields covered.

**Mismatch:** None.

---

## Agent 3: board-contrarian

**File:** `super-gsd/agents/board-contrarian.md`
**Model:** `sonnet` — CORRECT
**Role:** Contrarian — challenges consensus, finds blind spots, stress-tests assumptions.

**Required output sections:**
- `**Position**: SUPPORT | OPPOSE | MODIFY`
- `**Unexamined Risk**: failure mode nobody mentioned`
- `**Key Argument**: 2-3 sentences`
- `**Kill Condition**: when to abandon`
- `**What's Missing**: information needed`

**CEO compatibility:** Contrarian has no explicit `Risk Level` field — uses `Unexamined Risk` instead. CEO Board Stances table requires Risk Level. CEO must derive risk level from Contrarian's `Unexamined Risk` content (treat as High if unexamined risk is substantive, Medium if acknowledged, Low if not raised).

**Mismatch:** MINOR — Contrarian uses `Unexamined Risk` not `Risk Level`. CEO synthesis rules note "Weight Contrarian objections seriously" — this is handled qualitatively, not via a Low/Medium/High field. CEO will need to infer risk level from content.

**Resolution:** Not a blocker. CEO `<synthesis_rules>` already accounts for this with qualitative weighting. The Board Stances table row for Contrarian should document the unexamined risk as the Key Argument and infer risk level from its severity.

---

## Agent 4: board-moonshot

**File:** `super-gsd/agents/board-moonshot.md`
**Model:** `sonnet` — CORRECT
**Role:** Moonshot thinker — challenges incremental thinking, proposes 10x alternatives.

**Required output sections:**
- `**Position**: SUPPORT | OPPOSE | MODIFY`
- `**The 10x Question**: bigger problem this could solve`
- `**Key Argument**: 2-3 sentences`
- `**Moonshot Alternative**: concrete bigger version with specific first step`
- `**Why Not Bigger**: what's stopping further ambition`

**CEO compatibility:** Moonshot has no explicit `Risk Level` field — the CEO synthesis rules note "Weight Moonshot on ambition — but only if grounded (has a concrete first step)." CEO must infer risk from whether the Moonshot Alternative has a concrete first step (if yes: Medium; if not: High).

**Mismatch:** MINOR — same pattern as Contrarian. No explicit `Risk Level` field. CEO infers from grounding.

**Resolution:** Not a blocker. Same qualitative handling as Contrarian.

---

## Summary

| Agent | Model | Position Field | Risk Field | Key Argument | CEO Compatible |
|-------|-------|---------------|-----------|--------------|----------------|
| Architect | sonnet | Yes | Technical Risk | Yes | Yes — full match |
| Pragmatist | sonnet | Yes | Execution Risk | Yes | Yes — full match |
| Contrarian | sonnet | Yes | Unexamined Risk (inferred) | Yes | Yes — minor inference |
| Moonshot | sonnet | Yes | Inferred from grounding | Yes | Yes — minor inference |

**Total mismatches:** 0 blockers, 2 minor inferences documented.

Both inferences are handled by existing CEO `<synthesis_rules>` language. No changes required to agent definitions or CEO agent.
