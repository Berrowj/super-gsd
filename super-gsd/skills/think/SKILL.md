---
name: think
model: sonnet
description: "Multi-lens thinking over a problem, a thing being built, or a topic, with every lens drawn from the VTP thinking library through the think-lenses registry and every move grounded in retrieved passages. Use when the operator says 'think through', 'how else could we', 'what are we missing', 'different angle', 'stuck on', or before any brief, plan or deliberation on something non-trivial. Not for factual lookups, live-data questions or execution requests."
argument-hint: "<problem | thing being built | topic | path/to/brief-or-plan.md | phase> [--mode solve|enhance|discuss] [--depth quick|full] [--subject SAP-DATA|UI-RELAY|INTEGRATION|DEPLOY-INFRA|ORCHESTRATION|KNOWLEDGE|SECURITY|REPORTING|PRODUCT|PROCESS|PEOPLE|COMMS] [--allow-ungrounded] [--registry <path>] [--lenses L-ID,L-ID]"
allowed-tools:
  - Read
  - Write
  - Bash
  - Glob
  - Grep
  - Agent
  - AskUserQuestion
  - mcp__vtp-kb__vtp_search_book_passages
  - mcp__vtp-kb__vtp_search_research_passages
  - mcp__vtp__vtp_search_book_passages
  - mcp__vtp__vtp_search_research_passages
---

<trigger>

**Invoke when** the operator types `/think ...`, or says "think this through", "how else could we do this", "what are we missing", "give me a different angle", "I'm stuck on", "before we brief this", or asks for lateral, logical or dynamic options on a problem, a build or a discussion.

**Do NOT invoke when:**
- The question is a factual lookup ("what is the current phase", "where does X live").
- The question needs live SAP, Mongo or Clarity data. Books are lenses, never authority for live state; route to the live tools.
- The operator asked for execution ("go", "ship it", "fix the bug"). Think first only if they ask.
- The problem already has a think record from the last 24 hours under `.planning/thinking/` and nothing in the frame changed. Read that record instead.

</trigger>

<objective>

Take one framed problem, build or topic and run it through a set of ways of thinking that the operator did not pick by habit. Every lens comes from `think-lenses.yaml`; every move a lens produces is grounded in a retrieved passage from the VTP library and carries a falsifier; the moves are then collided (dialectical pass) and ranked by effect on the stated goal. The output is an append-only think record with T-coded moves, a ruled-out list, kept disagreements and a route into SGSD (`/sgsd-triage`, a brief for `/sgsd-deliberate`, `/gsd-plan-phase` tasks, `/rd-board`, or nothing).

This skill recommends. It never edits source, never dispatches executors and never writes a plan. It writes one record and one metrics row.

Use Sonnet for the thinking pass and every lens worker. The skill's model override lasts for this turn; the host session resumes its usual model on the next prompt. Do not upgrade to Opus or Fable unless the operator explicitly asks.

Cost, measured on the first green run (quick depth, local retrieval, 5 lenses, 15 moves): 12 minutes 46 seconds and roughly 90k to 100k tokens of unique content, most of it the record and the lens files rather than the reasoning. Quick depth is one orchestrator pass over up to 6 lenses plus 1 hybrid second lens. Full depth dispatches up to 10 lens sub-agents in parallel plus 2 hybrid second lenses; assume two to three times the quick cost. Default is quick; use full for GATE-tier subjects or when the operator asks.

</objective>

<contracts>

