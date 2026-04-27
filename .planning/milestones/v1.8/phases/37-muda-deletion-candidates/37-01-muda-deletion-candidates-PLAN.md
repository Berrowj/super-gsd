---
plan_id: 37-01
phase: 37
title: MUDA Deletion Candidates
schema_version: 2
model: sonnet
expected_ATC_tier: FULL
requirements: [MUDA-01, MUDA-02, MUDA-03, MUDA-04]
locked_decisions: [37=A]
depends_on: [36]
created: 2026-04-27
tasks:
  - id: T1
    type: code
    files_touched:
      - super-gsd/scripts/lib/muda-deletion-candidates.cjs
      - super-gsd/scripts/sgsd-muda-audit.sh
      - super-gsd/scripts/lib/muda-deletion-candidates.test.cjs
    hypothesis: "3 mechanical heuristics over canonical ledgers (gate-value-log + crit-backlog) produce actionable deletion candidates that Phase 39 keep/kill rubric and milestone-close authors can review without reading raw JSONL."
    falsifier: "Heuristic thresholds produce >50% false-positives on current repo state."
    stop_rule: "self-test 14+ assertions PASS; sgsd-muda-audit.sh post-hook present (grep test); fallback test 3 fixtures PASS."
    minimal_test: "node super-gsd/scripts/lib/muda-deletion-candidates.cjs --self-test -> exit 0; node super-gsd/scripts/lib/muda-deletion-candidates.test.cjs -> exit 0."

must_haves:
  truths:
    - "CANDIDATE_KINDS = Object.freeze(['low_value_gate','recurring_backlog','skip_drift_gate'])"
    - "Each candidate row has 5 required fields (kind, target, evidence, risk, rollback) per MUDA-03"
    - "Library never throws upward (mirrors Phase 32 / 34 / 36 locked design: gate-value-log.cjs:271-278, route-ledger.cjs:42-51)"
    - "sgsd-muda-audit.sh post-hook NEVER blocks the audit (failure logged + ignored; locked invariant)"
    - "__dirname-anchored fingerprint guard (Phase 32 W3 lesson) protects canonical gate-value-log.jsonl + crit-backlog.jsonl"
    - "appendToWasteFile is idempotent (re-runs produce byte-identical output via section-locate-or-append)"
    - "renderMarkdown is pure (no I/O); ASCII-only; 5-column markdown table"
    - "DRY_RUN=true skips post-hook entirely (compose_waste_md heredoc untouched)"
  artifacts:
    - super-gsd/scripts/lib/muda-deletion-candidates.cjs (NEW ~370 LOC)
    - super-gsd/scripts/sgsd-muda-audit.sh (modified, +~25 LOC post-hook between line 480 and line 481)
    - super-gsd/scripts/lib/muda-deletion-candidates.test.cjs (NEW ~90 LOC, 3 fixtures)
  key_links:
    - 37-CONTEXT.md
    - 37-RESEARCH.md (sec 1 thresholds, sec 2 schema, sec 3 wire-in, sec 4 API, sec 11 locks)
    - super-gsd/scripts/lib/gate-value-log.cjs (Phase 36 architectural template; 1:1 mirror)
    - super-gsd/scripts/lib/crit-backlog.cjs (data source for recurring heuristic)
    - super-gsd/scripts/sgsd-muda-audit.sh (line 480 insertion point; production caller)
---

<objective>
Phase 37 lands `super-gsd/scripts/lib/muda-deletion-candidates.cjs` -- a
deletion-candidate finder + WASTE.md `## Deletion Candidates` section
renderer. Three mechanical heuristics (low_value, recurring, skip_drift)
read the canonical ledgers (gate-value-log.jsonl from Phase 36;
crit-backlog.jsonl) and emit candidate rows of shape
`{kind, target, evidence, risk, rollback}` per MUDA-03. The lib is wired
into `sgsd-muda-audit.sh` as a post-hook AFTER the atomic WASTE.md write
at line 287, BEFORE the metrics log at line 481.

Architecture mirrors `gate-value-log.cjs` (Phase 36) and
`route-ledger.cjs` (Phase 32) 1:1: frozen const enums, public API never
throws upward, `__dirname`-anchored fingerprint guard, defensive read,
atomic file mutation. Phase 37 differs in ONE respect: it does NOT emit
envelope-v1 JSONL rows. Candidates are computed-on-demand from existing
logs and rendered into a markdown section appended to WASTE.md. No new
ledger; no schema bump.

Locked design (mass-discuss line 212, decision 37=A): heuristic deletion
candidates ONLY -- no auto-disable. Each candidate is a suggestion the
operator (or Phase 39 rubric) may act on. Auto-removal is dangerous;
review-at-close is the safety contract.

Purpose:
- MUDA-01: WASTE.md template gains `## Deletion Candidates` section
- MUDA-02: 3 heuristics: low_value, recurring, skip_drift
- MUDA-03: Each candidate row carries kind, target, evidence, risk, rollback
- MUDA-04: Wired into `sgsd-muda-audit.sh` post-WASTE.md write

Output:
- 1 new lib at `super-gsd/scripts/lib/muda-deletion-candidates.cjs` (~370 LOC)
- 1 post-hook block in `super-gsd/scripts/sgsd-muda-audit.sh` (~25 LOC at line ~480)
- 1 new local-fallback test at `super-gsd/scripts/lib/muda-deletion-candidates.test.cjs` (~90 LOC, 3 fixtures)
- Net diff approximately +490 / -2 across 2 created + 1 edited file
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/ROADMAP-AGENT.md
@.planning/milestones/v1.8/REQUIREMENTS.md
@.planning/milestones/v1.8/phases/37-muda-deletion-candidates/37-CONTEXT.md
@.planning/milestones/v1.8/phases/37-muda-deletion-candidates/37-RESEARCH.md
@super-gsd/scripts/lib/gate-value-log.cjs
@super-gsd/scripts/lib/crit-backlog.cjs
@super-gsd/scripts/lib/route-ledger.cjs
@super-gsd/scripts/sgsd-muda-audit.sh

