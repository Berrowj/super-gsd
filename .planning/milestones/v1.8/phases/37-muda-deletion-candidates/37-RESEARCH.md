---
phase: 37
name: MUDA Deletion Candidates
milestone: v1.8
status: research_complete
researched: 2026-04-27
confidence: HIGH
controlling_principle: "Autonomy continues; evidence tells the truth."
locked_decisions: [37=A]
---

# Phase 37: MUDA Deletion Candidates - Research

## Summary

Phase 37 lands `super-gsd/scripts/lib/muda-deletion-candidates.cjs` -- a
deletion-candidate finder + WASTE.md section renderer that runs as a
post-hook after `sgsd-muda-audit.sh` writes WASTE.md. Three heuristics
(low_value, recurring, skip_drift) emit candidate rows of shape
`{kind, target, evidence, risk, rollback}` per MUDA-03.

Architecture mirrors `super-gsd/scripts/lib/gate-value-log.cjs` (Phase 36)
and `super-gsd/scripts/lib/route-ledger.cjs` (Phase 32) 1:1: frozen const
enums, public API never throws upward, `__dirname`-anchored fingerprint
guard, defensive read, atomic file mutation. Phase 37 differs in ONE
respect: it does NOT emit envelope-v1 JSONL rows. Candidates are
computed-on-demand from existing logs and rendered into a markdown section
appended to WASTE.md. No new ledger; no schema bump.

Locked design (mass-discuss line 212, `37=A`): heuristic deletion candidates
ONLY -- no auto-disable. Each candidate is a suggestion the operator (or
Phase 39 rubric) may act on. Auto-removal is dangerous; review-at-close is
the safety contract.

**Primary recommendation:** Single plan, ~370-line lib + 1 sgsd-muda-audit.sh
post-hook (~25 lines) + 14-assertion self-test + local-fallback test.
Schema-without-consumer rule satisfied: sgsd-muda-audit.sh wire-in IS the
production caller. 2 created, 1 edited. Net ~+490 / -2.

## Architectural Responsibility Map

| Capability | Primary Tier | Rationale |
|-----------|--------------|-----------|
| Find low_value candidates | scripts/lib (cjs) | Reads gate-value-log.cjs::summarize |
| Find recurring candidates | scripts/lib (cjs) | Reads crit-backlog.cjs::unresolvedRows |
| Find skip_drift candidates | scripts/lib (cjs) | Reads gate-value-log.cjs::summarize |
| Render markdown section | scripts/lib (cjs) | Pure transform |
| Append to WASTE.md atomically | scripts/lib (cjs) | tmp + rename; idempotent |
| Wire post-WASTE.md write | sgsd-muda-audit.sh:~480 | Production caller |
| Phase 39 rubric read (DEFERRED) | rubric.cjs | Consumer in Phase 39 |
| Cockpit deletion-count (DEFERRED) | sgsd-mission-strip.ps1 | v2.0+ ops |

## User Constraints (from ROADMAP-AGENT.md + mass-discuss)

### Locked Decisions

- **37=A**: 3 heuristics (low_value, recurring, skip_drift); deletion
  candidates only; **no auto-disable** (mass-discuss:212).
- WASTE.md template gains `## Deletion Candidates` section (REQUIREMENTS.md:28).
- Each candidate row: `{kind, target, evidence, risk, rollback}` (REQUIREMENTS.md:30).
- Wire into `sgsd-muda-audit.sh` post-WASTE.md write (REQUIREMENTS.md:31).
- Public API never throws upward (route-ledger.cjs:42-51; gate-value-log.cjs:51-55).
- ASCII-only outputs (PS 5.1 mojibake guard).
- Live-or-local fallback (Patch 4).
- Defer if review surfaces false positives at >50% (REQUIREMENTS.md:79).

### Claude's Discretion

- Heuristic thresholds (locked Section 1.4; rationale documented).
- Risk classification per kind (locked Section 7).
- Default rollback string per kind (locked Section 8).
- Library API surface (locked Section 4).
- Self-test assertion count (target 14; mirrors Phase 36).

### Deferred Ideas (OUT OF SCOPE)

- Auto-disable of low-value gates (37=A explicit).
- Cross-milestone heuristic aggregation (Phase 39 rubric folds).
- Cockpit deletion-candidate count surface (Phase 38+).
- Auto-execution of rollback (operator-only).
- New JSONL ledger for candidate history (re-compute is cheap).
- Public-fallback corpus tags (v1.9 Phase 45).

## Phase Requirements