1. **Registry is the only lens source.** Lenses, hybrids, subject routes and the wildcard rule are read from `think-lenses.yaml`. Do not invent a lens at run time. A way of thinking that is not in the registry is a proposal for the registry, noted under `## Registry gaps` in the record.
2. **Grounding (contract R1).** A lens contributes moves only when at least one passage was retrieved for it. `nothing_found: true` is a valid and respectable lens result. Model recall alone is banned as the sole source unless `--allow-ungrounded` was passed, and then the record is marked `grounded: false` and cannot be routed anywhere.
3. **Falsifier on every move.** Each move states the observation that would show it wrong, or the literal text `none (judgement call)`. No move is dressed up with a contrived test.
4. **Books are lenses.** A passage supplies a way of asking, never a fact about Clarity, SAP or JCL. A claim about live state in a move must name the probe that would establish it.
5. **Append-only record.** `.planning/thinking/` is never rewritten. A re-run writes a new file and links the previous one.
6. **Fixed vocabulary.** Move types are `lateral`, `logical`, `dynamic`, `structural`. Subjects are the registry's subject keys. Evidence carries two fields: `retrieval` (`mcp` or `local-sidecar`, the provenance of the whole run) and `grade` (`measured`, `argued`, `anecdotal`, what the passage itself offers). Provenance never lowers a grade and a grade never hides provenance.
7. **Communication rules of the host repo apply to the record**: answer first, no emoji, no em dashes, headings summarise their content, codes on every move (T1..Tn), every action names an owner and a trigger.

</contracts>

<step_0_inputs>
## Step 0: Parse inputs, resolve the registry, probe retrieval

