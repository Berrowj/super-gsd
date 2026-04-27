---
schema_version: 2
phase: 39
plan: 01
title: Gate Keep/Kill Rubric
type: execute
wave: 1
milestone: v1.8
depends_on: [34, 36]
files_modified:
  - super-gsd/tools/gate-keep-kill/rubric.cjs
  - super-gsd/tools/gate-keep-kill/rubric.test.cjs
  - super-gsd/skills/sgsd-complete-milestone/SKILL.md
autonomous: true
locked_decisions: [39=B]
requirements: [RUBRIC-01, RUBRIC-02, RUBRIC-03, RUBRIC-04]
atc_tier: FULL
risk_tier: high
known_dead_ends:
  - Do NOT modify super-gsd/registry/command-envelope-v1.{yaml,json}
  - Do NOT modify scripts/lib/{route-ledger,review-ledger,gate-value-log,sampling-decider}.cjs
  - Do NOT introduce any new npm dependencies (node built-ins fs/path/os/crypto only)
  - Do NOT default-kill on empty data (RUBRIC-03 contract — gates with 0 fires MUST classify defer)
  - Do NOT bypass the edge-guard halt override (Section 1.3 lock — halt forces keep)
  - Do NOT mutate super-gsd/registry/gates.yaml (lock 39=B: rubric is read-only)
  - Do NOT toggle gate `state:` fields (operator-only after review)
  - Do NOT auto-execute kill recommendations (mass-discuss line 214 verbatim)
user_setup: []

t1_contract:
  hypothesis: >
    A pure-function mechanical rubric (R1-R6 first-match-wins + edge-guard halt override)
    over Phase 34 review-ledger + Phase 36 gate-value-log + edge-guard-log + gates.yaml
    classifies all 13 registered gates as keep|kill|defer with defer-on-empty as the
    structural correctness rule. Wired into sgsd-complete-milestone Step 4.5, the
    rubric produces an auditable markdown table that surfaces kill candidates to the
    operator without mutating any registry file.
  falsifier: >
    The rubric returns `kill` for any gate where gate-value-log fires === 0
    (RUBRIC-03 violation) OR mutates gates.yaml on any code path OR throws upward
    on missing/malformed source files OR fails to classify any of the 13 gates in
    super-gsd/registry/gates.yaml (RUBRIC-02 violation) OR the SKILL.md Step 4.5
    grep for `runRubric\(` returns 0 (RUBRIC-04 violation) OR the canonical 4
    fingerprint files are touched by --self-test (Phase 32 W3 lesson).
  stop_rule: >
    All 14 self-test assertions pass; the 6-fixture local-fallback test passes;
    grep for `runRubric` in SKILL.md returns >= 1; the canonical fingerprint
    (mtime+size of 4 files) is byte-stable across self-test invocations; net
    diff is +440 / -0 within ~5% tolerance; commit-reviews.jsonl shows PASS for
    all 3 atomic commits.
  minimal_test: >
    `node super-gsd/tools/gate-keep-kill/rubric.cjs --self-test` exits 0 AND
    `node super-gsd/tools/gate-keep-kill/rubric.test.cjs` exits 0 AND
    `grep -q 'runRubric' super-gsd/skills/sgsd-complete-milestone/SKILL.md` exits 0.

must_haves:
  truths:
    - "Rubric reads all 4 sources (gate-value-log, review-ledger, edge-guard-log, gates.yaml)"
    - "Every gate in gates.yaml gets a verdict in {keep, kill, defer}"
    - "Empty gate-value-log produces all-defer verdicts (NOT default-kill)"
    - "Edge-guard halt override forces verdict=keep regardless of value_score"
    - "SKILL.md Step 4.5 invokes runRubric and writes gate-keep-kill.md"
    - "rubric.cjs --self-test exits 0 with 14 pass assertions"
    - "Public API never throws upward on missing/malformed inputs"
    - "Canonical fingerprint files untouched by --self-test"
  artifacts:
    - path: "super-gsd/tools/gate-keep-kill/rubric.cjs"
      provides: "Mechanical rubric lib + CLI + 14-assertion self-test"
      exports: ["runRubric", "renderTable", "classifyGate", "KEEP_THRESHOLDS", "VERDICTS", "REASONS"]
      min_lines: 320
    - path: "super-gsd/tools/gate-keep-kill/rubric.test.cjs"
      provides: "Local-fallback test with 6 fixtures (R1-R6 + halt override)"
      min_lines: 100
    - path: "super-gsd/skills/sgsd-complete-milestone/SKILL.md"
      provides: "Step 4.5 wire-in (RUBRIC-04) + Step 6 SUMMARY embed"
      contains: "runRubric"
  key_links:
    - from: "super-gsd/tools/gate-keep-kill/rubric.cjs::runRubric"
      to: "super-gsd/scripts/lib/gate-value-log.cjs::summarize"
      via: "require() + summarize(planningDir, {milestone, gate})"
      pattern: "require.*gate-value-log"
    - from: "super-gsd/tools/gate-keep-kill/rubric.cjs::runRubric"
      to: "super-gsd/scripts/lib/review-ledger.cjs::readReviewRows"
      via: "require() + readReviewRows(planningDir)"
      pattern: "require.*review-ledger"
    - from: "super-gsd/tools/gate-keep-kill/rubric.cjs::runRubric"
      to: ".planning/metrics/edge-guard-log.jsonl"
      via: "fs.readFileSync + line-by-line JSON.parse (defensive)"
      pattern: "edge-guard-log\\.jsonl"
    - from: "super-gsd/tools/gate-keep-kill/rubric.cjs::runRubric"
      to: "super-gsd/registry/gates.yaml"
      via: "fs.readFileSync + manual minimal YAML parse for `- name:` rows"
      pattern: "gates\\.yaml"
    - from: "super-gsd/skills/sgsd-complete-milestone/SKILL.md::Step 4.5"
      to: "super-gsd/tools/gate-keep-kill/rubric.cjs"
      via: "require() in skill markdown JS-fenced block"
      pattern: "runRubric"
    - from: "super-gsd/skills/sgsd-complete-milestone/SKILL.md::Step 6"
      to: ".planning/milestones/{{version}}/gate-keep-kill.md"
      via: "writeFileSync rendered table embedded in SUMMARY.md"
      pattern: "Gate Keep/Kill Rubric"
---

<objective>
Phase 39 lands the mechanical keep/kill rubric — the v1.8 milestone-close
companion to Phase 36's gate-value-log telemetry and Phase 34's review-ledger.
For each of the 13 gates registered in `super-gsd/registry/gates.yaml`, the
rubric reads three canonical telemetry sources, applies a closed-enum
first-match-wins rule (R1-R6 + edge-guard halt override), and produces a
markdown recommendation table classifying every gate as `keep | kill | defer`.

Lock 39=B: the rubric ONLY recommends. The operator (via the
`sgsd-complete-milestone` SKILL.md Step 4.5 surfacing) decides whether to act
on `kill` rows. The script NEVER edits gates.yaml, NEVER toggles `state:`,
NEVER mutates registry rows. Auto-execute is mass-discussed-out as too
dangerous (mass-discuss line 214 verbatim).

