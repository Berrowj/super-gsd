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
- "new" -> create brief interactively, then deliberate
- path to a brief .md file -> validate and deliberate

Token budget: 10,400 (1 round) to 16,400 (2 rounds). Only use for high-stakes decisions.
</objective>

<step_0_gate>
## Step 0: Pre-Gates (two checks, both mandatory)

### Step 0a: DELIBERATION-FLOOR (DLB-06)

If $ARGUMENTS is a file path, read the brief frontmatter/Termination for:
- `q1_impl_hours` (decimal)
- `q1_revertable` (true | false)

If BOTH present AND `q1_impl_hours < 2` AND `q1_revertable == true` -> SKIP deliberation.

### Step 0b: Phase Impact Gate

Proceed only when the decision affects 3 or more phases.
</step_0_gate>

<step_1_brief>
## Step 1: Load or Create Brief

If $ARGUMENTS is "new", create a brief from the template.
If $ARGUMENTS is a file path, validate that Situation, Stakes, Constraints, and Key Questions exist.
</step_1_brief>

<step_2_context>
## Step 2: Load Context

Read:
- `.planning/STATE.md`
- `.planning/ROADMAP.md`
- the recent DLB memos

Build a compact context block for the board.
</step_2_context>

<step_2_5_roster>
## Step 2.5: Resolve Board Roster

Load the runtime board registry:

```javascript
const boardRegistry = require('super-gsd/scripts/lib/board-registry.cjs');
const round1Roster = boardRegistry.resolveRoster(brief);
```

Round 1 roster is the registry's `default_minimal_board` plus `always_present`.
Escalation happens only after Round 1 results exist.
</step_2_5_roster>

<step_3_round1>
## Step 3: Spawn Board Members (Round 1)

Dispatch the roster returned by `boardRegistry.resolveRoster(brief)` in parallel.

After each Agent() return, validate the YAML response:

```javascript
const deliberationSchema = require('super-gsd/scripts/lib/deliberation-schema.cjs');
const result = deliberationSchema.validate(agentResponse);
if (!result.valid) {
  const retryPrompt =
    `Previous response failed schema: ${result.errors.join('; ')}. ` +
    `Re-emit as valid YAML matching ALL 10 required fields. ` +
    `NO prose wrapper. NO markdown fences.`;
  const retryRaw = Agent(memberName, { prompt: retryPrompt });
  const retry = deliberationSchema.validate(retryRaw);
  if (!retry.valid) {
    throw new Error(`Board member '${memberName}' malformed after retry: ${retry.errors.join('; ')}`);
  }
  return retry.parsed;
}
return result.parsed;
```

Every Round 1 result is therefore a parsed object with:
- `position`
- `confidence`
- `risks_raised`
- `evidence_cited`
- `falsifier`
- `implementation_concerns`
- `known_deadends`
- `intuition`
- `why_principled`
- `rationale`
</step_3_round1>

<step_4_round2>
## Step 4: Evaluate Need for Round 2

Evaluate the parsed `round1Results` using field access, not prose matching:
- 3+ agree and the minority objection is substantive -> Round 2
- split 2-2 on `member.position` -> Round 2
- all members have the same `member.position` -> add groupthink pressure

Escalate roster only if the runtime registry says so:

```javascript
const round2Roster = boardRegistry.resolveRoster(brief, round1Results);
```

Round 2 re-dispatch uses the same `deliberation-schema` validate + retry-once pattern after each
Agent() return.
</step_4_round2>

<step_5_synthesize>
## Step 5: Synthesize Decision Memo

All `round1Results` and `round2Results` are parsed objects already (validated in Steps 3 and 4).
The synthesize call below takes these objects directly.

```javascript
const voteSynth = require('super-gsd/scripts/lib/vote-synthesis.cjs');
const { decision, sum, tiebreaker_applied, raw_votes } =
  voteSynth.synthesize(round2Results && round2Results.length ? round2Results : round1Results);
```

Write the memo frontmatter with:

```yaml
---
type: deliberation-memo
date: {YYYY-MM-DD}
brief: {path to brief}
board: [architect, pragmatist, contrarian, moonshot]
rounds: {1 or 2}
vote: "{decision}" # use `VOTE_TIE` in this field when tiebreaker_applied === true
signed_sum: {sum}
tiebreaker_applied: {bool}
raw_votes: {raw_votes}
decision: "{one-line summary}"
---
```

If `tiebreaker_applied === true`, the memo must include `## Tiebreak Rationale`.

Rubric-driven synthesis:
- Collect all `risks_raised` into `## Risks Acknowledged`
- Collect all `known_deadends` into `## Dead Ends / Paths Ruled Out`
- Collect falsifier across members into memo `## Falsifier`
- Use `rationale` and `why_principled` to write `## Recommendation`
- Use `evidence_cited` to keep the memo grounded

Always append `## Post-Synthesis Reflection` at the footer.
</step_5_synthesize>

<step_6_state>
## Step 6: Update State + Report

Write the memo to `.planning/decisions/`.
Write debate logs to `.planning/deliberations/`.
Append a token log row.
Report the final decision, signed_sum, and memo path.
</step_6_state>