1. `$ARGUMENTS` is one of: free text; a path to a `.md` (brief, plan, idea, CONTEXT.md); or the word `phase` (read the active phase's CONTEXT.md and PLAN.md via `node super-gsd/scripts/lib/decision-state.cjs --render orchestrator --project "$PWD"` for the phase id). Flags: `--mode`, `--depth`, `--subject`, `--allow-ungrounded`, `--registry <path>` (explicit registry file, wins over the search order; a skill under test in a worktree passes this), `--lenses L-ID,L-ID` (force these lenses into the selected set; they count against the cap and are never cut).
2. Resolve the registry: `--registry <path>` when given, otherwise first hit wins:
   - `super-gsd/registry/think-lenses.yaml` (project)
   - `~/.claude/super-gsd/registry/think-lenses.yaml` (global registry snapshot)
   - `~/.claude/super-gsd/source/super-gsd/registry/think-lenses.yaml` (global source clone)
   If none resolves, stop and report `registry_missing`; do not improvise lenses.
3. Probe retrieval, in this order, and record `vtp_mode`:
   - `mcp`: call `vtp_search_book_passages` on whichever VTP server this environment registers (`vtp-kb` in-project, `vtp` at user scope on devcp) with `query: "health probe"`, `limit: 1`. A response with a `results` array means `mcp`.
   - `local-sidecar`: the MCP call failed or the tool is absent, and `scripts/think-retrieve-local.py` exists in the current directory (Voice-Text-Plan on the laptop). Ranking is token overlap with a relevance floor, so the run carries `retrieval: local-sidecar` and every hit is graded on its content like any other passage.
   - `none`: neither. Continue only with `--allow-ungrounded`; otherwise stop after Step 2 and write a frame-only record with `route: none` and the instruction to re-run when VTP is reachable.
4. Create the run directory `.planning/tmp/think/{YYYYMMDD-HHMM}-{slug}/` (or `./thinking/tmp/...` outside an SGSD project). Every intermediate artefact goes there; sub-agents receive paths, never pasted content.
</step_0_inputs>

<step_1_frame>
## Step 1: Frame the problem without its means

Write `frame.md` in the run directory:

```markdown
# Frame: {slug}
situation: one paragraph of what is observed, each clause traceable to a source (file, log, person, incident id)
consequence: what it costs or blocks, in the unit the operator cares about
decision: the decision that is stuck or the thing being built, stated as a need (verb), not as a product or a means
gap: what understanding is missing
subject: {one or two of SAP-DATA UI-RELAY INTEGRATION DEPLOY-INFRA ORCHESTRATION KNOWLEDGE SECURITY REPORTING PRODUCT PROCESS PEOPLE COMMS}
mode: {solve | enhance | discuss}
definedness: {well-defined | ill-defined | wicked}   (PSD-P-02)
operating_mode: {execute the pattern | question the pattern | rebuild from constraints}   (FPT-P-01)
means_removed: list any means that were in the operator's wording and were stripped out (DTFD-P-01)
premises: numbered; each tagged established | assumed | value judgement, with a locator for the established ones
```

Mode is inferred when not given: a failure or stuck decision is `solve`; a named artefact under construction is `enhance`; a question or topic is `discuss`. Subject is inferred from the frame; if two subjects tie, keep both and say so.

If the frame cannot name a decision or a consequence, stop and ask the operator one question (AskUserQuestion). Do not proceed on a frame with no decision in it (DSSA-P-01).
</step_1_frame>

<step_2_route>
## Step 2: Select the lens set from the registry, not from habit

1. Start from `subject_routes[subject].core` (union when two subjects). Add `mode_additions[mode]`. Add any `--lenses`. Skip any lens with `state: retired`.
2. Apply the wildcard rule: find the move_type absent from the set so far and add the first active lens from `wildcard_rule.preference_by_missing_move_type[that type]` whose family is not already present. If every move_type is present, take the first lens in `wildcard_rule.fallback_order` whose family is not already present. The wildcard is chosen by the registry's order, never by taste; it counts against the cap and is never cut.
3. Cap the set to `depth.{quick|full}.lenses` (quick 6, full 10). Cut in this order until the cap holds: mode additions from the last added, then core lenses from the end of the route list. Never cut the wildcard, a `--lenses` entry, or the first lens of a hybrid you are about to select in step 4.
4. Select the subject's hybrids in route order, up to `depth.{quick|full}.hybrids`, keeping only those whose first lens survived the cap. A hybrid's second lens is additive and does not count against the cap, so quick depth runs at most 7 lenses and full at most 12.
5. Write `lenses.md` listing each selected lens: id, name, question, principles, move_type, evidence_strength, authority_limit, and the reason it was selected (core, mode, forced, hybrid first, hybrid second, wildcard). List the lenses cut by the cap with the reason, so a re-run with `--lenses` can restore them. List the families NOT selected in one line, so the omission is visible (NUO-P-04).

The engineering reflex (inversion, control theory, adversarial framing) is not a lens set. If the selected set contains no metacognitive, dialectical, probabilistic or design lens, the routing was overridden by habit; go back to the registry.
</step_2_route>

<step_3_ground>
## Step 3: Retrieve passages per lens

For each selected lens, retrieve 2 to 4 passages and save them to `{lens_id}.passages.json` in the run directory.

- `mcp`: `vtp_search_book_passages({ query: <lens.question rewritten with the frame's nouns>, filters: { book_slug: [lens.book_slug, ...lens.extra_books], principles: lens.principles }, limit: 4, snippet_chars: 900 })`. If the server predates the `principles` filter it is ignored silently and the book_slug scope still holds. For lenses with `research_queries`, also call `vtp_search_research_passages({ query, limit: 3 })` per query.
- `local-sidecar`: `python scripts/think-retrieve-local.py --slug <book_slug[,extra_books]> --principles <ids> --query "<rewritten question>" --limit 4 --snippet 900 --out {runDir}/{lens_id}.passages.json` (`--snippet` is `snippet_chars`). Exit 0: hits written. Exit 3: no chunk cleared the relevance floor, record `nothing_found: true`. Exit 2: the book is not on disk, record `nothing_found: true` and name the book in Method notes. Exit 1: the script failed; retry once with `PYTHONIOENCODING=utf-8`, then record `retrieval_error` for that lens and continue. Never read exit 1 as nothing found.
- Grade each hit on its content: `measured` when the passage reports a measurement or a study; `argued` when it argues; `anecdotal` when it tells a case. Provenance is recorded once for the run as `retrieval: mcp | local-sidecar`, never as a grade.

A lens whose retrieval returns nothing relevant is recorded `nothing_found: true` and produces no moves. A passage that was retrieved and read but is too far from the frame to ground a move goes in that lens's `passages_unused`; a lens whose every passage is unused is `nothing_found: true` as well. Do not fill the gap from recall. Do not widen the query until it matches something unrelated.

Retrieval is done by the orchestrator before any dispatch. Sub-agents never call MCP (they receive the passages file path).
</step_3_ground>

<step_4_think>
## Step 4: Think through each lens

Each lens produces `{lens_id}.out.yaml` in this shape, and nothing else:

```yaml
lens: L-FP-CONSTRAINT
reframe: "one sentence: what this lens makes the problem look like"
nothing_found: false
moves:
  - technique: "short imperative name"
    move_type: lateral | logical | dynamic | structural
    changes: "the arrangement, quantity or claim it changes"
    helps: "the failure it prevents or the option it opens, in the frame's own consequence unit"
    implement: "concrete steps: files, gates, registries, owners, order"
    falsifier: "the observation that would show this move wrong" | "none (judgement call)"
    cost: low | medium | high
    evidence:
      - principle: FPT-P-02
        passage: "book_slug::chunk_id"
        grade: measured | argued | anecdotal
        quote: "up to 25 words from the passage"
    rules_out: "what this lens says not to do here"
    handoff: L-CORRECT-APART   # optional: any registry lens, selected or not, that should take this move next
passages_unused: ["book_slug::chunk_id"]   # retrieved and read, too far from the frame to ground a move
limits: "what this lens cannot see, from its authority_limit"
```

**Quick depth:** the orchestrator writes each file itself, one lens at a time, reading only `frame.md`, `lenses.md` and that lens's passages file. No lens may be skipped because an earlier lens "already covered it"; each lens is run against the frame, not against the previous lens's output.

**Full depth:** dispatch one sub-agent per lens in parallel:

```javascript
Agent({
  description: `think lens ${lens.id}`,
  subagent_type: "general-purpose",
  model: "sonnet",
  prompt: `Read ${runDir}/frame.md, then ${runDir}/${lens.id}.passages.json.
Lens card: ${JSON.stringify(lensCard)}.
Apply ONLY this lens's question to the frame. Produce moves grounded in the passages given; a move without a passage reference is not admissible. Every move carries a falsifier or the literal text "none (judgement call)". Do not read other files, do not call MCP, do not search the web. Write valid YAML matching the schema in the card to ${runDir}/${lens.id}.out.yaml and reply with the path only.`
});
```

Validate each returned YAML (required keys present, every move has `evidence` with at least one passage, every `grade` in the fixed vocabulary, `falsifier` non-empty). One retry on a schema failure, then mark the lens `invalid_output` and continue.

**Hybrids** run after their first lens has finished: the second lens receives the first lens's `.out.yaml` path as extra input and is told to extend, contradict or bound those moves, not to start again.
</step_4_think>

<step_5_collide>
## Step 5: Collide the moves

1. Merge every `.out.yaml`. Deduplicate moves that name the same change; keep the version with the stronger evidence grade and record the lenses that converged on it (convergence from different families is corroboration, FTD-P-04; convergence from one family is repetition).
2. Assign codes T1..Tn in rank order. Rank by effect on the frame's decision first (DBS-P-04), then by cost, then by evidence grade. A move with `none (judgement call)` ranks below any move with a falsifier at the same effect.
3. Run the dialectical pass on the top five moves, one paragraph each:
   - refute from the move's own rule: the case its own rule cannot cover (DIAL-P-04);
   - inverted re-read: what the move looks like under the opposite framing (NUO-P-03);
   - third activity: if two moves are in tension, is there an arrangement that meets both requirements, and if not, keep the tension as a stated limit, do not average it (NUO-P-01, ANA-P-02).
4. Collect `rules_out` from every lens into one ruled-out list; a move that a lens ruled out and another lens proposed is kept with both sides named.
5. Mark each move `lateral`, `logical`, `dynamic` or `structural`. If one type is absent from the top five, say so; do not manufacture one.
6. Collect every `handoff` that names a lens outside the selected set. List them with the moves that asked for them under `## Not run` in the record, so a re-run with `--lenses` or `--depth full` can cover them.
</step_5_collide>