| ID | Description | Section |
|----|-------------|---------|
| MUDA-01 | WASTE.md gains `## Deletion Candidates` section | 1, 4 |
| MUDA-02 | 3 heuristics: low_value, recurring, skip_drift | 1, 5 |
| MUDA-03 | Each candidate row: kind, target, evidence, risk, rollback | 2 |
| MUDA-04 | Wired into `sgsd-muda-audit.sh` post-WASTE.md write | 3 |

---

## 1. Three Heuristics (definition + threshold + data source)

### 1.1 low_value

**Definition:** Gates with low Phase-36 `value_score` after sufficient
fires. A gate that fires >=5 times and produces more blocks than
0.5*warns + passes is value-negative.

**Threshold:** `value_score < 0.3` AND `fires >= 5`.

- `value_score` formula from `gate-value-log.cjs:329-332`:
  `max(0, (pass + 0.5*warn - block) / fires)`.
- `fires >= 5` floor avoids low-sample false positives.
- 0.3 threshold matches Phase 39 rubric `defer` cut (cf.
  `36-RESEARCH.md:534-538`): below 0.3 = candidate; 0.3-0.7 = defer;
  >=0.7 = keep. Phase 37 surfaces kill candidates; Phase 39 acts.

**Data source:** `gate-value-log.cjs::summarize(planningDir, opts)`
(`gate-value-log.cjs:308-341`). Returns one row per gate with
`{gate, fires, pass, warn, block, skip, total_observations, fire_rate,
value_score}`.

**Cold-start:** `summarize` returns `[]` on empty ledger
(`gate-value-log.cjs:283-284`). Heuristic returns `[]`. Defer-on-empty
preserved end-to-end.

### 1.2 recurring

**Definition:** CRIT-BACKLOG entries that recur across milestones with
the same `(kind, suspected_cause)` tuple. Cross-milestone recurrence is
the structural signal.

**Threshold:** Same `(kind, suspected_cause)` tuple appears in `>=2`
distinct milestones (unresolved, latest-row-per-id).

- `kind` is the closed enum from `crit-backlog.cjs:29`:
  `[per_dispatch_atc, phase_atc, verifier_fail, edge_guard_miss, cleared]`.
- `suspected_cause` is the v1 schema field (`crit-backlog.cjs:99`). Older
  rows have null; recurring heuristic uses **summary substring fallback**
  via `_normalizeSummary()` (lowercase, replace sha/milestone/phase
  tokens, slice to 80 chars).
- Distinct-milestone counter prevents same-milestone duplicates from
  triggering recurrence. 5 v1.6 verifier_fail rows for "live Codex auth
  unavailable" are NOT recurring; they need to also appear in v1.5 or v1.7.

**Data source:** `crit-backlog.cjs::unresolvedRows(planningDir)`
(`crit-backlog.cjs:126-133`). Returns latest row per id, filtered to
`kind != 'cleared'`. Phase 37 groups by `(kind, suspected_cause ||
normalizedSummary)`.

**Cold-start:** `unresolvedRows` returns `[]` -> heuristic returns `[]`.

### 1.3 skip_drift

**Definition:** Gates that fire SKIP more than 80% of the time. Low
utilization signals candidate for removal OR for amortization
(milestone-close only) per Phase 38 sampling-tier work.

**Threshold:** `skip / total_observations > 0.8` AND
`total_observations >= 5`. Equivalent: `fire_rate < 0.2`.

- `total_observations = fires + skip` (`gate-value-log.cjs:328`).
- `1 - fire_rate` computes skip ratio without extra reads.
- 0.8 is aggressive (4-of-5 skip); operator-tuneable via `opts.max_fire_rate`.
- `total_observations >= 5` floor mirrors low_value's `fires >= 5`.

**Data source:** Same `gate-value-log.cjs::summarize` as low_value. Phase
37 re-uses one read per heuristic (cheap; <100KB ledger at v1.8).

**Cold-start:** Empty summary -> `[]`.

### 1.4 Threshold summary (LOCKED)

| Heuristic | Threshold | Floor | Source |
|-----------|-----------|-------|--------|
| low_value | `value_score < 0.3` | `fires >= 5` | gate-value-log summary |
| recurring | `milestones.size >= 2` | (none) | crit-backlog unresolved |
| skip_drift | `fire_rate < 0.2` | `total_observations >= 5` | gate-value-log summary |

All thresholds operator-overridable via `opts`; defaults locked for v1.8 ship.

## 2. Candidate Row Schema (MUDA-03 Five Fields)

| Field | Type | Closed enum? | Purpose |
|-------|------|--------------|---------|
| `kind` | string | YES (3 values) | Heuristic that produced candidate |
| `target` | string | NO | Gate name OR backlog tuple OR resource name |
| `evidence` | `{kind, ref}[]` | NO | Citations supporting candidate |
| `risk` | string | YES (`low`, `medium`, `high`) | Risk of accepting candidate |
| `rollback` | string | NO | Free-text describing how to reverse |