The controlling correctness rule is RUBRIC-03 defer-on-empty: a gate with
zero fires in `gate-value-log.jsonl` MUST classify as `defer`, never `kill`.
At v1.8 close most gates will have zero rows (Phase 36 only wires 3 sites);
the rubric must produce mostly-defer output without inventing verdicts.
This mirrors v1.7's `review-ledger.cjs::killCheck empty_baseline` semantics.

Purpose: convert v1.8's gate-fitness telemetry into an auditable, mechanical
recommendation surface so future milestones can prune dead weight on
evidence rather than gut feel — without sacrificing the controlling
principle "Autonomy continues; evidence tells the truth."

Output: 1 NEW tool (~360 LOC), 1 NEW test (~120 LOC), 1 SKILL.md edit (~28
lines net). Net ~+440 / -0. Wave 1 (depends only on already-shipped 34, 36).

T1 verification (per t1_contract above): all assertions pass, fingerprint
guard holds, SKILL.md grep returns >= 1.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/ROADMAP.md
@.planning/milestones/v1.8/REQUIREMENTS.md
@.planning/milestones/v1.8/phases/39-gate-keep-kill/39-CONTEXT.md
@.planning/milestones/v1.8/phases/39-gate-keep-kill/39-RESEARCH.md
@super-gsd/registry/gates.yaml
@super-gsd/scripts/lib/gate-value-log.cjs
@super-gsd/scripts/lib/review-ledger.cjs
@super-gsd/skills/sgsd-complete-milestone/SKILL.md

<interfaces>
<!-- Extracted from Phase 34/36 lib files. Executor consumes these directly. -->
<!-- All public APIs are NEVER-throw-upward (try/catch wraps; on error returns falsey). -->

From super-gsd/scripts/lib/gate-value-log.cjs:
```javascript
// summarize(planningDir, opts) -> Array<{
//   gate, fires, pass, warn, block, skip,
//   total_observations, fire_rate, value_score
// }>
//   value_score = max(0, (pass + 0.5*warn - block) / fires) when fires > 0,
//                 else null  (defer-on-empty source for Phase 39 RUBRIC-03)
//   opts: { milestone?, gate? }
//   Result is sorted by fires DESC. Gates absent from log are absent from result.
module.exports.summarize;

// readGateValueRows(planningDir, opts) -> Array<envelope-v1 row + {gate, outcome, retroactive}>
//   opts: { gate?, outcome?, milestone? }
module.exports.readGateValueRows;

// OUTCOMES = Object.freeze(['pass', 'warn', 'block', 'skip'])  (closed enum)
module.exports.OUTCOMES;
```

From super-gsd/scripts/lib/review-ledger.cjs:
```javascript
// readReviewRows(planningDir, opts) -> Array<envelope-v1 row + {_legacy, _source_phase, _source_milestone}>
//   opts: { milestone?, phase? }
//   Each row preserves the legacy commit-reviews payload under row._legacy.
//   Legacy fields: { verdict, plan, tier, provider, critical, warning, pass_rate, ... }
//   row._legacy.gate is NOT a guaranteed field; gate identity must be
//   recovered from row.phase / row._legacy.tier when filtering by gate.
module.exports.readReviewRows;

// LEGACY_VERDICT_MAP -> envelope-v1 status mapping (frozen)
//   pass -> ok, warn -> warn, critical -> fail, critical-halt -> blocked,
//   block -> blocked, skipped -> skipped
module.exports.LEGACY_VERDICT_MAP;
```

Edge-guard-log row shape (read locally; no helper exists per RESEARCH §1.1):
```javascript
// .planning/metrics/edge-guard-log.jsonl rows (one JSON per line):
// {
//   ts:         ISO-8601,
//   gate:       string,           // matches gates.yaml row name
//   resolution: 'log-only' | 'halt',
//   ...other fields, ignored by rubric
// }
// File may not exist (no edge-guard violations fired ever); defensive read returns [].
```

gates.yaml row shape (consumed by rubric for the 13-gate list):
```yaml
gates:
  - name: per-dispatch-ATC          # required; the rubric key
    category: code-quality          # informational only
    enforcement_mode: hard-halt     # informational only
    state: active                   # rubric reads but does NOT modify
    # ... other fields ignored by rubric
```

The 13 gate names (verified against super-gsd/registry/gates.yaml):
  per-dispatch-ATC, phase-level-ATC, classifier-haiku, context-selector-haiku,
  sgsd-recall-queries, intent-injection, MUDA-waste-audit, qualitative-waste-audit,
  sgsd-curate-learnings, token-log, vtp-enrichment, verifier-row-arithmetic,
  verifier-detail-vs-summary
</interfaces>

<rubric_rule_locked>
<!-- From 39-RESEARCH.md §1.2 (LOCKED Q3+Q4). First-match-wins. DO NOT REORDER. -->

INPUT:  fires (int >= 0), value_score (float in [0,1] | null), edgeRows (array)

PRE-RULE (override on top of R1-R6, RESEARCH §1.3):
  If edgeRows contains >= 1 row with resolution === 'halt' AND ts within
  milestone window:
    -> verdict = 'keep'; reason = 'structural_emit_required'
    Return immediately. Override all of R1-R6.

R1. fires === 0
    -> defer; reason = 'no_fires_yet'                              [RUBRIC-03 primary]
R2. value_score === null
    -> defer; reason = 'value_score_indeterminate'
R3. fires < min_fires_for_kill (10) AND value_score < kill_value_score (0.2)
    -> defer; reason = 'insufficient_evidence_for_kill'            [RUBRIC-03 secondary]
R4. value_score >= keep_value_score (0.5) AND fires >= min_fires_for_keep (5)
    -> keep;  reason = 'value_score_above_threshold'
R5. value_score < kill_value_score (0.2) AND fires >= min_fires_for_kill (10)
    -> kill;  reason = 'value_score_below_threshold_with_evidence'
R6. (fallthrough)
    -> defer; reason = 'mid_value_score_or_low_fires'

Frozen thresholds (RESEARCH §1.2):
  KEEP_THRESHOLDS = Object.freeze({
    keep_value_score:   0.5,
    kill_value_score:   0.2,
    min_fires_for_keep: 5,
    min_fires_for_kill: 10,
  });

Frozen verdicts (RESEARCH §1.2 + §3.2):
  VERDICTS = Object.freeze(['keep', 'kill', 'defer']);

Frozen reasons (RESEARCH §3.2 — exactly 7 keys, all values are literal strings):
  REASONS = Object.freeze({
    no_fires_yet:                              'no_fires_yet',
    value_score_indeterminate:                 'value_score_indeterminate',
    insufficient_evidence_for_kill:            'insufficient_evidence_for_kill',
    value_score_above_threshold:               'value_score_above_threshold',
    value_score_below_threshold_with_evidence: 'value_score_below_threshold_with_evidence',
    mid_value_score_or_low_fires:              'mid_value_score_or_low_fires',
    structural_emit_required:                  'structural_emit_required',
  });

Asymmetry rationale (RESEARCH §1.2):
  Kill bar (10 fires) > Keep bar (5 fires) because killing is destructive;
  insufficient evidence defaults to defer, never default-kill. 5-fire keep
  bar matches review-ledger killCheck flip-point.

