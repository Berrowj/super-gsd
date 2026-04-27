---
phase: 39
name: Gate Keep/Kill Review
milestone: v1.8
status: research_complete
researched: 2026-04-27
confidence: HIGH
controlling_principle: "Autonomy continues; evidence tells the truth."
locked_decisions: [39=B]
---

# Phase 39: Gate Keep/Kill Review - Research

## Summary

Phase 39 lands the mechanical keep/kill rubric that consumes Phase 34's
review-ledger, Phase 36's gate-value-log, and the existing edge-guard-log
to classify each of the 13 registered gates in
`super-gsd/registry/gates.yaml` as `keep | kill | defer`. The controlling
artifact is a new tool `super-gsd/tools/gate-keep-kill/rubric.cjs` that
exports `runRubric(planningDir, opts)` + `renderTable(rows)` with a frozen
`KEEP_THRESHOLDS` enum encoding the mechanical rule. Manual override at
milestone close is preserved per lock 39=B: the rubric only RECOMMENDS;
the operator (via sgsd-complete-milestone SKILL.md surfacing) decides
whether to act on `kill` rows.

Architecture mirrors Phase 32, 34, 36, 38 1:1: pure data + pure functions,
frozen const enums, public API never throws upward, `__dirname`-anchored
fingerprint guard, defensive read of all source ledgers, single-plan
delivery. Phase 39 differs in two respects: (a) location is
`super-gsd/tools/gate-keep-kill/rubric.cjs` NOT `scripts/lib/` per
ROADMAP-AGENT.md:433 verbatim, matching the Phase 35 system-map / Phase 50
release-readiness multi-source-aggregator pattern; (b) defer-on-empty
(RUBRIC-03) is the controlling correctness rule -- gates with zero fires
MUST classify as `defer`, never `kill` -- because v1.8 is the first
milestone that populates gate-value-log.jsonl and most gates will have
zero rows at v1.8 close.

**Primary recommendation:** Single plan; ~360-line tool + 14-assertion
self-test + sgsd-complete-milestone SKILL.md wire-in (new Step 4.5
between gate-drift Step 4 and cross-phase Step 5). Net ~+440 / -0.
Schema-without-consumer rule satisfied by 3 in-phase consumers
(Section 8).

## Architectural Responsibility Map

| Capability | Tier | Rationale |
|------------|------|-----------|
| Read gate-value-log summarize() output | tools/gate-keep-kill (cjs) | Phase 36 lib `summarize` API |
| Read review-ledger rows per gate | tools/gate-keep-kill (cjs) | Phase 34 lib `readReviewRows` |
| Read edge-guard-log rows per gate | tools/gate-keep-kill (cjs) | Local read; edge-guard.cjs writes only |
| Apply mechanical rubric rule | tools/gate-keep-kill (cjs) | Pure function; closed enum verdicts |
| Defer-on-empty enforcement | tools/gate-keep-kill (cjs) | Gates with 0 fires MUST be `defer` |
| Render markdown table | tools/gate-keep-kill (cjs) | Consumed by sgsd-complete-milestone |
| Wire-in at milestone close (Step 4.5) | sgsd-complete-milestone/SKILL.md (edit) | RUBRIC-04 production caller |
| Manual override after rubric output | operator (out of band) | Lock 39=B: rubric recommends only |
| Auto-execute kill of any gate | NOT IMPLEMENTED (locked deferred) | mass-discuss line 214: too dangerous |

## User Constraints (from ROADMAP-AGENT.md + mass-discuss)

### Locked Decisions (verbatim, mass-discuss.md line 214)

- **39=B** Mechanical rubric + manual override at close. "Auto-execute
  kills too dangerous" -- the rubric reads telemetry, classifies each
  gate, renders a table; the operator (with sgsd-complete-milestone
  SKILL.md as the surfacing point) decides what to do with `kill`
  recommendations. The script NEVER edits gates.yaml, NEVER toggles
  `state:` fields, NEVER mutates registry rows.

### Acceptance criteria (REQUIREMENTS.md lines 41-46)

- **RUBRIC-01** Mechanical script reading review-ledger + gate-value-log
  + edge-guard-log.
- **RUBRIC-02** Output table with all 13 gates classified
  `keep | kill | defer`.
- **RUBRIC-03** `defer-on-empty` (gate-value-log empty for that gate)
  is explicit, NOT default-kill on missing data.
- **RUBRIC-04** Wired into `sgsd-complete-milestone/SKILL.md` at close.

### Cross-milestone integration (REQUIREMENTS.md line 96)