<step_6_record>
## Step 6: Write the record, the metrics row, and the route

Write `.planning/thinking/{YYYY-MM-DD-HHMM}-{slug}.md` (`mkdir -p` first; outside an SGSD project use `./thinking/`):

```markdown
---
type: think-record
date: {YYYY-MM-DD}
slug: {slug}
mode: {solve|enhance|discuss}
subject: [{subjects}]
depth: {quick|full}
vtp_mode: {mcp|local-sidecar|none}
grounded: {true|false}
lenses_used: [{ids}]
lenses_nothing_found: [{ids}]
hybrids_used: [{ids}]
not_run: [{lens ids named by handoffs but not selected}]
previous_record: {path or null}
route: {sgsd-triage | sgsd-deliberate | gsd-plan-phase | rd-board | none}
---

# {governing thought: one sentence, the answer}

## Frame
{frame.md contents}

## Lenses applied and omitted
{table: lens, family, move_type, selected because, result (n moves | nothing found | invalid output)}
{one line naming the families not used}

## Moves
### T1 {technique} [{move_type}] [{cost}] [evidence: {best grade}]
- changes: ...
- helps: ...
- implement: ...
- falsifier: ...
- evidence: {principle ids with book slug and chunk ids; quote}
- lenses: {converging lens ids}
(repeat)

## Dialectical pass on T1 to T5
{refutation, inverted re-read, third activity or kept tension, per move}

## Ruled out
{list, each with the lens and principle that rules it out}

## Disagreements kept
{tensions not resolved, with both sides named}

## Not run
{lenses named by a handoff but outside the selected set, and the lenses cut by the cap, each with the move or reason}

## Route
{which SGSD continuation and why; if sgsd-deliberate, the Key Questions the brief should carry; if gsd-plan-phase, the task list with T codes; if rd-board, the candidate; if none, why}

## Source ledger
{retrieval mode for the run; every passage used: book slug, chunk id, grade; every passage retrieved and unused; every research passage}

## Registry gaps
{ways of thinking that were wanted and are not in think-lenses.yaml, as proposals}

## Method notes
{lenses fired, lenses with nothing found or retrieval_error, lenses cut by the cap, vtp_mode, what was not checked. No timing or token figures here: the record is written before the run ends, and the metrics row carries them}
```

