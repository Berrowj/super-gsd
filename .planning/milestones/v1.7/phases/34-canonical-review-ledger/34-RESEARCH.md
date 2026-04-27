---
phase: 34
name: Canonical Review Ledger
milestone: v1.7
status: research_complete
researched: 2026-04-27
confidence: HIGH
controlling_principle: "Autonomy continues; evidence tells the truth."
---

# Phase 34: Canonical Review Ledger - Research

## Summary

Phase 34 ships the aggregator + real-time writer consolidating per-phase
`commit-reviews.jsonl` files into canonical `.planning/metrics/review-ledger.jsonl`.
Closes the v1.5 milestone-close empty-baseline gap (per
`.planning/milestones/v1.5/evidence/codex-kill-check.md:11-22`): kill-check ran
on `claudeReviews=0` and treated the delta as signal when it was an artifact.
Two halves: (a) only Phase 21 wrote rows to per-phase JSONL; 22-25 wrote to
`codex-log.jsonl`; (b) formula consumed an unaggregated, fragmented view.

Locked design (mass-discuss line 209, `34=C`): aggregator backfills
v1.2/v1.4/v1.5/v1.6 historic data; real-time writer captures forward at every
per-dispatch + phase-level ATC fire.

Template: `super-gsd/scripts/lib/route-ledger.cjs` (lines 174-208) -- atomic
`appendFileSync`, defensive `readRows`, public API never throws upward,
fingerprint-anchored self-test via `__dirname`. Phase 34 difference: route
ledger emits envelope-v1 directly; review ledger preserves **legacy row
content verbatim** and **wraps** with envelope-v1 metadata +
`_source_phase`, `_source_milestone` extension fields. Satisfies
envelope-v1.yaml:55-61 (atc-review first_wave: "envelope wrap is the bridge
layer; preserves code-reviewer-v1 inside evidence").

**Primary recommendation:** Single plan, ~600-line lib + 2 SKILL.md wire-ins
+ cockpit reads + self-test + local-fallback test. 4 created, 3 edited.
~+1,120 / -0.

## Architectural Responsibility Map

| Capability | Primary Tier | Rationale |
|-----------|--------------|-----------|
| Append row to canonical | scripts/lib (cjs) | Atomic writer mirroring route-ledger.cjs |
| Aggregate per-phase -> canonical | scripts/lib (cjs) | Read existing per-phase files |
| `--kill-check` | CLI on lib | Lib exposes; status-consistency / milestone-close call |
| Wire-in per-dispatch ATC | SKILL.md:1248 | Existing append site |
| Wire-in phase-level ATC | SKILL.md:760 | Existing append site |
| Mission Strip read | sgsd-mission-strip.ps1 | Currently does NOT read review JSONL |
| Mission Control read | sgsd-mission-control.ps1:1538 | Currently globs per-phase; switch to canonical |

## User Constraints (from ROADMAP-AGENT.md + mass-discuss)

### Locked Decisions

- **34=C**: aggregator + real-time writer (mass-discuss line 209).
- Real-time writer wired into `codex-exec.sh` + Claude reviewer (LEDGER-02).
  **Reinterpretation (Q4 below):** orchestrator (`sgsd-orchestrate/SKILL.md`)
  writes per-phase row at existing append sites; Codex + Claude paths converge
  there. One wire-in covers both providers.
- `--kill-check` returns `baseline_ok` when non-empty; `empty_baseline`
  otherwise (LEDGER-03).
- Mission Strip + dashboard read canonical (LEDGER-04).
- Schema-without-consumer rule satisfied: 5 production callers (Section 7).
- Live-or-local fallback (Patch 4).
- Public API never throws upward (per route-ledger.cjs LOCKED 32-RESEARCH 9.3).
- ASCII-only outputs (PS 5.1 mojibake guard).

### Claude's Discretion

Aggregator strategy, dedup tuple, `--kill-check` scope, tee-vs-replace -- all
locked Section 11.

### Deferred Ideas (OUT OF SCOPE)

- Rendered .md view (defer v1.8+, mirrors Phase 32).
- ASCII histogram / sparkline (v1.8+).
- Auto-deletion of per-phase commit-reviews files (audit trail preserved).
- Cross-milestone aggregation in `--kill-check` (`--all-milestones` deferred).
- Milestone-close kill-formula reform (data plumbing only here).

## Phase Requirements

| ID | Description | Section |
|----|-------------|---------|
| LEDGER-01 | Aggregator over per-phase commit-reviews.jsonl -> canonical | 2 |
| LEDGER-02 | Real-time writer wired into codex-exec.sh + Claude reviewer | 3 |
| LEDGER-03 | `--kill-check` flag returns baseline_ok / empty_baseline | 4 |
| LEDGER-04 | Mission Strip + dashboard read canonical | 6 |

---

## 1. Per-Phase Writer Inventory

**Existing per-phase commit-reviews.jsonl files** (verified via `find`, 11 files):

```
.planning/milestones/v1.2/phases/11-plan-schema-v2/commit-reviews.jsonl
.planning/milestones/v1.4/phases/{17-debt-sweep,18-codex-hardening,
                                   19-mc-visibility,20-autonomous-handoff}/commit-reviews.jsonl
.planning/milestones/v1.5/phases/21-vtp-enrichment-gates/commit-reviews.jsonl
.planning/milestones/v1.6/phases/{26-cockpit-question-contract,27-cockpit-data-tree,
                                   28-mission-control-layout,29-agent-codex-lanes,
                                   30-startup-cockpit-acceptance}/commit-reviews.jsonl
```

Canonical glob: `.planning/milestones/*/phases/*/commit-reviews.jsonl`.

**Writer code paths today:**

| Site | Tier | Writer | Path |
|------|------|--------|------|
| `sgsd-orchestrate/SKILL.md:760` | phase-level ATC | orchestrator (Opus, Write tool); `appendReviewEvidence` is pseudocode | `.planning/milestones/{m}/phases/{NN}-*/commit-reviews.jsonl` |
| `sgsd-orchestrate/SKILL.md:1248` | per-dispatch ATC | orchestrator (same); `appendPerDispatchReviewEvidence` is pseudocode | same path |
| `super-gsd/tools/codex-rerun/rerun-missing-reviews.cjs:177-200` | post-hoc rerun | direct `fs.appendFileSync` | exact per-phase path |

**Critical clarification on LEDGER-02 wording:** REQUIREMENTS:42 says "wired
into codex-exec.sh + Claude reviewer". Reading the source:

- `codex-exec.sh:711-714` writes `REPORT_OUT` (parsed code-reviewer-v1 report)
  atomically. Does NOT write `commit-reviews.jsonl`.
- `codex-exec.sh:545-550` writes one row to `codex-log.jsonl` (provenance).
- `commit-reviews.jsonl` rows are written by orchestrator at SKILL.md:760
  + 1248, regardless of provider.

So "wired into codex-exec.sh + Claude reviewer" actually means: **wired into
orchestrator append sites that fire after both Codex shell and Claude agent
return**. One wire covers both providers (matches Phase 32's
SKILL.md:1236 pattern).

**Existing row shape** (verified via `head -5` of 30 + 21 phase files):

```json
{"ts":"2026-04-24T19:33:31.939Z","plan":"21-01","tier":"full",
 "verdict":"critical","critical":2,"warning":2,"pass_rate":"2/6",
 "one_liner":"Blocked: missing agent plus ctx, status, and path mismatches.",
 "provider":"openai-codex","model":"gpt-5.5","reasoning_effort":"xhigh",
 "duration_ms":252460,"timeout_escalated":true}
```

Required per SKILL.md:1246: `ts, plan, tier, verdict, critical, warning,
one_liner, provider, model, reasoning_effort`. Optional: `commit, pass_rate,
duration_ms, findings, fallback_reason, timeout_escalated, rerun, rerun_reason,
note, escalation`. Verdict vocab: `pass | warn | critical | critical-halt |
block | skipped`. Tier vocab: `full | gate | phase-level | per-dispatch`.
Both legacy (code-reviewer-v1 era); preserve verbatim in canonical.

---

## 2. Aggregator Design (LEDGER-01)

### 2.1 Operation

`aggregateFromPhases(planningDir, opts?)`:

1. Walk `${planningDir}/milestones/*/phases/*/commit-reviews.jsonl` via
   `fs.readdirSync` recursion (no `find` spawn; cross-platform).
2. Read text, split `\r?\n`, JSON.parse each non-empty line. **Defensive**:
   malformed -> null, skipped (mirror route-ledger.cjs:194).
3. Extract `_source_milestone`, `_source_phase` from path.
4. Compose canonical row per Section 3.2 (envelope-v1 wrapper).
5. Write to `${planningDir}/metrics/review-ledger.jsonl`.

### 2.2 Strategy: rebuild vs incremental

**LOCKED: rebuild every invocation.**

- Per-phase JSONLs are append-only; full source set always present.
- Idempotency: byte-identical output across runs.
- Incremental tail-reading needs per-source byte offsets, fragile to file
  rewrite. Rebuild has zero state.
- Cost: 11 files * ~5 rows = ~55 rows; microseconds.

Aggregator uses `fs.writeFileSync` (truncating); real-time writer always
appends. They never race: aggregator is manual/tool; real-time is synchronous
in orchestrator loop.

### 2.3 Dedup

When real-time has already written canonical rows AND aggregator runs again,
naive rebuild duplicates. **LOCKED tuple: `(ts, plan, tier, provider,
_source_phase)`.**

- `ts` ISO-8601 ms precision -- effectively unique per writer per ms.
- `plan` distinguishes per-task rows of same phase.
- `tier` distinguishes per-dispatch vs phase-level for same plan.
- `provider` distinguishes Codex vs Claude vs claude-via-fallback.
- `_source_phase` ties dedup to originating folder.

`Set` of keys; skip seen; preserve real-time-only rows. **Rejected**:
row-content hash -- brittle to non-semantic field-order changes.

### 2.4 Output ordering

**LOCKED: chronological by `ts` ASC.** Deterministic; matches Phase 35
deterministic-output principle. Easier tail consumption.

### 2.5 Path globbing

```javascript
function walkPerPhaseFiles(planningDir) {
  const out = [];
  const milestonesRoot = path.join(planningDir, 'milestones');
  if (!fs.existsSync(milestonesRoot)) return out;
  for (const m of fs.readdirSync(milestonesRoot)) {
    const phasesDir = path.join(milestonesRoot, m, 'phases');
    if (!fs.existsSync(phasesDir)) continue;
    for (const p of fs.readdirSync(phasesDir)) {
      const f = path.join(phasesDir, p, 'commit-reviews.jsonl');
      if (fs.existsSync(f) && fs.statSync(f).isFile()) {
        out.push({ path: f, milestone: m, phase: p });
      }
    }
  }
  return out;
}
```

---

## 3. Real-Time Writer (LEDGER-02)

### 3.1 Tee pattern

Write to TWO files: per-phase (audit trail) + canonical (new). Both atomic
appends in orchestrator's evidence-emission step (SKILL.md:760, 1248):

```
orchestrator review evidence emission
  +--> appendFileSync(per-phase commit-reviews.jsonl)    [existing]
  +--> appendReviewRow(planningDir, row)                  [new lib call]
            +--> appendFileSync(.planning/metrics/review-ledger.jsonl)
```

Failure isolation: lib wraps try/catch, stderr-warns on error, returns false.
Per-phase write unaffected. Mirrors route-ledger.cjs:198-208 LOCKED contract.

### 3.2 Envelope-v1 wrapper

Per envelope-v1.yaml:55-61 (atc-review first_wave): canonical row is
envelope-v1 shaped with legacy commit-reviews preserved verbatim under
`_legacy`.

```json
{
  "envelope_version": 1,
  "ts": "2026-04-27T11:32:01.123Z",
  "command": "appendReviewRow",
  "status": "warn",
  "reason_codes": ["atc_warn_only"],
  "artifacts": [{"kind":"review_report","path":".planning/.../21-01-ATC-REVIEW.md"}],
  "evidence": [],
  "next_action": null, "risk": null, "duration_ms": 252460,
  "run_id": "2026-04-27T11:32:01.123Z-a1b2",
  "phase": "21", "milestone": "v1.5",
  "_source_phase": "21-vtp-enrichment-gates",
  "_source_milestone": "v1.5",
  "_legacy": {
    "plan":"21-01","tier":"full","verdict":"critical","critical":2,"warning":2,
    "pass_rate":"2/6","one_liner":"...","provider":"openai-codex",
    "model":"gpt-5.5","reasoning_effort":"xhigh"
  }
}
```

**Status mapping** (frozen `LEGACY_VERDICT_MAP`):

| verdict | status | reason_codes |
|---------|--------|--------------|
| `pass` | `ok` | `[review_unanimous_pass]` |
| `warn` | `warn` | `[atc_warn_only]` |
| `critical` | `fail` | `[atc_critical]` |
| `critical-halt` | `blocked` | `[atc_critical]` |
| `block` | `blocked` | `[atc_critical]` |
| `skipped` | `skipped` | `[gate_skip_with_reason]` |
| (unknown) | `warn` | `[parse_failure]` |

`run_id` mirrors route-ledger.cjs:80-84; passes envelope-v1 RUN_ID_REGEX.

### 3.3 Wire-in targets

**Wire-in 1 (phase-level ATC) -- SKILL.md:760:**

```javascript
if (report) {
  // Existing per-phase write (preserved):
  appendReviewEvidence(report, {gate: 'phase-level-ATC', ...});
  // NEW canonical write:
  require(path.join(process.cwd(), 'super-gsd', 'scripts', 'lib', 'review-ledger.cjs'))
    .appendReviewRow(path.join(process.cwd(), '.planning'), {
      ts: new Date().toISOString(),
      plan: 'phase-level',
      tier: 'phase-level',
      verdict: report.verdict,
      critical: report.critical_count,
      warning: report.warning_count,
      one_liner: report.one_liner,
      provider: report._provider || effective.name,
      model: report._model,
      reasoning_effort: report._reasoning_effort,
      _source_phase: currentPhaseDir,
      _source_milestone: currentMilestone,
    });
}
```

**Wire-in 2 (per-dispatch ATC) -- SKILL.md:1248:** same shape; `tier ∈ {full,
gate}`; `plan` is actual plan ID. Both pseudocode-level edits to SKILL.md.
Real-time path exercises on next Codex/Claude review under either gate.

### 3.4 Atomic-append + failure contract

`fs.appendFileSync` atomic at row boundary on POSIX for sub-block writes;
Windows for sub-block <= 4KB. Each canonical row ~700-1500 bytes -- well under.
Same guarantee route-ledger.cjs:174-183 + crit-backlog.cjs rely on;
production-validated across 11 files.

`appendReviewRow` wraps every call try/catch -> stderr-warn -> false.
Internal `_normalize` + `_assertEnvelopeV1` throw on closed-enum violations;
public wrapper catches.

---

## 4. `--kill-check` Semantics (LEDGER-03)

### 4.1 CLI

```bash
node super-gsd/scripts/lib/review-ledger.cjs --kill-check [--milestone v1.7]
```

### 4.2 Behavior

1. Read canonical `.planning/metrics/review-ledger.jsonl` (defensive parse).
2. Filter by `--milestone <ID>` (active milestone if absent; resolved from
   STATE.md frontmatter `milestone:` key).
3. Count rows after filter.

| Count | Result | exit |
|-------|--------|------|
| `>= 1` | `{ok:true, reason:"baseline_ok", count:N, milestone:"<id>"}` | `0` |
| `0` | `{ok:false, reason:"empty_baseline", count:0, milestone:"<id>"}` | `2` |

Exit `2` is **not a Phase 34 failure** -- it is a TRUE FINDING about state.
v1.5 closed with exit-2 semantically; we lacked the flag. After Phase 34
backfill, `--kill-check --milestone v1.5` flips to exit 0.

Exit `1` reserved for errors (canonical unreadable, malformed beyond defensive
recovery, STATE.md missing milestone frontmatter).

Output: single-line JSON to stdout. stderr for warnings.

### 4.3 Default scope

**LOCKED: active milestone from STATE.md frontmatter.** "Closes v1.5
empty-baseline gap" = milestone-scoped formula. All-milestones is
observability-only; `--all-milestones` deferred.

### 4.4 Public API

```javascript
function killCheck(planningDir, opts = {}) {
  // opts.milestone resolves from STATE.md if absent
  // returns: {ok, reason, count, milestone}
  // never throws upward
}
```

Used by: `--kill-check` CLI; (forward) status-consistency/check.cjs;
(forward) sgsd-complete-milestone. Forward consumer wires deferred to v1.8+
if those skills need edits.

---

## 5. v1.5 Empty-Baseline Gap Analysis

### 5.1 What v1.5 tried

CODEX-12 formula (`v1.5/evidence/codex-kill-check.md`):
`critical_count_delta = codexCrits - claudeCrits` to gate Codex retirement
at v1.5 close. If `delta < threshold` (5), Codex retires.

### 5.2 Why it failed

Two-fold gap (`v1.5/evidence/codex-kill-check.md:21-29`):

1. **Empty baseline.** `claudeReviews=0` -- v1.5 ran Codex-only; delta of 4
   was an artifact comparing Codex against an empty set.
2. **Incomplete capture.** Only Phase 21 wrote to its `commit-reviews.jsonl`.
   22-25 ran Codex (Phase 22: 7 rounds CRIT->PASS) but rows landed in
   `codex-log.jsonl` / monitor outputs.

### 5.3 Current symptom

Milestone close passes when no reviews ran -- formula returns DEVIATION/RETIRE
on insufficient data instead of "skip kill" on no data. Cannot distinguish
"0 reviews because nothing reviewed" from "0 reviews because all passed
clean with critical=0". v1.5 honored the deviation manually (operator override).

### 5.4 What Phase 34 fixes

- LEDGER-01: aggregator backfills v1.2/v1.4/v1.5/v1.6 historic per-phase rows.
- LEDGER-02: real-time tee at orchestrator wire-in closes "Phases 22-25
  didn't write" half forward.
- LEDGER-03: explicit `empty_baseline` signal replaces implicit-formula
  assumption. Future formulas check first; if empty_baseline, skip.

### 5.5 What Phase 34 does NOT fix

- Kill-formula itself (still needs non-empty Claude baseline; v1.5 SUMMARY
  action item carried forward, not in scope).
- Threshold value (5). Tuning is v1.8+ (Phase 36 gate-value-telemetry).

---

## 6. Mission Strip + Dashboard Read Paths (LEDGER-04)

### 6.1 Current Mission Control read

`super-gsd/scripts/sgsd-mission-control.ps1:1538`:

```powershell
$gateFile = Get-ChildItem -Path $phasesRoot -Filter "commit-reviews.jsonl" -Recurse
            -ErrorAction SilentlyContinue |
            Sort-Object LastWriteTime -Descending | Select-Object -First 1
if ($gateFile) {
    $gateLine = Get-Content $gateFile.FullName -Tail 1
    $g = $gateLine | ConvertFrom-Json
    $lastGate = $g.verdict
    $gateColor = switch ($lastGate) { "pass" {"Green"} "warn" {"Yellow"} default {"Red"} }
}
```

Two bugs: (1) cross-milestone bleed -- if v1.5/phase-21 file is freshest by
mtime, MC shows v1.5 data while we work on v1.7; (2) no aggregator awareness
-- literal latest from freshest per-phase file, never reflects rollup ordering.

### 6.2 Current Mission Strip read

`super-gsd/scripts/lib/sgsd-mission-strip.ps1` -- NO references to
commit-reviews / verdicts. Reads STATE.md, codex-live.json, crit-backlog.jsonl,
heartbeat.jsonl. Does not surface review counts -- LEDGER-04 adds.

### 6.3 Proposed change

**Mission Control (mission-control.ps1:1535-1548):** replace `Get-ChildItem
-Recurse` glob with canonical tail-read filtered by active milestone.
Tail-1 -> `lastGate`. **Fallback**: canonical missing -> existing per-phase
glob (forward-compatible).

**Mission Strip:** add ONE line "reviews P/W/F: <p>/<w>/<f>" from canonical
filtered by active milestone. Tail-100; histogram by status (or
`_legacy.verdict`). Canonical missing -> "--/--/--" (graceful degrade per
Phase 28). Slot is planner-discretion within Phase 28's locked 6-line strip.

### 6.4 Read contract

Canonical `status` is envelope-v1 (`ok|warn|fail|skipped|timeout|blocked`).
Mission Strip already knows vocab via Phase 31 `mission_strip_read_contract`
(envelope-v1.yaml:232-253); status->pane mapping at 244-251.

Consumers wanting legacy verdict: row preserves under `_legacy.verdict`.
MC's existing color switch keeps working with one new line:

```powershell
$lastGate = if ($g._legacy.verdict) { $g._legacy.verdict } else { $g.status }
```

### 6.5 Backward compatibility

Per-phase commit-reviews files NOT touched. Direct readers
(codex-rerun/rerun-missing-reviews.cjs, audit scripts, manual `tail -f`)
keep working.

---

## 7. Schema-Without-Consumer Rule

Per ROADMAP-AGENT.md (EXISTING-SURFACE-AUDIT.md:67-73): "Phases that
introduce a new contract/log/lib MUST include >=1 production caller as part
of phase's acceptance, NOT 'deferred to next phase'."

Phase 34 satisfies with **five** production consumers:

| # | Consumer | Lib call | R/W |
|---|----------|----------|-----|
| 1 | aggregator (`aggregateFromPhases`) | reads per-phase, writes canonical | both |
| 2 | `--kill-check` CLI | `killCheck` | read |
| 3 | SKILL.md:760 (phase-level tee) | `appendReviewRow` | write |
| 4 | SKILL.md:1248 (per-dispatch tee) | `appendReviewRow` | write |
| 5 | mission-control.ps1:1538 (dashboard) | reads canonical | read |

Optional sixth: mission-strip.ps1 P/W/F line (LEDGER-04). Self-test is
structural but doesn't count. Five callers exceeds rule's "1 minimum" by 5x
(Phase 32: 1; Phase 33: 2).

---

## 8. Live-or-Local Fallback (Patch 4)

Mass-discuss Patch 4: deterministic local-fallback exercising the PRODUCTION
CALLER PATH. Mock predicates that bypass production caller forbidden.

### 8.1 Live path

Orchestrator dispatches Codex/Claude review; wire-in at SKILL.md:760/1248
fires; `appendReviewRow` invoked with real review data.

### 8.2 Local path

When live unavailable: `super-gsd/scripts/lib/review-ledger.test.cjs` imports
SAME public helper, exercises with synthetic production-shaped fixtures.
Mirrors route-ledger.test.cjs:21-77. Test does NOT mock `appendReviewRow` --
CALLS it. Only upstream review-row payload is faked.

### 8.3 Aggregator as third path

Even with NO live + NO local-test runs: `node review-ledger.cjs --aggregate`
populates canonical from existing per-phase files. The "cold backfill" used
at Phase 34 ship time.

All three paths use same helpers: real-time = `appendReviewRow`; aggregator
= `appendReviewRow` in loop after dedup; kill-check = `readReviewRows`.

### 8.4 Verifiable acceptance (ROADMAP-AGENT.md:347-353)

- [x] `--aggregate` produces >=1 row -- 11 source files; pessimistic >=10 rows.
- [x] `--kill-check` returns `baseline_ok` (exit 0) -- post-backfill trivial.
- [x] Live-or-local fixture invokes `appendReviewRow` through same code path
      orchestrator uses; mock predicates forbidden.

---

## 9. Self-Test Scaffold (15 Assertions)

Mirrors route-ledger.cjs:286-420 (12) + repair-command-checker.cjs:301-432
(14 + fingerprint).

### 9.1 Fingerprint guard (anchored to __dirname)

```javascript
// Lib at <repo>/super-gsd/scripts/lib/review-ledger.cjs.
// Canonical at <repo>/.planning/metrics/review-ledger.jsonl (3 dirs up).
const realLedger = path.resolve(
  __dirname, '..', '..', '..', '.planning', 'metrics', 'review-ledger.jsonl');
```

Capture mtime + size + existence BEFORE writes; assert unchanged AFTER.
MUST be `__dirname` (self-test invokable from any dir).

### 9.2 Assertions

1. Frozen exports: `LEGACY_VERDICT_MAP`, `STATUSES`, `COMMAND_NAME`,
   `ENVELOPE_VERSION === 1`.
2. Empty read: `readReviewRows(tmp)` -> `[]`.
3. Single append: `appendReviewRow(tmp, {verdict:'warn',...})` -> envelope row
   with `status:'warn'`.
4. Verdict mapping: 6 legacy verdicts map per Section 3.2.
5. Invalid verdict tolerance: `verdict:'banana'` -> `status:'warn',
   reason_codes:['parse_failure']`. Never throws upward.
6. Missing required fields: `appendReviewRow(tmp, {})` -> `false` + stderr.
   Never throws upward.
7. `_legacy` preservation: original fields verbatim under `_legacy`.
8. Source tagging: row includes `_source_phase`/`_source_milestone`.
9. RUN_ID_REGEX compliance: emitted `run_id` matches envelope-v1.json:78.
10. Defensive read: malformed mid-file line skipped; surrounding readable.
11. Aggregator deterministic: 3 per-phase files (5/3/2 rows) -> canonical
    with 10 rows chronological.
12. Aggregator dedup: pre-populated overlap; re-aggregate; no duplicates by
    tuple `(ts, plan, tier, provider, _source_phase)`.
13. Aggregator idempotent: two runs -> byte-identical canonical.
14. `killCheck` empty: `{ok:false, reason:'empty_baseline', count:0}`.
15. `killCheck` non-empty: 3 rows v1.7 -> `{ok:true, reason:'baseline_ok',
    count:3, milestone:'v1.7'}`.

### 9.3 Tmpdir + cleanup

`fs.mkdtempSync(path.join(os.tmpdir(), 'rl-'))`; `fs.rmSync(tmp,{recursive:true,
force:true})` in finally.

### 9.4 Local-fallback test (separate file)

`review-ledger.test.cjs` -- 4 fixtures via public API:
- A: phase-level pass (Codex).
- B: per-dispatch warn (Codex, fallback_triggered).
- C: per-dispatch critical (claude-via-fallback).
- D: phase-level critical-halt.

Asserts 4 rows, 4 unique run_ids, all envelope-v1 valid, status mapping
correct, legacy preserved, source tagging present.

### 9.5 Naming + exit codes

`--self-test`: 0 = all-pass, 1 = any failure (Phase 32 contract). Invoke:
`node review-ledger.cjs --self-test`; `node review-ledger.test.cjs`.

---

## 10. Public API (5 Exports)

```javascript
// 1. Atomic single-row append (production wire-in target).
//    Wraps internal _normalize + _assertEnvelopeV1; never throws upward.
appendReviewRow(planningDir, row)

// 2. Defensive read with optional filters.
//    opts: { milestone?, phase? }
readReviewRows(planningDir, opts = {})

// 3. Aggregate per-phase commit-reviews.jsonl into canonical.
//    Idempotent. Dedup tuple: (ts, plan, tier, provider, _source_phase).
aggregateFromPhases(planningDir, opts = {})

// 4. Kill-check: returns baseline_ok / empty_baseline.
//    opts.milestone resolves from STATE.md if absent.
killCheck(planningDir, opts = {})

// 5. Path resolver -- canonical jsonl location (mirrors route-ledger.cjs:74).
ledgerPath(planningDir)
```

Plus four frozen constants: `LEGACY_VERDICT_MAP`, `STATUSES`,
`COMMAND_NAME='appendReviewRow'`, `ENVELOPE_VERSION=1`. All public APIs follow
LOCKED route-ledger contract.

---

## 11. Open Derivation Calls + Locked Recommendations

Every call locked.

| # | Question | Recommendation |
|---|----------|----------------|
| Q1 | Aggregator strategy | Rebuild every invocation |
| Q2 | Dedup tuple | `(ts, plan, tier, provider, _source_phase)` |
| Q3 | --kill-check default scope | Active milestone (STATE.md) |
| Q4 | Wire-in target | SKILL.md:760 + :1248 (NOT codex-exec.sh) |
| Q5 | Tee vs replace per-phase | Tee (write BOTH) |
| Q6 | Output ordering | Chronological by ts ASC |
| Q7 | Empty/malformed handling | Defensive: skip, never throw |
| Q8 | Render Markdown view | NO (defer v1.8+) |
| Q9 | Unknown verdict mapping | `status=warn, reason_codes=[parse_failure]` |
| Q10 | run_id generation | Same as route-ledger.cjs:80-84 |
| Q11 | run_id uniqueness assertion | 100-call test (route-ledger.cjs:399-400) |
| Q12 | Lib location | `super-gsd/scripts/lib/review-ledger.cjs` |
| Q13 | Tool wrapper split? | Single lib with `--self-test`, `--aggregate`, `--kill-check`. NO separate tools/review-ledger/ |
| Q14 | Mission Strip P/W/F line | ONE line; canonical filtered by active milestone; "--/--/--" on missing |
| Q15 | Backfill scope at ship | Run aggregator ONCE during Phase 34; commit canonical .jsonl |
| Q16 | Mission Control fallback | Keep per-phase glob fallback when canonical missing |

### 11.1 Q13 (single-file)

ROADMAP-AGENT.md:341-342 mentions both `tools/review-ledger/aggregate.cjs` and
`scripts/lib/review-ledger-writer.cjs`. **Collapse into one**:
`super-gsd/scripts/lib/review-ledger.cjs`. Phase 32 combined everything in
ONE file (shipped 9.5/10). Separate tools/ wrapper is dead weight (would just
re-export from lib). Single-file = one fingerprint guard, one self-test, one
require path. **Recorded as DEVIATIONS in plan.**

### 11.2 Q4 (wire-in target)

REQUIREMENTS.md:42 says "wired into codex-exec.sh + Claude reviewer".
**Wire INSTEAD into orchestrator's two append sites** which fire after both
Codex shell and Claude agent return.

- `codex-exec.sh:711-723` writes `REPORT_OUT` + one `codex-log.jsonl` row.
  Does NOT write canonical commit-reviews row -- orchestrator does, AFTER
  codex-exec.sh returns and report parses.
- Wiring into codex-exec.sh writes from wrong abstraction level (shell
  wrapper vs orchestrator semantic boundary). Orchestrator has parsed
  verdict/critical_count/warning_count; codex-exec.sh has only raw bytes.
- Orchestrator wire covers BOTH providers symmetrically. Claude review goes
  through `Agent({subagent_type, ...})` (SKILL.md:698-703) producing a
  `report` object that flows through SAME SKILL.md:760/1248 emission. One
  wire = both vendors.

Consistent with Phase 32 wiring `logCodexRoute` once at SKILL.md:1236.
Acceptance still holds semantically. **Recorded as DEVIATIONS.**

### 11.3 Q15 (commit canonical .jsonl)

Convention: don't commit generated data. Counter:
- Per-phase commit-reviews files ARE committed (11 files in git history).
- Backfill once = future tools have data day one without rebuild.
- Aggregator idempotent: re-running on fresh clone -> byte-identical; no churn.

LOCKED: commit `.planning/metrics/review-ledger.jsonl` once at Phase 34
implementation. Subsequent appends update via wire-in; rebuild produces same.

---

## 12. Single-Plan Recommendation

### 12.1 Plan structure

ONE plan: `34-01-canonical-review-ledger-PLAN.md`. Phase 32 + 33 each shipped
as single plan; same envelope.

### 12.2 File count

**Created:**
1. `super-gsd/scripts/lib/review-ledger.cjs` (~600 lines).
2. `super-gsd/scripts/lib/review-ledger.test.cjs` (~120 lines).
3. `.planning/metrics/review-ledger.jsonl` (initial backfill ~50-80 rows).
4. `.planning/milestones/v1.7/phases/34-canonical-review-ledger/34-01-canonical-review-ledger-PLAN.md`.

**Edited:**
1. `super-gsd/skills/sgsd-orchestrate/SKILL.md` -- 2 wire-ins at line 760 +
   1248. ~20 lines. Pattern matches Phase 32's SKILL.md:1222-1233.
2. `super-gsd/scripts/sgsd-mission-control.ps1:1535-1548` -- swap glob for
   canonical tail-read with active-milestone filter; per-phase fallback.
   ~25 lines.
3. `super-gsd/scripts/lib/sgsd-mission-strip.ps1` -- add P/W/F line. ~30 lines.

### 12.3 Line delta

Created: +600+120+75+250 = **+1,045**. Edited: +20+25+30 = **+75**. Total:
**~+1,120 / -0**.

LARGE phase (50+ lines, 4+ files, NEW system) -- ATC tier: **FULL**, GATE
indicators (new contract layer / canonical metric stream).

### 12.4 Sequencing

1. **W0**: Read patterns. Write `review-ledger.cjs` (5 APIs + 15-assertion
   self-test + frozen verdict map).
2. **W1**: Write `review-ledger.test.cjs` (4 fixtures). `--self-test` and
   local-fallback test PASS before any wire-in.
3. **W2**: Edit SKILL.md (2 wire-ins). Edit Mission Control + Mission Strip.
4. **W3**: Run aggregator -> backfill canonical. Commit
   `.planning/metrics/review-ledger.jsonl`.
5. **W4**: Run `--kill-check --milestone v1.7`. If `empty_baseline`, fire
   local-fallback fixture; re-run; assert `baseline_ok`.
6. **W5**: Phase-level ATC review captures row in per-phase AND canonical
   (live wire-in fires first time). Assert ledger row count incremented by 1.

### 12.5 Acceptance verification (ROADMAP-AGENT.md:347-353)

- [x] `--aggregate` produces >=1 row (Section 2; expected ~50).
- [x] `--kill-check` returns `baseline_ok` (exit 0) post-backfill (trivial).
- [x] Live-or-local via `review-ledger.test.cjs` (Section 9.4); same code
      path as orchestrator; mock predicates forbidden.

### 12.6 Risk

LOW: pattern identical to Phase 32 (9.5/10 anti-slop). Additive; existing
paths unbroken. Wire-ins tee'd. Public-API never-throws-upward inherited.

MEDIUM: PowerShell read-path edits intersect PS 5.1 mojibake guards. ASCII-
only enforced (mission-strip.ps1:25). Risk localized to ~55 PS lines.

ZERO: existing per-phase audit trail untouched.

---

## Sources

### Primary (HIGH)
- `super-gsd/scripts/lib/route-ledger.cjs:1-444` -- architectural template.
- `super-gsd/scripts/lib/route-ledger.test.cjs:1-90` -- local-fallback pattern.
- `super-gsd/scripts/lib/repair-command-checker.cjs:1-485` -- 14-assertion + fingerprint.
- `super-gsd/scripts/codex-exec.sh:1-725` -- per-dispatch shell writer (does NOT write commit-reviews).
- `super-gsd/skills/sgsd-orchestrate/SKILL.md:760, :1248` -- per-phase append sites (wire-in targets).
- `super-gsd/registry/command-envelope-v1.yaml:55-61, :100-227, :232-253` -- atc-review first_wave, reason_codes, mission_strip_read_contract.
- `.planning/milestones/v1.7/REQUIREMENTS.md:39-44` -- LEDGER-01..04.
- `.planning/discussions/2026-04-26-mass-discuss.md:209` -- 34=C locked.
- `.planning/ROADMAP-AGENT.md:332-353` -- Phase 34 block.
- `.planning/milestones/v1.7/EXISTING-SURFACE-AUDIT.md:40-44, 67-79` -- gap + schema-without-consumer rule.
- `.planning/milestones/v1.5/SUMMARY.md:115-136` -- v1.5 close lessons.
- `.planning/milestones/v1.5/evidence/codex-kill-check.md:1-32` -- v1.5 deviation.
- `super-gsd/scripts/sgsd-mission-control.ps1:1535-1548` -- current per-phase glob.
- `super-gsd/scripts/lib/sgsd-mission-strip.ps1:1-100` -- current strip data sources.
- `super-gsd/tools/codex-rerun/rerun-missing-reviews.cjs:177-200` -- existing append shape.

### Secondary (MEDIUM)
- `.planning/milestones/v1.6/phases/30-startup-cockpit-acceptance/commit-reviews.jsonl` -- sample row.
- `.planning/milestones/v1.5/phases/21-vtp-enrichment-gates/commit-reviews.jsonl` -- legacy schema with rerun fields.

### Tertiary (LOW -- NONE)

All claims verified against on-disk source. No training-only knowledge cited.

## Assumptions Log

| # | Claim | Risk |
|---|-------|------|
| (none) | All claims verified against on-disk source | -- |

No `[ASSUMED]` claims. Every cited line was read this session; every
behavioral claim verified by reading implementing code.

## Project Constraints (CLAUDE.md)

- ASCII-only literals (PS 5.1 mojibake guard).
- Atomic commits (`feat({phase}-{plan}): {one-liner}`).
- Stage specific files; no `git add -A`.
- Per-dispatch ATC + halt-on-CRIT after 3 retries -> CRIT-BACKLOG -> continue.
- Phase-level ATC at close (Codex + Claude).
- Public-API never-throws-upward for orchestrator-boundary helpers.
- Deferred ideas (rendered .md, ASCII histogram, kill-formula reform) OOS.

## Confidence Breakdown

| Area | Level | Reason |
|------|-------|--------|
| Per-phase writer inventory | HIGH | 11 files via `find`; SKILL.md sites located; codex-exec.sh read line-by-line. |
| Aggregator design | HIGH | Pattern from route-ledger.cjs (shipped) + crit-backlog.cjs. |
| Real-time writer | HIGH | Public-API contract identical to route-ledger.cjs LOCKED. |
| `--kill-check` | HIGH | Semantics from v1.5 SUMMARY/evidence; exit codes match Phase 32. |
| v1.5 gap | HIGH | Direct quotes from `v1.5/evidence/codex-kill-check.md` + SUMMARY.md. |
| Mission Strip / Control | MEDIUM | MC read at line 1538 verified; Strip currently has NO review read. LEDGER-04 additive; line allocation = planner discretion within Phase 28's locked strip. |
| Schema-without-consumer | HIGH | 5 production callers identified by name. |
| Single-plan recommendation | HIGH | Pattern matches Phase 32 + 33 envelopes. |

**Research date:** 2026-04-27
**Valid until:** 2026-05-27 (30 days; relock if mass-discuss amended).