Phase 39 rubric defer-on-empty handles cold-start state. Mirror
contract: v1.7's `--kill-check empty_baseline` fix is scoped to
review-ledger; Phase 39 needs the analogous defer-on-empty for
gate-value-log AND edge-guard-log AND review-ledger -- any of the
three being empty for a given gate produces `defer`, not `kill`.

### Claude's Discretion (locked recommendations below)

- Threshold values for `keep` / `kill` / `defer` (locked Section 1.2).
- Reason-string vocabulary in output table (locked Section 3.2).
- Tool subdirectory layout under `super-gsd/tools/` (locked Section 2).
- Self-test assertion count: 14 (matches Phase 36 baseline; honors
  briefing 12+ floor).
- Public API surface: 3 functions + 3 frozen constants (Section 5).
- Renderer markdown column order (Section 3.3).

### Deferred Ideas (OUT OF SCOPE)

- Auto-execute `kill` recommendations (mass-discuss line 214 verbatim).
- Per-milestone threshold tuning (v1.9+ if value emerges).
- Cockpit / Mission Strip live keep/kill display (v2.0+ ops).
- Trend lines across milestones (v1.9+; rubric is single-snapshot).
- gates.yaml mutation (operator-only after review).
- Slack/email notification of `kill` rows (SUMMARY.md surfacing is the
  v1.8 channel).
- Confidence intervals on `value_score` (v2.0+).

## Phase Requirements

| ID | Description | Section |
|----|-------------|---------|
| RUBRIC-01 | Mechanical script reading 3 ledgers | 1, 2, 5 |
| RUBRIC-02 | Output table with all 13 gates classified | 3 |
| RUBRIC-03 | `defer-on-empty` explicit (NOT default-kill) | 6 |
| RUBRIC-04 | Wired into sgsd-complete-milestone SKILL.md at close | 4 |

---

## 1. Rubric Algorithm + Thresholds

### 1.1 Inputs per gate

For each gate row in `super-gsd/registry/gates.yaml::gates[]` (13 entries):

| Source | Data | Lib function |
|--------|------|-------------|
| `gate-value-log.jsonl` | `{fires, pass, warn, block, skip, value_score}` | `gate-value-log.cjs::summarize(planningDir, {gate})` |
| `review-ledger.jsonl` | rows where `_legacy.gate === <name>` | `review-ledger.cjs::readReviewRows(planningDir)` filtered locally |
| `edge-guard-log.jsonl` | rows where `gate === <name>` AND `resolution in {log-only, halt}` | inline read (no helper exists; edge-guard.cjs writes only) |

### 1.2 Mechanical rule (closed enum, first match wins)

```
INPUT:  fires (int >= 0), value_score (float in [0,1] | null)
OUTPUT: verdict in {'keep','kill','defer'}, reason (closed enum)

R1. fires === 0
    -> defer; reason = 'no_fires_yet'              (RUBRIC-03)
R2. value_score === null
    -> defer; reason = 'value_score_indeterminate'
R3. fires < min_fires_for_kill (10) AND value_score < kill_value_score (0.2)
    -> defer; reason = 'insufficient_evidence_for_kill'   (NOT default-kill)
R4. value_score >= keep_value_score (0.5) AND fires >= min_fires_for_keep (5)
    -> keep;  reason = 'value_score_above_threshold'
R5. value_score < kill_value_score (0.2) AND fires >= min_fires_for_kill (10)
    -> kill;  reason = 'value_score_below_threshold_with_evidence'
R6. (fallthrough)
    -> defer; reason = 'mid_value_score_or_low_fires'
```

Frozen thresholds:

```javascript
const KEEP_THRESHOLDS = Object.freeze({
  keep_value_score:    0.5,
  kill_value_score:    0.2,
  min_fires_for_keep:  5,
  min_fires_for_kill:  10,
});
```

**Why kill bar > keep bar (10 vs 5):** killing is destructive; we need
MORE evidence to recommend kill than keep. Asymmetry encodes "evidence
tells the truth": insufficient evidence defaults to keep-the-gate via
`defer`, never default-kill. 5-fire keep bar matches the point at which
review-ledger.cjs::killCheck flips from `empty_baseline` to
`baseline_ok`.

### 1.3 Edge-guard-log halt override

Single structural-correctness override on top of R1-R6:

If a gate has `>= 1` row in `edge-guard-log.jsonl` with `gate === <name>`
AND `resolution === 'halt'` AND row's `ts` is newer than milestone start:
verdict is FORCED to `keep`, reason = `structural_emit_required`,
regardless of value_score. Rationale: a gate that triggered an
edge-guard halt within the milestone is by definition load-bearing;
killing it is incoherent. Soft `log-only` rows do NOT force the verdict;
they appear in `notes` for operator awareness only.