<interfaces>
<!-- Architectural template: gate-value-log.cjs (Phase 36) public API -->
<!-- Mirror this 1:1 in muda-deletion-candidates.cjs. Do NOT invent new patterns. -->

From super-gsd/scripts/lib/gate-value-log.cjs (Phase 36 template):
```javascript
// Public-API try/catch wrapper pattern (NEVER throws upward):
function summarize(planningDir, opts) {
  try {
    // ... internal work that may throw on closed-enum violation ...
    return result;
  } catch (e) {
    console.warn('[SGSD] gate-value-log summarize failed:', e.message);
    return [];
  }
}

// summarize() returns rows with shape:
// { gate, fires, pass, warn, block, skip, total_observations, fire_rate, value_score }
// where value_score = max(0, (pass + 0.5*warn - block) / fires) when fires>0, else null
```

From super-gsd/scripts/lib/crit-backlog.cjs:
```javascript
// unresolvedRows(planningDir) returns latest row per id, filtered to kind != 'cleared'.
// Each row carries: { id, kind, phase, plan, milestone, summary, suspected_cause, ... }
// kind enum: ['per_dispatch_atc', 'phase_atc', 'verifier_fail', 'edge_guard_miss', 'cleared']
```

From super-gsd/scripts/sgsd-muda-audit.sh:283-287 (atomic mv pattern; mirror in lib):
```bash
# Atomic write: tmp + rename
mkdir -p "$PHASE_DIR"
tmp="$WASTE_FILE.tmp"
compose_waste_md > "$tmp"
mv "$tmp" "$WASTE_FILE"
```

From super-gsd/scripts/sgsd-muda-audit.sh insertion point (line 480, between
`rm -f "$TMP_CODEX_REPORT"` at line 478 and `# Log to metrics` at line 481):
```bash
  rm -f "$TMP_CODEX_REPORT"
fi
# <<< POST-HOOK INSERTION POINT (line 480) >>>
# Log to metrics
METRICS_LOG="$PROJECT/.planning/metrics/muda-log.jsonl"
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>T1.A1: Create muda-deletion-candidates.cjs library (~370 LOC)</name>
  <files>super-gsd/scripts/lib/muda-deletion-candidates.cjs</files>
  <action>
Create `super-gsd/scripts/lib/muda-deletion-candidates.cjs` mirroring
`gate-value-log.cjs` (Phase 36) and `route-ledger.cjs` (Phase 32) 1:1.

**File structure (top to bottom):**

1. **Header comment block** citing 37-RESEARCH.md sec 11. State:
   - Source of truth: candidates computed-on-demand from existing
     gate-value-log.jsonl + crit-backlog.jsonl (NO new JSONL ledger).
   - Rendered output: `## Deletion Candidates` section appended to
     WASTE.md by sgsd-muda-audit.sh post-hook.
   - Locked design 37=A (mass-discuss:212): 3 heuristics; deletion
     candidates only; no auto-disable.
   - Failure contract: every public API wraps in try/catch and NEVER
     throws upward (mirrors gate-value-log.cjs:271-278).
   - Schema-without-consumer satisfied: 2 in-phase consumers
     (sgsd-muda-audit.sh wire-in + --self-test). Phase 39 rubric
     deferred consumer.

2. **Imports**: `fs`, `path`, `os`. Then:
   ```javascript
   const gateValueLog = require('./gate-value-log.cjs');
   const critBacklog  = require('./crit-backlog.cjs');
   ```

3. **Frozen constants** (per RESEARCH §4.4):
   ```javascript
   const CANDIDATE_KINDS = Object.freeze([
     'low_value_gate', 'recurring_backlog', 'skip_drift_gate',
   ]);
   const RISK_LEVELS = Object.freeze(['low', 'medium', 'high']);
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
   const SECTION_HEADING = '## Deletion Candidates';
   ```

4. **Internal helpers**:
   - `_normalizeSummary(s)`: lowercase the input string; replace `[0-9a-f]{6,40}` with `<sha>`; replace `v\d+\.\d+` with `<ms>`; replace `phase\s*\d+` with `<phase>`; collapse whitespace; slice to 80 chars. Used by recurring fallback when `suspected_cause` is null. Per RESEARCH §1.2 + §5.
   - `_normalize(candidate)`: validate candidate has 5 required fields. Throw on missing `kind`, missing `target`, missing `risk`, missing `rollback`. `kind` must be in `CANDIDATE_KINDS`. `risk` must be in `RISK_LEVELS`. `evidence` must be array (coerce empty to `[]`). Throws on violation; public APIs wrap. Returns canonical 5-field object.
   - `_escapePipe(s)`: replace literal `|` with `\|` for markdown table cells. ASCII-only.

5. **Sub-finders (3)** -- each is a private function `_find*` that throws on its OWN data-shape errors but the public wrapper catches.

   ```javascript
   function _findLowValueCandidates(planningDir, opts) {
     const o = opts || {};
     const t = (o.thresholds && o.thresholds.low_value) || DEFAULT_THRESHOLDS.low_value;
     const summary = gateValueLog.summarize(planningDir,
       o.milestone ? { milestone: o.milestone } : {});
     const out = [];
     for (const row of summary) {
       if (row.fires < t.min_fires) continue;
       if (row.value_score === null) continue;
       if (row.value_score >= t.max_value_score) continue;
       out.push(_normalize({
         kind: 'low_value_gate',
         target: row.gate,
         evidence: [
           { kind: 'metric', ref: `gate-value-log:${row.gate} fires=${row.fires} pass=${row.pass} warn=${row.warn} block=${row.block} value_score=${row.value_score.toFixed(3)}` },
         ],
         risk: DEFAULT_RISK_BY_KIND.low_value_gate,
         rollback: (o.rollbacks && o.rollbacks.low_value_gate) || DEFAULT_ROLLBACKS.low_value_gate,
       }));
     }
     return out;
   }
   ```

   `_findRecurringCandidates(planningDir, opts)`:
   - Read `critBacklog.unresolvedRows(planningDir)`.
   - Group by `(kind, suspected_cause || _normalizeSummary(summary))`.
   - For each group: collect distinct `milestone` values into a Set.
   - If `milestones.size >= t.min_milestones` (default 2): emit candidate with:
     - `target: \`${kind}: ${cause_or_normalized}\``
     - `evidence: [{ kind: 'milestones', ref: \`v${ms_list_joined}\` }, { kind: 'count', ref: \`occurrences=${rows.length}\` }]`
     - `risk: 'low'`
     - `rollback: DEFAULT_ROLLBACKS.recurring_backlog`

   `_findSkipDriftCandidates(planningDir, opts)`:
   - Read `gateValueLog.summarize(planningDir, milestone-filter)`.
   - For each row: skip if `row.total_observations < t.min_observations` (default 5).
   - If `row.fire_rate < t.max_fire_rate` (default 0.2): emit candidate with:
     - `target: row.gate`
     - `evidence: [{ kind: 'metric', ref: \`gate-value-log:${row.gate} skip=${row.skip} total_observations=${row.total_observations} fire_rate=${row.fire_rate.toFixed(3)}\` }]`
     - `risk: 'low'`
     - `rollback: DEFAULT_ROLLBACKS.skip_drift_gate`

