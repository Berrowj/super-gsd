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

<worker_connection>
Before any external seat launch, read `/sgsd-workers` and supervise it from this
same CEO/Fable session. Record a stable `UNIT=fable.ceo.<deliberation-run-id>`.
Use priority-first supervision: before launching any seat, prepare absolute
control/project paths, every seat/round/attempt binding, fresh report path and
expected position schema/validator. Check owned inboxes before lengthy reading
or vote processing; pending questions preempt failed-seat investigation, so
defer unrelated diagnostics until they are answered or escalated.
Pass `--owner "$UNIT"` when preparing every descriptor, including every round
and retry. Require its returned `worker_owner` to match; launch environment
alone cannot override the descriptor's embedded `--owner` flag. Run that command
with Bash `run_in_background: true` and `SGSD_WORKER_OWNER="$UNIT"`.
Poll owned worker questions while other seats run; answer approved context or
escalate operator-only authority. Wait for final exit by servicing the inbox,
not by blocking on a result the worker cannot produce until it gets an answer.
Record worker UUID, background task ID and seat/round/attempt/report mapping.
Keep validated votes across compaction; never invent or duplicate missing ones.
Legacy `codex.readonly.audit` is an advisory role name: OS mode is full access,
not a read-only sandbox. The role still must not edit implementation files.
</worker_connection>

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
The CEO is the synthesizer, not a voting seat: do not spawn the CEO as its own
board member. List inactive/blocked registry seats in the operator report with
their reason; a blocked seat is not an abstention. Do not claim the full requested
lineup ran. An active seat with invalid configuration stops the deliberation.
Escalation happens only after Round 1 results exist.
</step_2_5_roster>

<step_3_round1>
## Step 3: Spawn Board Members (Round 1)

Dispatch voting seats from the resolved roster in parallel. Resolve EACH seat's
transport before invoking it, using the installed or source `scripts/lib/board-dispatch.cjs`.
The registry is authoritative. Never use Agent() for an OpenAI/external seat.

Prepare a prompt file containing the original brief, bounded project context,
expertise, and the complete role body from that seat's agent definition. Use a
new run directory under `.planning/deliberations/`; old memos are context only.
Then, from the project's Bash environment:

```bash
node super-gsd/scripts/lib/board-dispatch.cjs \
  --member sgsd-board-architect --project . --owner "$UNIT" \
  --prompt-file .planning/deliberations/<run-id>/architect-prompt.md
```

For a global install, use the canonical source runtime at
`~/.claude/super-gsd/source/super-gsd/scripts/lib/board-dispatch.cjs` instead.
Use that same canonical source for registry/schema/vote helpers and role bodies.
Do not use the partial flat hook runtime under `~/.claude/scripts/lib`, even if its read-only --describe succeeds:
shared hook YAML dependencies do not make it a supported board runtime; it lacks
the board wrapper and routing configuration. If the canonical source or its
dependencies are missing, stop and report the installation issue.
The command emits a JSON descriptor, not a model response:

- `dispatch: agent`: call Agent with the seat role prompt and the descriptor's
  explicit `model`. The model may differ from the installed agent frontmatter
  when an operator passes `--model <preset>` to the resolver.
- `dispatch: codex-exec`: run the returned `command` verbatim through Bash.
  It invokes the existing wrapper with exact model ID, reasoning effort,
  `codex.readonly.audit`, `board-position-v1`, timeout, and a NEW `report_path`.
  Service `/sgsd-workers` until its process exits; only exit zero permits reading that report as a
  position. Do not extract a vote from progress output or a failed report.

`--model fable`, `--model astra-max`, or `--model luna-max` is an explicit per-seat
operator override. Never choose an override to conceal an unavailable model.
Record descriptor provider/model/effort, seat, round, exit, and report path in
the debate log. Do not ask the model to guess its own identity.

Both transports use the SAME existing validator:

```javascript
const deliberationSchema = require('super-gsd/scripts/lib/deliberation-schema.cjs');
const result = deliberationSchema.validate(agentResponse);
if (!result.valid) {
  const retryPrompt =
    `Previous response failed schema: ${result.errors.join('; ')}. ` +
    `Re-emit as valid YAML matching ALL 10 required fields. ` +
    `NO prose wrapper. NO markdown fences.`;
  // Retry ONCE through the SAME resolved transport/model/effort, including
  // the original brief/role/context plus retryPrompt. For codex-exec, prepare
  // another descriptor with --owner "$UNIT" and the new prompt file for a fresh report path.
  // Wrapper exit 6 is a malformed-position retry; never read it as a vote.
  const retryRaw = dispatchSameSeatWithFreshAttempt(retryPrompt);
  const retry = deliberationSchema.validate(retryRaw);
  if (!retry.valid) {
    throw new Error(`Board member '${memberName}' malformed after retry: ${retry.errors.join('; ')}`);
  }
  return retry.parsed;
}
return result.parsed;
```

`dispatchSameSeatWithFreshAttempt` above denotes the Agent/Bash procedure just
specified, not an installed function. A second malformed response stops the
deliberation. Timeout, authentication/model error, circuit-open, unavailable
validator, or report-write failure stops it immediately: record an incomplete
board, surface the blocker, and do not synthesize a final decision from missing
votes. Never downgrade the model, change authentication or the worker access policy,
reuse an old report, or convert a provider failure into SUPPORT/OPPOSE/ABSTAIN.

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

Round 2 re-dispatch repeats the provider-aware procedure, fresh report paths, and
same-schema retry-once rule from Step 3. Respect the brief's max_rounds and the
skill's two-round limit. Do not silently route external retries through Agent().
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
board: [<actual successfully dispatched voting seat names>]
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