Append one row to `.planning/metrics/think-log.jsonl` (`mkdir -p .planning/metrics` first; `record` is the repo-relative path; the row is written after the record and carries the timing):

```json
{"ts":"{ISO}","slug":"{slug}","mode":"{mode}","subject":["..."],"depth":"{depth}","vtp_mode":"{mode}","grounded":true,"lenses":["..."],"lenses_nothing_found":["..."],"lenses_cut":["..."],"not_run":["..."],"moves":N,"promoted":0,"route":"{route}","record":"{repo-relative path}","wall_s":N,"tokens_est":N}
```

`promoted` starts at 0 and is updated by the operator or by the consuming skill when a move becomes a plan task, a brief question or an rd-board candidate (`node -e` one-liner or a manual edit is acceptable; the field exists so lenses can be retired by ablation).

Route rules:
- any move is GATE-tier (new system, dependency, architecture, contract change) → `sgsd-deliberate`; draft the Key Questions from the kept disagreements;
- the frame is an external idea or paper → `rd-board`;
- every promoted move is LITE or FULL tier and implementable → `gsd-plan-phase` with the T codes as task seeds;
- the frame is still ambiguous after the pass → `sgsd-triage`;
- `grounded: false` → `none`.

Report in chat: the governing thought first, then T codes with one line each, the route, and the absolute path of the record. Do not restate the record.
</step_6_record>

<degraded_modes>

