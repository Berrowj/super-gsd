---
name: rd-board
description: "Clarity R&D Board. Converts external research, VTP material, papers and new technical ideas into evidence-bounded opportunities with an exact Clarity slot — or kills them. Four-seat multi-model board across two providers, blind ballot, gates R-0 to R2."
argument-hint: "[new | path/to/source.md | vtp:<slug> | radar]"
allowed-tools:
  - Read
  - Write
  - Glob
  - Grep
  - Bash
  - Agent
---

<objective>
Run an R&D Board session under the Clarity R&D Board Treaty v0.3
(`super-gsd/docs/RD-BOARD-TREATY.md`). Read the treaty before deviating from anything below.

$ARGUMENTS:
- `new`              -> build a source ledger interactively, then convene
- path to a file     -> ingest that paper/article/transcript as the source
- `vtp:<slug>`       -> pull the source from the VTP corpus
- `radar`            -> review open R&D Radar entries, no new candidate

**What this skill is for.** Deciding whether an external idea has earned a precise place in
Clarity. It is NOT a general planning skill — use `/sgsd-triage` for that — and it is NOT
authorised to write production code. Gates R3-R7 are defined in the treaty but not automated
in v1; this skill runs R-0 through R2 and stops at a recommendation.

**Cost.** A full four-seat convening is expensive: two Opus/Fable Agent() dispatches plus two
`codex exec` shellouts, times up to two cross-examination rounds. Gate R-0 exists precisely so
most candidates never pay it. Do not convene the board to be thorough; convene it because R-0
escalated.
</objective>

<step_0_load>
## Step 0: Load treaty, registry and map

Read in this order:
1. `super-gsd/docs/RD-BOARD-TREATY.md` — the constitution. Sections 4, 10, 13 govern this run.
2. `super-gsd/registry/rd-board-members.yaml` — seats, dispatch routes, structural controls.
3. `.planning/rd/capability-map/` — current-state projection. If absent, note it as a denominator
   gap; the Cartographer will inspect live, at higher cost.
4. `.planning/rd/radar.md` — open Radar entries, to catch duplicates and unfired triggers.

```javascript
const rdSchema = require('super-gsd/scripts/lib/rd-memo-schema.cjs');
```
</step_0_load>

<step_1_intake>
## Step 1: Source ledger (Treaty §13.1, §6)

Build a NEUTRAL source ledger. Do not evaluate yet.

For every material claim extracted from the source, record the §6.2 labels:
`claim_id`, claim text, source + date, **source class (§6.1)**, scope and stated conditions,
mechanism proposed, evidence supplied, important missing evidence, internal relevance
hypothesis, confidence.

Two rules bite here:
- **Source class is not determined by medium.** A paper can contain promotional claims; a
  transcript can contain primary evidence.
- **Bibliography exclusion (§6.1).** A citation found inside another document's reference list
  is NOT evidence for the cited claim. It may motivate a search. It may never be quoted as support.

Declare scope, repository ref, environment, date and access limitations. Unknowns stay unknown —
they do not become zero, false, or "probably fine".

Open the candidate's **append-only event log** (§14) at `.planning/rd/candidates/{id}/events.jsonl`.
Every claim, observation, memo, verdict and operator decision is appended. The dossier is a
projection over this log. **Never edit a dossier field in place** — a correction is a new
superseding event, and both remain.
</step_1_intake>

<step_2_gate_r0_triage>
## Step 2: Gate R-0 — convening triage (Treaty §10 R-0)

Dispatch the Cartographer ALONE. It disposes of the candidate without a board when the
candidate is `NO_SLOT`, a duplicate of an existing engine/API, or a Radar `Hold`/`Reject`
entry whose reopening trigger has not fired.

```javascript
const triage = Agent('rd-board-cartographer', { prompt: triagePrompt, mode: 'bypassPermissions' });
```

If disposed: log the disposal, write the Radar entry, emit the §15 report with a
"board not convened" note and the cost saved, and STOP. The operator can reverse any disposal.

If escalated: continue. Record WHY it escalated — that reason is the board's remit.
</step_2_gate_r0_triage>

<step_3_fast_path>
## Step 3: Fast-path check (Treaty §10.0)

If the candidate declares **zero additions** in its complexity delta AND its placement mode is
`DELETE`, `OBSERVE` or `COMPOSE`, it runs **R0 -> R2 -> R5 only**. The intermediate gates exist
to control the risk of adding things; a candidate that adds nothing does not need them.

If it later acquires an addition, it drops back to the full path. Record the transition.

Iteration INSIDE a gate is explicitly permitted and requires no re-convening. A gate is a
review boundary, not a work boundary.
</step_3_fast_path>

<step_4_independent_memos>
## Step 4: Independent first positions (Treaty §13.2, §13.2.1)

R-0 through R2 are **divergent phases**: dispatch all four seats **in parallel, fully
independent**. No seat sees another's draft. This is the phase where premature agreement is the
failure mode.

All four seats receive the SAME validated observation pack and access boundaries, plus only
their own role instructions (§4.5 rule 7). No seat gets an evidential advantage from its seat.

**Two Anthropic seats** via Agent():
```javascript
const cartographer = Agent('rd-board-cartographer', { prompt, mode: 'bypassPermissions' });
const moonshot     = Agent('rd-board-moonshot',     { prompt, mode: 'bypassPermissions' });
```

**Two OpenAI seats** via codex shellout — Agent() cannot spawn OpenAI models:
```bash
bash super-gsd/scripts/codex-exec.sh \
  --prompt-file .planning/rd/candidates/{id}/prompts/experimentalist.md \
  --report-out  .planning/rd/candidates/{id}/memos/experimentalist.yaml \
  --contract rd-memo-v1 --model gpt-5.6-sol --reasoning xhigh
```
The Contrarian is identical with `gpt-5.5`. Build each prompt file from the agent .md body plus
the shared observation pack.