6. **Public APIs (6)** -- ALL wrapped in try/catch, ALL return `[]` or `false` on error:

   ```javascript
   function findLowValueCandidates(planningDir, opts) {
     try { return _findLowValueCandidates(planningDir, opts); }
     catch (e) {
       console.warn('[SGSD] muda-deletion-candidates findLowValueCandidates failed:', e.message);
       return [];
     }
   }
   // findRecurringCandidates: identical wrapper around _findRecurringCandidates
   // findSkipDriftCandidates: identical wrapper around _findSkipDriftCandidates

   function findCandidates(planningDir, opts) {
     try {
       const o = opts || {};
       const kinds = Array.isArray(o.kinds) ? o.kinds : CANDIDATE_KINDS;
       const all = [];
       if (kinds.includes('low_value_gate'))    all.push(..._findLowValueCandidates(planningDir, opts));
       if (kinds.includes('recurring_backlog')) all.push(..._findRecurringCandidates(planningDir, opts));
       if (kinds.includes('skip_drift_gate'))   all.push(..._findSkipDriftCandidates(planningDir, opts));
       return all;
     } catch (e) {
       console.warn('[SGSD] muda-deletion-candidates findCandidates failed:', e.message);
       return [];
     }
   }
   ```

   `renderMarkdown(candidates, opts)` -- pure transform, NO I/O:
   - Returns markdown string starting with `\n## Deletion Candidates\n\n`.
   - 2-line operator preamble:
     ```
     > Heuristic suggestions only. Phase 39 rubric reviews these at milestone close.
     > Operator may dismiss any row. Auto-disable is NOT performed (locked 37=A).
     ```
   - If empty list: emit `_No deletion candidates surfaced by current heuristics._\n` and footer.
   - If non-empty: 5-column markdown table:
     ```
     | kind | target | risk | evidence | rollback |
     |------|--------|------|----------|----------|
     ```
     Each row: `| ${kind} | ${_escapePipe(target)} | ${risk} | ${_escapePipe(evidenceStr)} | ${_escapePipe(rollback)} |`
     where `evidenceStr` = candidate.evidence.map(e => `${e.kind}=\`${e.ref}\``).join('; ').
   - Footer line: `_Total: N candidate(s) across M heuristic(s)._\n` where M = distinct `kind` values.
   - Wrap in try/catch -> return empty heading section on error.

   `appendToWasteFile(planningDir, wasteFilePath, opts)`:
   - Wrap entire body in try/catch -> return `false` on error.
   - If `!wasteFilePath || !fs.existsSync(wasteFilePath)`: return `false`.
   - Compute `candidates = findCandidates(planningDir, opts)`.
   - Compute `section = renderMarkdown(candidates, opts)`.
   - Read existing content: `const existing = fs.readFileSync(wasteFilePath, 'utf8');`
   - Section-locate-or-append (idempotent re-run):
     - If `existing.includes(SECTION_HEADING)`: replace from `## Deletion Candidates` through next `\n## ` heading or EOF. Use a regex like `/\n## Deletion Candidates[\s\S]*?(?=\n## |$)/` and replace with the new section (prefixed with `\n` if needed).
     - Else: append section to end (ensuring single newline separator).
   - Atomic write:
     ```javascript
     const tmp = wasteFilePath + '.mdc.tmp';
     fs.writeFileSync(tmp, newContent, 'utf8');
     fs.renameSync(tmp, wasteFilePath);
     ```
   - Return `true` on success.

