---
name: sgsd-deliberate
description: "CEO/Board strategic deliberation. Multi-agent adversarial debate on structured briefs. Produces Decision Memos."
argument-hint: "[new | path/to/brief.md]"
allowed-tools:
  - Read
  - Write
  - Glob
  - Grep
  - Bash
  - Agent
---

<objective>
Run a CEO/Board deliberation on a structured brief.

$ARGUMENTS is either:
- "new" → create brief interactively, then deliberate
- path to a brief .md file → validate and deliberate

Token budget: 10,400 (1 round) to 16,400 (2 rounds). Only use for high-stakes decisions.
</objective>

<step_0_gate>
## Step 0: Phase Impact Gate

Before creating the brief or spawning the board, run this check. It is MANDATORY and cannot be bypassed even when $ARGUMENTS is a file path.

1. If $ARGUMENTS is a file path: read the brief and check for `phases_affected` in the `## Termination` section.
2. If $ARGUMENTS is "new" OR `phases_affected` is not present in the brief: ask the user:
   > "How many project phases does this decision affect? (enter a number)"
3. Evaluate the score:
   - `phases_affected < 3` → SKIP. Respond exactly:
     > "This decision affects fewer than 3 phases. Use /gsd-plan or decide directly. Deliberation is reserved for cross-cutting decisions (3+ phases affected)."
     Then STOP. Do not proceed.
   - `phases_affected >= 3` → PROCEED to Step 1.

Gate model: Haiku (this is a numeric threshold check, not semantic evaluation).
Gate cost: ~50 tokens.
</step_0_gate>

<step_1_brief>
## Step 1: Load or Create Brief

If $ARGUMENTS is "new":
1. Ask user: "What decision do you need to make?"
2. Generate brief with 4 required sections:
   - ## Situation (>50 words, factual context)
   - ## Stakes (>30 words, what's at risk)
   - ## Constraints (non-negotiable boundaries)
   - ## Key Questions (specific, not "should we do this?")
3. Write to `.planning/briefs/{date}-{slug}.md`
4. Show brief, ask for approval

If $ARGUMENTS is a file path:
1. Read the brief
2. Validate: Situation, Stakes, Constraints, Key Questions all present
3. If missing sections: warn, ask whether to proceed or fill gaps

Brief template: @super-gsd/templates/brief-template.md
</step_1_brief>

<step_2_context>
## Step 2: Load Context

Read (frontmatter only, not full files):
- `.planning/STATE.md` — current milestone, phase, progress
- `.planning/ROADMAP.md` — phase list (first 50 lines)
- Recent `.planning/decisions/DLB-*.md` — last 3 decision memos (if any)

Query ByteRover:
- `sgsd-recall "{brief domain} decisions patterns"` → relevant knowledge
- `sgsd-recall "{brief domain} expertise"` → domain expertise

Build context block: ~400 tokens summarizing project position + relevant knowledge.
</step_2_context>

<step_3_round1>
## Step 3: Spawn Board Members (Round 1)

Spawn 4 agents IN PARALLEL:

```
Agent(description: "Architect analysis", model: "sonnet", prompt: "
BRIEF: {full brief}
PROJECT CONTEXT: {context block}
RELEVANT EXPERTISE: {sgsd-recall results}
YOUR ROLE: Technical Architect — evaluate feasibility, risk, implementation cost.
RESPOND: Position, Technical Risk, Key Argument, Implementation Sketch, Blind Spots.
No intro. Max 400 words.")

Agent(description: "Pragmatist analysis", model: "sonnet", prompt: "...")
Agent(description: "Contrarian analysis", model: "sonnet", prompt: "...")
Agent(description: "Moonshot analysis", model: "sonnet", prompt: "...")
```

Collect all 4 responses.
</step_3_round1>

<step_4_round2>
## Step 4: Evaluate Need for Round 2

Read all 4 positions:
- 3+ agree, contrarian objection substantive → Round 2
- Split 2-2 → Round 2
- All 4 agree → Flag groupthink, Round 2 with challenge
- Decision obvious, no substantive disagreement → Skip to Step 5

Round 2 (if needed):
Re-spawn all 4 with:
1. Original brief
2. ALL Round 1 positions (each agent sees what others said)
3. Instruction: "Respond to other positions. Update yours if persuaded. Strengthen if not. Final position. Max 300 words."
</step_4_round2>

<step_5_synthesize>
## Step 5: Synthesize Decision Memo

Write to `.planning/decisions/DLB-{NN}-{slug}.md`:

```yaml
---
type: deliberation-memo
date: {YYYY-MM-DD}
brief: {path to brief}
board: [architect, pragmatist, contrarian, moonshot]
rounds: {1 or 2}
vote: "{e.g., 3-1 SUPPORT, Contrarian OPPOSED}"
decision: "{one-line summary}"
---
```

Sections:
- ## Recommendation (2-3 sentences)
- ## Board Stances (table: Agent | Position | Risk | Key Argument)
- ## Unresolved Tensions
- ## Trade-offs Accepted
- ## Risks Acknowledged (with mitigations)
- ## Next Actions (checkboxes)
- ## Deliberation Metadata

Write debate log to `.planning/deliberations/{date}-{slug}/`:
- `round-1-positions.md`
- `round-2-rebuttals.md` (if Round 2)
- `deliberation-log.md` (metadata: agents, timing, rounds)

Create directories if they don't exist.
</step_5_synthesize>

<step_6_state>
## Step 6: Update State + Report

Curate decision into ByteRover:
```
sgsd-curate "{decision summary}" domain: decisions/{topic} importance: 80
```

Log token usage to `.planning/metrics/token-log.jsonl`:
```json
{"ts":"{ISO}","type":"deliberation","brief":"{slug}","rounds":{N},"board":4,"est_total":{N}}
```

Report to user:
```
DELIBERATION COMPLETE
Decision: {one-liner}
Vote: {vote breakdown}
Memo: .planning/decisions/DLB-{NN}-{slug}.md
```
</step_6_state>