**§4.5 rule 3 — no silent substitution.** If a model is unavailable the seat returns
`MODEL_UNAVAILABLE`. Record it, and do NOT present the run as the treaty lineup. Provider failure
is recorded separately from candidate merit (rule 12) — a timeout is not evidence against the idea.

Validate every memo, Anthropic and OpenAI alike:
```javascript
const result = rdSchema.validate(raw, { requirePlacementMode: seat === 'cartographer' });
if (!result.valid) {
  // retry ONCE with the errors quoted back, then hard-fail the seat
}
```
The validator enforces the §10 superlative bar and the §13.5.1 blind ballot mechanically.
Do not hand-wave a violation through.
</step_4_independent_memos>

<step_5_diversity_floor>
## Step 5: Diversity floor (Treaty §4.5 rule 13)

BEFORE cross-examination opens:
```javascript
const check = rdSchema.checkDiversityFloor(memos, registry.structural_controls.divergence_floor);
```

If `check.void_round` — **the round is void**. Re-run the seats in isolated subgroups, with no
shared draft and no knowledge of the voided round. Convergence reached *before* debate is a
defect, not agreement.

The floor is currently **uncalibrated** (`null`) — treaty §21 decision 6. While null, never void;
record `check.score` on every run so the floor can be derived empirically from the acceptance
run rather than guessed. Report the score in the §15 divergence panel either way.
</step_5_diversity_floor>

<step_6_cross_exam>
## Step 6: Cross-examination (Treaty §13.3, §13.3.5, §13.5.1)

**Distribute the Cartographer's slot map as DATA**, before debate opens. It is not an opening
argument.

**Randomise speaking order per candidate.** A fixed order that always opens with the same seat
installs an authority dynamic that measurably suppresses semantic diversity.

**Blind ballot is in force throughout:**
- findings are presented **de-identified** as `FINDING-n` — never by seat or model name;
- **no running tally, endorsement count or majority indication** is ever exposed to a voting model;
- final per-seat verdicts are submitted **privately** to the orchestrator;
- attribution is restored ONLY in the operator-facing memo, after voting closes.

**Ledger blindness (§4.5 r15) is in force:** no seat is told it is being scored, shown any
ledger, or informed that the run affects model retention. Evaluation-awareness is a measured
conformity amplifier — stronger than public balloting. The ledger is computed post-hoc by this
skill from artefacts no seat sees.

**Cap: two rounds.** Between rounds each seat re-answers **privately, without seeing others'
revisions**. Communication is a bounded resource, not a default.
</step_6_cross_exam>

<step_7_validate_evidence>
## Step 7: Evidence validation (Treaty §13.4)

Deterministically check: citations resolve, repository paths exist, executed commands were
actually run, metric denominators are stated, source dates are present, and observations are
separated from claims.

Additionally enforce: the §6.1 bibliography exclusion, the §10 superlative bar, and — for any
gate attempt at R3/R4 — **raw-artefact adjudication**: no gate passes on a summary, report file
or agent-authored result narrative. A result narrative is a claim, never an observation.

This validator checks form and provenance. **It does not decide product merit.**
</step_7_validate_evidence>

<step_8_decide>
## Step 8: Decision rule (Treaty §13.5)

- R0-R2 advancement requires **3 of 4** recommendations, Cartographer `SLOT_PASS`,
  Experimentalist `TESTABLE`, and **no unresolved hard risk**.
- Contrarian objections must be **answered or converted into a test**. No taste-based veto.
- Moonshot upside cannot override missing evidence, fit or safety.
- **Abstention due to missing evidence is not approval.** Do not count it as one.
- A **factual** deadlock becomes an experiment. A **value/policy** deadlock becomes an operator
  checkpoint.
- Any production advancement requires an operator `promotion_decision`. This skill never
  promotes.

Verdicts are the §13.6 enum. Every non-advance verdict **states the condition that would justify
reopening it** — that condition becomes the Radar entry's trigger.
</step_8_decide>

<step_9_report>
## Step 9: Answer-first report (Treaty §15)

Write `.planning/rd/candidates/{id}/REPORT.md` with all thirteen sections, verdict FIRST:

1. Verdict · 2. External idea in plain language · 3. Current-state map · 4. Candidate slots
(ranked, including `NO_SLOT`) · 5. Board positions **with attribution restored** · 6. Incumbent
and simpler alternatives including deletion · 7. Proposed experiment with threshold and kill
criteria · 8. Complexity delta · 9. Readiness card (four axes) · 10. Decision request — only the
operator choice genuinely required · 11. Evidence ledger · 12. Denominator panel · 13. Divergence
panel — divergence score, any voided round, and whether the board convened at all.

**A recommendation of "build nothing" is a healthy output, not a failed session.** Say it plainly
when it is the answer.

Render the dossier projection (§14) from the event log. Update `.planning/rd/radar.md` — respect
the **12-entry attention cap** on operator-actionable states (`Assess`, `Spike`, `Shadow`,
`Challenger`, `Pilot`); demote the lowest-priority entries to `Observe` beyond it.

Append the post-hoc model performance ledger (§4.5) — including **predicted-vs-actual gate
outcome** per seat. Seats never see this.
</step_9_report>

<step_10_state>
## Step 10: Persist

Append token/cost rows to `.planning/metrics/`. Commit the candidate directory and Radar update.
Report to the operator: verdict, whether the board convened, divergence score, cost, and the
single decision being requested — nothing else.
</step_10_state>