### 1.4 Review-ledger consistency cross-check

For each gate, count review-ledger rows where `_legacy.gate` matches
`<name>`; compute `pass_rate = ok / (ok+warn+fail+blocked)` from the
envelope status field (excluding skipped/timeout).

- Divergence (`|pass_rate - value_score| >= 0.3`) with `>= 5` rows in
  BOTH logs -> notes += `'review_ledger_divergence'`. Does NOT change
  verdict.
- Zero review-ledger rows but `>= 5` gate-value-log fires -> notes
  += `'review_ledger_uncovered'`.

Rubric is read-only on the ledgers; reconciliation is operator
judgment.

## 2. Tool Location + Structure

### 2.1 File layout

```
super-gsd/
+-- tools/
    +-- gate-keep-kill/
        +-- rubric.cjs          (~360 lines: lib + CLI + self-test)
```

### 2.2 Why `tools/` not `scripts/lib/`

Per ROADMAP-AGENT.md:433 verbatim:
`New: super-gsd/tools/gate-keep-kill/rubric.cjs`. Matches `tools/`
precedents (system-map P35, status-consistency, phase-folder-audit P40,
failure-injection P46, release-readiness P50). Boundary:

| Layer | Pattern | Examples |
|-------|---------|----------|
| `scripts/lib/*.cjs` | Pure read/write helpers for ONE log/file | route-ledger, review-ledger, gate-value-log, sampling-decider, edge-guard, repair-command-checker |
| `tools/<name>/*.cjs` | Multi-source aggregator/auditor producing report | system-map, release-readiness, gate-keep-kill, phase-folder-audit |

Rule: `lib/*` owns ONE source of truth; `tools/*` consumes multiple
`lib/` outputs to produce a derived view. Phase 39 reads 3 ledgers + 1
registry to produce a 4th derived view -- belongs in `tools/`.

### 2.3 Single-file structure

Single `rubric.cjs` (no split), mirroring Phase 36/38. Layout:
header -> 3 frozen consts (VERDICTS, KEEP_THRESHOLDS, REASONS) ->
private `_readEdgeGuardRows` -> public `classifyGate` (pure) ->
public `runRubric` -> public `renderTable` -> `selfTest` (14
assertions) -> `main` (CLI: `--self-test | --render | --json`).

## 3. Output Schema

### 3.1 Row shape (one per gate)

```typescript
interface RubricRow {
  gate:        string;                       // gates.yaml row name
  verdict:     'keep' | 'kill' | 'defer';
  fires:       number;                       // gate-value-log fires count
  value_score: number | null;                // null if no fires
  pass_rate:   number | null;                // review-ledger pass rate
  reason:      string;                       // REASONS enum (Section 3.2)
  notes:       string[];                     // soft warnings
}
```

### 3.2 REASONS closed enum (frozen)

```javascript
const REASONS = Object.freeze({
  no_fires_yet:                              'no_fires_yet',
  value_score_indeterminate:                 'value_score_indeterminate',
  insufficient_evidence_for_kill:            'insufficient_evidence_for_kill',
  value_score_above_threshold:               'value_score_above_threshold',
  value_score_below_threshold_with_evidence: 'value_score_below_threshold_with_evidence',
  mid_value_score_or_low_fires:              'mid_value_score_or_low_fires',
  structural_emit_required:                  'structural_emit_required',
});
```

### 3.3 Markdown table column order

```
| gate | verdict | fires | value_score | pass_rate | reason | notes |
```

Rendering rules consumed by SKILL.md Step 4.5:

- `verdict` wraps in **bold** for `kill`, plain for `keep`, italic for
  `defer` (operator visual triage).
- `value_score` formatted to 2 decimal places when non-null; literal
  string `"--"` when null (defer-on-empty visibility).
- `pass_rate` same rule.
- `reason` literal REASONS enum value (no prose translation).
- `notes` joined with `; ` separator (or `"--"` when empty).

### 3.4 Sample output (illustrative)