Review-ledger consistency cross-check (RESEARCH §1.4 — notes-only, NOT verdict-changing):
  pass_rate = ok / (ok + warn + fail + blocked) over rows where the
              gate identity matches (best-effort match via row.phase or
              row._legacy.tier).
  - |pass_rate - value_score| >= 0.3 AND >= 5 rows in BOTH logs
      -> notes += 'review_ledger_divergence'
  - 0 review-ledger rows AND >= 5 gate-value-log fires
      -> notes += 'review_ledger_uncovered'
  Verdict NEVER changes from notes; notes are operator-judgment hints.
</rubric_rule_locked>

<schema_locked>
<!-- From 39-RESEARCH.md §3.1, §3.3 — output row shape + column order. -->

RubricRow:
  gate:        string                       // verbatim from gates.yaml row name
  verdict:     'keep' | 'kill' | 'defer'    // VERDICTS enum
  fires:       number                       // gate-value-log fires count
  value_score: number | null                // null when fires === 0
  pass_rate:   number | null                // review-ledger pass rate, null when uncovered
  reason:      string                       // REASONS enum value
  notes:       string[]                     // soft warnings (may be empty)

renderTable column order (RESEARCH §3.3, frozen):
  | gate | verdict | fires | value_score | pass_rate | reason | notes |

Render rules:
  verdict: **bold** for kill, plain for keep, *italic* for defer
  value_score: 2-decimal-place when non-null, literal "--" when null
  pass_rate:   same rule
  reason:      literal REASONS value (no prose translation)
  notes:       joined with "; " separator, or "--" when empty
