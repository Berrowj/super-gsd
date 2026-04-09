# CEO Prompt Assembly Trace

Brief: `.planning/briefs/2026-04-08-memory-layer-indexing.md`

## Gate Check Trace (Step 0)

Source: `super-gsd/skills/gsd-deliberate/SKILL.md` — `<step_0_gate>`

- Brief has `## Termination` section
- `phases_affected: 4`
- Threshold: 4 >= 3
- Result: **PROCEED**

Gate cost: ~50 tokens (Haiku numeric check)

---

## Board Member Prompt Structure (Step 3, Round 1)

Template source: `super-gsd/agents/gsd-ceo.md` — `<board_spawn_template>`

Each of the 4 board agents receives a prompt assembled from these 5 components, in order:

### Component 1: BRIEF

```
BRIEF:
# Brief: BM25 Memory Layer Indexing Strategy

## Situation
[full text from brief — ~180 words]

## Stakes
[full text from brief — ~120 words]

## Constraints
[full text from brief — ~80 words]

## Key Questions
[full text from brief — ~80 words]

## Additional Context
[full text from brief — ~50 words]

## Termination
phases_affected: 4
max_rounds: 2
gate_score: PROCEED
```

Source: `.planning/briefs/2026-04-08-memory-layer-indexing.md` (full file content)

### Component 2: PROJECT CONTEXT

```
PROJECT CONTEXT:
milestone: v1.0
status: verifying
stopped_at: Completed 03-03-PLAN.md
completed_phases: 3 of 7
current_phase: Phase 5 — Strategic Deliberation
key_decisions:
  - D001: Opus orchestrates, Sonnet executes, Haiku classifies
  - D002: Compressed XML plans
  - Phase 2: Manual YAML serialization, fs+path only
  - Phase 2: Domain validation prevents path traversal
```

Source: `.planning/STATE.md` frontmatter (first ~10 fields only, not full file)

### Component 3: RELEVANT EXPERTISE

```
RELEVANT EXPERTISE:
[brv-query "memory layer BM25 indexing decisions patterns" results]
[brv-query "memory layer expertise" results]
```

Source: ByteRover query — injected at runtime. Placeholder in trace because results are dynamic.
Expected content: Phase 2 SUMMARY entries, brv-curate-local patterns, MEM-01 to MEM-05 decisions.

### Component 4: YOUR ROLE

For Architect:
```
YOUR ROLE:
You are the Technical Architect on a decision board.
[full content of board-architect.md <role>, <temperament>, <reasoning>, <heuristics>, <output> blocks]
```

Source: `super-gsd/agents/board-architect.md` (full agent definition injected by CEO)

For Pragmatist: `super-gsd/agents/board-pragmatist.md`
For Contrarian: `super-gsd/agents/board-contrarian.md`
For Moonshot: `super-gsd/agents/board-moonshot.md`

### Component 5: Closing Instruction

```
RESPOND WITH YOUR STRUCTURED POSITION ONLY. No intro. No summary.
Max 400 words.
```

Source: `super-gsd/agents/gsd-ceo.md` — `<board_spawn_template>` closing line

---

## Round 2 Evaluation Logic (Step 4)

Source: `super-gsd/skills/gsd-deliberate/SKILL.md` — `<step_4_round2>`

Trigger conditions for Round 2 (any one is sufficient):

| Condition | Round 2 Triggered? |
|-----------|-------------------|
| 3+ board members agree AND contrarian objection is substantive | Yes |
| Split 2-2 | Yes |
| All 4 agree (potential groupthink) | Yes — with explicit groupthink challenge injected |
| Decision is obvious, no substantive disagreement | No — skip to synthesis |

Round 2 addition to each prompt: all 4 Round 1 positions visible + instruction: "Respond to other positions. Update yours if persuaded. Strengthen if not. Final position. Max 300 words."

Termination check (Step 7.5, from gsd-ceo.md):
- max_rounds for this brief: 2 → after Round 2, synthesize immediately regardless
- No-movement check: if all 4 Round 2 positions identical to Round 1, synthesize immediately

---

## Prompt Component Coverage

| Component | Present in Template | Source File |
|-----------|--------------------|----|
| BRIEF | Yes | brief-template.md |
| PROJECT CONTEXT | Yes | STATE.md frontmatter |
| RELEVANT EXPERTISE | Yes | brv-query (runtime) |
| YOUR ROLE | Yes | board-{name}.md |
| Closing instruction | Yes | gsd-ceo.md board_spawn_template |

All 5 components accounted for. No missing fields.