| Condition | Behaviour |
| --- | --- |
| Registry missing at all three paths | Stop, report `registry_missing`, no record |
| MCP unavailable, local script present (laptop) | `vtp_mode: local-sidecar`; grade each passage as `measured`, `argued` or `anecdotal`, and record retrieval provenance in Source ledger |
| MCP unavailable, no local script (devcp) | Frame-only record, `route: none`, ask operator to re-run when the tunnel is up; with `--allow-ungrounded`, full run with `grounded: false` and `route: none` |
| A lens returns nothing, or every retrieved passage is unused | `nothing_found: true`, zero moves, lens listed in the omitted table |
| Local retriever exits 1 | Retry once with `PYTHONIOENCODING=utf-8`; then `retrieval_error` for that lens, noted in Method notes |
| Sub-agent returns invalid YAML twice | `invalid_output`, lens excluded, noted in Method notes |
| Frame has no decision | One AskUserQuestion, then stop if still none |

</degraded_modes>

<rules>

1. Never edit `think-lenses.yaml` during a run. Registry changes are their own commit with a reason and a retirement or admission record.
2. Never pass the executor's or the operator's proposed solution to a lens as if it were the frame; strip means first (Step 1).
3. Never let a lens read another lens's output except as the second half of a registered hybrid.
4. Never dispatch a lens sub-agent with MCP tools; retrieval belongs to the orchestrator.
5. Never write more than one record per run and never rewrite an existing record.
6. Never route a `grounded: false` record into a brief, plan or board.
7. Never present a book passage as a fact about Clarity, SAP or JCL.
8. Never write timing or token figures into the record; the metrics row carries them, because the record is append-only and finished before the run is.

</rules>

<red_flags>

Stop and go back to the registry when you notice any of these:

- Every selected lens is from one family, or none is metacognitive, dialectical, probabilistic or design.
- A move has no passage reference "because the point is obvious".
- Every move is `logical` and nothing is `lateral`.
- The ruled-out list is empty.
- The record has moves but `vtp_mode` is `none` and `--allow-ungrounded` was not passed.
- The falsifier restates the move ("it would be wrong if it did not work").
- The route is `none` while grounded moves exist.
- You are about to skip a lens because "the earlier lens already covered it".
- The wildcard was picked by judgement; when every move_type is present the registry's `fallback_order` decides.

</red_flags>

<rationalisations>

| Excuse | Reality |
| --- | --- |
| "My own knowledge covers this problem" | The baseline run without this skill produced twenty techniques and stated: sources drawn on, none, own knowledge only. That is the failure this skill exists to prevent. Retrieve or record nothing found. |
| "The engineering lenses are the relevant ones" | Expertise raises the chance of fixation, not lowers it (PSD-P-04). The registry decides the set; habit does not. |
| "A falsifier here would be contrived" | Then write `none (judgement call)` and let the move rank below tested ones. Do not invent a test and do not omit the field. |
| "The lens found nothing, so I filled in what it would have said" | `nothing_found: true` is the honest output. A filled gap is model recall wearing a citation. |
| "The book says X, so X holds for Clarity" | Books are lenses. Name the probe that would establish X on the live system, or drop the claim. |
| "No time for the dialectical pass" | Quick depth still runs the refutation and the inverted re-read on the top five. That is where the untested move gets caught. |
| "The record is long, I will just summarise in chat" | The record is the deliverable; chat gets the governing thought, the T codes and the path. Summaries of the record score worse than the record. |

</rationalisations>

<quick_reference>

| Station | Input | Output | Rule that bites |
| --- | --- | --- | --- |
| 0 Inputs | `$ARGUMENTS` | registry path, `vtp_mode`, run dir | no registry, no run |
| 1 Frame | operator text or file | `frame.md` with decision, means removed, premises | no decision, one question, then stop |
| 2 Route | frame + registry | `lenses.md` (selected, why, cut, omitted) | cap 6 or 10; wildcard and hybrid firsts never cut; habit never selects |
| 3 Ground | lenses | `{lens}.passages.json` | nothing found is a result |
| 4 Think | frame + passages | `{lens}.out.yaml` | every move: evidence + falsifier |
| 5 Collide | all outputs | T codes, dialectical pass, ruled out, tensions | rank by effect on the decision |
| 6 Record | everything | `.planning/thinking/...md`, metrics row, route | append-only, chat gets the thought and the path |

</quick_reference>