```
| gate                  | verdict | fires | value_score | pass_rate | reason                                    | notes                       |
|-----------------------|---------|-------|-------------|-----------|-------------------------------------------|-----------------------------|
| per-dispatch-ATC      | keep    | 23    | 0.78        | 0.82      | value_score_above_threshold               | --                          |
| phase-level-ATC       | keep    | 8     | 0.62        | 0.75      | value_score_above_threshold               | --                          |
| MUDA-waste-audit      | defer   | 4     | 0.50        | --        | mid_value_score_or_low_fires              | review_ledger_uncovered     |
| classifier-haiku      | defer   | 0     | --          | --        | no_fires_yet                              | --                          |
| sgsd-recall-queries   | defer   | 0     | --          | --        | no_fires_yet                              | --                          |
| ... (8 more gates)    | ...     | ...   | ...         | ...       | ...                                       | ...                         |
```

At v1.8 close, expect the majority of gates to be `defer` with reason
`no_fires_yet` (Phase 36 only wires 3 sites; the other 10 lack
telemetry yet). This is correct -- defer-on-empty in action,
satisfying RUBRIC-03.

## 4. Wire-In Target (RUBRIC-04)

### 4.1 Insertion point in sgsd-complete-milestone/SKILL.md

Natural placement is BETWEEN Step 4 (Gate Drift Audit; reads
edge-guard-log) and Step 5 (Cross-Phase Integration). Step 4 already
reads per-gate signals at milestone close; Phase 39's rubric is the
next-logical-step that consumes the same edge-guard-log alongside
two newer ledgers.

| Step | After Phase 39 |
|------|----------------|
| 0-4 | unchanged |
| **4.5 (NEW)** | **Gate Keep/Kill Rubric (+~15 lines)** |
| 5 | unchanged |
| 6 | extended +~6 lines (rubric table embed in SUMMARY.md) |
| 7-9 | unchanged |

### 4.2 Step 4.5 SKILL.md content (verbatim spec for planner)

```markdown
<step_4_5_gate_keep_kill_rubric>
## Step 4.5: Gate Keep/Kill Rubric (Phase 39 -- RUBRIC-01..04)

Run the mechanical rubric over the milestone's gate telemetry:

const { runRubric, renderTable } = require(
  './super-gsd/tools/gate-keep-kill/rubric.cjs'
);
const rows = runRubric('.planning', { milestone: '{{version}}' });
const md   = renderTable(rows);
require('fs').writeFileSync(
  '.planning/milestones/{{version}}/gate-keep-kill.md',
  '# Gate Keep/Kill Rubric (milestone {{version}})\n\n' +
  '> Mechanical recommendation. Manual override at operator judgment.\n' +
  '> Locked decision 39=B: auto-execute kills are deferred to operator.\n\n' +
  md + '\n', 'utf8');

Per lock 39=B: this step ONLY produces the recommendation table.
The operator (or future automation explicitly added in v1.9+)
decides whether to act on `kill` rows. The script does NOT mutate
gates.yaml or any registry file.

Defer-on-empty (RUBRIC-03): gates with zero fires in
`gate-value-log.jsonl` MUST classify as `defer`, not `kill`. The
first v1.8 close will produce a table where most gates are `defer`
with reason `no_fires_yet` -- correct cold-start state.
</step_4_5_gate_keep_kill_rubric>
```

### 4.3 Step 6 SUMMARY.md extension

Add a new subsection to the SUMMARY.md template after Unresolved Repairs
(line 143) and before VTP Connections (line 152):

```markdown
## Gate Keep/Kill Rubric (milestone {{version}})

> Mechanical recommendation. Operator judgment for any `kill` row.

| gate | verdict | fires | value_score | pass_rate | reason | notes |
|------|---------|-------|-------------|-----------|--------|-------|
{{rows from runRubric, rendered via renderTable}}
```

This converts the rubric into evidence inside the milestone artifact,
satisfying RUBRIC-04 (wired into SKILL.md at close).

## 5. Public API Design

Mirrors gate-value-log.cjs and sampling-decider.cjs module.exports
shape: 3 named functions + 3 frozen constants.

```javascript
module.exports = {
  // Public functions:
  runRubric,         // (planningDir, opts) -> RubricRow[]
  renderTable,       // (rows) -> markdown string
  classifyGate,      // (gateName, summary, reviewRows, edgeRows) -> RubricRow
                     //   exposed for unit testing; pure function

  // Frozen constants:
  KEEP_THRESHOLDS,   // {keep_value_score, kill_value_score, min_fires_for_keep, min_fires_for_kill}
  VERDICTS,          // ['keep', 'kill', 'defer']
  REASONS,           // closed enum dict
};
```

### 5.1 Signatures