7. **--self-test** mode (mirrors gate-value-log.cjs:344-545):
   - Capture `realLedgerGVL = path.resolve(__dirname, '..', '..', '..', '.planning', 'metrics', 'gate-value-log.jsonl')` and `realLedgerCB = path.resolve(__dirname, '..', '..', '..', '.planning', 'metrics', 'crit-backlog.jsonl')` mtimes BEFORE any work.
   - Create `tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mdc-'))` plus `metrics/` subdir.
   - 14 assertions (per RESEARCH §9):

     1. `CANDIDATE_KINDS` is `Object.isFrozen` + length 3 + contains all 3 kinds (low_value_gate, recurring_backlog, skip_drift_gate).
     2. `RISK_LEVELS` is `Object.isFrozen` + length 3 + includes low/medium/high.
     3. `DEFAULT_THRESHOLDS` frozen at top + nested: `low_value.min_fires===5`, `low_value.max_value_score===0.3`, `recurring.min_milestones===2`, `skip_drift.max_fire_rate===0.2`, `skip_drift.min_observations===5`.
     4. `DEFAULT_ROLLBACKS` frozen with 3 keys; each value is non-empty string.
     5. `findCandidates(tmp)` on fresh tmpdir (no ledgers) returns `[]`.
     6. low_value heuristic over fixture: write 6 gate-value rows for gate `g_lo` (1 pass + 5 block) using `gateValueLog.logGateValue(tmp, ...)`. Expect `_findLowValueCandidates(tmp)` returns one row with `target='g_lo'`, `kind='low_value_gate'`, `risk='medium'`. Validate value_score formula: max(0, (1+0-5)/6)=0.
     7. low_value floor: gate `g_few` with 1 pass + 3 block (fires=4, below floor 5). Expect `[]`.
     8. recurring heuristic across 2 milestones: append 2 crit-backlog rows with `kind='verifier_fail'`, `suspected_cause='codex unavailable'`, milestones `'v1.5'` + `'v1.7'`. Use `provider_health_check: { available: false, behavioral: true }` to satisfy the codex-unavailable guard. Expect 1 candidate with `target='verifier_fail: codex unavailable'`, `risk='low'`, evidence references both milestones.
     9. recurring same-milestone NOT recurring: 5 crit-backlog rows ALL milestone `'v1.6'` same tuple. Expect `[]`.
     10. recurring fallback to normalized summary: 2 rows with `suspected_cause: null`, summary contains a sha + milestone token, across 2 distinct milestones; recurring fires. Validate `_normalizeSummary` collapsed sha/milestone tokens.
     11. skip_drift heuristic: 1 fire (pass) + 9 skips for gate `g_dr` (total_obs=10, fire_rate=0.1). Expect 1 candidate `target='g_dr'`, `kind='skip_drift_gate'`, `risk='low'`.
     12. skip_drift floor: 1 fire + 1 skip (total_obs=2, below floor 5). Expect `[]`.
     13. `renderMarkdown([])` contains `_No deletion candidates surfaced`. `renderMarkdown(non-empty)` contains the 5-column header `| kind | target | risk | evidence | rollback |` and the footer `_Total: ` prefix.
     14. `appendToWasteFile` idempotent: write synthetic WASTE.md to tmpdir; call once -> section appears; capture file content; call again -> file byte-identical to captured. Then call with NEW candidates set -> section REPLACED in-place (row count differs from previous; existing pre-section content preserved).

   - **Fingerprint guard** (after all assertions): canonical
     `gate-value-log.jsonl` AND `crit-backlog.jsonl` mtimes + sizes
     unchanged. Anchor to `__dirname` not `process.cwd()` (Phase 32 W3 lesson).
   - First-failure stops; mirror `gate-value-log.cjs:344-349` reporter.
   - Cleanup: `fs.rmSync(tmp, { recursive: true, force: true })`.
   - Return `0` on all-pass; `1` on any failure.

8. **CLI main** at bottom (`if (require.main === module)`):
   - `--self-test` -> `process.exit(selfTest())`.
   - `--apply --waste-file <path>`: parse `--waste-file` arg + optional `--planning-dir` arg (default `path.resolve(__dirname, '..', '..', '..', '.planning')` per Phase 36 ATC W2 fix); call `appendToWasteFile(planningDir, wasteFile, opts)`; print `OK` or `FAIL <message>` and exit 0 / 1.
   - `--list [--planning-dir <p>] [--milestone <m>]`: print `JSON.stringify(findCandidates(planningDir, opts), null, 2)`.
   - Default: print usage block listing all flags and exit 0.

9. **module.exports** (10 total: 6 public APIs + 4 frozen constants):
   ```javascript
   module.exports = {
     // Public APIs (6):
     findCandidates,
     findLowValueCandidates,
     findRecurringCandidates,
     findSkipDriftCandidates,
     renderMarkdown,
     appendToWasteFile,
     // Frozen constants (4):
     CANDIDATE_KINDS,
     RISK_LEVELS,
     DEFAULT_THRESHOLDS,
     DEFAULT_ROLLBACKS,
   };
   ```

**Constraints (verbatim):**
- ASCII-only; LF line endings; no smart quotes; no em dashes ("--" not "—").
- No new dependencies (Node built-ins only: fs, path, os).
- Public API NEVER throws upward.
- `__dirname`-anchored fingerprint guard against canonical ledgers.
- Mirror gate-value-log.cjs / route-ledger.cjs / review-ledger.cjs architecture.
  </action>
  <verify>
    <automated>node super-gsd/scripts/lib/muda-deletion-candidates.cjs --self-test</automated>
    Expected: exit code 0; stdout includes "muda-deletion-candidates self-test: 14 pass, 0 fail" (or higher).
  </verify>
  <done>
- File `super-gsd/scripts/lib/muda-deletion-candidates.cjs` exists at ~370 LOC.
- `--self-test` exits 0 with all 14 assertions PASS.
- `module.exports` lists 6 public APIs + 4 frozen constants.
- Fingerprint guard verifies canonical `gate-value-log.jsonl` + `crit-backlog.jsonl` are byte-untouched after self-test runs.
- All 6 public APIs wrap in try/catch (grep `console.warn.*muda-deletion-candidates` returns 6 matches).
- ASCII-only (`grep -P '[^\x00-\x7F]' super-gsd/scripts/lib/muda-deletion-candidates.cjs` returns nothing).
  </done>
</task>

<task type="auto">
  <name>T1.A2: Wire post-hook into sgsd-muda-audit.sh at line 480 (~25 LOC)</name>
  <files>super-gsd/scripts/sgsd-muda-audit.sh</files>
  <action>
Insert a 25-line guarded post-hook block in
`super-gsd/scripts/sgsd-muda-audit.sh` between the qualitative-codex
block (ends at line 478, `rm -f "$TMP_CODEX_REPORT"` followed by `fi`
at line 479) and the metrics log block (starts at line 481, `# Log to
metrics`).

**Exact insertion point:** AFTER line 479 (`fi` closing the
codex_qualitative_waste block), BEFORE line 481 (`# Log to metrics`).
The new block becomes lines 480-504; subsequent line numbers shift +25.

**Block to insert verbatim** (preserve leading hash comment block + the
guard structure; never block the audit on post-hook failure):