**Frozen enums:**

```js
const CANDIDATE_KINDS = Object.freeze([
  'low_value_gate', 'recurring_backlog', 'skip_drift_gate',
]);
const RISK_LEVELS = Object.freeze(['low', 'medium', 'high']);
```

**`evidence` shape:** array of `{kind:string, ref:string}` -- mirrors
envelope-v1 evidence sub-shape (`command-envelope-v1.json:53-65`). Phase
37 does NOT embed envelope-v1 wrappers (candidates are not JSONL-emitted)
but reuses the inner shape so future Phase 39 consumers see a familiar
contract.

**`target` format:**
- low_value_gate: gate name (`"phase-level-ATC"`).
- recurring_backlog: `"<kind>: <suspected_cause>"` (e.g.
  `"verifier_fail: live Codex auth unavailable"`).
- skip_drift_gate: gate name.

**Validation:** `_normalize(candidate)` throws on closed-enum violation,
missing required field; coerces empty arrays to `[]`. Public API wraps
in try/catch (mirrors `gate-value-log.cjs:271-278`).

## 3. Wire-In Target in sgsd-muda-audit.sh (cite line ref)

Wire-in: `super-gsd/scripts/sgsd-muda-audit.sh` after the atomic WASTE.md
write at line 287, before the metrics log at line 481.

**Verbatim WASTE.md write site (`sgsd-muda-audit.sh:283-287`):**

```bash
# Atomic write: tmp + rename
mkdir -p "$PHASE_DIR"
tmp="$WASTE_FILE.tmp"
compose_waste_md > "$tmp"
mv "$tmp" "$WASTE_FILE"
```

**Insert location:** between qualitative-codex block (ends at line 479,
`rm -f "$TMP_CODEX_REPORT"`) and metrics log (line 481-500). Ordering ensures:

1. WASTE.md exists with the standard probe-results table.
2. Optional codex_qualitative_waste row appended (when fired).
3. THEN deletion-candidates section appended atomically.
4. Metrics log captures the final WASTE.md exit code unchanged.

**Wire-in shell snippet (~25 lines):** guarded `if [[ "$DRY_RUN" != "true"
&& -x "$NODE_BIN" && -f "$WASTE_FILE" ]]` block invokes
`"$NODE_BIN" -e` with require()+`appendToWasteFile($PROJECT/.planning,
$WASTE_FILE, { milestone: $MUDA_MILESTONE })`. Wraps node call in a stderr
warn-only catch; node exits 0 always (never block). Falls through to a
non-blocking shell-level `|| echo` warn if node is unavailable. Plan must
include this snippet verbatim.

**Why post-hook, not embed in compose_waste_md:**

1. compose_waste_md is a pure heredoc emitter. Adding node calls breaks
   the heredoc model.
2. Post-hook keeps Phase 37 reversible: future `--no-deletion-candidates`
   flag is a one-line skip.
3. compose_waste_md runs in `--dry-run` mode at line 274-281; post-hook
   shell guard `[[ "$DRY_RUN" != "true" ]]` honors the same flag.

**Idempotence:** `appendToWasteFile` MUST handle re-runs (section already
exists). Strategy: regex-locate `## Deletion Candidates` heading; replace
section through next `## ` heading or EOF; if absent, append. See
Section 4.3.

## 4. Library API Design (5+ exports)

```js
module.exports = {
  // Public APIs (6):
  findCandidates,            // (planningDir, opts?) -> Candidate[]
  findLowValueCandidates,    // (planningDir, opts?) -> Candidate[]
  findRecurringCandidates,   // (planningDir, opts?) -> Candidate[]
  findSkipDriftCandidates,   // (planningDir, opts?) -> Candidate[]
  renderMarkdown,            // (candidates, opts?) -> string
  appendToWasteFile,         // (planningDir, wasteFilePath, opts?) -> boolean

  // Frozen constants (4):
  CANDIDATE_KINDS, RISK_LEVELS, DEFAULT_THRESHOLDS, DEFAULT_ROLLBACKS,
};
```

### 4.1 findCandidates(planningDir, opts?)

Composite finder. Calls all three sub-finders; concatenates results.
Optional `opts.kinds = ['low_value_gate', ...]` selects subset. Wraps in
try/catch -> returns `[]` on error (mirrors `gate-value-log.cjs:271-278`).

### 4.2 renderMarkdown(candidates, opts?)

Pure transform (no I/O). Returns the `## Deletion Candidates` section as
a markdown string. Contract:

- ASCII-only; leading + trailing newline.
- 2-line operator preamble: "> Heuristic suggestions only. Phase 39
  rubric reviews these at milestone close." + "> Operator may dismiss
  any row. Auto-disable is NOT performed (locked 37=A)."
- Empty list -> `_No deletion candidates surfaced by current heuristics._`.
- Non-empty -> 5-column markdown table with header
  `| kind | target | risk | evidence | rollback |`. Evidence cell joins
  array entries as `kind=\`ref\`; ...`. Pipe characters escaped in all cells.
- Footer: `_Total: N candidate(s) across M heuristic(s)._`.

### 4.3 appendToWasteFile(planningDir, wasteFilePath, opts?)

Atomic mutation. Behavior:

1. If wasteFilePath missing -> return false.
2. Call `findCandidates(planningDir, opts)` -> candidates array.
3. Call `renderMarkdown(candidates, opts)` -> section string.
4. Read existing WASTE.md content.
5. If `## Deletion Candidates` heading present: replace section through
   next `## ` heading or EOF (section-replacement, idempotent re-run).
6. If absent: append section at EOF (with single-newline separator).
7. Atomic write: `fs.writeFileSync(tmp); fs.renameSync(tmp, wasteFilePath)`
   (mirrors sgsd-muda-audit.sh:283-287 pattern).
8. Wraps everything in try/catch -> return `true` on success, `false` on error.

Idempotence verified by self-test #14: two consecutive runs produce
byte-identical output.

### 4.4 Frozen constants

```js
const DEFAULT_THRESHOLDS = Object.freeze({
  low_value:  Object.freeze({ min_fires: 5, max_value_score: 0.3 }),
  recurring:  Object.freeze({ min_milestones: 2 }),
  skip_drift: Object.freeze({ min_observations: 5, max_fire_rate: 0.2 }),
});
const DEFAULT_ROLLBACKS = Object.freeze({
  low_value_gate:    'git revert <gate-removal-commit>; restore gates.yaml row',
  recurring_backlog: 'n/a (backlog row deletion is metadata-only)',
  skip_drift_gate:   'git revert; gates.shouldFire returns to default firing',
});
const DEFAULT_RISK_BY_KIND = Object.freeze({
  'low_value_gate':    'medium',
  'recurring_backlog': 'low',
  'skip_drift_gate':   'low',
});
```

## 5. Heuristic Implementation Outline

End-to-end data flow for one phase-close `sgsd-muda-audit.sh` invocation:

```
sgsd-muda-audit.sh <phase>
  +- runs sgsd-muda-probe.sh
  +- composes WASTE.md probe-table heredoc (line 226-272)
  +- atomic mv WASTE.md.tmp -> WASTE.md (line 287)
  +- (conditional) codex_qualitative_waste row (line 358-479)
  +- [PHASE 37 WIRE-IN] node muda-deletion-candidates.cjs::appendToWasteFile
       +- findCandidates(planningDir, opts)
            +- findLowValueCandidates: gate-value-log -> summarize -> filter
            +- findRecurringCandidates: crit-backlog -> group by tuple -> filter
            +- findSkipDriftCandidates: gate-value-log -> summarize -> filter
            +- concat -> Candidate[]
       +- renderMarkdown(candidates) -> '## Deletion Candidates\n...'
       +- read WASTE.md; locate-or-absent? -> replace or append section
       +- atomic tmp + rename
  +- log to metrics/muda-log.jsonl (line 482-500)
  +- exit $PROBE_EXIT (unchanged)
```

**Read order:** `summarize` is called twice (once per gate-value-derived
heuristic). Second call re-reads JSONL. Cost is microseconds; ledger is
small (<100KB at v1.8).

**Recurring heuristic walk:** `unresolvedRows` already de-dups by id.
Phase 37 groups by `(kind, suspected_cause || normalizedSummary)`.
Pre-v1.6 rows have `suspected_cause: null` (v1 schema field not
retroactively backfilled per `crit-backlog.cjs:74-82` partial-v1 guard);
fallback uses `_normalizeSummary(s)` which lowercases the summary,
replaces sha (`[0-9a-f]{6,40}` -> `<sha>`), milestone (`v\d+\.\d+` ->
`<ms>`), and phase (`phase\s*\d+` -> `<phase>`) tokens, collapses
whitespace, and slices to 80 chars. Stable across commits + milestones.

## 6. Schema-Without-Consumer Rule Satisfaction