| Function | Signature | Contract |
|----------|-----------|----------|
| `runRubric` | `(planningDir, opts?) -> RubricRow[]` | NEVER throws upward; missing log file -> defer with appropriate reason. `opts.milestone` filters logs; `opts.gatesYamlPath` overrides the `__dirname`-anchored default |
| `renderTable` | `(rows) -> string` | Markdown table per Section 3.3 column order |
| `classifyGate` | `(gateName, summary, reviewRows, edgeRows) -> RubricRow` | Pure function; deterministic; no I/O. Exposed for self-test independence so rule logic is unit-testable without fs fixtures |

## 6. Defer-on-Empty Contract (RUBRIC-03)

### 6.1 What "empty" means

For gate `<name>`:

| Source | Empty condition | Effect on verdict |
|--------|----------------|------------------|
| gate-value-log.jsonl | `summarize()` returns no entry, or `fires === 0` | verdict = `defer`, reason = `no_fires_yet` |
| review-ledger.jsonl | No row tagged for this gate | `pass_rate: null`; notes += `'review_ledger_uncovered'`; does NOT force defer |
| edge-guard-log.jsonl | No row | No effect |
| ALL three empty | All sources empty | verdict = `defer`, reason = `no_fires_yet` |

PRIMARY defer-on-empty trigger is gate-value-log emptiness; gate-value-log
is the canonical fitness signal (Phase 36). Review-ledger emptiness
alone is a coverage gap (note), not a classification trigger -- gate-
OUTPUT data (review-ledger) is informational; gate-FITNESS data
(gate-value-log) is dispositive.

### 6.2 What default-kill would look like (and why it's banned)

Naive (FORBIDDEN) coding:

```javascript
// FORBIDDEN: this is what RUBRIC-03 explicitly bans
if (!summary || summary.fires === 0) return { verdict: 'kill', reason: 'no_data' };
```

This is a category error: zero fires means ZERO evidence, not negative
evidence. Correct response is `defer`. Mirror lock from v1.7:
`review-ledger.cjs::killCheck` returns
`{ok: false, reason: 'empty_baseline'}` on zero rows, NOT
`{ok: false, reason: 'baseline_failed'}`. Phase 39 rubric inherits the
semantic -- empty input produces a non-actionable verdict (`defer`),
which the operator interprets as "wait for more data," not "kill now."

### 6.3 Self-test must bind RUBRIC-03

Self-test fixture (Section 7) MUST include a fixture where
gate-value-log is empty and the rubric output for every gate is
`defer` with reason `no_fires_yet`. Binding RUBRIC-03 acceptance test.

### 6.4 Cold-start operator contract

First v1.8-close run: gate-value-log has rows only for Phase 36's 3
wire-ins (phase-level-ATC, per-dispatch-ATC, MUDA-waste-audit). The
other 10 gates classify as `defer` / `no_fires_yet`. Correct: those
gates lack telemetry sources; rubric must not invent verdicts. Future
phases add wire-ins; output becomes more decisive over time without
code change.

## 7. --self-test Scaffold

Target: **14 assertions** (Phase 36 baseline; honors briefing 12+
floor). Mirrors gate-value-log.cjs:344-545 layout, including the
canonical fingerprint guard (Phase 36 ATC W2 lesson).

Skeleton mirrors gate-value-log.cjs:344-545 (canonical fingerprint
guard before tmp work; tmp via `fs.mkdtempSync`; pass/fail tally;
exit 0/1). Captures mtime+size of 4 canonicals
(`.planning/metrics/{gate-value-log,review-ledger,edge-guard-log}.jsonl`
+ `super-gsd/registry/gates.yaml`) anchored to `__dirname`.

The 14 assertions:

| #  | Asserts | Binds |
|----|---------|-------|
| 1  | VERDICTS frozen, length 3, {keep,kill,defer} | shape |
| 2  | KEEP_THRESHOLDS frozen, 4 keys, values match Section 1.2 | shape |
| 3  | REASONS frozen, 7 keys, values match Section 3.2 | shape |
| 4  | classifyGate('g1', null, [], []) -> defer + 'no_fires_yet' | **RUBRIC-03** |
| 5  | fires>=5, value_score 0.8 -> keep + 'value_score_above_threshold' | R4 |
| 6  | fires>=10, value_score 0.1 -> kill + 'value_score_below_threshold_with_evidence' | R5 |
| 7  | fires=7, value_score 0.1 -> defer + 'insufficient_evidence_for_kill' | **RUBRIC-03 secondary** |
| 8  | fires=4, value_score 0.7 -> defer + 'mid_value_score_or_low_fires' | R6 |
| 9  | value_score=null -> defer + 'value_score_indeterminate' | R2 |
| 10 | Edge-guard resolution='halt' on low-value gate -> keep + 'structural_emit_required' | Section 1.3 |
| 11 | runRubric over 3-gate fixture -> 3 rows, valid verdict + reason | integration |
| 12 | renderTable on full 13-gate fixture -> 13 rows + header per Section 3.3 | renderer |
| 13 | Malformed line in gate-value-log.jsonl skipped; surrounding rows used | defensive read |
| 14 | mtime+size of 4 canonical files unchanged after self-test | fingerprint guard |