```bash
# MUDA-04 (Phase 37): deletion-candidates post-hook.
# Computes 3-heuristic deletion candidates from canonical ledgers
# (gate-value-log.jsonl + crit-backlog.jsonl) and appends a
# `## Deletion Candidates` section to WASTE.md. NEVER blocks the audit:
# any failure is logged to stderr and ignored. Skipped on --dry-run.
# Lib: super-gsd/scripts/lib/muda-deletion-candidates.cjs (Phase 37 lib).
# Locked 37=A: deletion-candidates only; no auto-disable; review-at-close
# is the safety contract.
MDC_LIB="$SCRIPT_DIR/lib/muda-deletion-candidates.cjs"
if [[ "$DRY_RUN" != "true" && -x "$NODE_BIN" && -f "$WASTE_FILE" && -f "$MDC_LIB" ]]; then
    MDC_PLANNING_DIR="$PROJECT/.planning"
    MDC_MILESTONE="${MUDA_MILESTONE:-}"
    if "$NODE_BIN" "$MDC_LIB" --apply \
        --waste-file "$WASTE_FILE" \
        --planning-dir "$MDC_PLANNING_DIR" \
        ${MDC_MILESTONE:+--milestone "$MDC_MILESTONE"} \
        >/dev/null 2>&1; then
        :  # post-hook applied (silent on success; verifiable via grep on WASTE.md)
    else
        echo "sgsd-muda-audit: muda-deletion-candidates post-hook failed (non-blocking)" >&2
    fi
elif [[ "$DRY_RUN" == "true" ]]; then
    : # dry-run: skip deletion-candidates post-hook (compose_waste_md heredoc untouched)
fi
```

**Behavior contract:**
1. Triggered only when DRY_RUN!=true (compose_waste_md heredoc respected).
2. Triggered only when NODE_BIN is executable AND WASTE.md was written
   AND the lib file exists (defensive triple-guard against stale checkouts).
3. Reads `$MUDA_MILESTONE` env var if set; passes via `--milestone` arg.
4. On node exit non-zero: emits stderr warning; never sets `exit` or
   modifies `$PROBE_EXIT` (audit's final exit code unchanged).
5. Atomic mutation of WASTE.md is the lib's responsibility (tmp + rename).
   This block is invocation-only; no in-shell file mutation.

**What NOT to change:**
- Do NOT modify `compose_waste_md` heredoc.
- Do NOT modify the atomic mv at line 287.
- Do NOT modify the metrics log block at line 481+.
- Do NOT modify the curate_finding loop at line 290-356.
- Do NOT modify the codex_qualitative_waste block at line 358-479.
- Do NOT introduce any new shell variable that escapes this block's scope.
- Do NOT call `exit` or `set -e` constructs that could abort the audit.
  </action>
  <verify>
    <automated>grep -q "muda-deletion-candidates" super-gsd/scripts/sgsd-muda-audit.sh && echo "PASS MUDA-04" || (echo "FAIL MUDA-04" && exit 1)</automated>
    Also verify post-hook does not block: `bash super-gsd/scripts/sgsd-muda-audit.sh --help` (or any non-destructive flag) exits cleanly.
  </verify>
  <done>
- `grep -q "muda-deletion-candidates" super-gsd/scripts/sgsd-muda-audit.sh` matches.
- The block sits between the codex-qualitative-waste closing `fi` (line 479) and the `# Log to metrics` comment (now line ~506).
- DRY_RUN guard present: `grep -q "DRY_RUN.*true.*NODE_BIN.*WASTE_FILE.*MDC_LIB" super-gsd/scripts/sgsd-muda-audit.sh` succeeds (allowing for shell quoting variants).
- The original line 287 atomic mv (`mv "$tmp" "$WASTE_FILE"`) is untouched.
- The original codex_qualitative_waste block at line 358-479 is untouched (diff inspection confirms zero deletions in that range).
- Post-hook never `exit`s; only `:` and stderr `echo`.
  </done>
</task>

<task type="auto">
  <name>T1.A3: Create local-fallback test file (~90 LOC, 3 fixtures)</name>
  <files>super-gsd/scripts/lib/muda-deletion-candidates.test.cjs</files>
  <action>
Create `super-gsd/scripts/lib/muda-deletion-candidates.test.cjs` --
deterministic local-fallback exercising the SAME `appendToWasteFile`
+ `findCandidates` + `findLowValueCandidates` + `findRecurringCandidates`
+ `findSkipDriftCandidates` + `renderMarkdown` exports the
sgsd-muda-audit.sh post-hook calls (no provider faking; lib reads
filesystem-only). 3 fixtures.

**File structure:**

1. **Header comment**: cite Phase 37 RESEARCH §10 (Live-or-Local Fallback).
   This test is the "local" path; the post-hook in sgsd-muda-audit.sh is
   the "live" path. Same exported helpers; same code path.

2. **Imports**:
   ```javascript
   const fs   = require('fs');
   const path = require('path');
   const os   = require('os');
   const lib       = require('./muda-deletion-candidates.cjs');
   const gateValueLog = require('./gate-value-log.cjs');
   const critBacklog  = require('./crit-backlog.cjs');
   ```