| # | Consumer | When | What it consumes |
|---|----------|------|------------------|
| 1 | `sgsd-muda-audit.sh` post-hook | Every phase-close (live) | Calls `appendToWasteFile` |
| 2 | `--self-test` mode (lib CLI) | Manual / CI | Calls 6 public APIs against tmpdir fixtures |
| 3 | Phase 39 rubric (DEFERRED) | Milestone close | Reads candidate list for keep/kill table |
| 4 | Cockpit deletion-count (DEFERRED) | Mission Strip refresh | Counts candidates per WASTE.md |

Consumers #1 and #2 ship in Phase 37. #3 is Phase 39's responsibility
(RUBRIC-01 reads `gate-value-log + review-ledger + edge-guard-log`; Phase
39 plan should consider also reading deletion candidates). #4 is v2.0+
ops.

**No new ledger.** Computed-on-demand. Persisting candidate history
would require new retention policy + clearance contract; cost outweighs
benefit when re-computation is microseconds.

**Cold-start:** sgsd-muda-audit.sh wire-in: `findCandidates` returns
`[]`; `renderMarkdown([])` emits `_No deletion candidates surfaced..._`.
Phase 39 rubric: existing RUBRIC-03 defer-on-empty handles empty list
identically to empty value-log.

## 7. Risk Classification Rules

Static lookup from `DEFAULT_RISK_BY_KIND`. Risk reflects danger of
accepting the candidate.

### 7.1 low_value_gate -> medium

Removing a historically-blocking gate is medium risk:

1. The gate may have caught real defects future work could re-introduce.
   value_score < 0.3 is majority-block, but blocks can include legitimate
   hard-halts that prevented bad ships.
2. Re-adding a gate post-removal is more expensive than amortizing it
   (Phase 38 SAMPLE-03 sampling-tier work enables this).
3. Phase 39 rubric reviews kill recommendations at close; manual override
   is the safety contract (locked 39=B).

### 7.2 recurring_backlog -> low

Closing a recurring backlog row tuple is low risk:

1. Row is metadata-only; deletion does not change runtime behavior.
2. Recurrence has been observed and continued; closing the row class
   does not introduce new failure modes.
3. If underlying cause re-occurs, fresh row is appended (CRIT schema is
   append-only per `crit-backlog.cjs:9-11`).

### 7.3 skip_drift_gate -> low

Removing an almost-never-fires gate is low risk:

1. By definition the gate has had minimal influence (fire_rate < 0.2).
   Removing it changes near-nothing.
2. Phase 38 sampling-tier amortization is the recommended mitigation
   (move gate to milestone-close only); deletion is the strict alternative.
3. Re-adding an amortized gate at higher tier is cheap.

### 7.4 Static-not-dynamic

Risk fixed-per-kind in v1.8. Future v1.9+ could escalate based on
milestones-since-last-fire or downstream-blocker count; out of scope
for 37=A.

## 8. Rollback Text Per Kind (locked defaults)

| Kind | Default rollback |
|------|------------------|
| `low_value_gate` | `git revert <gate-removal-commit>; restore gates.yaml row` |
| `recurring_backlog` | `n/a (backlog row deletion is metadata-only)` |
| `skip_drift_gate` | `git revert; gates.shouldFire returns to default firing` |

**Why static-text not dynamic:**