### 7.1 Fixture + count rationale

Fixtures live in `tmp = fs.mkdtempSync(...)`; rubric.cjs is tested in
isolation (does NOT import gate-value-log.cjs; appendFile fakes log
rows). Assertions 11/12 use a 3-row fixture `gates.yaml` written under
`tmp/registry/` passed via `opts.gatesYamlPath`. The real
`super-gsd/registry/gates.yaml` is NEVER touched (assertion 14 proves
this). Count rationale: Phase 36 baseline is 14; Phase 39's 7 rule
branches (R1-R6 + halt override) + 3 shape + 1 runRubric + 1
renderTable + 1 defensive read + 1 fingerprint guard = 14, exceeding
the briefing's 12+ floor.

## 8. Schema-Without-Consumer Rule Satisfaction

Phase 39 lands ONE new schema (`RubricRow`) and produces ONE new
artifact (`gate-keep-kill.md` per milestone). Per the
SGSD-v2-MIGRATION-MANIFEST.md "schema without consumer is contract
without enforcement" rule, every emitted shape MUST have a real
in-phase consumer.

| Consumer site | Reads | Phase 39 ships |
|--------------|-------|----------------|
| 1. `super-gsd/tools/gate-keep-kill/rubric.cjs::selfTest` | RubricRow shape via classifyGate + renderTable | YES (within file) |
| 2. `super-gsd/skills/sgsd-complete-milestone/SKILL.md::Step 4.5` | `runRubric()` result; `renderTable()` markdown | YES (RUBRIC-04 wire-in) |
| 3. `.planning/milestones/{{version}}/SUMMARY.md` Step 6 extension | Embeds rendered markdown | YES (Step 6 modification) |

Three in-phase consumers -- exceeds the ">=1 production caller" floor
and matches Phase 32/36/38 precedents. Future speculative consumers
(do NOT bind Phase 39): Phase 40 phase-folder-audit, Phase 42
citation-relevance, Phase 50 release-readiness "gate health" bucket.

## 9. Architectural Mirror Discipline (1:1 with Phase 32 / 34 / 36 / 38)

| Property | Phase 32 (route-ledger.cjs) | Phase 34 (review-ledger.cjs) | Phase 36 (gate-value-log.cjs) | Phase 38 (sampling-decider.cjs) | Phase 39 (rubric.cjs) |
|----------|----|----|----|----|----|
| Frozen const enums | BOUNDARIES, STATUSES | LEGACY_VERDICT_MAP, STATUSES | OUTCOMES, STATUSES, VERDICT_OUTCOME_MAP | WORK_RISKS, SAMPLING_TIERS, VERDICTS, MATRIX | VERDICTS, REASONS, KEEP_THRESHOLDS |
| Public API never throws upward | YES | YES | YES | YES (shouldSample fires-on-error) | YES (defer-on-error) |
| Defensive read (skip malformed) | YES | YES | YES | N/A (no read) | YES (inherits gate-value-log + own edge-guard reader) |
| `__dirname` fingerprint guard | YES | YES | YES (W2 fix) | YES (gates.yaml + route-decisions.jsonl) | YES (4 canonicals) |
| Manual envelope-v1 schema check | YES | YES | YES | N/A | N/A (rubric is derived report, not envelope row) |
| Single-file deliverable | YES | YES | YES | YES | YES |
| `--self-test` exits 0 on PASS | YES | YES | YES (14) | YES (17) | YES (14 target) |
| Single-plan delivery | YES | YES | YES | YES | YES |

Two architectural deviations:

1. **Location:** `tools/` not `scripts/lib/` (Section 2.2; matches
   Phase 35/40/46/50 tool-tier precedent).
2. **No writer counterpart:** rubric is read-only over 4 canonical
   sources. No `appendRubricRow` because output is recomputed each run,
   never persisted as a JSONL stream. Rubric is a snapshot view, not
   a ledger.

## 10. Open Derivation Calls + Locked Recommendations

All 11 calls below are LOCKED in this RESEARCH.