3. **Test scaffold** -- 3 fixtures, each in isolated tmpdir:

   **Fixture 1: low_value heuristic fires**
   - Create `tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mdc-test-lv-'))`.
   - Create `metrics/` subdir.
   - Append 6 rows via `gateValueLog.logGateValue(tmp, ...)` for gate `g_lo`: 1 pass + 5 block (fires=6, value_score = max(0, (1+0-5)/6) = 0).
   - Write synthetic WASTE.md at `path.join(tmp, 'WASTE.md')` containing some preamble (e.g. `# Phase 99 WASTE\n\n## Probe Results\n\n(empty)\n\n`).
   - Call `lib.appendToWasteFile(tmp, path.join(tmp, 'WASTE.md'), { milestone: 'v1.8' })`.
   - Read file; assert contains `## Deletion Candidates`.
   - Assert contains `low_value_gate`, `g_lo`, `medium`, and `value_score=0.000`.
   - Assert preamble preserved (`# Phase 99 WASTE` still present at top).
   - Cleanup tmpdir.

   **Fixture 2: recurring heuristic across 2 milestones**
   - Fresh tmpdir `mdc-test-rec-`.
   - Append 2 crit-backlog rows via `critBacklog.appendRow(tmp, ...)`:
     - Row 1: `{ kind: 'verifier_fail', milestone: 'v1.5', summary: 'Codex review missing; fallback used', missing_evidence: 'codex output', suspected_cause: 'codex review missing', confidence: 'high', clearance_requires: 'codex run' }`.
     - Row 2: same shape with `milestone: 'v1.7'`.
     - Use the v1 schema 4-field set (missing_evidence + suspected_cause + confidence + clearance_requires) to satisfy crit-backlog v1 guard. Use suspected_cause `'codex review missing'` (NOT `'codex unavailable'` which would trigger the codex-unavailable guard requiring provider_health_check).
   - Write synthetic WASTE.md.
   - Call `lib.appendToWasteFile(tmp, path.join(tmp, 'WASTE.md'))` (no milestone filter -- recurring spans milestones).
   - Read file; assert contains `## Deletion Candidates`, `recurring_backlog`, `verifier_fail: codex review missing`, `low` (risk).
   - Assert evidence cell references both `v1.5` AND `v1.7`.
   - Cleanup tmpdir.

   **Fixture 3: skip_drift + idempotent re-run + cold-start defer**
   Three sub-asserts in one tmpdir:
   - Fresh tmpdir `mdc-test-sd-`.
   - **Sub-assert 3a (cold-start)**: write empty WASTE.md preamble. Call `appendToWasteFile`; assert file contains `_No deletion candidates surfaced` (defer-on-empty preserved).
   - **Sub-assert 3b (skip_drift fires + idempotent)**: append 1 fire (pass) + 9 skips for gate `g_dr` via `gateValueLog.logGateValue` (total_obs=10, fire_rate=0.1, below 0.2 threshold). Call `appendToWasteFile` -> read file; capture content into `firstRun`. Call `appendToWasteFile` again with same data -> read file; assert content === firstRun (byte-identical idempotent re-run).
   - **Sub-assert 3c (replacement on data change)**: append 5 more pass rows for gate `g_dr` (now total_obs=15, fires=6, fire_rate=6/15=0.4, above 0.2 threshold; skip_drift no longer fires). Call `appendToWasteFile` -> assert file content !== firstRun (section was replaced, not duplicated). Assert exactly ONE `## Deletion Candidates` heading in the file (`(content.match(/## Deletion Candidates/g) || []).length === 1`).
   - Cleanup tmpdir.

4. **Reporter**:
   ```javascript
   let pass = 0, fail = 0;
   const failures = [];
   function check(name, cond, detail) {
     if (cond) { pass++; }
     else { fail++; failures.push({ name, detail: detail || '' }); }
   }
   // ... fixtures ...
   console.log(`muda-deletion-candidates local-fallback test: ${pass} pass, ${fail} fail`);
   if (fail > 0) {
     for (const f of failures) console.error(`  FAIL: ${f.name}${f.detail ? ' -- ' + f.detail : ''}`);
     process.exit(1);
   }
   process.exit(0);
   ```