</schema_locked>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Create rubric.cjs lib + CLI + 14-assertion self-test</name>
  <files>super-gsd/tools/gate-keep-kill/rubric.cjs</files>
  <behavior>
    All assertions tested in --self-test (RESEARCH §7):
    - 1: VERDICTS frozen, length 3, equals ['keep','kill','defer']
    - 2: KEEP_THRESHOLDS frozen, exactly 4 keys, values match RESEARCH §1.2
    - 3: REASONS frozen, exactly 7 keys, values match RESEARCH §3.2
    - 4: classifyGate('g1', null, [], []) -> {verdict:'defer', reason:'no_fires_yet'} [RUBRIC-03]
    - 5: classifyGate('g2', {fires:5, value_score:0.8}, [], []) -> keep + value_score_above_threshold (R4)
    - 6: classifyGate('g3', {fires:10, value_score:0.1}, [], []) -> kill + value_score_below_threshold_with_evidence (R5)
    - 7: classifyGate('g4', {fires:7, value_score:0.1}, [], []) -> defer + insufficient_evidence_for_kill [RUBRIC-03 secondary]
    - 8: classifyGate('g5', {fires:4, value_score:0.7}, [], []) -> defer + mid_value_score_or_low_fires (R6)
    - 9: classifyGate('g6', {fires:5, value_score:null}, [], []) -> defer + value_score_indeterminate (R2)
    - 10: edge-guard halt override on low-value gate -> keep + structural_emit_required (RESEARCH §1.3)
    - 11: runRubric over a 3-gate fixture -> 3 rows with valid verdict + reason (integration)
    - 12: renderTable on a 13-gate fixture -> 13 rows + header per RESEARCH §3.3
    - 13: malformed line in gate-value-log.jsonl skipped; surrounding rows used (defensive read)
    - 14: mtime+size of 4 canonical fingerprint files unchanged after self-test (RESEARCH §7 / Phase 36 W2)

    Public API never throws upward:
    - runRubric(planningDir, opts) catches any internal error, console.warns, returns []
    - renderTable(rows) catches errors, returns "(rubric render error)" string
    - classifyGate(...) is pure but wrapped at the runRubric call site

    Defer-on-empty acceptance (RUBRIC-03):
    - Empty gate-value-log -> ALL gates verdict=defer with reason=no_fires_yet
    - Missing edge-guard-log file -> treated as zero rows, no override fires
    - Missing review-ledger -> pass_rate=null, notes may include review_ledger_uncovered
  </behavior>
  <action>
    Create the file at `super-gsd/tools/gate-keep-kill/rubric.cjs` (NEW, ~360 LOC).
    Mirror Phase 36 (gate-value-log.cjs) and Phase 38 architecturally 1:1 per RESEARCH §9.
    Implements RUBRIC-01 (reads 4 sources), RUBRIC-02 (classifies all 13 gates),
    and the rubric-side of RUBRIC-03 (defer-on-empty as the FIRST rule).

    File layout (single-file, no split per RESEARCH §2.3 Q2 lock):

    1. HEADER COMMENT BLOCK (~50 lines)
       - Cite "Source: 39-RESEARCH.md §10 (LOCKED Q1-Q11)"
       - State the failure contract verbatim from gate-value-log.cjs:51-55:
         "this script NEVER throws upward at the orchestrator boundary"
       - State RUBRIC-03 verbatim: "gates with 0 fires MUST classify as defer, NEVER kill"
       - State lock 39=B verbatim: "Mechanical rubric + manual override at close"
       - Enumerate RUBRIC-01..04 acceptance bindings
       - State the 4-canonical fingerprint guard list

    2. REQUIRES (node built-ins only — RESEARCH §11 lock):
         const fs   = require('fs');
         const path = require('path');
         const os   = require('os');
       (no js-yaml, no glob, no other deps; manual minimal YAML parse for gates.yaml)

    3. FROZEN CONSTANTS (~25 lines, RESEARCH §1.2 + §3.2 verbatim):
         const VERDICTS         = Object.freeze(['keep', 'kill', 'defer']);
         const KEEP_THRESHOLDS  = Object.freeze({ keep_value_score: 0.5,
                                                   kill_value_score: 0.2,
                                                   min_fires_for_keep: 5,
                                                   min_fires_for_kill: 10 });
         const REASONS          = Object.freeze({ ... 7 keys per RESEARCH §3.2 ... });

    4. PRIVATE HELPERS (~80 lines):
       a. _readEdgeGuardRows(planningDir, gateName, milestoneStartIso)
          - Reads .planning/metrics/edge-guard-log.jsonl line-by-line
          - Returns []  when file absent (defensive — RESEARCH §11.1: "may not exist")
          - JSON.parse each line in try/catch (skip malformed)
          - Filters to rows where row.gate === gateName
          - Optional second filter: row.ts >= milestoneStartIso (when provided)
       b. _parseGatesYaml(yamlText)
          - Manual minimal parse: walk lines, regex-match `^\s*-\s+name:\s*(\S+)`
          - Returns array of { name } objects in document order
          - Defensive: returns [] on read or parse failure
          - DO NOT add js-yaml dep (RESEARCH §11 zero-deps lock)
       c. _readGatesYaml(gatesYamlPath)
          - try/catch fs.readFileSync; calls _parseGatesYaml; returns name array
          - Default path resolution via __dirname-anchored:
              path.resolve(__dirname, '..', '..', 'registry', 'gates.yaml')
            (lib at <repo>/super-gsd/tools/gate-keep-kill/rubric.cjs;
             registry at <repo>/super-gsd/registry/gates.yaml — 2 dirs up + registry)
       d. _filterReviewRowsForGate(rows, gateName)
          - Best-effort match: row.phase contains gate's expected phase identifier
            OR row._legacy.tier contains a per-gate marker. RESEARCH §1.4 says this
            is informational only (notes), so an imperfect match is acceptable.
          - For first delivery, match on row._legacy.gate when present, else
            empty array (note: review_ledger_uncovered will fire often at v1.8).

    5. PUBLIC FUNCTION classifyGate(gateName, summary, reviewRows, edgeRows) (~50 lines):
       - PURE function (RESEARCH §5.1 Q10 lock); no I/O; no console; deterministic.
       - PRE-RULE: scan edgeRows for resolution === 'halt' (any row matching gate)
           -> return { verdict:'keep', reason:REASONS.structural_emit_required, ...}
       - R1: if !summary OR summary.fires === 0
           -> return { verdict:'defer', reason:REASONS.no_fires_yet, fires:0, value_score:null, pass_rate:null, notes:[] }
       - R2: if summary.value_score === null
           -> return { verdict:'defer', reason:REASONS.value_score_indeterminate, ... }
       - R3: if fires < min_fires_for_kill AND value_score < kill_value_score
           -> return { verdict:'defer', reason:REASONS.insufficient_evidence_for_kill, ... }
       - R4: if value_score >= keep_value_score AND fires >= min_fires_for_keep
           -> return { verdict:'keep', reason:REASONS.value_score_above_threshold, ... }
       - R5: if value_score < kill_value_score AND fires >= min_fires_for_kill
           -> return { verdict:'kill', reason:REASONS.value_score_below_threshold_with_evidence, ... }
       - R6: fallthrough
           -> return { verdict:'defer', reason:REASONS.mid_value_score_or_low_fires, ... }
       - Compute pass_rate and notes per RESEARCH §1.4 cross-check (notes-only).
       - Return shape strictly matches RubricRow (RESEARCH §3.1) — gate, verdict,
         fires, value_score, pass_rate, reason, notes.

    6. PUBLIC FUNCTION runRubric(planningDir, opts) (~70 lines):
       - opts: { milestone?, gatesYamlPath? } (RESEARCH §5.1)
       - Wrap entire body in try/catch returning [] on error (never throws upward).
       - Step 1: const gateNames = _readGatesYaml(opts.gatesYamlPath || default);
           if gateNames.length === 0 -> return [].
       - Step 2: require Phase 36 lib:
           const { summarize } = require(path.resolve(__dirname,
             '..', '..', 'scripts', 'lib', 'gate-value-log.cjs'));
         require Phase 34 lib:
           const { readReviewRows } = require(path.resolve(__dirname,
             '..', '..', 'scripts', 'lib', 'review-ledger.cjs'));
       - Step 3: pull all summaries once:
           const allSummaries = summarize(planningDir,
             opts.milestone ? { milestone: opts.milestone } : {});
           const summaryByGate = new Map(allSummaries.map(s => [s.gate, s]));
       - Step 4: pull all review rows once (filter per gate locally):
           const allReviewRows = readReviewRows(planningDir,
             opts.milestone ? { milestone: opts.milestone } : {});
       - Step 5: resolve milestone-start for edge-guard window. If opts.milestone
         provided and a STATE.md milestone start ts is reachable, use it; else
         pass null and treat all edge-guard rows as in-window (defensive permissive).
       - Step 6: for each gateName in gateNames, build RubricRow:
           const summary    = summaryByGate.get(gateName) || null;
           const reviewRows = _filterReviewRowsForGate(allReviewRows, gateName);
           const edgeRows   = _readEdgeGuardRows(planningDir, gateName, milestoneStart);
           const row        = classifyGate(gateName, summary, reviewRows, edgeRows);
       - Step 7: return rows array (one per gateName, in gates.yaml document order).
       - On any internal exception: console.warn('[SGSD] rubric runRubric failed:', e.message); return [].

    7. PUBLIC FUNCTION renderTable(rows) (~40 lines):
       - Wrap in try/catch returning '(rubric render error)' on failure.
       - Header line per RESEARCH §3.3:
           `| gate | verdict | fires | value_score | pass_rate | reason | notes |`
       - Separator line: `|------|---------|-------|-------------|-----------|--------|-------|`
       - For each row:
           verdict_cell = row.verdict === 'kill'  ? `**${row.verdict}**`
                        : row.verdict === 'defer' ? `*${row.verdict}*`
                        : row.verdict;            // plain for keep
           fires_cell   = String(row.fires);
           value_cell   = row.value_score === null ? '--' : row.value_score.toFixed(2);
           pass_cell    = row.pass_rate   === null ? '--' : row.pass_rate.toFixed(2);
           notes_cell   = row.notes && row.notes.length ? row.notes.join('; ') : '--';
       - Return joined string (header + separator + N rows, '\n' joined; trailing newline).

    8. SELF-TEST (~120 lines, RESEARCH §7):
       - Mirror gate-value-log.cjs:344-545 layout exactly.
       - Capture canonical fingerprints BEFORE any work, anchored to __dirname:
           const repoRoot = path.resolve(__dirname, '..', '..', '..');
           const canonicals = [
             path.join(repoRoot, '.planning', 'metrics', 'gate-value-log.jsonl'),
             path.join(repoRoot, '.planning', 'metrics', 'review-ledger.jsonl'),
             path.join(repoRoot, '.planning', 'metrics', 'edge-guard-log.jsonl'),
             path.join(repoRoot, 'super-gsd', 'registry', 'gates.yaml'),
           ];
           const before = canonicals.map(p => fs.existsSync(p)
             ? { exists: true, mtime: fs.statSync(p).mtimeMs, size: fs.statSync(p).size }
             : { exists: false, mtime: 0, size: 0 });
       - Use fs.mkdtempSync(path.join(os.tmpdir(), 'rubric-')) for fixtures.
       - 14 assertions in order (matching <behavior> block above; do NOT renumber):
         #1 shape: VERDICTS frozen + length 3 + ['keep','kill','defer']
         #2 shape: KEEP_THRESHOLDS frozen + 4 keys + values RESEARCH §1.2
         #3 shape: REASONS frozen + 7 keys + values RESEARCH §3.2
         #4 RUBRIC-03 primary: classifyGate('g','null',[],[]) -> defer + no_fires_yet
         #5 R4: classifyGate(...) high-fires high-value -> keep
         #6 R5: classifyGate(...) high-fires low-value -> kill
         #7 RUBRIC-03 secondary: classifyGate(...) mid-fires low-value -> defer + insufficient_evidence_for_kill
         #8 R6: classifyGate(...) low-fires mid-value -> defer + mid_value_score_or_low_fires
         #9 R2: classifyGate with value_score === null -> defer + value_score_indeterminate
         #10 halt override: edgeRows with resolution='halt' on low-value gate -> keep + structural_emit_required
         #11 runRubric integration over 3-gate tmp fixture -> 3 rows valid shape
         #12 renderTable over 13-row fixture -> 13 rows + header per RESEARCH §3.3
         #13 defensive read: malformed line in tmp gate-value-log skipped, surrounding rows used
         #14 fingerprint guard: 4 canonicals untouched (compare before/after)
       - Test layout for #11/#12: write a tiny gates.yaml under tmp/registry/ and
         invoke runRubric(planningDir, { gatesYamlPath: tmpYamlPath }). The real
         super-gsd/registry/gates.yaml is NEVER read during self-test.
       - Tally pass/fail; on fail print failures with name + detail; return 1.
       - On success print `gate-keep-kill rubric self-test: 14 pass, 0 fail` and return 0.
       - Wrap fs.rmSync(tmp, { recursive: true, force: true }) in finally.

    9. CLI MAIN (~30 lines):
       - if cmd === '--self-test'  -> process.exit(selfTest());
       - if cmd === '--render' -> resolve planningDir from --planning-dir or
           __dirname-anchored .planning fallback (Phase 36 W2 lesson;
           NEVER process.cwd() default — silent wrong-ledger trap);
           parse optional --milestone <id>;
           const rows = runRubric(planningDir, opts);
           console.log(renderTable(rows));
           process.exit(0);
       - if cmd === '--json'  -> same as --render but console.log(JSON.stringify(rows, null, 2));
       - else print Usage block listing 3 commands + module.exports surface.

    10. MODULE.EXPORTS (RESEARCH §5):
        module.exports = {
          runRubric, renderTable, classifyGate,    // 3 public functions
          KEEP_THRESHOLDS, VERDICTS, REASONS,      // 3 frozen constants
        };

    NEVER-DO list (binding):
    - DO NOT throw upward from any module.exports surface (try/catch every public).
    - DO NOT default-kill on empty (RUBRIC-03 — assertion #4 is the binding test).
    - DO NOT skip edge-guard halt override (RESEARCH §1.3 — assertion #10 is the binding test).
    - DO NOT read process.cwd() for default planningDir at CLI (Phase 36 W2 lesson).
    - DO NOT mutate gates.yaml under any code path (lock 39=B).
    - DO NOT add an npm dep (zero-deps lock; manual YAML parse, manual envelope shape).
    - DO NOT touch the canonical 4 files during --self-test (assertion #14 is the binding test).

    ATC reminder (FULL tier): pure functions only at the rule core; closed-enum
    discipline; no `any` types in JSDoc; defensive read everywhere; NEVER refactor
    the R1-R6 ordering — first-match-wins is a structural-correctness lock per
    RESEARCH §10 Q4.
  </action>
  <verify>
    <automated>node super-gsd/tools/gate-keep-kill/rubric.cjs --self-test</automated>
  </verify>
  <done>
    - File exists at super-gsd/tools/gate-keep-kill/rubric.cjs
    - --self-test exits 0 reporting "14 pass, 0 fail"
    - module.exports surface = { runRubric, renderTable, classifyGate, KEEP_THRESHOLDS, VERDICTS, REASONS }
    - VERDICTS / KEEP_THRESHOLDS / REASONS all Object.freeze (assertions #1-#3 PASS)
    - Empty gate-value-log produces all-defer output (assertion #4 PASS — RUBRIC-03)
    - Edge-guard halt override forces keep regardless of value_score (assertion #10 PASS)
    - Canonical fingerprint files (4 files) untouched by --self-test (assertion #14 PASS)
    - File size between 320 and 420 lines (~360 target per CONTEXT.md)
    - No new dependencies added (package.json unchanged)
    - Atomic commit: `feat(39-01): rubric.cjs lib + 14-assertion self-test`
  </done>
</task>

<task type="auto" tdd="false">
  <name>Task 2: Wire runRubric into sgsd-complete-milestone Step 4.5 + Step 6 SUMMARY embed</name>
  <files>super-gsd/skills/sgsd-complete-milestone/SKILL.md</files>
  <action>
    EDIT `super-gsd/skills/sgsd-complete-milestone/SKILL.md` to add the rubric
    invocation as new Step 4.5 (between existing Step 4 gate-drift and Step 5
    cross-phase-integration) AND extend Step 6 SUMMARY with a rubric-table
    embed. This satisfies RUBRIC-04 (the production caller of runRubric).

    Insertion #1 (Step 4.5 block, NEW, between line 94 and line 96):

    Locate the closing tag `</step_4_gate_drift>` (currently at line 94 of
    SKILL.md). Insert immediately after that closing tag, before the
    `<step_5_cross_phase_check>` opening tag (currently line 96), the
    following block verbatim (~22 lines):

    ```
    <step_4_5_gate_keep_kill_rubric>
    ## Step 4.5: Gate Keep/Kill Rubric (Phase 39 — RUBRIC-01..04)

    Run the mechanical rubric over the milestone's gate telemetry. The
    rubric reads `.planning/metrics/gate-value-log.jsonl` (Phase 36),
    `.planning/metrics/review-ledger.jsonl` (Phase 34),
    `.planning/metrics/edge-guard-log.jsonl` (defensive: may be absent),
    and `super-gsd/registry/gates.yaml` (read-only).

    ```javascript
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
    ```

    Per lock 39=B: this step ONLY produces the recommendation table. The
    operator (or future automation explicitly added in v1.9+) decides
    whether to act on `kill` rows. The script does NOT mutate
    `super-gsd/registry/gates.yaml` or any registry file.

    Defer-on-empty (RUBRIC-03): gates with zero fires in
    `gate-value-log.jsonl` MUST classify as `defer`, not `kill`. The first
    v1.8 close will produce a table where most gates are `defer` with reason
    `no_fires_yet` — correct cold-start state.
    </step_4_5_gate_keep_kill_rubric>

    ```

    NOTE: the inner JS-fenced block uses standard ` ``` ` markers; the outer
    block uses XML-tag-like step markers consistent with the rest of SKILL.md.
    Preserve the exact indentation pattern of surrounding `<step_*>` blocks.

    Insertion #2 (Step 6 SUMMARY extension, append within `<step_6_summary>`):

    Locate the existing `<step_6_summary>` block (currently lines 103-143).
    Inside that block, after the existing `## Unresolved Repairs` template
    (after the line `If the helper returns an empty array, write the
    literal line: ...` around line 137-138), and BEFORE the closing
    `</step_6_summary>` tag (line 143), append the following ~6-line
    subsection template verbatim:

    ```
    ### Gate Keep/Kill Rubric subsection (Phase 39 — RUBRIC-04)

    Append to SUMMARY.md a new subsection AFTER `## Unresolved Repairs` and
    BEFORE the existing `## Connections` section. Source: read the file
    `.planning/milestones/{{version}}/gate-keep-kill.md` produced by Step 4.5;
    embed its contents inline:

    ```markdown
    ## Gate Keep/Kill Rubric (milestone {{version}})

    > Mechanical recommendation. Operator judgment for any `kill` row.

    {{contents of .planning/milestones/{{version}}/gate-keep-kill.md}}
    ```

    If `.planning/milestones/{{version}}/gate-keep-kill.md` does not exist
    (Step 4.5 failed), write the literal line:
    `(rubric output unavailable — see provider_unavailable log)`.
    ```

    The combined edit MUST preserve all existing SKILL.md content verbatim
    EXCEPT for the two insertion points above. No deletions. No
    reformatting of existing lines. Net diff target: +28 / -0.

    Acceptance verification embedded:
    - `grep -q 'runRubric' super-gsd/skills/sgsd-complete-milestone/SKILL.md`
      MUST return 0 (RUBRIC-04 binding).
    - `grep -c '<step_4_5_gate_keep_kill_rubric>' super-gsd/skills/sgsd-complete-milestone/SKILL.md`
      MUST return 1.
    - `grep -c 'Gate Keep/Kill Rubric' super-gsd/skills/sgsd-complete-milestone/SKILL.md`
      MUST return >= 2 (Step 4.5 heading + Step 6 SUMMARY heading).

    Commit message: `feat(39-01): wire runRubric into sgsd-complete-milestone Step 4.5 + SUMMARY embed`

    NEVER-DO list (binding):
    - DO NOT modify the existing `<step_4_gate_drift>` or `<step_5_cross_phase_check>` blocks.
    - DO NOT change Step 6 frontmatter or the existing Unresolved Repairs template.
    - DO NOT change the SKILL.md frontmatter (allowed-tools list stays as-is;
      no new tool is required — `Read` and `Write` already cover the new step).
    - DO NOT add a new top-level step header like "Step 4.5" outside the
      `<step_4_5_gate_keep_kill_rubric>` XML-tag block — break the SKILL.md
      structure pattern only inside that block.
  </action>
  <verify>
    <automated>grep -q 'runRubric' super-gsd/skills/sgsd-complete-milestone/SKILL.md && grep -c '&lt;step_4_5_gate_keep_kill_rubric&gt;' super-gsd/skills/sgsd-complete-milestone/SKILL.md | grep -q '^1$' && echo "PASS RUBRIC-04"</automated>
  </verify>
  <done>
    - SKILL.md contains a new `<step_4_5_gate_keep_kill_rubric>` block between
      `</step_4_gate_drift>` and `<step_5_cross_phase_check>`
    - The block invokes runRubric() and writeFileSync to `.planning/milestones/{{version}}/gate-keep-kill.md`
    - Step 6 SUMMARY block contains the rubric-embed template (~6 lines added)
    - `grep -q 'runRubric' SKILL.md` exits 0 (RUBRIC-04)
    - All pre-existing steps (0, 1, 2, 3, 4, 5, 6, 7, 8, 9) remain unchanged byte-wise
      (verify with diff-line-count: only +28 inserted lines, 0 deletions)
    - SKILL.md still parses as valid markdown (preview-render check)
    - Atomic commit: `feat(39-01): wire runRubric into sgsd-complete-milestone Step 4.5 + SUMMARY embed`
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Create rubric.test.cjs local-fallback test (6 fixtures: R1-R6 + halt override)</name>
  <files>super-gsd/tools/gate-keep-kill/rubric.test.cjs</files>
  <behavior>
    Six deterministic fixtures, each in its own fs.mkdtempSync() — independent,
    no cross-fixture state leakage. Uses the production rubric.cjs lib via
    require() (binding-equivalent to the SKILL.md Step 4.5 production caller).
    Local-fallback proof per RESEARCH §11 (Live-or-Local Fallback):

    Fixture 1 (R1 + RUBRIC-03 — empty everything):
      Setup: tmpdir with NO gate-value-log.jsonl, NO review-ledger.jsonl,
        NO edge-guard-log.jsonl. Mini gates.yaml with 13 rows.
      Expect: runRubric returns 13 rows; every verdict === 'defer'; every
        reason === 'no_fires_yet'; every value_score === null.
      Binds: RUBRIC-02 (all 13 classified) + RUBRIC-03 (defer-on-empty).

    Fixture 2 (R2 — value_score indeterminate):
      Setup: tmpdir with gate-value-log.jsonl having only 'skip' outcome rows
        for one gate (fires === 0 because skip doesn't increment fires per
        Phase 36 summarize() logic). Even simpler: synthesize a row where
        Phase 36 summarize returns null value_score.
      Expect: that gate -> verdict='defer', reason='value_score_indeterminate'
        OR 'no_fires_yet' (R1 fires-first; both are valid defer outcomes; we
        accept both as long as verdict is defer and reason is in the
        defer-cluster reasons set).

    Fixture 3 (R4 — keep candidate):
      Setup: gate-value-log with a gate having fires=15, pass=12, warn=2,
        block=1 -> value_score = (12 + 1 - 1) / 15 = 12/15 = 0.80.
      Expect: that gate -> verdict='keep', reason='value_score_above_threshold'.

    Fixture 4 (R5 — kill candidate):
      Setup: gate-value-log with a gate having fires=12, pass=1, warn=0,
        block=11 -> value_score = max(0, (1 + 0 - 11) / 12) = 0.
      Expect: that gate -> verdict='kill',
        reason='value_score_below_threshold_with_evidence'.

    Fixture 5 (R3 + R6 — defer cluster):
      Setup: gate-value-log with two gates:
        gate_A: fires=4, pass=3, warn=0, block=1 -> value_score = 0.50,
          fires < 5 keep bar -> R6 fallthrough -> defer + mid_value_score_or_low_fires
        gate_B: fires=7, pass=1, warn=0, block=6 -> value_score = max(0,(1-6)/7) = 0,
          fires < 10 kill bar AND value_score < 0.2 -> R3 ->
          defer + insufficient_evidence_for_kill (RUBRIC-03 secondary).
      Expect: both gates verdict='defer'; reasons match each row.

    Fixture 6 (PRE-RULE — edge-guard halt override):
      Setup: gate-value-log with one gate at kill thresholds (fires=12,
        block=11 -> would be R5 kill); edge-guard-log with one row for the
        SAME gate having resolution='halt'.
      Expect: that gate -> verdict='keep', reason='structural_emit_required'.
      Binds: RESEARCH §1.3 lock — halt override beats R5 kill.

    Renderer round-trip (bonus, RESEARCH §11 fixture #5):
      For fixture 1's 13-row output, runRubric -> renderTable -> parse
      markdown line-by-line; assert row count and verdict column values
      recoverable. Confirms RESEARCH §3.3 column order is honored.

    Each fixture uses tmpdir-isolated registry/gates.yaml passed via
    opts.gatesYamlPath. The real super-gsd/registry/gates.yaml is NEVER
    read or modified. Test file MUST exit 0 on all-pass; exit 1 with
    detailed failure list on any failure.
  </behavior>
  <action>
    Create `super-gsd/tools/gate-keep-kill/rubric.test.cjs` (NEW, ~120 LOC).

    File layout:

    1. HEADER (~15 lines):
       - "// Phase 39 local-fallback test for rubric.cjs."
       - "// Provider-independent. Six fixtures cover R1-R6 + edge-guard halt override."
       - "// Each fixture is fs.mkdtempSync-isolated; canonical files NEVER touched."
       - Cite "Source: 39-RESEARCH.md §11 (Live-or-Local Fallback)".

    2. REQUIRES (node built-ins + production lib):
         const fs   = require('fs');
         const path = require('path');
         const os   = require('os');
         const { runRubric, renderTable, classifyGate, REASONS, VERDICTS } =
           require('./rubric.cjs');

    3. HELPERS (~25 lines):
       - mkTmp() -> fs.mkdtempSync(path.join(os.tmpdir(), 'rubric-test-'))
       - writeYaml(tmp, gateNames) -> writes a minimal gates.yaml with `gates:`
         + N rows of `  - name: <gate>` under tmp/registry/gates.yaml; returns
         the path.
       - writeGateLog(tmp, rows) -> appends each row as JSONL to
         tmp/.planning/metrics/gate-value-log.jsonl (envelope-v1 shape; reuse
         the row factory pattern from gate-value-log.cjs:471-502 by simply
         calling Phase 36's logGateValue lib for compactness).
       - writeEdgeLog(tmp, rows) -> appends to tmp/.planning/metrics/edge-guard-log.jsonl.

    4. SIX FIXTURE FUNCTIONS (~60 lines total):
       Each fixture:
         a. tmp = mkTmp()
         b. yamlPath = writeYaml(tmp, [...gateNames])
         c. (optional) writeGateLog(tmp, [...rows])
         d. (optional) writeEdgeLog(tmp, [...rows])
         e. const planningDir = path.join(tmp, '.planning');
            const rows = runRubric(planningDir, { gatesYamlPath: yamlPath });
         f. assert against expected; on failure push to failures[] with name + detail
         g. fs.rmSync(tmp, { recursive: true, force: true })

       Implement fixtures 1-6 per <behavior> block above. Plus the renderer
       round-trip bonus assertion using fixture 1's rows.

    5. MAIN (~20 lines):
       - let pass = 0, fail = 0; const failures = [];
       - Run each fixture; tally pass/fail.
       - On success: console.log('rubric local-fallback test: 6 pass, 0 fail'); process.exit(0).
       - On failure: print failures with name + detail; process.exit(1).

    6. FINGERPRINT GUARD (~10 lines, mirroring rubric.cjs --self-test #14):
       Capture mtime+size of the 4 canonical files (anchored to __dirname:
       <repo>/super-gsd/tools/gate-keep-kill/rubric.test.cjs is 3 dirs from repo
       root) BEFORE any fixture runs and AFTER all fixtures complete. Assert
       byte-stability. This is a 7th binding assertion (the 6 fixtures + 1
       fingerprint guard).

    NEVER-DO list (binding):
    - DO NOT mock or shim rubric.cjs internals — use the public module.exports
      surface ONLY (binding-equivalence to SKILL.md Step 4.5 caller).
    - DO NOT touch the canonical 4 files — fingerprint guard is binding.
    - DO NOT add jest, mocha, or any test-framework dep — assert + exit-code is
      sufficient and matches Phase 38's local-fallback precedent.
    - DO NOT use process.cwd() for any path resolution — anchor to __dirname or
      to tmp paths.
    - DO NOT skip the renderer round-trip — RESEARCH §11 fixture #5 requires it.

    Commit message: `test(39-01): deterministic local fallback for rubric (6 fixtures: R1-R6)`
  </action>
  <verify>
    <automated>node super-gsd/tools/gate-keep-kill/rubric.test.cjs</automated>
  </verify>
  <done>
    - File exists at super-gsd/tools/gate-keep-kill/rubric.test.cjs
    - Test exits 0 reporting "6 pass, 0 fail" (or "7 pass, 0 fail" with fingerprint guard counted)
    - All 6 fixtures use the production rubric.cjs module.exports (no mocks)
    - Each fixture is fs.mkdtempSync-isolated; canonical 4 files untouched (fingerprint guard)
    - Fixture 1 binds RUBRIC-03 (empty -> 13 defer + no_fires_yet)
    - Fixture 6 binds RESEARCH §1.3 (halt override beats R5 kill)
    - Renderer round-trip passes (fixture 1 -> renderTable -> parse -> verdict column recoverable)
    - File size between 100 and 160 lines (~120 target per CONTEXT.md)
    - No new dependencies added (package.json unchanged)
    - Atomic commit: `test(39-01): deterministic local fallback for rubric (6 fixtures: R1-R6)`
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| operator -> rubric | Operator invokes rubric.cjs via SKILL.md Step 4.5 (or CLI manually). Operator is trusted; the rubric is read-only over local artifacts. No network input crosses this boundary. |
| rubric -> ledgers | Rubric reads 3 JSONL ledgers + 1 YAML registry. Ledger lines may be malformed (writer crash, partial flush, manual edit). Treated as untrusted at the parse boundary. |
| rubric -> SKILL.md | SKILL.md Step 4.5 invokes runRubric() with `'.planning'` planningDir + `{{version}}` milestone string. The version is operator-supplied via STATE.md frontmatter (Phase 33 trust model — STATE.md is operator-controlled). |
| rubric -> filesystem | Rubric writes ONLY to `.planning/milestones/{{version}}/gate-keep-kill.md` (via SKILL.md, not the lib itself). The lib does NOT write any files. CLI --render writes to stdout only. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-39-01 | Tampering | edge-guard-log.jsonl | mitigate | Defensive JSON.parse per-line in try/catch; malformed lines silently skipped (RESEARCH §1.1 + Phase 36 ATC pattern). Self-test assertion #13 binds this. |
| T-39-02 | Tampering | gate-value-log.jsonl | mitigate | Phase 36 lib already enforces envelope-v1 schema on read; rubric inherits the defensive read via summarize(). Phase 36 self-test asserts this. |
| T-39-03 | Tampering | review-ledger.jsonl | mitigate | Phase 34 lib already enforces envelope-v1 schema; rubric inherits via readReviewRows(). Phase 34 self-test asserts this. |
| T-39-04 | Tampering | gates.yaml | mitigate | Manual minimal YAML parse uses regex `^\s*-\s+name:\s*(\S+)`; injected non-name keys are ignored. Returns [] on read failure. Rubric reads but NEVER writes the registry (lock 39=B). |
| T-39-05 | Information disclosure | rubric output | accept | The rendered markdown table contains only gate names + numeric metrics + closed-enum reasons. No secrets, no PII, no path traversal payloads. Operator-visible by design. |
| T-39-06 | Denial of service | malformed log floods | mitigate | Defensive read per-line; one bad line cannot crash the rubric. Single-pass read; no recursion. Fixed memory bound: O(rows). |
| T-39-07 | Elevation of privilege | rubric mutates registry | mitigate | Code review enforces "rubric NEVER writes gates.yaml". Self-test fingerprint guard (assertion #14) detects any unintended write to the canonical 4 files including gates.yaml. ATC Step 8 review re-checks. |
| T-39-08 | Repudiation | operator ignores kill row | accept | Lock 39=B explicitly puts the operator on the hook. Rubric output is committed to git via SKILL.md Step 8 (archive); audit trail preserved in `.planning/milestones/{{version}}/gate-keep-kill.md`. |
| T-39-09 | Spoofing | fake gate name in gate-value-log | accept | Phase 36 lib enforces `gate` field is a non-empty string; the rubric uses gates.yaml as the source-of-truth gate list and joins gate-value-log rows ON name match. Spurious rows for non-registered gates are filtered out (no row produced for them). |
| T-39-10 | Tampering | symlink attack on tmp dir | accept | fs.mkdtempSync is the OS standard for safe tmp creation; same risk model as Phase 36/38 self-tests which already ship to production. |
| T-39-11 | Information disclosure | env vars in error logs | mitigate | console.warn messages include only `e.message` (sanitized error string), never process.env or stack traces. Mirrors gate-value-log.cjs:275-277 + review-ledger.cjs:201-202. |
</threat_model>

<verification>

## Phase-level acceptance (RUBRIC-01..04 + T1 contract)

```bash
# RUBRIC-01: rubric reads 4 canonical sources
node -e "const r = require('./super-gsd/tools/gate-keep-kill/rubric.cjs'); console.log(typeof r.runRubric === 'function' && typeof r.classifyGate === 'function' && typeof r.renderTable === 'function' ? 'PASS' : 'FAIL')"

# RUBRIC-02 + Self-test: 14 assertions PASS, all 13 gates classified
node super-gsd/tools/gate-keep-kill/rubric.cjs --self-test
echo "RUBRIC-02 self-test exit: $?"

# RUBRIC-03: defer-on-empty (assertion #4 + fixture 1) — bound by self-test + test file
node super-gsd/tools/gate-keep-kill/rubric.test.cjs
echo "RUBRIC-03 fixture exit: $?"

# RUBRIC-04: SKILL.md grep
grep -q 'runRubric' super-gsd/skills/sgsd-complete-milestone/SKILL.md && echo "PASS RUBRIC-04" || echo "FAIL RUBRIC-04"

# RUBRIC-04: Step 4.5 block exists exactly once
COUNT=$(grep -c '<step_4_5_gate_keep_kill_rubric>' super-gsd/skills/sgsd-complete-milestone/SKILL.md)
[ "$COUNT" = "1" ] && echo "PASS step 4.5 placement" || echo "FAIL step 4.5 placement (count=$COUNT)"

# Fingerprint guard binding: canonical files unchanged after self-test
SHA_BEFORE=$(sha256sum super-gsd/registry/gates.yaml .planning/metrics/gate-value-log.jsonl 2>/dev/null | sort)
node super-gsd/tools/gate-keep-kill/rubric.cjs --self-test > /dev/null
SHA_AFTER=$(sha256sum super-gsd/registry/gates.yaml .planning/metrics/gate-value-log.jsonl 2>/dev/null | sort)
[ "$SHA_BEFORE" = "$SHA_AFTER" ] && echo "PASS fingerprint guard" || echo "FAIL fingerprint guard"

# Live-or-Local Fallback verification (RESEARCH §11):
# Live: against actual .planning telemetry, runRubric should produce >= 1 row per gate in gates.yaml
node -e "const {runRubric, renderTable} = require('./super-gsd/tools/gate-keep-kill/rubric.cjs'); const rows = runRubric('.planning', {milestone: 'v1.8'}); console.log('rows:', rows.length, '/13'); console.log(renderTable(rows));"

# Net diff bound (T1 stop_rule)
git diff --stat HEAD~3..HEAD -- super-gsd/tools/gate-keep-kill/ super-gsd/skills/sgsd-complete-milestone/SKILL.md
# Expected: ~+440 / -0 (rubric.cjs ~+360, rubric.test.cjs ~+120, SKILL.md ~+28; - = 0)
```

## Per-task acceptance summary

| Task | Verification | Binds |
|------|--------------|-------|
| 1 (rubric.cjs) | --self-test exits 0; "14 pass, 0 fail" | RUBRIC-01 + RUBRIC-02 + RUBRIC-03 |
| 2 (SKILL.md edit) | grep -q 'runRubric' SKILL.md exits 0; step block count == 1 | RUBRIC-04 |
| 3 (rubric.test.cjs) | test exits 0; "6 pass, 0 fail" + fingerprint guard | RUBRIC-03 (binding) + R1-R6 + halt override |

## ATC FULL tier verification (post-commit)

Per Phase 36/38 precedent (~440 LOC + new tool subdir + SKILL.md edit):
- Per-dispatch ATC fires on every task commit (3 fires).
- Phase-level ATC fires once at phase close.
- MUDA-waste-audit fires (>=100 diff_lines + phase_type !== refactor/docs/config).
- Edge-guard structural emit check fires on the new gate-keep-kill.md artifact path.

</verification>

<success_criteria>

Phase 39 acceptance gate (per ROADMAP-AGENT.md:436-439 + REQUIREMENTS.md:43-46):

1. **RUBRIC-01 (mechanical script reading 3 ledgers + gates.yaml):**
   `super-gsd/tools/gate-keep-kill/rubric.cjs` exists, exports
   `{runRubric, renderTable, classifyGate, KEEP_THRESHOLDS, VERDICTS, REASONS}`,
   and `runRubric()` reads gate-value-log + review-ledger + edge-guard-log + gates.yaml.

2. **RUBRIC-02 (output table classifies all 13 gates):**
   `node rubric.cjs --render --milestone v1.8` produces a markdown table
   with one row per gate in `super-gsd/registry/gates.yaml` (13 rows).

3. **RUBRIC-03 (defer-on-empty explicit, NOT default-kill):**
   - Self-test assertion #4: classifyGate with null summary -> defer + no_fires_yet.
   - Self-test assertion #7: low-fires + low-value-score -> defer + insufficient_evidence_for_kill.
   - Test fixture 1: empty everything -> 13 defer rows.

4. **RUBRIC-04 (wired into sgsd-complete-milestone/SKILL.md at close):**
   `grep -q 'runRubric' super-gsd/skills/sgsd-complete-milestone/SKILL.md` exits 0.
   `<step_4_5_gate_keep_kill_rubric>` block exists exactly once.

5. **Fingerprint guard (Phase 36 W2 lesson):**
   The 4 canonical files (gate-value-log.jsonl, review-ledger.jsonl,
   edge-guard-log.jsonl, gates.yaml) are byte-stable across --self-test
   invocations (mtime+size unchanged).

6. **Provider-unavailable graceful degradation:**
   Local-fallback test exercises the SAME code path SKILL.md invokes;
   binding-equivalent to live (RESEARCH §11). Live cannot be blocked by
   `provider_unavailable` because the rubric has zero external calls
   (no LLM, no MCP, no network).

7. **Net diff:**
   ~+440 / -0 across the 3 atomic commits (within +/-5% tolerance).

8. **Threat model coverage:**
   All 11 STRIDE threats (T-39-01..11) have explicit dispositions; the 6
   `mitigate` rows have specific implementation references; the 5 `accept`
   rows have explicit rationale.

9. **Lock 39=B observed:**
   No code path mutates `super-gsd/registry/gates.yaml`. Self-test
   fingerprint guard (assertion #14) is the binding test. The rubric
   ONLY recommends; the operator decides.

10. **Schema-without-consumer rule satisfied:**
    Three in-phase consumers of `RubricRow` (RESEARCH §8): rubric.cjs
    selfTest + rubric.cjs renderTable + SKILL.md Step 4.5. Exceeds the
    >=1 production caller floor.

</success_criteria>

<output>
After completion, create `.planning/milestones/v1.8/phases/39-gate-keep-kill/39-01-SUMMARY.md`
following the standard SUMMARY template:
- frontmatter: phase, plan, status, files_changed, requirements_satisfied
- One-liner per atomic commit (3 commits)
- VERIFICATION block with all 10 success_criteria check results
- DEVIATIONS block (anticipate: ~3-5 ATC findings per Phase 36/38 precedent — all in-loop fixable)
- BLOCKERS: none expected (RESEARCH §11 live-or-local fallback removes provider dependency)
- SCRIPTS_CREATED: super-gsd/tools/gate-keep-kill/rubric.cjs (lib + CLI + self-test)
- ONE_LINER: "Phase 39 — mechanical keep/kill rubric over Phase 34/36 telemetry; defer-on-empty; lock 39=B (manual override at close); 14 assertions PASS"
</output>