| Q | Question | LOCKED |
|---|----------|--------|
| Q1 | Tool location: `scripts/lib/` or `tools/`? | `super-gsd/tools/gate-keep-kill/rubric.cjs` per ROADMAP-AGENT.md:433 |
| Q2 | Single-file or split? | Single. Mirrors Phase 36/38 |
| Q3 | Threshold values (keep>=0.5, kill<0.2, min fires 5/10)? | Section 1.2 verbatim; asymmetry encodes "evidence tells truth" |
| Q4 | R1-R6 rule order (defer-on-empty FIRST)? | Section 1.2 first-match-wins; `fires===0` first; RUBRIC-03 cannot be bypassed |
| Q5 | Edge-guard halt override? | Section 1.3: halt within milestone window forces `keep` regardless of value_score |
| Q6 | Review-ledger divergence? | Section 1.4 notes-only; does NOT change verdict |
| Q7 | Defer-on-empty primary signal? | Section 6.1: gate-value-log dispositive; review-ledger note-only; edge-guard no-op |
| Q8 | SKILL.md insertion point? | Section 4.1 new Step 4.5 between Step 4 (gate-drift) and Step 5 (cross-phase) |
| Q9 | Output artifact location? | Section 4.2: `.planning/milestones/{{version}}/gate-keep-kill.md`; embedded in SUMMARY.md |
| Q10 | Public API surface? | Section 5: 3 fns (runRubric, renderTable, classifyGate) + 3 frozen consts |
| Q11 | Self-test assertion count? | 14 (Phase 36 baseline; briefing 12+ floor); RUBRIC-03 bound by assertions 4+7 |

## 11. Live-or-Local Fallback (Patch 4)

**Live:** the next milestone close enters Step 4.5 with canonical
`gate-value-log.jsonl` (Phase 36), `review-ledger.jsonl` (Phase 34),
`edge-guard-log.jsonl` (edge-guard since v1.0; file may not exist if
no violations fired -- rubric defensive-reads as zero rows).
`runRubric()` produces 13 rows; `renderTable()` writes to
`.planning/milestones/v1.8/gate-keep-kill.md`; SUMMARY.md embeds.
Production proof.

**Local:** `super-gsd/tools/gate-keep-kill/rubric.test.cjs` (~120
lines) exercises the SAME exported helpers SKILL.md will call,
against in-tmpdir fixtures. Five test cases (per Phase 38 precedent
count):

1. **Empty everything** -- empty gate-value-log, review-ledger,
   edge-guard-log; gates.yaml with 13 rows. Expect 13 rows out, all
   `defer` with `no_fires_yet`. Binds RUBRIC-03 to a real run.
2. **Mixed verdict spread** -- gate-value-log with rows for 3 gates
   (one keep candidate, one kill candidate, one defer). Expect
   correct verdict per gate.
3. **Edge-guard halt override** -- gate-value-log shows kill
   candidate; edge-guard-log has resolution='halt' for same gate
   in milestone window. Expect verdict forced to `keep`,
   reason `structural_emit_required`.
4. **Review-ledger divergence note** -- gate-value-log shows high
   value_score, review-ledger shows low pass_rate for same gate.
   Expect verdict matches gate-value-log (keep), notes contains
   `'review_ledger_divergence'`.
5. **Renderer round-trip** -- runRubric output -> renderTable ->
   parse markdown -> recover row count and verdict column. Asserts
   table is well-formed and column order matches Section 3.3.

Lib has zero external deps (node built-ins fs, path, os only). Live
cannot be blocked by `provider_unavailable`. Local fallback covers
all RUBRIC-XX requirements deterministically; live (when reachable)
supersedes local.

## 12. Single Plan Recommendation

**One plan: `39-01-gate-keep-kill-PLAN.md`**

| Atomic commit | Files | Approx +/- |
|---------------|-------|------------|
| C1: tool + self-test | `super-gsd/tools/gate-keep-kill/rubric.cjs` (NEW) | +360 / -0 |
| C2: SKILL.md wire-in (RUBRIC-04) | `super-gsd/skills/sgsd-complete-milestone/SKILL.md` (Step 4.5 insert + Step 6 SUMMARY extension) | +28 / -0 |
| C3: local-fallback test | `super-gsd/tools/gate-keep-kill/rubric.test.cjs` (NEW) | +120 / -0 |

Total: 2 created, 1 edited. Net ~+440 / -0.

Why one plan:

1. C1 self-test must pass before C2 wires SKILL.md production caller
   (C2 imports C1's module.exports).
2. C3 local-fallback exercises the same code path C2 invokes -- same
   plan ensures fallback is binding-equivalent to live.
3. Phase 32, 34, 36, 37, 38 each shipped lib/tool + wires + test in a
   single plan. Phase 39 inherits that precedent.

Acceptance gate (per ROADMAP-AGENT.md:436-439 + REQUIREMENTS.md:43-46):

- `node rubric.cjs --self-test` exits 0 (14 assertions PASS).
- `node rubric.cjs --render --milestone v1.8` produces a table with
  all 13 gates (RUBRIC-02).
- Defer-on-empty proven: self-test assertion 4 + fixture case 1
  (RUBRIC-03).
- SKILL.md Step 4.5 invokes `runRubric` + `renderTable`, writes
  `gate-keep-kill.md` (RUBRIC-04); provider_unavailable -> local
  fallback -> continue.
- Fingerprint guard: 4 canonicals untouched by self-test
  (gate-value-log + review-ledger + edge-guard-log + gates.yaml).

Risk: FULL (~440 lines + new tool subdir + SKILL.md edit). Per-dispatch
and phase-level ATC fires. Edge-guard structural check on Step 4.5
emit (`gate-keep-kill.md`) is the main novelty. MUDA likely fires.

---

## Sources

### Primary (HIGH confidence)
- `.planning/discussions/2026-04-26-mass-discuss.md:214` -- locks 39=B verbatim
- `.planning/milestones/v1.8/REQUIREMENTS.md:41-46, 96-97` -- RUBRIC lane + cross-milestone defer-on-empty
- `.planning/ROADMAP-AGENT.md:427-438` -- Phase 39 acceptance contract
- `super-gsd/registry/gates.yaml:33-282` -- 13 gates the rubric must classify
- `super-gsd/scripts/lib/gate-value-log.cjs:64-92, 308-341, 585-599` -- OUTCOMES + summarize() (Phase 36 read API)
- `super-gsd/scripts/lib/review-ledger.cjs:208-232, 691-703` -- readReviewRows (Phase 34 read API)
- `super-gsd/scripts/lib/edge-guard.cjs:38, 95-117` -- RELATIVE_LOG + JSONL row shape
- `super-gsd/skills/sgsd-complete-milestone/SKILL.md:88-94, 104-143` -- Step 4 (edge-guard precedent) + Step 6 (SUMMARY)

### Secondary (HIGH confidence)
- `.planning/milestones/v1.8/phases/36-gate-value-telemetry/36-RESEARCH.md` -- 1:1 architectural template
- `.planning/milestones/v1.8/phases/38-risk-tiered-gate-sampling/38-RESEARCH.md` -- multi-file consumer + single-plan precedent
- `.planning/milestones/v1.7/phases/32-route-decision-ledger/32-01-route-ledger-PLAN.md` -- frozen-const + never-throw precedent
- `.planning/milestones/v1.7/phases/34-canonical-review-ledger/34-RESEARCH.md` -- defer-on-empty origin (empty_baseline contract)
- `super-gsd/tools/system-map/generate.cjs`, `super-gsd/tools/release-readiness/score.cjs` -- `tools/` tier precedent
- `super-gsd/tools/status-consistency/check.cjs` -- CLI-with-exit-code tools-tier precedent

### Tertiary
No LOW-confidence claims. All findings cross-verified against >=2
source-tier files.

## Metadata

Confidence breakdown:
- Lock 39=B + RUBRIC-01..04 + tool location + thresholds + insertion
  point + API surface + self-test scaffold + live-or-local fallback +
  single-plan recommendation: **HIGH** (verbatim or 1:1-precedent)
- Edge-guard halt override + review-ledger divergence handling:
  **MEDIUM** (derived from edge-guard `escalation: halt` and Phase 34
  ledger semantics; consistent with controlling principle but not
  explicitly mass-discussed)

Research date: 2026-04-27
Valid until: 2026-05-27 (30 days; v1.8 has no fast-moving deps)

Open questions: zero. All 11 derivation calls in Section 10 are LOCKED.

Plan-checker contract: planner MUST honor mechanical rule order R1-R6
+ edge-guard halt override (Section 1.2-1.3), defer-on-empty as the
FIRST rule (RUBRIC-03), tool location `super-gsd/tools/gate-keep-kill/
rubric.cjs` (Section 2), output schema and column order (Section 3),
SKILL.md Step 4.5 insertion + Step 6 SUMMARY.md extension (Section 4),
public API surface and frozen constants (Section 5), 14 self-test
assertions including the 4 RUBRIC-03-binding ones (Section 7), 3
in-phase consumers (Section 8), and Section 10 LOCKED Q1-Q11
derivation calls. Any deviation requires CONTEXT.md override with
explicit rationale.