5. **Total assertion count**: target 8-10 distinct `check()` calls across
   3 fixtures (matches Phase 36's local-fallback density). Sub-asserts
   inside fixtures count individually.

6. **No mocks. No provider faking. No external network.** Lib reads
   filesystem-only; test asserts filesystem state.
  </action>
  <verify>
    <automated>node super-gsd/scripts/lib/muda-deletion-candidates.test.cjs</automated>
    Expected: exit code 0; stdout contains "X pass, 0 fail" with X >= 8.
  </verify>
  <done>
- File exists at `super-gsd/scripts/lib/muda-deletion-candidates.test.cjs` (~90 LOC).
- All 3 fixtures PASS.
- No external network calls; no mocks; uses production lib via require().
- tmpdir-isolated; test cleanup leaves no debris in `/tmp` or `os.tmpdir()`.
- Canonical `.planning/metrics/gate-value-log.jsonl` + `crit-backlog.jsonl` mtimes unchanged after test runs (filesystem fingerprint preserved).
  </done>
</task>

</tasks>

<known_dead_ends>
The following are explicitly OUT OF SCOPE for Phase 37 (locked 37=A
mass-discuss:212; reinforced by 37-RESEARCH.md §11 Q1-Q15):

1. **Do NOT modify `super-gsd/registry/command-envelope-v1.yaml`** or
   `super-gsd/templates/command-envelope-v1.json`. Phase 37 emits NO
   envelope-v1 JSONL rows (Q9 lock: markdown only). Phase 31 contract
   stays untouched; collides_with: [] still holds.

2. **Do NOT modify the 4 existing canonical contracts** (route-ledger,
   review-ledger, gate-value-log, repair-command-checker). Phase 37 only
   READS gate-value-log + crit-backlog; never writes.

3. **Do NOT introduce new dependencies.** Node built-ins only (fs, path,
   os). No npm packages. No new vendored libs. (Phase 37 has zero YAML
   parsing needs; gate-value-log + crit-backlog already shipped without
   js-yaml.)

4. **Do NOT add semantic / graph-walk / NLP heuristics.** 37=A locks
   3 mechanical heuristics (low_value, recurring, skip_drift). Semantic
   deletion-candidates are deferred to v1.9+.

5. **Do NOT make the post-hook block the audit.** Locked never-block
   invariant (mass-discuss:212; CONTEXT.md kill-condition).
   Post-hook stderr-only on failure; main exit code unchanged.

6. **Do NOT delete or overwrite WASTE.md content.** Only APPEND or
   REPLACE the `## Deletion Candidates` section. Preceding sections
   (probe-results table, codex_qualitative_waste row, etc.) are
   immutable from the lib's perspective.

7. **Do NOT auto-disable any gate or backlog row.** 37=A explicit:
   deletion candidates are SUGGESTIONS; operator (or Phase 39 rubric)
   chooses to act. The lib emits; never executes.

8. **Do NOT persist a candidate-history JSONL ledger.** Q1 + Q13 lock:
   computed-on-demand. Re-computation is microseconds. New retention
   policy + clearance contract not justified.

9. **Do NOT surface candidate count in cockpit / mission-strip.** Q12
   lock: Phase 38+ concern. Phase 39 rubric is the consumer.

10. **Do NOT add a Phase 39 rubric reader.** That's Phase 39's plan
    (RUBRIC-01..04). Phase 37 only ships the writer + post-hook + test.

11. **Do NOT use process.cwd()-relative paths in --self-test.** Phase 32
    W3 lesson locked: anchor to `__dirname`. Self-test must work from
    any CWD.
</known_dead_ends>

<verification>
**Runnable acceptance gates (per CONTEXT acceptance section):**

```bash
# MUDA-01 + MUDA-02 + MUDA-03 acceptance:
node super-gsd/scripts/lib/muda-deletion-candidates.cjs --self-test
# Expected: exit 0; stdout "X pass, 0 fail" with X >= 14.

# MUDA-02 KINDS enum check:
node -e "const m=require('./super-gsd/scripts/lib/muda-deletion-candidates.cjs');
  if (m.CANDIDATE_KINDS.length !== 3) process.exit(1);
  if (!m.CANDIDATE_KINDS.includes('low_value_gate')) process.exit(1);
  if (!m.CANDIDATE_KINDS.includes('recurring_backlog')) process.exit(1);
  if (!m.CANDIDATE_KINDS.includes('skip_drift_gate')) process.exit(1);
  if (!Object.isFrozen(m.CANDIDATE_KINDS)) process.exit(1);
  console.log('PASS MUDA-02');"
# Expected: stdout "PASS MUDA-02"; exit 0.

# MUDA-04 wire-in check:
grep -q "muda-deletion-candidates" super-gsd/scripts/sgsd-muda-audit.sh \
  && echo "PASS MUDA-04" \
  || (echo "FAIL MUDA-04" && exit 1)
# Expected: stdout "PASS MUDA-04".

# Local fallback test (3 fixtures):
node super-gsd/scripts/lib/muda-deletion-candidates.test.cjs
# Expected: exit 0; stdout contains "X pass, 0 fail" with X >= 8.

# Fingerprint guard (canonical ledgers unchanged):
# Capture mtime BEFORE running self-test; verify unchanged AFTER.
# (Asserted internally as assertion #14 + bonus fingerprint guard at end of selfTest.)

# DRY_RUN respect:
# (Manual: `bash super-gsd/scripts/sgsd-muda-audit.sh --dry-run <phase>` should NOT mutate any WASTE.md.)
```

**Anti-slop validation (10-point checklist per project CLAUDE.md):**

1. Every new function has a caller: 6 public APIs called from selfTest +
   --apply CLI + 3 sub-finders called from findCandidates AND from
   selfTest.
2. Every import used: fs, path, os, gateValueLog, critBacklog -- all
   referenced.
3. Every parameter read: `opts` extensively destructured for thresholds,
   rollbacks, milestone filter, kinds subset.
4. Could this be less code? 3 sub-finders + 1 composer + renderer +
   appender = minimum to satisfy MUDA-01..04. No further compression.
5. New abstractions justified? frozen const enums = guard against typos
   in caller. _normalize = single validation site.
6. Existing code does 80%? `gateValueLog.summarize` + `critBacklog.unresolvedRows`
   reused; this lib only ADDS heuristic filtering + markdown rendering +
   atomic file mutation.
7. Senior engineer mass-delete? No: every line satisfies a MUDA-NN req
   or a locked Q1-Q15 contract.
8. ΔComplexity <= 0? lib is +370 LOC; no reduction in callers; net
   positive but justified by 4 explicit requirements + locked 37=A.
9. "Just in case" additions? None. `opts.kinds` subset is documented in
   RESEARCH §4.1 (Phase 39 rubric pre-filter).
10. ONE thing? Yes: deletion-candidate WASTE.md section.
</verification>

<success_criteria>
**T1 (single composite task) is complete when ALL of the following hold:**

- [ ] `super-gsd/scripts/lib/muda-deletion-candidates.cjs` exists at ~370 LOC.
- [ ] `super-gsd/scripts/lib/muda-deletion-candidates.cjs --self-test` exits 0 with 14+ assertions PASS.
- [ ] All 6 public APIs (findCandidates, findLowValueCandidates, findRecurringCandidates, findSkipDriftCandidates, renderMarkdown, appendToWasteFile) wrap in try/catch and never throw upward.
- [ ] All 4 frozen constants exported (CANDIDATE_KINDS, RISK_LEVELS, DEFAULT_THRESHOLDS, DEFAULT_ROLLBACKS) and `Object.isFrozen` returns true on each.
- [ ] CANDIDATE_KINDS exactly equals `['low_value_gate', 'recurring_backlog', 'skip_drift_gate']` in that order.
- [ ] Each candidate row has 5 required fields (kind, target, evidence, risk, rollback) per MUDA-03.
- [ ] `super-gsd/scripts/sgsd-muda-audit.sh` contains a 25-line post-hook block between line 480 and line 481 (line numbers shift +25 after edit).
- [ ] Post-hook is DRY_RUN-guarded; failure logs to stderr but never blocks the audit.
- [ ] Original line 287 atomic mv + qualitative-codex block (358-479) + metrics log (481+) all UNTOUCHED.
- [ ] `super-gsd/scripts/lib/muda-deletion-candidates.test.cjs` exists at ~90 LOC; 3 fixtures (low_value, recurring, skip_drift+idempotent+cold-start) all PASS.
- [ ] `node super-gsd/scripts/lib/muda-deletion-candidates.test.cjs` exits 0.
- [ ] `grep -q "muda-deletion-candidates" super-gsd/scripts/sgsd-muda-audit.sh` returns 0 (MUDA-04 evidence).
- [ ] Canonical `.planning/metrics/gate-value-log.jsonl` + `.planning/metrics/crit-backlog.jsonl` mtimes + sizes unchanged after self-test + fallback-test runs (fingerprint guard).
- [ ] All output ASCII-only (no smart quotes, no em dashes; "--" not "—").
- [ ] No new dependencies added (Node built-ins only).
- [ ] `appendToWasteFile` idempotent: two consecutive calls produce byte-identical files.
- [ ] `appendToWasteFile` replaces (does NOT duplicate) the section on data-change re-run.

**Phase-level acceptance:** all 4 MUDA-NN requirements green; 3 atomic
commits land cleanly; per-dispatch ATC + phase-level ATC pass without
CRIT findings.
</success_criteria>

<commit_plan>
**3 atomic commits (in order):**

C1 (T1.A1): create lib + 14-assertion self-test
```
git add super-gsd/scripts/lib/muda-deletion-candidates.cjs
git commit -m "feat(37-01): muda-deletion-candidates.cjs lib + 14-assertion self-test"
```
- Files: `super-gsd/scripts/lib/muda-deletion-candidates.cjs` (NEW ~370 LOC).
- Verification before commit: `node super-gsd/scripts/lib/muda-deletion-candidates.cjs --self-test` exits 0.
- Approx +370 / -0.

C2 (T1.A2): wire post-hook into sgsd-muda-audit.sh
```
git add super-gsd/scripts/sgsd-muda-audit.sh
git commit -m "feat(37-01): wire post-hook into sgsd-muda-audit.sh after WASTE.md write"
```
- Files: `super-gsd/scripts/sgsd-muda-audit.sh` (modified, +25 LOC at line ~480).
- Verification before commit: `grep -q "muda-deletion-candidates" super-gsd/scripts/sgsd-muda-audit.sh` returns 0.
- Approx +25 / -2.

C3 (T1.A3): local-fallback test
```
git add super-gsd/scripts/lib/muda-deletion-candidates.test.cjs
git commit -m "test(37-01): deterministic local fallback for muda-deletion-candidates (3 fixtures)"
```
- Files: `super-gsd/scripts/lib/muda-deletion-candidates.test.cjs` (NEW ~90 LOC).
- Verification before commit: `node super-gsd/scripts/lib/muda-deletion-candidates.test.cjs` exits 0.
- Approx +90 / -0.

**Total**: 3 commits, 2 created + 1 edited, net +485 / -2.

**Why this order**: C1 must precede C2 (the post-hook in sgsd-muda-audit.sh
invokes the lib via `node "$NODE_BIN" "$MDC_LIB" --apply ...`; the lib
must exist on disk before the wire-in is committed). C3 follows because
the local-fallback test exercises C1's lib directly (require() import);
deferring C3 keeps each commit independently runnable but C3's tests
only pass after C1 is in place.

**Never use --no-verify, --amend, --no-edit, --rebase -i, or git add -A.**
**Stage by exact filename only.** ATC log auto-classifies each commit on
landing; mission-control dashboard refreshes within 10s.
</commit_plan>

<live_or_local_fallback>
**Live path** (production, automatic):
- Next phase-close `bash super-gsd/scripts/sgsd-muda-audit.sh <phase>`
  invocation triggers the post-hook.
- Reads gate-value-log.jsonl + crit-backlog.jsonl populated by the
  running roadmap autopilot.
- Appends `## Deletion Candidates` section to that phase's WASTE.md.
- Production proof = grep on the new WASTE.md confirms section present.

**Local path** (manual / CI, deterministic):
- `node super-gsd/scripts/lib/muda-deletion-candidates.test.cjs`
- Exercises the SAME `appendToWasteFile` + `findCandidates` exports the
  post-hook calls.
- 3 fixtures cover: low_value-fires + recurring-2-milestones +
  skip_drift+idempotent+cold-start.
- No provider faking required (lib reads filesystem-only; no Codex /
  Claude / external API calls in this phase).

**Provider-unavailable handling**: not applicable. Phase 37 has zero
external providers. Lib reads filesystem-only.

**Edge-guard structural emit**: the WASTE.md mutation IS the structural
emit. Edge-guard checks: (a) WASTE.md exists after sgsd-muda-audit
exits; (b) WASTE.md contains `## Deletion Candidates` heading. Both
grep-checkable. Both already covered by self-test #14 + local-fallback
fixture 1.
</live_or_local_fallback>

<schema_without_consumer_satisfaction>
Per RESEARCH §6, the schema-without-consumer rule is satisfied by 2
in-phase consumers + 2 deferred consumers:

| # | Consumer | When | Status |
|---|----------|------|--------|
| 1 | `sgsd-muda-audit.sh` post-hook | Every phase-close (live) | SHIPS in Phase 37 (T1.A2) |
| 2 | `--self-test` mode (lib CLI) | Manual / CI | SHIPS in Phase 37 (T1.A1) |
| 3 | Phase 39 rubric (RUBRIC-01) | Milestone close | DEFERRED to Phase 39 |
| 4 | Cockpit deletion-count surface | Mission Strip refresh | DEFERRED to v2.0+ ops |

In-phase consumers (#1 + #2) suffice. Phase 39 plan should consume the
6 public APIs via require() to feed its keep/kill rubric.

**No new ledger.** Computed-on-demand (Q1 + Q13 lock). Re-computation is
microseconds; ledger persistence cost outweighs benefit.

**Cold-start**: empty ledgers -> `findCandidates` returns `[]` ->
`renderMarkdown([])` emits the defer-on-empty placeholder. Phase 39
rubric defer-on-empty handles empty candidate list identically to
empty value-log.
</schema_without_consumer_satisfaction>

<output>
After T1 completes (3 atomic commits land), create
`.planning/milestones/v1.8/phases/37-muda-deletion-candidates/37-01-SUMMARY.md`
with the standard schema:

- frontmatter: plan_id, phase, status: COMPLETE, completed timestamp
- one_liner: "muda-deletion-candidates: 3-heuristic deletion finder + WASTE.md post-hook + 14-assertion self-test + 3-fixture local fallback (MUDA-01..04 green)"
- files_changed: 2 created + 1 edited (paths + line counts)
- verification_evidence: --self-test exit 0, --test exit 0, grep MUDA-04 hit
- deviations: none expected; document any if found
- followups_for_phase_38_39: opts.kinds subset filter is the API Phase 39
  rubric should call; deletion-candidate count surface is Phase 38+ ops
- atc_tier: FULL
</output>