1. Exact rollback command is unknowable at candidate-generation time
   (gate-removal commit hasn't been made yet). Text describes shape, not
   specific invocation.
2. Operator reading WASTE.md uses rollback as procedural hint, not
   copy-paste. Phase 33 `repair_command` 4-AND constraints don't apply
   because rollback is text-only descriptive (mirrors REPAIR-02
   `repair_instruction` mandatory-text).
3. Dynamic rollback (embedding actual commit shas) requires tracking
   gate-removal events; that's Phase 39 rubric territory, not Phase 37.

**Validation:** `_normalize` requires non-empty string. Empty rollback
raises in `_normalize`; public API try/catch returns `false` (mirrors
`gate-value-log.cjs:154-159`). Operator-overridable via `opts.rollbacks`.

## 9. --self-test Scaffold (14 assertions + fingerprint guard)

Mirrors `gate-value-log.cjs selfTest()` (14 assertions). Anchor to
`__dirname` not `process.cwd()` -- Phase 32 W3 lesson, locked.

Setup mirrors `gate-value-log.cjs:357-363`: capture mtimeMs of canonical
`.planning/metrics/gate-value-log.jsonl` AND
`.planning/metrics/crit-backlog.jsonl` BEFORE any work; create
`fs.mkdtempSync(os.tmpdir(), 'mdc-')` + `metrics/` subdir; do all
fixture writes in tmp; verify mtimes unchanged at end (fingerprint guard).

**14 Assertions:**

1. **CANDIDATE_KINDS frozen** -- `Object.isFrozen`, length 3, all 3 kinds.
2. **RISK_LEVELS frozen** -- `Object.isFrozen`, length 3, includes
   `low`, `medium`, `high`.
3. **DEFAULT_THRESHOLDS frozen at top + nested** -- `low_value.min_fires
   === 5`, `low_value.max_value_score === 0.3`, `skip_drift.max_fire_rate
   === 0.2`, `recurring.min_milestones === 2`.
4. **DEFAULT_ROLLBACKS frozen with 3 keys** -- non-empty string per
   CANDIDATE_KINDS entry.
5. **`findCandidates` empty-ledger returns `[]`** -- fresh tmpdir; no
   ledgers -> `[]`.
6. **low_value heuristic over fixture** -- write 6 gate-value rows for
   gate `g_lo` (1 pass + 5 block; fires=6, value_score = max(0, (1-5)/6)
   = 0). `findLowValueCandidates` returns one row with `target='g_lo'`,
   `kind='low_value_gate'`, `risk='medium'`.
7. **low_value floor `fires >= 5`** -- 4 rows for gate `g_few` (1 pass,
   3 block); below floor; returns `[]`.
8. **recurring heuristic across 2 milestones** -- 2 crit-backlog rows
   with `kind='verifier_fail'`, `suspected_cause='codex unavailable'`,
   milestones `'v1.5'` + `'v1.7'`. `findRecurringCandidates` returns 1
   row with `target='verifier_fail: codex unavailable'`, `risk='low'`,
   evidence includes `milestones=v1.5, v1.7`.
9. **recurring same-milestone NOT recurring** -- 5 crit-backlog rows
   all milestone `v1.6`, same tuple. Returns `[]`.
10. **recurring fallback to normalized summary when `suspected_cause`
    null** -- 2 rows with null suspected_cause, same summary substring,
    across 2 milestones; recurring fires correctly.
11. **skip_drift heuristic** -- 1 fire + 9 skips for gate `g_dr`
    (fire_rate = 0.1; total_obs = 10). Returns 1 row with
    `target='g_dr'`, `kind='skip_drift_gate'`, `risk='low'`.
12. **skip_drift floor `total_observations >= 5`** -- 1 fire + 1 skip
    (total_obs = 2); below floor; returns `[]`.
13. **renderMarkdown empty list** -- contains `_No deletion candidates
    surfaced`; with candidates contains `| kind | target | risk |
    evidence | rollback |` header.
14. **`appendToWasteFile` idempotent** -- write synthetic WASTE.md to
    tmpdir; call once -> section appears; call again -> file
    byte-identical. Then call with NEW candidates -> section REPLACED
    (row count differs).

**Bonus fingerprint guard:** canonical
`.planning/metrics/gate-value-log.jsonl` AND
`.planning/metrics/crit-backlog.jsonl` mtimes unchanged after self-test.

Order: constants first, sub-finders next, composer last. First-failure
stops; mirrors `gate-value-log.cjs:344-349` reporter.

## 10. Live-or-Local Fallback Design (Patch 4)

**Live:** the next phase-close `sgsd-muda-audit.sh` invocation triggers
the post-hook; reads gate-value-log + crit-backlog populated by the
running roadmap autopilot; appends `## Deletion Candidates` section to
WASTE.md. Production proof.

**Local:** `super-gsd/scripts/lib/muda-deletion-candidates.test.cjs`
(~80 lines) exercises the SAME `appendToWasteFile` + `findCandidates`
exported helpers that sgsd-muda-audit.sh calls, against fixtures. No
provider faking required (lib reads filesystem-only).

Test fixture coverage (4 cases):

1. **Cold start (empty ledgers)**: empty gate-value-log + empty
   crit-backlog; synthetic WASTE.md exists. `appendToWasteFile` returns
   `true`; resulting file contains `_No deletion candidates surfaced..._`.
2. **All three heuristics fire**: gate-value-log has 1 low_value gate
   (6 rows) + 1 skip_drift gate (1 fire + 9 skips); crit-backlog has 2
   v1.5/v1.7 rows with same tuple. Section table has 3 rows.
3. **Idempotent re-run**: call twice. Second call produces byte-identical
   file (passes self-test #14).
4. **Defer-on-empty mixed**: only crit-backlog has data; gate-value-log
   empty. `findCandidates` returns recurring candidates only.

**Provider-unavailable handling:** Phase 37 has zero external providers.
Lib reads filesystem-only. `provider_unavailable` is not a meaningful
failure mode. Live-or-local rule still applies because sgsd-muda-audit.sh
wire-in IS the production caller; local test calls SAME exported helper.

**Edge-guard:** structural emit is the WASTE.md mutation. Edge-guard
checks: (a) WASTE.md exists after sgsd-muda-audit exits; (b) WASTE.md
contains `## Deletion Candidates` heading. Both grep-checkable.

## 11. Open Derivation Calls + Locked Recommendations

All 15 calls below LOCKED in this RESEARCH (target: zero open into PLAN).

**Q1. New ledger or computed-on-demand?**
LOCKED: computed-on-demand. Re-computation is microseconds; persisted
history needs new retention policy. (Cf. Section 6.)

**Q2. low_value threshold?**
LOCKED: `value_score < 0.3` AND `fires >= 5`. 0.3 mirrors Phase 39
rubric defer cut. 5-fire floor avoids 1-block false positives.

**Q3. recurring threshold?**
LOCKED: `>= 2 distinct milestones`. Cross-milestone is the structural signal.

**Q4. skip_drift threshold?**
LOCKED: `fire_rate < 0.2` (skip > 80%) AND `total_observations >= 5`.
Operator-tuneable.

**Q5. recurring tuple key when `suspected_cause` is null?**
LOCKED: fallback to `_normalizeSummary(summary)` -- lowercase, replace
sha/milestone/phase tokens, slice to 80 chars.

**Q6. risk per kind?**
LOCKED: low_value_gate -> medium; recurring_backlog -> low;
skip_drift_gate -> low. Static lookup. (Cf. Section 7.)

**Q7. rollback per kind?**
LOCKED: 3 strings per `DEFAULT_ROLLBACKS`. Operator-overridable.
(Cf. Section 8.)

**Q8. CANDIDATE_KINDS closed enum or open string?**
LOCKED: closed enum of 3. `_normalize` throws on violation; public API
returns `false`. Mirrors `gate-value-log.cjs OUTCOMES`.

**Q9. Output format: JSONL or markdown only?**
LOCKED: markdown only (appended to WASTE.md). No JSONL for v1.8.
findCandidates returns JS objects in-memory; renderMarkdown serializes.
Phase 39 can require() and call findCandidates directly.

**Q10. Wire-in placement?**
LOCKED: post-hook at sgsd-muda-audit.sh:~480 (after qualitative-codex
block, before metrics log). compose_waste_md stays a pure heredoc
emitter. (Cf. Section 3.)

**Q11. dry-run respect?**
LOCKED: yes. Wire-in shell guard checks `$DRY_RUN`. dry-run skips the
node invocation entirely.

**Q12. Cockpit deletion-count surface in this PLAN?**
LOCKED: no. Phase 38+ concern. Phase 39 surfaces deletion candidates in
milestone-close summary, not live strip.

**Q13. New JSONL ledger for candidate history?**
LOCKED: no (same as Q1). Mass-discuss line 212 (37=A) is "deletion
candidates only, no auto-disable". Persisting history is auto-disable
adjacent.

**Q14. Lib location?**
LOCKED: `super-gsd/scripts/lib/muda-deletion-candidates.cjs`. Mirrors
gate-value-log + route-ledger placement.

**Q15. Test file location?**
LOCKED: `super-gsd/scripts/lib/muda-deletion-candidates.test.cjs`. Same
dir as lib.

## 12. Single Plan Recommendation

**One plan: `37-01-muda-deletion-candidates-PLAN.md`**

| Atomic commit | Files | Approx +/- |
|---------------|-------|------------|
| C1: lib + 14-assertion self-test (T1) | `super-gsd/scripts/lib/muda-deletion-candidates.cjs` | +370 / -0 |
| C2: sgsd-muda-audit.sh post-hook (T2) | `super-gsd/scripts/sgsd-muda-audit.sh` | +25 / -2 |
| C3: local-fallback test (T3) | `super-gsd/scripts/lib/muda-deletion-candidates.test.cjs` | +90 / -0 |

Total: 2 created, 1 edited. Net ~+490 / -2.

Why one plan: (a) C1 self-test must pass before C2 wire-in (C2 invokes
C1 via node -e); (b) C3 local-fallback exercises C1 + C2 in same code
path the orchestrator uses -- splitting C3 delays MUDA-04 evidence;
(c) Phase 32 + 34 + 36 all shipped lib + wire + test in single plan.

**Acceptance gate** (per ROADMAP-AGENT.md:405-407):

- `node super-gsd/scripts/lib/muda-deletion-candidates.cjs --self-test` exits 0.
- Running `sgsd-muda-audit.sh <phase>` on current repo state produces a
  `## Deletion Candidates` section in next WASTE.md.
- Each candidate row in rendered table has all 5 MUDA-03 fields.
- 14 self-test assertions PASS.
- Fingerprint guard: canonical gate-value-log + crit-backlog jsonl
  untouched by self-test.
- sgsd-muda-audit.sh `--dry-run` does NOT append section.

**Risk: LITE.** Diff <500 LOC; new file mirrors existing 1:1; one edited
file gains 25 lines of guarded shell. No new abstractions. Anti-slop:
every new function has a caller (6 public APIs called from self-test
AND from wire-in OR sub-finder); no dead imports; all 6 public APIs use
`opts`; re-uses existing `summarize()` + `unresolvedRows()`; 3
sub-finders + 1 composer = minimum to satisfy MUDA-02; no new ledger;
no JSON output; no auto-disable; ΔComplexity <= 0; ONE thing
(deletion-candidate WASTE.md section).

Per-dispatch ATC will fire; Codex review must pass. Phase-level ATC at
close must pass. Edge-guard: WASTE.md contains the section after
sgsd-muda-audit exits.

---

## Sources

### Primary (HIGH confidence)
- `super-gsd/scripts/lib/gate-value-log.cjs:64-599` -- 1:1 architectural
  template; closed-enum + frozen-const + summarize(), defer-on-empty
- `super-gsd/scripts/lib/route-ledger.cjs:42-444` -- secondary template;
  __dirname fingerprint guard, public-API never throws upward
- `super-gsd/scripts/lib/crit-backlog.cjs:29, 61-113, 126-149` --
  unresolvedRows API + v1 schema fields
- `super-gsd/scripts/lib/repair-command-checker.cjs:35-119` -- frozen
  enum precedent
- `super-gsd/scripts/sgsd-muda-audit.sh:226-272, 283-287, 358-479,
  481-500` -- compose_waste_md, atomic mv, qualitative-codex, metrics log
- `super-gsd/scripts/sgsd-muda-probe.sh:1-100` -- 5 probes shape
- `super-gsd/registry/command-envelope-v1.yaml:53-65` -- evidence
  sub-shape `{kind, ref}` reused
- `.planning/milestones/v1.8/REQUIREMENTS.md:26-31, 76-83` -- MUDA lane
  + Kill/Defer condition
- `.planning/milestones/v1.8/phases/36-gate-value-telemetry/36-RESEARCH.md:46-696` -- Phase 36 architectural template

### Secondary (HIGH confidence)
- `.planning/discussions/2026-04-26-mass-discuss.md:212` -- locked 37=A
- `.planning/ROADMAP-AGENT.md:396-407` -- Phase 37 acceptance contract
- `.planning/milestones/v1.8/phases/36-gate-value-telemetry/36-01-gate-value-telemetry-PLAN.md:1-200` -- single-plan + single-wire shape
- `.planning/metrics/crit-backlog.jsonl:1-26` -- live data shape
- `.planning/milestones/v1.4/phases/17-debt-sweep/WASTE.md:1-37` -- live
  WASTE.md template reference
- `.planning/milestones/v1.2/phases/10-gate-policy/WASTE.md:1-32` -- live
  WASTE.md template reference

### Tertiary
- No LOW-confidence claims. All findings cross-verified against >=2
  source-tier files.

## Metadata

Confidence breakdown:
- Heuristic definitions: HIGH -- 3 thresholds derived from Phase 36
  formulas + Phase 39 rubric defer cut
- Candidate row schema: HIGH -- MUDA-03 verbatim (5 fields)
- Wire-in target: HIGH -- file:line cited (sgsd-muda-audit.sh:283-287
  atomic mv, line 480 insertion point)
- Library API: HIGH -- mirrors gate-value-log.cjs module.exports 1:1
- Heuristic implementation: HIGH -- end-to-end data flow traced through
  existing libs
- Schema-without-consumer: HIGH -- 2 in-phase consumers + 2 deferred
- Risk classification: MEDIUM -- judgment locked Q6 with rationale
- Rollback text: MEDIUM -- judgment locked Q7; static-text contract
- Self-test scaffold: HIGH -- 14 assertions derived from gate-value-log.cjs:344-545
- Live-or-local fallback: HIGH -- Patch 4 verbatim; no provider deps

Research date: 2026-04-27
Valid until: 2026-05-27 (30 days; v1.8 has no fast-moving deps)

Open questions: zero. All 15 derivation calls in Section 11 are LOCKED.

Plan-checker contract: planner MUST honor 3-heuristic LOCKED thresholds
(Section 1.4), 5-field candidate row schema (Section 2), wire-in
location at sgsd-muda-audit.sh:~480 (Section 3), and Section 11 LOCKED
Q1-Q15 derivation calls. Any deviation requires CONTEXT.md override
with explicit rationale.
