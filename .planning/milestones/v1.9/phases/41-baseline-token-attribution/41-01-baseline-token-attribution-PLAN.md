---
plan_id: 41-01
phase: 41
title: Baseline Token Attribution
schema_version: 2
model: sonnet
expected_ATC_tier: FULL
requirements: [BASE-01, BASE-02, BASE-03, BASE-04]
locked_decisions: []
depends_on: [31, 32, 36]
created: 2026-04-27
tasks:
  - id: T1
    type: code
    files_touched:
      - super-gsd/tools/token-attribution/report.cjs
      - .planning/metrics/agent-token-spend.jsonl
      - .planning/milestones/v1.9/baseline-token-spend.md
    hypothesis: "An envelope-v1-wrapped agent-token-spend ledger derived from existing 11,173 exact-token rows + 67 byte-estimated rows produces the truthful baseline needed for Phase 42 budgets, Phase 47 routing, and Phase 51 benchmark target."
    falsifier: "Backfill produces <100 rows after sourcing token-attribution.jsonl (would mean source data missing or schema mismatched)."
    stop_rule: "self-test 14/14 PASS; --backfill produces >=10000 rows; --backfill idempotent (byte-identical re-run); --report produces baseline-token-spend.md with top-consumer + outlier + substitution-candidate sections."
    minimal_test: "node super-gsd/tools/token-attribution/report.cjs --self-test -> exit 0; node super-gsd/tools/token-attribution/report.cjs --backfill -> ledger has >=10000 rows; node super-gsd/tools/token-attribution/report.cjs --report -> baseline-token-spend.md exists."
must_haves:
  truths:
    - "Each row is valid envelope-v1 wrapper + 3 extension fields (role, provider, token_breakdown) per Phase 31 contract"
    - "ROLES = Object.freeze 8-entry enum; rejects unknown role"
    - "BLOAT_THRESHOLDS frozen const per RESEARCH 5"
    - "Public APIs never throw upward (mirrors Phase 32-40 locked design)"
    - "Backfill is read-only against source streams (token-attribution.jsonl, codex-log.jsonl); only agent-token-spend.jsonl + baseline-report are write targets"
    - "__dirname-anchored fingerprint guard over 4 canonical streams (Phase 32 W3 lesson)"
    - "Idempotent dedup via (agent_id + ts) tuple per RESEARCH 3"
    - "tokens_estimated:true flag on byte-derived rows (codex-log source)"
  artifacts:
    - super-gsd/tools/token-attribution/report.cjs (NEW ~600 LOC)
    - .planning/metrics/agent-token-spend.jsonl (NEW; backfilled from existing streams)
    - .planning/milestones/v1.9/baseline-token-spend.md (NEW report)
  key_links:
    - 41-CONTEXT.md
    - 41-RESEARCH.md (full 11-derivation matrix)
    - command-envelope-v1.yaml (envelope-v1 contract)
    - super-gsd/scripts/lib/gate-value-log.cjs (1:1 architectural template)
---

<objective>
Phase 41 produces a TRUTHFUL token-spend baseline before any v1.9
optimization. The audit (`.planning/analyses/2026-04-27-agent-context-bloat-audit.md`)
found researcher-style runs spending 122k-223k tokens per phase with
>98% cache-read share. We MEASURE that bloat truthfully so Phase 42 can
set per-role budgets, Phase 47 can route substitutions, and Phase 51 can
prove the >=50% reduction acceptance.

Controlling principle: "Autonomy continues; evidence tells the truth."

Purpose:
  - Land the canonical envelope-v1 ledger `agent-token-spend.jsonl` that
    Phase 31's first-wave emitter contract requires.
  - Derive (NOT estimate) the bulk of the baseline from existing
    `.planning/metrics/token-attribution.jsonl` (11,173 rows with exact
    `usage.input_tokens` / `cache_read_input_tokens` /
    `cache_creation_input_tokens` / `output_tokens` / `total_tokens`).
  - Byte-estimate ONLY where source rows lack a `usage` object
    (codex-log.jsonl 67 rows; flagged `tokens_estimated:true`).
  - Render `baseline-token-spend.md` showing top-consumer by role x
    phase x provider, bloat outliers (cache_read_ratio>0.9 AND
    useful_findings<15), and substitution candidates per BASE-04.

Output:
  - `super-gsd/tools/token-attribution/report.cjs` (NEW; ~600 LOC;
    1:1 mirror of Phase 36 `gate-value-log.cjs`).
  - `.planning/metrics/agent-token-spend.jsonl` (NEW; backfilled).
  - `.planning/milestones/v1.9/baseline-token-spend.md` (NEW report).

This phase does NOT optimize. It measures. The substitution-candidate
section IDENTIFIES candidates per the 5 R-rules; Phase 47 wires the
routing.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/milestones/v1.9/REQUIREMENTS.md
@.planning/milestones/v1.9/ROADMAP.md
@.planning/milestones/v1.9/phases/41-baseline-token-attribution/41-CONTEXT.md
@.planning/milestones/v1.9/phases/41-baseline-token-attribution/41-RESEARCH.md
@.planning/analyses/2026-04-27-agent-context-bloat-audit.md
@super-gsd/registry/command-envelope-v1.yaml
@super-gsd/scripts/lib/gate-value-log.cjs
@super-gsd/scripts/lib/route-ledger.cjs
@super-gsd/tools/token-attribution/collect.cjs

<interfaces>
<!-- Key contracts the executor needs. Extracted from canonical files. -->
<!-- Use these directly. No exploration required. -->

From super-gsd/registry/command-envelope-v1.yaml (envelope-v1 contract):
```
envelope_version: 1                       # const
ts:               ISO-8601 string
command:          "logTokenSpend"         # discriminator (NEW for Phase 41)
status:           ok|warn|fail|skipped|timeout|blocked
reason_codes:     string[]                # closed vocab; defaults per OUTCOME
artifacts:        [{kind, path}]
evidence:         [{kind, ref}]
next_action:      string|null
risk:             low|medium|high|null
duration_ms:      integer|null  (>= 0)
run_id:           "YYYY-MM-DDTHH:MM:SS.sssZ-XXXX" (4hex)
phase:            string|null
milestone:        string|null
```

From super-gsd/scripts/lib/gate-value-log.cjs (1:1 architectural template):
```javascript
// Frozen const pattern Phase 41 mirrors:
const OUTCOMES = Object.freeze(['pass', 'warn', 'block', 'skip']);
const STATUSES = Object.freeze(['ok','warn','fail','skipped','timeout','blocked']);
const COMMAND_NAME     = 'logGateValue';      // -> 'logTokenSpend'
const ENVELOPE_VERSION = 1;
const LEDGER_REL       = path.join('metrics', 'gate-value-log.jsonl');  // -> 'agent-token-spend.jsonl'
const RUN_ID_REGEX =
  /^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(?:\.[0-9]+)?Z-[a-f0-9]{4}$/;

// __dirname-anchored canonical guard (Phase 32 W3 lesson):
const realLedger = path.resolve(__dirname, '..', '..', '..',
  '.planning', 'metrics', 'gate-value-log.jsonl');

// Public API shape Phase 41 mirrors verbatim:
//   logGateValue(planningDir, args)        -> appendTokenSpend(planningDir, row)
//   readGateValueRows(planningDir, opts)   -> readAgentTokenSpendRows(planningDir, opts) [private]
//   summarize(planningDir, opts)           -> summarize(planningDir, opts)
//   ledgerPath(planningDir)                -> ledgerPath(planningDir)
//   outcomeFromVerdict(...)                -> NOT mirrored (no verdict in Phase 41)
//   NEW                                    -> backfillFromMetrics(planningDir, opts)
//   NEW                                    -> report(planningDir, opts)
```

From .planning/metrics/token-attribution.jsonl (PRIMARY source schema):
```jsonl
// event_type=assistant_turn (orchestrator main-Claude turn)
{"schema_version":1,"event_type":"assistant_turn","event_id":"assistant:<sid>:<uuid>",
 "ts":"2026-04-26T21:12:28.689Z","source":"claude-session-jsonl",
 "session_id":"<sid>","session_file":"<sid>.jsonl","uuid":"<uuid>",
 "model":"claude-opus-4-7","milestone":null,"phase":null,"plan":null,
 "role":"orchestrator","attribution_basis":"message.usage",
 "confidence":"exact_usage_fields",
 "usage":{"input_tokens":6,"cache_creation_input_tokens":53986,
          "cache_read_input_tokens":0,"output_tokens":247,
          "context_tokens":53992,"total_tokens":54239}}

// event_type=agent_result (sub-agent dispatch result)
{"schema_version":1,"event_type":"agent_result","event_id":"agent:<sid>:<aid>",
 "ts":"...","tool_use_id":"toolu_...","agent_id":"<aid>",
 "agent_type":"gsd-phase-researcher","agent_role":"research",
 "model":"...","milestone":"v1.6","phase":"26","plan":null,
 "status":"completed","prompt_chars":N,"output_chars":N,
 "total_tokens":N,"duration_ms":N,"tool_uses":N,
 "usage":{...same shape as assistant_turn},
 "tool_stats":{"readCount":N,"searchCount":N,"bashCount":N,
               "editFileCount":N,"linesAdded":N,"linesRemoved":N,
               "otherToolCount":N},
 "codex_offload_candidate":"low|medium|high",
 "codex_offload_reason":"..."}
```

From .planning/metrics/codex-log.jsonl (SECONDARY source; byte-estimated):
```jsonl
{"ts":"2026-04-24T02:39:05Z","phase":15,"plan":null,"step":"muda-qualitative",
 "exit":5,"duration_ms":60558,"prompt_bytes":35004,"report_bytes":0,
 "timeout_hit":true,"fallback_triggered":false,"stderr_preview":"..."}
// NOTE: NO usage object. Estimate via input=round(prompt_bytes/4),
// output=round(report_bytes/4). Flag tokens_estimated:true.
```

From super-gsd/tools/token-attribution/collect.cjs:99-106 (idempotency):
```javascript
function readExistingIds(ledgerPath) {
  const ids = new Set();
  if (!fs.existsSync(ledgerPath)) return ids;
  for (const e of readJsonl(ledgerPath)) {
    if (e && e.event_id) ids.add(e.event_id);
  }
  return ids;
}
```
Phase 41 reuses this pattern with `evidence[0].ref` (synthetic dedup
key derived from `source_event_id` for token-attribution rows or
`hash(ts+phase+step)` for codex-log rows).
</interfaces>
</context>

<known_dead_ends>
<!-- HARD FENCES. Do NOT cross. Tasks that violate these are auto-FAIL. -->

1. Do NOT modify `super-gsd/registry/command-envelope-v1.yaml` or
   `super-gsd/templates/command-envelope-v1.json`. Phase 31 contract is
   LOCKED. Phase 41 rides on `additionalProperties: true`; the 3 ext
   fields (role, provider, token_breakdown) attach to envelope-v1 with
   ZERO schema bump.

2. Do NOT modify any of the 4 existing contracts:
   - code-reviewer-v1
   - review-providers-v1
   - handover-contract-v2
   - plan-schema-v2
   Phase 31 reconciliation note `does_not_touch` enforces this. If you
   THINK you need to touch one, STOP and surface a BLOCKER.

3. Do NOT modify any of the 4 canonical source streams:
   - .planning/metrics/token-attribution.jsonl  (read-only PRIMARY)
   - .planning/metrics/token-log.jsonl          (read-only LEGACY)
   - .planning/metrics/codex-log.jsonl          (read-only SECONDARY)
   - .planning/metrics/activity-log.jsonl       (read-only CORROBORATION)
   Phase 41 is read-only against sources. The ONLY write targets are
   .planning/metrics/agent-token-spend.jsonl (NEW canonical) and
   .planning/milestones/v1.9/baseline-token-spend.md (NEW report).
   Self-test assertion 14 fingerprints all 4 source paths and asserts
   they are byte-identical before/after; violation FAILS the self-test.

4. Do NOT introduce ANY new dependencies. Node built-ins ONLY:
   `fs`, `path`, `os`, `crypto`. Markdown rendering is a manual
   string-template (the Phase 36 + 32 lib pattern); NO marked / showdown
   / nunjucks / handlebars / template-engine of any kind. The lib
   loads in <50ms cold; that property is preserved.

5. Do NOT estimate tokens when EXACT data is available. RESEARCH LOCK 3:
   exact tokens win. Estimation path (`tokens=round(bytes/4)`) is
   ONLY for source rows that lack a `usage` object. Every estimated row
   carries `token_breakdown.tokens_estimated:true`. A token-attribution
   row that HAS a usage object MUST emit `tokens_estimated:false`. Mixing
   the two policies for the same source row is a CRIT.

6. Do NOT exclude orchestrator self-spend. RESEARCH LOCK 6 + LOCK 11:
   the audit identified v1.9/P41 itself as 1.24M orchestrator tokens
   across 4 turns. Excluding it would HIDE the largest bloat source.
   Backfill MUST emit `role:'orchestrator'` rows from
   `event_type:'assistant_turn'` source rows. The R5 substitution rule
   (orchestrator turn-trim) explicitly relies on these rows.

7. ASCII ONLY. Phase 39 W4 lesson: every non-ASCII char in canonical
   tooling has caused at least one downstream encoding bug. Use `--`
   not em-dashes. Use `->` not arrows. Use `>=` not >=. Use straight
   quotes. The lib MUST be byte-identical when round-tripped through
   ASCII normalization.

8. Do NOT split the lib across multiple files. The 4 public APIs
   (appendTokenSpend, backfillFromMetrics, report, summarize) are ONE
   file by RESEARCH section 6.1 lock. Phase 50 cockpit MAY later split
   `super-gsd/scripts/lib/agent-token-spend.cjs` (real-time canonical
   writer) from this tool (CLI reporter) without breaking change. Phase
   41 keeps everything in `super-gsd/tools/token-attribution/report.cjs`.

9. Do NOT add cost telemetry. RESEARCH section 10 inherits Phase 36's
   "no cost" lock (mass-discuss line 211). Cost is a v2.0+ concern.
   `duration_ms` (envelope-v1 standard field) is the time signal.

10. Do NOT render raw row dumps in `baseline-token-spend.md`.
    RESEARCH section 12.4 risk row 6: report is filtered/aggregated, not
    a raw 11k-row dump. Outlier section caps at 50 rows; substitution
    section caps at 20 rows per R-rule.

11. Do NOT ship without all 14 self-test assertions PASSING. Self-test
    is the proof-of-correctness gate. Mirror Phase 36 14-assertion
    pattern verbatim (see Action A1 below). 13/14 PASS = phase FAIL.

12. Do NOT use `process.cwd()` for the canonical-path default. Phase 32
    W3 + Phase 36 W2 lessons: ALWAYS anchor to `__dirname` and walk up
    3 directories to `.planning`. CLI invocations from non-root dirs
    silently corrupt the wrong ledger when this lock is broken.
</known_dead_ends>

<tasks>

<task type="auto" tdd="true">
  <name>Task T1: Build report.cjs lib + 14-assertion self-test (RED-GREEN)</name>
  <files>super-gsd/tools/token-attribution/report.cjs</files>
  <behavior>
    The lib MUST satisfy these behaviors. Tests (the 14 self-test
    assertions) describe these behaviors before implementation lands;
    implementation passes when the self-test exits 0 with 14/14 PASS.

    BEHAVIOR 1: Frozen const enums (RESEARCH 2.3)
      - ROLES = Object.freeze(['researcher','planner','executor',
        'verifier','reviewer','orchestrator','classifier','other'])
      - PROVIDERS = Object.freeze(['claude','codex','local-script','vtp'])
      - STATUSES = Object.freeze(['ok','warn','fail','skipped',
        'timeout','blocked'])  (envelope-v1 6-state enum)
      - BLOAT_THRESHOLDS = Object.freeze({
          cache_read_ratio_high:    0.90,
          useful_findings_low:      15,
          researcher_input_max:     25000,
          planner_input_max:        30000,
          executor_input_max:       40000,
          verifier_input_max:       20000,
          files_read_high:          50,
          diff_lines_low:           100,
        })
      - ALL frozen; mutation attempts MUST fail silently in non-strict
        or throw in strict (Phase 36 self-test 1 confirms via
        `try{ROLES.push('x')}catch{}` then asserts length unchanged).

    BEHAVIOR 2: appendTokenSpend(planningDir, row) -> normalized envelope
      - Validates ROLES enum membership; rejects unknown role -> false.
      - Validates PROVIDERS enum membership; rejects unknown provider -> false.
      - Validates token_breakdown is an object; rejects non-object -> false.
      - Normalizes envelope-v1 fields per gate-value-log.cjs::_normalize.
      - Asserts envelope-v1 schema via _assertEnvelopeV1 (13 required
        fields + run_id pattern + status enum + duration_ms type).
      - Atomic append via fs.appendFileSync to
        <planningDir>/metrics/agent-token-spend.jsonl.
      - NEVER throws upward. Stderr-only error logging mirroring
        gate-value-log.cjs:271-278.

    BEHAVIOR 3: backfillFromMetrics(planningDir, opts) -> {rowsRead,
                rowsAppended, rowsSkipped, errors[]}
      - Walks token-attribution.jsonl (PRIMARY).
        * agent_result rows -> deriveRole(agent_role, agent_type) +
          provider:'claude' + token_breakdown from {usage, tool_stats,
          tokens_estimated:false, useful_findings:<linesAdded>,
          source_event_id:<event_id>, source_stream:'token-attribution.jsonl'}.
        * assistant_turn rows -> role:'orchestrator' +
          provider:'claude' + token_breakdown from {usage,
          tokens_estimated:false, source_event_id, source_stream}.
      - Walks codex-log.jsonl (SECONDARY).
        * Estimates tokens via round(prompt_bytes/4) and
          round(report_bytes/4); flags tokens_estimated:true.
        * status from deriveStatus(exit, timeout_hit, fallback_triggered):
          exit==0 -> ok with reason ['codex_review_pass','tokens_estimated'];
          timeout_hit -> timeout with ['codex_timeout','tokens_estimated'];
          exit==4 -> fail with ['codex_auth_missing','tokens_estimated'];
          fallback_triggered -> warn with ['codex_fallback_triggered',
            'tokens_estimated'].
      - Walks token-log.jsonl (LEGACY) but skips stub rows where
        model='unknown' AND total<10. Meaningful rows -> role:'other',
        confidence:'low_legacy_stub'.
      - IDEMPOTENT: dedup keyed on
        evidence[0].ref = `<source_stream>:<source_event_id>` for
        token-attribution rows; `codex:<ts>:<phase>:<step>` for codex-log
        rows. Re-run yields zero new rows when sources unchanged.
      - opts.dryRun=true -> count but do not write.

    BEHAVIOR 4: report(planningDir, opts) -> markdown string
      - Default outPath = <milestone-dir>/baseline-token-spend.md.
      - Renders the 7 RESEARCH section 4.2 sections:
        1. Headline Numbers
        2. Top Consumers by Role x Milestone
        3. Top Consumers by Role x Phase x Provider
        4. Outliers (Bloat Signature) -- cache_read_ratio>0.9 AND
           useful_findings<15 (per RESEARCH 4.3).
        5. Substitution Candidates (R1..R5 per RESEARCH 5).
        6. Audit Crosscheck (P36 researcher 171k, P40 researcher 122k,
           v1.9/P41 orchestrator 1.24M; mark "explicitly unavailable
           with reason" if missing per RESEARCH 3.5).
        7. Methodology (sources, estimation policy, useful-findings
           proxy LOCK 10).
      - Writes file AND returns rendered string.

    BEHAVIOR 5: summarize(planningDir, opts) -> array of aggregations
      - opts.groupBy in {'role','phase','provider','role+phase',
        'role+phase+provider'}. Default 'role'.
      - opts.milestone filter.
      - Returns [{...keys, calls, total, avg, cache_read_ratio,
        useful_findings_per_100k, status_breakdown}].
      - Phase 42 BUDGET-01 imports this verbatim.

    BEHAVIOR 6: __dirname-anchored fingerprint guard
      - All 4 canonical source streams + the canonical
        agent-token-spend.jsonl path resolved via
        path.resolve(__dirname,'..','..','..','.planning','metrics',<file>).
      - Self-test 14 captures {exists, mtimeMs, size} for each path
        BEFORE any test setup; reasserts byte-identical AFTER cleanup.

    BEHAVIOR 7: 14 self-test assertions (Phase 36 mirror; RESEARCH 7)
      1.  ROLES is frozen array of 8 entries (mutation fails silently)
      2.  PROVIDERS is frozen array of 4 entries
      3.  STATUSES is frozen array of 6 envelope-v1 states
      4.  BLOAT_THRESHOLDS is frozen object with 8 keys; all values
          numeric and >0
      5.  Empty read on fresh tmpdir returns []
      6.  appendTokenSpend with valid row -> envelope-shaped row written
          (verifies role, provider, token_breakdown ext fields preserved
           + envelope-v1 13 required fields present + run_id pattern)
      7.  Invalid role -> false; never throws upward
      8.  Invalid provider -> false; never throws upward
      9.  Three sequential appends -> three rows; never truncated
      10. Malformed line skipped; subsequent valid append readable
          (defensive read)
      11. backfillFromMetrics with synthetic source rows produces correct
          envelope rows (4 source-stream cases: token-attribution
          agent_result, token-attribution assistant_turn, codex-log
          row with byte estimation, token-log legacy stub)
      12. summarize aggregates by role with correct cache_read_ratio
          (fixture: 5 researcher rows = 1k+10k+100k+150k+200k tokens;
           verify avg, ratio, status_breakdown)
      13. summarize milestone filter excludes other milestones
      14. Canonical streams (4 source paths + 1 ledger path) untouched
          by self-test (fingerprint check before/after)
  </behavior>
  <action>
File: `super-gsd/tools/token-attribution/report.cjs` (NEW; ~600 LOC).

Open by mirroring the structure of
`super-gsd/scripts/lib/gate-value-log.cjs` line by line. Substitute:

  gate-value-log     -> agent-token-spend
  logGateValue       -> appendTokenSpend
  readGateValueRows  -> readAgentTokenSpendRows (kept private)
  outcomeFromVerdict -> (REMOVED; not applicable)
  OUTCOMES (4)       -> ROLES (8) + PROVIDERS (4)
  gate (string)      -> role (frozen ROLES enum)
  outcome (4-enum)   -> provider (frozen PROVIDERS enum)
  retroactive (obj)  -> token_breakdown (obj)

ADDED public APIs not present in gate-value-log.cjs:
  backfillFromMetrics, report

REMOVED public API not applicable:
  outcomeFromVerdict, ledgerPath stays public

Header docblock MUST be rewritten (do NOT leave `gate` / `outcome` /
`retroactive` / `Phase 36` references). Risk row 1 in RESEARCH 12.4
explicitly flags this. The header cites:

  - 41-RESEARCH.md sections 2 (schema), 5 (R1..R5), 7 (14 assertions)
  - 41-RESEARCH.md section 11 (Open Derivation Calls -- LOCKED)
  - 41-RESEARCH.md section 12 (Single Plan Recommendation)
  - command-envelope-v1.yaml lines 22-77 (first-wave emitter list;
    Phase 41 adds `logTokenSpend` as command discriminator without
    schema bump)
  - super-gsd/scripts/lib/gate-value-log.cjs (1:1 mirror template)
  - .planning/analyses/2026-04-27-agent-context-bloat-audit.md
    sections 79-95 (live token ledger), 121-128 (top agent totals),
    139-158 (v1.8 P36-P40 cache-read share)

Skeleton (mirror gate-value-log.cjs:1-545 verbatim with substitutions):

```javascript
// ============================================================================
// SGSD - AGENT-TOKEN-SPEND canonical writer for role/provider attribution
// ============================================================================
// Source of truth: .planning/metrics/agent-token-spend.jsonl (machine-readable)
// Human-readable view: .planning/milestones/v1.9/baseline-token-spend.md
//
// Append-only. Every row is a valid command-envelope-v1 row PLUS three
// extension fields: `role`, `provider`, `token_breakdown`. envelope-v1 contract
// is `additionalProperties: true` so the extension fields ride along without
// any schema bump (Phase 31 contract preserved; collides_with: [] still holds).
//
// Phase 41 (v1.9/41=B) ships a NEW emitter `logTokenSpend` registered in
// super-gsd/registry/command-envelope-v1.yaml as the v1.9 first-wave addition.
// Phase 41 itself NEVER appends real-time rows; its only writers are the
// backfill walker (one-shot derivation from existing canonical streams) and
// the self-test (tmpdir only). Phase 50 cockpit may later import
// appendTokenSpend for live emission.
//
// Schema per row (one JSON object per line):
//   {
//     envelope_version: 1,
//     ts:               ISO-8601,
//     command:          "logTokenSpend",
//     status:           ok|warn|fail|skipped|timeout|blocked,
//     reason_codes:     string[]  (envelope-v1 vocab; see source-rule table),
//     artifacts:        {kind,path}[],
//     evidence:         {kind,ref}[],         // synthetic source-row dedup ref
//     next_action:      string|null,
//     risk:             low|medium|high|null,
//     duration_ms:      number|null,
//     run_id:           "YYYY-MM-DDTHH:MM:SS.sssZ-XXXX" (4hex),
//     phase:            string|null,
//     milestone:        string|null,
//     role:             ROLES enum (Phase 41 extension),
//     provider:         PROVIDERS enum (Phase 41 extension),
//     token_breakdown:  object (Phase 41 extension),
//   }
//
// Public API: appendTokenSpend, backfillFromMetrics, report, summarize,
// ledgerPath. See 41-RESEARCH.md section 6 for derivation. All five wrap
// internals in try/catch and never throw upward.
//
// Locked design: per 41-RESEARCH.md section 11 (Q1-Q11). Mirrors
// gate-value-log.cjs (Phase 36) 1:1 for shape, fingerprint guard, frozen
// const enums, manual envelope-v1 schema check, defensive read.
//
// No cost telemetry (inherits Phase 36 "no cost" lock; mass-discuss line 211).
// duration_ms is the standard envelope-v1 field, NOT cost.
//
// Failure contract: this writer NEVER throws upward at the orchestrator
// boundary. Closed-enum violations raise inside _appendRowInternal but the
// public helper appendTokenSpend wraps every call in try/catch; on error
// it console.warns to stderr and returns false.
// ============================================================================

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

// RESEARCH 2.3: 8-entry frozen ROLES enum.
const ROLES = Object.freeze([
  'researcher', 'planner', 'executor', 'verifier',
  'reviewer', 'orchestrator', 'classifier', 'other',
]);

// RESEARCH 2.3: 4-entry frozen PROVIDERS enum.
const PROVIDERS = Object.freeze([
  'claude', 'codex', 'local-script', 'vtp',
]);

// envelope-v1 status enum. Frozen. Mirrors gate-value-log.cjs:67-69.
const STATUSES = Object.freeze([
  'ok', 'warn', 'fail', 'skipped', 'timeout', 'blocked',
]);

// RESEARCH 2.3: 8-key frozen BLOAT_THRESHOLDS const.
// Values verbatim from REQUIREMENTS BUDGET-02/03 + audit derivations.
const BLOAT_THRESHOLDS = Object.freeze({
  cache_read_ratio_high:    0.90,
  useful_findings_low:      15,
  researcher_input_max:     25000,
  planner_input_max:        30000,
  executor_input_max:       40000,
  verifier_input_max:       20000,
  files_read_high:          50,
  diff_lines_low:           100,
});

const COMMAND_NAME     = 'logTokenSpend';
const ENVELOPE_VERSION = 1;
const LEDGER_REL       = path.join('metrics', 'agent-token-spend.jsonl');

// Mirrors gate-value-log.cjs:111. envelope-v1.json:78 verbatim.
const RUN_ID_REGEX =
  /^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(?:\.[0-9]+)?Z-[a-f0-9]{4}$/;

function ledgerPath(planningDir) {
  return path.join(planningDir, LEDGER_REL);
}

function generateRunId() {
  const ts = new Date().toISOString();
  const rand = crypto.randomBytes(2).toString('hex');
  return `${ts}-${rand}`;
}

// RESEARCH 3.2: locked role derivation. Priority: explicit agent_role,
// then agent_type substring, then 'other'.
function deriveRole(agentRole, agentType) {
  if (agentRole === 'research')       return 'researcher';
  if (agentRole === 'planning')       return 'planner';
  if (agentRole === 'execution')      return 'executor';
  if (agentRole === 'plan_check')     return 'reviewer';
  if (agentRole === 'review')         return 'reviewer';
  if (agentRole === 'classification') return 'classifier';
  const t = String(agentType || '').toLowerCase();
  if (t.includes('researcher'))   return 'researcher';
  if (t.includes('planner'))      return 'planner';
  if (t.includes('executor') || t.includes('exec-')) return 'executor';
  if (t.includes('verifier'))     return 'verifier';
  if (t.includes('reviewer') || t.includes('checker')) return 'reviewer';
  if (t.includes('classifier'))   return 'classifier';
  if (t === 'orchestrator')       return 'orchestrator';
  return 'other';
}

// RESEARCH 2.4: codex-log status derivation table.
function deriveCodexStatus(exit, timeoutHit, fallbackTriggered) {
  if (timeoutHit)        return { status: 'timeout', codes: ['codex_timeout', 'tokens_estimated'] };
  if (exit === 4)        return { status: 'fail',    codes: ['codex_auth_missing', 'tokens_estimated'] };
  if (fallbackTriggered) return { status: 'warn',    codes: ['codex_fallback_triggered', 'tokens_estimated'] };
  if (exit === 0)        return { status: 'ok',      codes: ['codex_review_pass', 'tokens_estimated'] };
  return { status: 'warn', codes: ['tokens_estimated'] };
}

// RESEARCH 5.1: useful-findings proxy = tool_stats.linesAdded for
// research/executor (output IS the finding); fallback editFileCount +
// searchCount for read-only verifier/reviewer; 0 when tool_stats absent.
function usefulFindings(role, toolStats) {
  if (!toolStats || typeof toolStats !== 'object') return 0;
  const linesAdded   = Number(toolStats.linesAdded) || 0;
  const editFileCnt  = Number(toolStats.editFileCount) || 0;
  const searchCnt    = Number(toolStats.searchCount) || 0;
  if (role === 'researcher' || role === 'executor' || role === 'planner') {
    return linesAdded;
  }
  // Verifier / reviewer / classifier / other: read-only signal.
  return editFileCnt + searchCnt;
}

// _normalize: validate + shape envelope-v1 + 3 ext fields.
// Mirrors gate-value-log.cjs::_normalize verbatim with ext-field swap.
function _normalize(row) {
  if (!row || typeof row !== 'object') {
    throw new Error('agent-token-spend: row must be an object');
  }
  if (!row.role || !ROLES.includes(row.role)) {
    throw new Error(
      `agent-token-spend: role must be one of ${ROLES.join(', ')}; got '${row.role}'`
    );
  }
  if (!row.provider || !PROVIDERS.includes(row.provider)) {
    throw new Error(
      `agent-token-spend: provider must be one of ${PROVIDERS.join(', ')}; got '${row.provider}'`
    );
  }
  if (row.token_breakdown !== undefined &&
      (row.token_breakdown === null || typeof row.token_breakdown !== 'object')) {
    throw new Error('agent-token-spend: token_breakdown must be an object (or omitted)');
  }
  if (row.reason_codes !== undefined && !Array.isArray(row.reason_codes)) {
    throw new Error('agent-token-spend: reason_codes must be an array (or omitted)');
  }
  if (row.artifacts !== undefined && !Array.isArray(row.artifacts)) {
    throw new Error('agent-token-spend: artifacts must be an array (or omitted)');
  }
  if (row.evidence !== undefined && !Array.isArray(row.evidence)) {
    throw new Error('agent-token-spend: evidence must be an array (or omitted)');
  }

  // Status: caller-supplied (default 'ok'). MUST be in STATUSES.
  const status = (row.status && STATUSES.includes(row.status)) ? row.status : 'ok';
  const reasonCodes = Array.isArray(row.reason_codes) ? row.reason_codes.slice() : [];

  // token_breakdown: copy through with floors. RESEARCH 2.2 example fields.
  const srcTb = row.token_breakdown || {};
  const tb = {
    model:                String(srcTb.model || ''),
    input_tokens:         Number(srcTb.input_tokens) || 0,
    cache_read_tokens:    Number(srcTb.cache_read_tokens) || 0,
    cache_creation_tokens:Number(srcTb.cache_creation_tokens) || 0,
    output_tokens:        Number(srcTb.output_tokens) || 0,
    total_tokens:         Number(srcTb.total_tokens) || 0,
    cache_read_ratio:     0,
    tokens_estimated:     Boolean(srcTb.tokens_estimated),
    tool_calls:           Number(srcTb.tool_calls) || 0,
    files_read:           Number(srcTb.files_read) || 0,
    useful_findings:      Number(srcTb.useful_findings) || 0,
    agent_type:           srcTb.agent_type || null,
    source_event_id:      srcTb.source_event_id || null,
    source_stream:        srcTb.source_stream || null,
  };
  // Derived ratio.
  if (tb.total_tokens > 0) {
    tb.cache_read_ratio = tb.cache_read_tokens / tb.total_tokens;
  }

  return {
    envelope_version: ENVELOPE_VERSION,
    ts:               row.ts || new Date().toISOString(),
    command:          COMMAND_NAME,
    status,
    reason_codes:     reasonCodes,
    artifacts:        Array.isArray(row.artifacts) ? row.artifacts.slice() : [],
    evidence:         Array.isArray(row.evidence)  ? row.evidence.slice()  : [],
    next_action:      row.next_action ?? null,
    risk:             row.risk ?? null,
    duration_ms:      typeof row.duration_ms === 'number' ? row.duration_ms : null,
    run_id:           row.run_id || generateRunId(),
    phase:            row.phase ?? null,
    milestone:        row.milestone ?? null,
    // Phase 41 extension fields:
    role:             row.role,
    provider:         row.provider,
    token_breakdown:  tb,
  };
}

// _assertEnvelopeV1: mirrors gate-value-log.cjs:217-255 verbatim.
function _assertEnvelopeV1(row) {
  const required = ['envelope_version', 'ts', 'command', 'status', 'reason_codes',
    'artifacts', 'evidence', 'next_action', 'risk', 'duration_ms', 'run_id', 'phase', 'milestone'];
  for (const k of required) {
    if (!(k in row)) throw new Error(`agent-token-spend: emitted row missing required envelope-v1 field '${k}'`);
  }
  if (row.envelope_version !== 1) {
    throw new Error(`agent-token-spend: envelope_version must be 1 (got ${row.envelope_version})`);
  }
  if (!RUN_ID_REGEX.test(row.run_id)) {
    throw new Error(`agent-token-spend: run_id violates envelope-v1 pattern (got '${row.run_id}')`);
  }
  if (!STATUSES.includes(row.status)) {
    throw new Error(`agent-token-spend: status must be one of ${STATUSES.join(', ')} (got '${row.status}')`);
  }
  if (row.duration_ms !== null && (!Number.isInteger(row.duration_ms) || row.duration_ms < 0)) {
    throw new Error(`agent-token-spend: duration_ms must be non-negative integer or null (got ${row.duration_ms})`);
  }
  for (const e of row.evidence) {
    if (!e || typeof e.kind !== 'string' || !e.kind || typeof e.ref !== 'string' || !e.ref) {
      throw new Error(`agent-token-spend: evidence item must be {kind:string, ref:string} (got ${JSON.stringify(e)})`);
    }
  }
  for (const a of row.artifacts) {
    if (!a || typeof a.kind !== 'string' || !a.kind || typeof a.path !== 'string' || !a.path) {
      throw new Error(`agent-token-spend: artifacts item must be {kind:string, path:string} (got ${JSON.stringify(a)})`);
    }
  }
}

function _appendRowInternal(planningDir, row) {
  if (!planningDir) throw new Error('agent-token-spend: planningDir required');
  const enriched = _normalize(row);
  _assertEnvelopeV1(enriched);
  const p = ledgerPath(planningDir);
  const dir = path.dirname(p);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.appendFileSync(p, JSON.stringify(enriched) + '\n', 'utf8');
  return enriched;
}

// Public API. Never throws upward.
function appendTokenSpend(planningDir, args) {
  try {
    return _appendRowInternal(planningDir, args || {});
  } catch (e) {
    console.warn('[SGSD] agent-token-spend appendTokenSpend failed:', e.message);
    return false;
  }
}

// Defensive read. Mirrors gate-value-log.cjs:282-303.
function _readRows(planningDir, opts) {
  try {
    if (!planningDir) return [];
    const o = opts || {};
    const p = ledgerPath(planningDir);
    if (!fs.existsSync(p)) return [];
    const text = fs.readFileSync(p, 'utf8');
    if (!text.trim()) return [];
    let rows = text.split(/\r?\n/).filter(Boolean)
      .map((l) => { try { return JSON.parse(l); } catch { return null; } })
      .filter(Boolean);
    if (o.role)      rows = rows.filter((r) => r.role === o.role);
    if (o.provider)  rows = rows.filter((r) => r.provider === o.provider);
    if (o.milestone) rows = rows.filter((r) => r.milestone === o.milestone);
    if (o.phase)     rows = rows.filter((r) => String(r.phase) === String(o.phase));
    return rows;
  } catch (e) {
    console.warn('[SGSD] agent-token-spend _readRows failed:', e.message);
    return [];
  }
}

// Idempotency: dedup keyed on evidence[0].ref.
function _existingDedupRefs(planningDir) {
  const refs = new Set();
  for (const r of _readRows(planningDir)) {
    if (Array.isArray(r.evidence) && r.evidence[0] && r.evidence[0].ref) {
      refs.add(r.evidence[0].ref);
    }
  }
  return refs;
}

// RESEARCH 3.1: backfill walker. PRIMARY token-attribution -> SECONDARY
// codex-log -> LEGACY token-log. opts.dryRun=true skips the writes.
function backfillFromMetrics(planningDir, opts) {
  const o = opts || {};
  const out = { rowsRead: 0, rowsAppended: 0, rowsSkipped: 0, errors: [] };
  try {
    const seen = _existingDedupRefs(planningDir);
    const metricsDir = path.join(planningDir, 'metrics');
    const sources = [
      { file: path.join(metricsDir, 'token-attribution.jsonl'), kind: 'attribution' },
      { file: path.join(metricsDir, 'codex-log.jsonl'),         kind: 'codex' },
      { file: path.join(metricsDir, 'token-log.jsonl'),         kind: 'legacy' },
    ];
    for (const src of sources) {
      if (!fs.existsSync(src.file)) continue;
      const text = fs.readFileSync(src.file, 'utf8');
      const lines = text.split(/\r?\n/).filter(Boolean);
      for (const line of lines) {
        out.rowsRead++;
        let raw;
        try { raw = JSON.parse(line); } catch { out.rowsSkipped++; continue; }
        const built = _buildRowFromSource(raw, src.kind);
        if (!built) { out.rowsSkipped++; continue; }
        if (seen.has(built._dedupRef)) { out.rowsSkipped++; continue; }
        seen.add(built._dedupRef);
        if (!o.dryRun) {
          delete built._dedupRef;
          const r = appendTokenSpend(planningDir, built);
          if (r) out.rowsAppended++; else out.errors.push({ source: src.kind, line: line.slice(0, 80) });
        } else {
          out.rowsAppended++;
        }
      }
    }
  } catch (e) {
    out.errors.push({ message: e.message });
  }
  return out;
}

// _buildRowFromSource: convert a source row to a Phase 41 envelope row.
// Returns row + _dedupRef sentinel or null if source row is unusable.
function _buildRowFromSource(raw, kind) {
  if (kind === 'attribution') {
    if (raw.event_type === 'agent_result') {
      const role = deriveRole(raw.agent_role, raw.agent_type);
      const usage = raw.usage || {};
      const ts = raw.tool_stats || {};
      const breakdown = {
        model:                 raw.model || null,
        input_tokens:          Number(usage.input_tokens) || 0,
        cache_read_tokens:     Number(usage.cache_read_input_tokens) || 0,
        cache_creation_tokens: Number(usage.cache_creation_input_tokens) || 0,
        output_tokens:         Number(usage.output_tokens) || 0,
        total_tokens:          Number(usage.total_tokens) || Number(raw.total_tokens) || 0,
        tokens_estimated:      false,
        tool_calls:            Number(raw.tool_uses) || 0,
        files_read:            Number(ts.readCount) || 0,
        useful_findings:       usefulFindings(role, ts),
        agent_type:            raw.agent_type || null,
        source_event_id:       raw.event_id || null,
        source_stream:         'token-attribution.jsonl',
      };
      const dedupRef = `attribution:${raw.event_id}`;
      return {
        ts: raw.ts,
        status: 'ok',
        reason_codes: ['exact_usage_fields'],
        evidence: [{ kind: 'token_attribution_row', ref: dedupRef }],
        artifacts: [],
        duration_ms: Number(raw.duration_ms) || null,
        phase: raw.phase ?? null,
        milestone: raw.milestone ?? null,
        role,
        provider: 'claude',
        token_breakdown: breakdown,
        _dedupRef: dedupRef,
      };
    }
    if (raw.event_type === 'assistant_turn') {
      const usage = raw.usage || {};
      const breakdown = {
        model:                 raw.model || null,
        input_tokens:          Number(usage.input_tokens) || 0,
        cache_read_tokens:     Number(usage.cache_read_input_tokens) || 0,
        cache_creation_tokens: Number(usage.cache_creation_input_tokens) || 0,
        output_tokens:         Number(usage.output_tokens) || 0,
        total_tokens:          Number(usage.total_tokens) || 0,
        tokens_estimated:      false,
        source_event_id:       raw.event_id || null,
        source_stream:         'token-attribution.jsonl',
      };
      const dedupRef = `attribution:${raw.event_id}`;
      return {
        ts: raw.ts,
        status: 'ok',
        reason_codes: ['exact_usage_fields'],
        evidence: [{ kind: 'token_attribution_row', ref: dedupRef }],
        artifacts: [],
        phase: raw.phase ?? null,
        milestone: raw.milestone ?? null,
        role: 'orchestrator',
        provider: 'claude',
        token_breakdown: breakdown,
        _dedupRef: dedupRef,
      };
    }
    return null;
  }

  if (kind === 'codex') {
    const stat = deriveCodexStatus(raw.exit, raw.timeout_hit, raw.fallback_triggered);
    const promptBytes = Number(raw.prompt_bytes) || 0;
    const reportBytes = Number(raw.report_bytes) || 0;
    const inputEst    = Math.round(promptBytes / 4);
    const outputEst   = Math.round(reportBytes / 4);
    const breakdown = {
      model:                 'gpt-5.4',
      input_tokens:          inputEst,
      cache_read_tokens:     0,
      cache_creation_tokens: 0,
      output_tokens:         outputEst,
      total_tokens:          inputEst + outputEst,
      tokens_estimated:      true,
      source_event_id:       null,
      source_stream:         'codex-log.jsonl',
    };
    const dedupRef = `codex:${raw.ts}:${raw.phase}:${raw.step}`;
    return {
      ts: raw.ts,
      status: stat.status,
      reason_codes: stat.codes,
      evidence: [{ kind: 'codex_log_row', ref: dedupRef }],
      artifacts: [],
      duration_ms: Number(raw.duration_ms) || null,
      phase: raw.phase != null ? String(raw.phase) : null,
      milestone: null,
      role: 'reviewer',
      provider: 'codex',
      token_breakdown: breakdown,
      _dedupRef: dedupRef,
    };
  }

  if (kind === 'legacy') {
    // Skip stub rows.
    if (String(raw.model || '').toLowerCase() === 'unknown' && (Number(raw.total) || 0) < 10) {
      return null;
    }
    const breakdown = {
      model:                 raw.model || null,
      input_tokens:          Number(raw.est_input) || 0,
      cache_read_tokens:     0,
      cache_creation_tokens: 0,
      output_tokens:         Number(raw.est_output) || 0,
      total_tokens:          Number(raw.total) || 0,
      tokens_estimated:      true,
      source_stream:         'token-log.jsonl',
    };
    const dedupRef = `legacy:${raw.ts}:${raw.phase || ''}:${raw.tool || ''}`;
    return {
      ts: raw.ts || new Date().toISOString(),
      status: 'ok',
      reason_codes: ['low_legacy_stub'],
      evidence: [{ kind: 'token_log_row', ref: dedupRef }],
      artifacts: [],
      phase: raw.phase != null ? String(raw.phase) : null,
      milestone: null,
      role: 'other',
      provider: 'claude',
      token_breakdown: breakdown,
      _dedupRef: dedupRef,
    };
  }

  return null;
}

// summarize: per-key aggregation. RESEARCH 6.3.
function summarize(planningDir, opts) {
  try {
    const o = opts || {};
    const filters = {};
    if (o.milestone) filters.milestone = o.milestone;
    if (o.role)      filters.role = o.role;
    if (o.phase)     filters.phase = o.phase;
    const rows = _readRows(planningDir, filters);
    const groupBy = o.groupBy || 'role';
    const keyOf = (r) => {
      switch (groupBy) {
        case 'role':                 return r.role;
        case 'phase':                return String(r.phase || 'unknown');
        case 'provider':             return r.provider;
        case 'role+phase':           return `${r.role}|${r.phase || 'unknown'}`;
        case 'role+phase+provider':  return `${r.role}|${r.phase || 'unknown'}|${r.provider}`;
        default:                     return r.role;
      }
    };
    const acc = new Map();
    for (const r of rows) {
      const k = keyOf(r);
      if (!acc.has(k)) acc.set(k, {
        key: k, calls: 0, total: 0, sumCacheRead: 0, sumOutput: 0,
        sumFindings: 0, statuses: {},
      });
      const a = acc.get(k);
      const tb = r.token_breakdown || {};
      a.calls++;
      a.total        += Number(tb.total_tokens) || 0;
      a.sumCacheRead += Number(tb.cache_read_tokens) || 0;
      a.sumOutput    += Number(tb.output_tokens) || 0;
      a.sumFindings  += Number(tb.useful_findings) || 0;
      a.statuses[r.status] = (a.statuses[r.status] || 0) + 1;
    }
    return Array.from(acc.values()).map((a) => ({
      key: a.key,
      calls: a.calls,
      total: a.total,
      avg: a.calls > 0 ? Math.round(a.total / a.calls) : 0,
      cache_read_ratio: a.total > 0 ? a.sumCacheRead / a.total : 0,
      useful_findings_per_100k: a.total > 0
        ? Math.round((a.sumFindings * 100000) / a.total) : 0,
      status_breakdown: a.statuses,
    })).sort((a, b) => b.total - a.total);
  } catch (e) {
    console.warn('[SGSD] agent-token-spend summarize failed:', e.message);
    return [];
  }
}

// RESEARCH 4.3: bloat detector.
function _isBloatRow(r) {
  const tb = r.token_breakdown || {};
  return (Number(tb.cache_read_ratio) || 0) > BLOAT_THRESHOLDS.cache_read_ratio_high
    && (Number(tb.useful_findings) || 0) < BLOAT_THRESHOLDS.useful_findings_low;
}

// RESEARCH 5: 5 substitution-candidate rules. Returns counts per rule.
function _substitutionCandidates(rows) {
  const r1 = []; // researcher local-script
  const r2 = []; // codex reviewer fallback
  const r3 = []; // executor context-packet
  const r4 = []; // verifier goal-backward
  const r5 = []; // orchestrator turn-trim
  for (const r of rows) {
    const tb = r.token_breakdown || {};
    if (r.role === 'researcher'
        && (tb.cache_read_ratio || 0) > 0.90
        && (tb.useful_findings || 0) < 15) r1.push(r);
    if (r.provider === 'codex'
        && (r.status === 'warn' || r.status === 'fail')
        && (r.reason_codes || []).includes('codex_fallback_triggered')) r2.push(r);
    if (r.role === 'executor'
        && (tb.files_read || 0) > BLOAT_THRESHOLDS.files_read_high) r3.push(r);
    if (r.role === 'verifier'
        && (tb.cache_read_ratio || 0) > 0.85) r4.push(r);
    if (r.role === 'orchestrator'
        && (tb.total_tokens || 0) > 200000) r5.push(r);
  }
  return { r1, r2, r3, r4, r5 };
}

// RESEARCH 4.2: 7-section markdown render.
function report(planningDir, opts) {
  try {
    const o = opts || {};
    const milestone = o.milestone || 'v1.9';
    const rows = _readRows(planningDir);
    const lines = [];
    lines.push(`# v${milestone} Baseline Token Spend Report`);
    lines.push(`Generated: ${new Date().toISOString()}  Source: agent-token-spend.jsonl (${rows.length} rows)`);
    lines.push('');

    // Section 1: Headline Numbers
    lines.push('## 1. Headline Numbers');
    const totals = { all: 0, v18: 0, v19: 0, subAgent: 0, orch: 0, cacheRead: 0 };
    for (const r of rows) {
      const tb = r.token_breakdown || {};
      const t = Number(tb.total_tokens) || 0;
      totals.all += t;
      if (r.milestone === 'v1.8') totals.v18 += t;
      if (r.milestone === 'v1.9') totals.v19 += t;
      if (r.role === 'orchestrator') totals.orch += t; else totals.subAgent += t;
      totals.cacheRead += Number(tb.cache_read_tokens) || 0;
    }
    lines.push(`- Total tokens (lifetime): ${totals.all.toLocaleString('en-US')}`);
    lines.push(`- Total tokens (v1.8): ${totals.v18.toLocaleString('en-US')}`);
    lines.push(`- Total tokens (v1.9): ${totals.v19.toLocaleString('en-US')}`);
    lines.push(`- Sub-agent tokens: ${totals.subAgent.toLocaleString('en-US')}`);
    lines.push(`- Orchestrator tokens: ${totals.orch.toLocaleString('en-US')}`);
    const cacheShare = totals.all > 0 ? (totals.cacheRead / totals.all) : 0;
    lines.push(`- Cache-read share: ${(cacheShare * 100).toFixed(1)}%`);
    lines.push('');

    // Section 2: Top Consumer by Role x Milestone
    lines.push('## 2. Top Consumers by Role x Milestone');
    lines.push('| Role | Milestone | Calls | Total | Avg | Cache-read % | Findings/100k |');
    lines.push('|------|-----------|------:|------:|----:|-------------:|--------------:|');
    const byRoleMilestone = summarize(planningDir, { groupBy: 'role+phase' });
    // Aggregate by role+milestone explicitly:
    const rmAcc = new Map();
    for (const r of rows) {
      const k = `${r.role}|${r.milestone || 'unknown'}`;
      if (!rmAcc.has(k)) rmAcc.set(k, { role: r.role, milestone: r.milestone || 'unknown',
        calls: 0, total: 0, sumCacheRead: 0, sumFindings: 0 });
      const a = rmAcc.get(k);
      const tb = r.token_breakdown || {};
      a.calls++;
      a.total += Number(tb.total_tokens) || 0;
      a.sumCacheRead += Number(tb.cache_read_tokens) || 0;
      a.sumFindings  += Number(tb.useful_findings) || 0;
    }
    const rmRows = Array.from(rmAcc.values())
      .sort((a, b) => b.total - a.total).slice(0, 25);
    for (const a of rmRows) {
      const ratio = a.total > 0 ? (a.sumCacheRead / a.total * 100).toFixed(1) : '0.0';
      const f100k = a.total > 0 ? Math.round((a.sumFindings * 100000) / a.total) : 0;
      lines.push(`| ${a.role} | ${a.milestone} | ${a.calls} | ${a.total.toLocaleString('en-US')} | ${Math.round(a.total/a.calls).toLocaleString('en-US')} | ${ratio}% | ${f100k} |`);
    }
    lines.push('');

    // Section 3: Top Consumers by Role x Phase x Provider
    lines.push('## 3. Top Consumers by Role x Phase x Provider');
    lines.push('| Role | Phase | Provider | Calls | Total | Avg | Cache-read % | Status mix |');
    lines.push('|------|-------|----------|------:|------:|----:|-------------:|------------|');
    const rpp = summarize(planningDir, { groupBy: 'role+phase+provider' }).slice(0, 30);
    for (const a of rpp) {
      const [role, phase, provider] = a.key.split('|');
      const ratio = (a.cache_read_ratio * 100).toFixed(1);
      const sm = Object.entries(a.status_breakdown).map(([k,v]) => `${k}:${v}`).join(' ');
      lines.push(`| ${role} | ${phase} | ${provider} | ${a.calls} | ${a.total.toLocaleString('en-US')} | ${a.avg.toLocaleString('en-US')} | ${ratio}% | ${sm} |`);
    }
    lines.push('');

    // Section 4: Outliers (Bloat Signature)
    lines.push('## 4. Outliers (Bloat Signature)');
    lines.push(`Rows where cache_read_ratio > ${BLOAT_THRESHOLDS.cache_read_ratio_high} AND useful_findings < ${BLOAT_THRESHOLDS.useful_findings_low}.`);
    lines.push('| Phase | Role | Total | Cache-read % | Findings | source_event_id |');
    lines.push('|-------|------|------:|-------------:|---------:|-----------------|');
    const outliers = rows.filter(_isBloatRow)
      .sort((a, b) => (b.token_breakdown.total_tokens || 0) - (a.token_breakdown.total_tokens || 0))
      .slice(0, 50);
    for (const r of outliers) {
      const tb = r.token_breakdown;
      lines.push(`| ${r.phase || '-'} | ${r.role} | ${(tb.total_tokens||0).toLocaleString('en-US')} | ${(tb.cache_read_ratio*100).toFixed(1)}% | ${tb.useful_findings||0} | ${tb.source_event_id || '-'} |`);
    }
    lines.push('');

    // Section 5: Substitution Candidates (BASE-04)
    const sc = _substitutionCandidates(rows);
    lines.push('## 5. Substitution Candidates');
    lines.push(`- R1 Researcher local-script candidates: ${sc.r1.length} rows`);
    lines.push(`- R2 Codex reviewer fallback candidates: ${sc.r2.length} rows`);
    lines.push(`- R3 Executor context-packet candidates: ${sc.r3.length} rows`);
    lines.push(`- R4 Verifier goal-backward candidates: ${sc.r4.length} rows`);
    lines.push(`- R5 Orchestrator turn-trim candidates: ${sc.r5.length} rows`);
    lines.push('');
    const dumpRule = (label, list, threshold) => {
      lines.push(`### ${label} (top 20 by total tokens)`);
      const top = [...list].sort((a, b) =>
        (b.token_breakdown.total_tokens || 0) - (a.token_breakdown.total_tokens || 0)
      ).slice(0, 20);
      lines.push('| Phase | Milestone | Total | Threshold trip |');
      lines.push('|-------|-----------|------:|----------------|');
      for (const r of top) {
        lines.push(`| ${r.phase || '-'} | ${r.milestone || '-'} | ${(r.token_breakdown.total_tokens||0).toLocaleString('en-US')} | ${threshold} |`);
      }
      lines.push('');
    };
    dumpRule('R1 Researcher local-script', sc.r1, 'cache>0.9 + findings<15');
    dumpRule('R2 Codex reviewer fallback', sc.r2, 'codex fallback_triggered');
    dumpRule('R3 Executor context-packet', sc.r3, 'files_read>50');
    dumpRule('R4 Verifier goal-backward', sc.r4, 'cache>0.85');
    dumpRule('R5 Orchestrator turn-trim', sc.r5, 'total>200k');

    // Section 6: Audit Crosscheck
    lines.push('## 6. Audit Crosscheck');
    const find = (predicate) => rows.filter(predicate);
    const p36r = find((r) => r.role === 'researcher' && String(r.phase) === '36' && (r.token_breakdown.total_tokens||0) > 100000);
    const p40r = find((r) => r.role === 'researcher' && String(r.phase) === '40' && (r.token_breakdown.total_tokens||0) > 100000);
    const p41o = find((r) => r.role === 'orchestrator' && String(r.phase) === '41' && r.milestone === 'v1.9');
    const p41sum = p41o.reduce((n, r) => n + (r.token_breakdown.total_tokens || 0), 0);
    lines.push(`- [${p36r.length ? 'x' : ' '}] P36 researcher >=170k -- ${p36r.length ? 'found at run_id ' + p36r[0].run_id : 'explicitly unavailable: no row matches role=researcher phase=36 total>100k in baseline'}`);
    lines.push(`- [${p40r.length ? 'x' : ' '}] P40 researcher >=122k -- ${p40r.length ? 'found at run_id ' + p40r[0].run_id : 'explicitly unavailable: no row matches role=researcher phase=40 total>100k in baseline'}`);
    lines.push(`- [${p41o.length ? 'x' : ' '}] v1.9/P41 orchestrator >=1.24M -- ${p41o.length ? `found at ${p41o.length} rows summing to ${p41sum.toLocaleString('en-US')}` : 'explicitly unavailable: no orchestrator rows for v1.9 phase 41'}`);
    lines.push('');

    // Section 7: Methodology
    lines.push('## 7. Methodology');
    lines.push('- Source streams walked: token-attribution.jsonl (PRIMARY exact),');
    lines.push('  codex-log.jsonl (SECONDARY byte-estimated tokens=round(bytes/4)),');
    lines.push('  token-log.jsonl (LEGACY; stub rows model=unknown total<10 skipped).');
    lines.push('- Estimation policy: tokens_estimated:true ONLY for codex-log and');
    lines.push('  legacy rows lacking a usage object. Every token-attribution row');
    lines.push('  carries tokens_estimated:false.');
    lines.push('- Confidence levels: token-attribution -> exact_usage_fields;');
    lines.push('  codex-log -> codex_review_pass + tokens_estimated;');
    lines.push('  token-log meaningful -> low_legacy_stub.');
    lines.push('- Useful-findings proxy (LOCK 10): tool_stats.linesAdded for');
    lines.push('  research/executor/planner roles; tool_stats.editFileCount +');
    lines.push('  searchCount for verifier/reviewer/classifier/other. Phase 42');
    lines.push('  may refine.');
    lines.push('- Orchestrator self-spend INCLUDED per LOCK 6 (largest consumer');
    lines.push('  per audit:103-112).');
    lines.push('');

    const md = lines.join('\n') + '\n';
    if (o.outPath !== false) {
      const fallbackOut = path.resolve(__dirname, '..', '..', '..',
        '.planning', 'milestones', milestone, 'baseline-token-spend.md');
      const out = o.outPath || fallbackOut;
      fs.mkdirSync(path.dirname(out), { recursive: true });
      fs.writeFileSync(out, md, 'utf8');
    }
    return md;
  } catch (e) {
    console.warn('[SGSD] agent-token-spend report failed:', e.message);
    return '';
  }
}

// -- self-test --------------------------------------------------------------
function selfTest() {
  let pass = 0, fail = 0;
  const failures = [];
  const assert = (name, cond, detail) => {
    if (cond) { pass++; }
    else { fail++; failures.push({ name, detail: detail || '' }); }
  };

  // Canonical-stream fingerprint guard. RESEARCH 7.1.
  const realLedger = path.resolve(__dirname, '..', '..', '..',
    '.planning', 'metrics', 'agent-token-spend.jsonl');
  const realSrcs = [
    path.resolve(__dirname, '..', '..', '..', '.planning', 'metrics', 'token-attribution.jsonl'),
    path.resolve(__dirname, '..', '..', '..', '.planning', 'metrics', 'token-log.jsonl'),
    path.resolve(__dirname, '..', '..', '..', '.planning', 'metrics', 'codex-log.jsonl'),
    path.resolve(__dirname, '..', '..', '..', '.planning', 'metrics', 'activity-log.jsonl'),
  ];
  const fp = (p) => fs.existsSync(p)
    ? { exists: true, mtime: fs.statSync(p).mtimeMs, size: fs.statSync(p).size }
    : { exists: false, mtime: 0, size: 0 };
  const before = { ledger: fp(realLedger), srcs: realSrcs.map(fp) };

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ats-'));
  try {
    // 1. ROLES frozen 8-entry.
    let f1 = false;
    try { ROLES.push('x'); } catch (e) { f1 = true; }
    assert('1. ROLES is frozen 8-entry', Array.isArray(ROLES) && ROLES.length === 8 && (f1 || ROLES.length === 8));

    // 2. PROVIDERS frozen 4-entry.
    let f2 = false;
    try { PROVIDERS.push('x'); } catch (e) { f2 = true; }
    assert('2. PROVIDERS is frozen 4-entry', Array.isArray(PROVIDERS) && PROVIDERS.length === 4 && (f2 || PROVIDERS.length === 4));

    // 3. STATUSES frozen 6-entry.
    assert('3. STATUSES is frozen 6 envelope-v1 states',
      Array.isArray(STATUSES) && STATUSES.length === 6 &&
      ['ok','warn','fail','skipped','timeout','blocked'].every((s) => STATUSES.includes(s)));

    // 4. BLOAT_THRESHOLDS frozen 8-key with numeric >0.
    const btKeys = Object.keys(BLOAT_THRESHOLDS);
    assert('4. BLOAT_THRESHOLDS frozen 8-key, all numeric > 0',
      btKeys.length === 8 && Object.isFrozen(BLOAT_THRESHOLDS) &&
      btKeys.every((k) => typeof BLOAT_THRESHOLDS[k] === 'number' && BLOAT_THRESHOLDS[k] > 0));

    // 5. Empty read on fresh tmpdir.
    assert('5. empty read on fresh tmpdir returns []',
      Array.isArray(_readRows(tmp)) && _readRows(tmp).length === 0);

    // 6. Single appendTokenSpend -> envelope-shaped row.
    const r1 = appendTokenSpend(tmp, {
      role: 'researcher', provider: 'claude',
      phase: '36', milestone: 'v1.8',
      evidence: [{ kind: 'token_attribution_row', ref: 'attribution:test:1' }],
      token_breakdown: { input_tokens: 1, cache_read_tokens: 80000, output_tokens: 700,
        total_tokens: 80701, useful_findings: 6 },
    });
    const rows6 = _readRows(tmp);
    assert('6. single append -> envelope-shaped row + 3 ext fields',
      r1 && r1.envelope_version === 1 && r1.command === 'logTokenSpend' &&
      r1.role === 'researcher' && r1.provider === 'claude' &&
      r1.token_breakdown && r1.token_breakdown.total_tokens === 80701 &&
      Math.abs(r1.token_breakdown.cache_read_ratio - (80000/80701)) < 1e-6 &&
      RUN_ID_REGEX.test(r1.run_id) &&
      rows6.length === 1);

    // 7. Invalid role -> false.
    let bad7 = null, threw7 = false;
    try { bad7 = appendTokenSpend(tmp, { role: 'banana', provider: 'claude' }); }
    catch (e) { threw7 = true; }
    assert('7. invalid role returns false; never throws upward',
      bad7 === false && !threw7);

    // 8. Invalid provider -> false.
    let bad8 = null, threw8 = false;
    try { bad8 = appendTokenSpend(tmp, { role: 'researcher', provider: 'foo' }); }
    catch (e) { threw8 = true; }
    assert('8. invalid provider returns false; never throws upward',
      bad8 === false && !threw8);

    // 9. Three sequential appends -> three rows.
    const tmp9 = fs.mkdtempSync(path.join(os.tmpdir(), 'ats-9-'));
    try {
      appendTokenSpend(tmp9, { role: 'researcher', provider: 'claude',
        evidence: [{kind:'a',ref:'a:1'}], token_breakdown: { total_tokens: 100 } });
      appendTokenSpend(tmp9, { role: 'planner', provider: 'claude',
        evidence: [{kind:'a',ref:'a:2'}], token_breakdown: { total_tokens: 200 } });
      appendTokenSpend(tmp9, { role: 'executor', provider: 'codex',
        evidence: [{kind:'a',ref:'a:3'}], token_breakdown: { total_tokens: 300 } });
      assert('9. three sequential appends -> three rows; never truncated',
        _readRows(tmp9).length === 3);
    } finally { fs.rmSync(tmp9, { recursive: true, force: true }); }

    // 10. Defensive read: malformed line skipped.
    const tmp10 = fs.mkdtempSync(path.join(os.tmpdir(), 'ats-10-'));
    try {
      appendTokenSpend(tmp10, { role: 'researcher', provider: 'claude',
        evidence:[{kind:'a',ref:'a:1'}], token_breakdown:{ total_tokens: 1 } });
      fs.appendFileSync(ledgerPath(tmp10), '{not-json\n', 'utf8');
      appendTokenSpend(tmp10, { role: 'planner', provider: 'claude',
        evidence:[{kind:'a',ref:'a:2'}], token_breakdown:{ total_tokens: 2 } });
      assert('10. malformed line skipped; subsequent valid append readable',
        _readRows(tmp10).length === 2);
    } finally { fs.rmSync(tmp10, { recursive: true, force: true }); }

    // 11. backfillFromMetrics with synthetic source rows.
    const tmp11 = fs.mkdtempSync(path.join(os.tmpdir(), 'ats-11-'));
    try {
      const srcDir = path.join(tmp11, 'metrics');
      fs.mkdirSync(srcDir, { recursive: true });
      // token-attribution: agent_result + assistant_turn
      const tA = path.join(srcDir, 'token-attribution.jsonl');
      fs.writeFileSync(tA, [
        JSON.stringify({event_type:'agent_result', event_id:'ag:1', ts:'2026-04-26T00:00:00Z',
          agent_role:'research', agent_type:'gsd-phase-researcher', model:'claude-opus-4-7',
          phase:'36', milestone:'v1.8', total_tokens:170000,
          usage:{input_tokens:10, cache_creation_input_tokens:5000, cache_read_input_tokens:160000, output_tokens:4990, total_tokens:170000},
          tool_stats:{readCount:9, linesAdded:519}}),
        JSON.stringify({event_type:'assistant_turn', event_id:'at:1', ts:'2026-04-26T01:00:00Z',
          model:'claude-opus-4-7', phase:'41', milestone:'v1.9',
          usage:{input_tokens:6, cache_creation_input_tokens:53986, cache_read_input_tokens:0, output_tokens:247, total_tokens:54239}}),
      ].join('\n') + '\n');
      // codex-log
      fs.writeFileSync(path.join(srcDir, 'codex-log.jsonl'),
        JSON.stringify({ts:'2026-04-24T02:39:05Z', phase:15, plan:null, step:'muda',
          exit:0, duration_ms:30000, prompt_bytes:35004, report_bytes:1200,
          timeout_hit:false, fallback_triggered:false}) + '\n');
      // token-log: stub + meaningful
      fs.writeFileSync(path.join(srcDir, 'token-log.jsonl'), [
        JSON.stringify({ts:'2026-04-20T00:00:00Z', model:'unknown', est_input:1, est_output:0, total:1}),
        JSON.stringify({ts:'2026-04-21T00:00:00Z', model:'claude-opus-4-7', est_input:500, est_output:200, total:700, tool:'Read'}),
      ].join('\n') + '\n');

      const out = backfillFromMetrics(tmp11, {});
      const all = _readRows(tmp11);
      assert('11. backfillFromMetrics produces 4 envelope rows from 4 source-stream cases',
        out.rowsAppended === 4 && all.length === 4 &&
        all.some((r) => r.role === 'researcher' && r.provider === 'claude' && r.token_breakdown.tokens_estimated === false) &&
        all.some((r) => r.role === 'orchestrator' && r.token_breakdown.tokens_estimated === false) &&
        all.some((r) => r.provider === 'codex' && r.token_breakdown.tokens_estimated === true) &&
        all.some((r) => r.role === 'other' && r.token_breakdown.tokens_estimated === true));

      // Idempotency check inside assertion 11.
      const out2 = backfillFromMetrics(tmp11, {});
      assert('11b. backfillFromMetrics idempotent on re-run',
        out2.rowsAppended === 0 && _readRows(tmp11).length === 4);
    } finally { fs.rmSync(tmp11, { recursive: true, force: true }); }

    // 12. summarize aggregates by role with correct cache_read_ratio.
    const tmp12 = fs.mkdtempSync(path.join(os.tmpdir(), 'ats-12-'));
    try {
      const t = [1000, 10000, 100000, 150000, 200000];
      for (let i = 0; i < t.length; i++) {
        appendTokenSpend(tmp12, {
          role: 'researcher', provider: 'claude',
          phase: '36', milestone: 'v1.8',
          evidence:[{kind:'a',ref:`r:${i}`}],
          token_breakdown: { input_tokens: 100, cache_read_tokens: Math.round(t[i]*0.95),
            output_tokens: Math.round(t[i]*0.04), total_tokens: t[i], useful_findings: 5 },
        });
      }
      const sum = summarize(tmp12, { groupBy: 'role' });
      const r = sum.find((s) => s.key === 'researcher');
      const expectedTotal = t.reduce((n, x) => n + x, 0);
      const expectedCache = t.reduce((n, x) => n + Math.round(x*0.95), 0);
      assert('12. summarize aggregates by role with correct cache_read_ratio',
        r && r.calls === 5 && r.total === expectedTotal &&
        Math.abs(r.cache_read_ratio - (expectedCache / expectedTotal)) < 1e-3 &&
        r.avg === Math.round(expectedTotal / 5));
    } finally { fs.rmSync(tmp12, { recursive: true, force: true }); }

    // 13. summarize milestone filter excludes other milestones.
    const tmp13 = fs.mkdtempSync(path.join(os.tmpdir(), 'ats-13-'));
    try {
      appendTokenSpend(tmp13, { role: 'researcher', provider: 'claude',
        phase: '32', milestone: 'v1.7', evidence:[{kind:'a',ref:'r:1'}],
        token_breakdown:{ total_tokens: 1000 } });
      appendTokenSpend(tmp13, { role: 'researcher', provider: 'claude',
        phase: '36', milestone: 'v1.8', evidence:[{kind:'a',ref:'r:2'}],
        token_breakdown:{ total_tokens: 2000 } });
      appendTokenSpend(tmp13, { role: 'researcher', provider: 'claude',
        phase: '37', milestone: 'v1.8', evidence:[{kind:'a',ref:'r:3'}],
        token_breakdown:{ total_tokens: 3000 } });
      const v17 = summarize(tmp13, { milestone: 'v1.7' });
      const v18 = summarize(tmp13, { milestone: 'v1.8' });
      assert('13. summarize milestone filter excludes other milestones',
        v17.length === 1 && v17[0].calls === 1 && v17[0].total === 1000 &&
        v18.length === 1 && v18[0].calls === 2 && v18[0].total === 5000);
    } finally { fs.rmSync(tmp13, { recursive: true, force: true }); }

    // 14. Canonical streams untouched by self-test.
    const after = { ledger: fp(realLedger), srcs: realSrcs.map(fp) };
    const sameLedger = before.ledger.exists === after.ledger.exists
      && before.ledger.mtime === after.ledger.mtime
      && before.ledger.size === after.ledger.size;
    const sameSrcs = before.srcs.every((b, i) =>
      b.exists === after.srcs[i].exists &&
      b.mtime === after.srcs[i].mtime &&
      b.size === after.srcs[i].size);
    assert('14. canonical streams (ledger + 4 sources) untouched by self-test',
      sameLedger && sameSrcs);

  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }

  console.log(`agent-token-spend self-test: ${pass} pass, ${fail} fail`);
  if (fail > 0) {
    for (const f of failures) console.error(`  FAIL: ${f.name}${f.detail ? ' -- ' + f.detail : ''}`);
    return 1;
  }
  return 0;
}

// -- main -------------------------------------------------------------------
if (require.main === module) {
  const cmd = process.argv[2];
  // __dirname-anchored canonical default. Phase 32 W3 + Phase 36 W2 lesson.
  const idx = process.argv.indexOf('--planning-dir');
  const planningDir = (idx > 0 && process.argv[idx + 1])
    ? path.resolve(process.argv[idx + 1])
    : path.resolve(__dirname, '..', '..', '..', '.planning');

  if (cmd === '--self-test') process.exit(selfTest());

  if (cmd === '--backfill') {
    const dryRun = process.argv.includes('--dry-run');
    const result = backfillFromMetrics(planningDir, { dryRun });
    console.log(JSON.stringify(result, null, 2));
    process.exit(result.errors && result.errors.length > 0 ? 1 : 0);
  }

  if (cmd === '--report') {
    const mIdx = process.argv.indexOf('--milestone');
    const milestone = (mIdx > 0 && process.argv[mIdx + 1]) ? process.argv[mIdx + 1] : 'v1.9';
    report(planningDir, { milestone });
    console.log(`baseline-token-spend.md generated for ${milestone}`);
    process.exit(0);
  }

  if (cmd === '--summary') {
    const gIdx = process.argv.indexOf('--group-by');
    const groupBy = (gIdx > 0 && process.argv[gIdx + 1]) ? process.argv[gIdx + 1] : 'role';
    const mIdx = process.argv.indexOf('--milestone');
    const opts = { groupBy };
    if (mIdx > 0 && process.argv[mIdx + 1]) opts.milestone = process.argv[mIdx + 1];
    console.log(JSON.stringify(summarize(planningDir, opts), null, 2));
    process.exit(0);
  }

  console.log('Usage:');
  console.log('  node super-gsd/tools/token-attribution/report.cjs --self-test');
  console.log('  node super-gsd/tools/token-attribution/report.cjs --backfill [--dry-run] [--planning-dir <path>]');
  console.log('  node super-gsd/tools/token-attribution/report.cjs --report [--milestone v1.9] [--planning-dir <path>]');
  console.log('  node super-gsd/tools/token-attribution/report.cjs --summary [--group-by role|phase|provider|role+phase|role+phase+provider] [--milestone v1.9]');
  process.exit(0);
}

module.exports = {
  // 4 + 1 public APIs (per RESEARCH 6.2):
  appendTokenSpend,
  backfillFromMetrics,
  report,
  summarize,
  ledgerPath,
  // Frozen consts (per RESEARCH 2.3 + 6.2):
  ROLES,
  PROVIDERS,
  STATUSES,
  BLOAT_THRESHOLDS,
  COMMAND_NAME,
  ENVELOPE_VERSION,
};
```

ASCII compliance: every char in the file MUST be ASCII (0x20-0x7E plus
LF). Run `node -e "const s=fs.readFileSync('super-gsd/tools/token-attribution/report.cjs','utf8');for(let i=0;i<s.length;i++){if(s.charCodeAt(i)>127){console.error('non-ASCII at',i,s.charAt(i));process.exit(1)}}"`
before commit.

Run `node super-gsd/tools/token-attribution/report.cjs --self-test`.
Self-test MUST exit 0 with `agent-token-spend self-test: 14 pass, 0 fail`.
Self-test FAIL = STOP and fix; do NOT proceed to A2 / A3.

Commit: `feat(41-01): token-attribution/report.cjs lib + 14-assertion self-test`
  </action>
  <verify>
<automated>
node super-gsd/tools/token-attribution/report.cjs --self-test 2>&1 | tail -5
node -e "const r=require('./super-gsd/tools/token-attribution/report.cjs');if(!Object.isFrozen(r.ROLES)||r.ROLES.length!==8){console.error('ROLES wrong');process.exit(1)};if(!Object.isFrozen(r.PROVIDERS)||r.PROVIDERS.length!==4){console.error('PROVIDERS wrong');process.exit(1)};if(!Object.isFrozen(r.BLOAT_THRESHOLDS)||Object.keys(r.BLOAT_THRESHOLDS).length!==8){console.error('BLOAT wrong');process.exit(1)};console.log('PASS frozen consts')"
node -e "const s=require('fs').readFileSync('super-gsd/tools/token-attribution/report.cjs','utf8');for(let i=0;i<s.length;i++){if(s.charCodeAt(i)>127){console.error('non-ASCII at',i,JSON.stringify(s.charAt(i)));process.exit(1)}}console.log('PASS ASCII-only')"
</automated>
  </verify>
  <done>
- super-gsd/tools/token-attribution/report.cjs exists and exports
  exactly: appendTokenSpend, backfillFromMetrics, report, summarize,
  ledgerPath, ROLES, PROVIDERS, STATUSES, BLOAT_THRESHOLDS,
  COMMAND_NAME, ENVELOPE_VERSION.
- Self-test exits 0 with 14 pass, 0 fail.
- File is ASCII-only (LF; no CRLF; no non-ASCII).
- ROLES is frozen 8-entry; PROVIDERS frozen 4-entry; STATUSES frozen
  6-entry; BLOAT_THRESHOLDS frozen 8-key.
- Header docblock cites RESEARCH section numbers and contains NO
  references to gate / outcome / retroactive / Phase 36 (mirror leak
  prevention; RESEARCH 12.4 risk row 1).
- File committed: `feat(41-01): token-attribution/report.cjs lib + 14-assertion self-test`.
  </done>
</task>

<task type="auto">
  <name>Task T1.A2: Run --backfill, derive baseline ledger from canonical streams</name>
  <files>.planning/metrics/agent-token-spend.jsonl</files>
  <action>
PRECONDITION: Task T1 self-test exits 0. Do NOT run this if T1 failed.

Run the backfill against the live repo:

```bash
node super-gsd/tools/token-attribution/report.cjs --backfill 2>&1 | tee /tmp/sgsd-41-backfill.json
```

Expected output (JSON to stdout):
```json
{
  "rowsRead": <approx 11240+>,
  "rowsAppended": <approx 11200+>,
  "rowsSkipped": <small (token-log stubs)>,
  "errors": []
}
```

Acceptance gates:

1. `wc -l .planning/metrics/agent-token-spend.jsonl` returns >= 10000.
   If <10000: STOP and surface BLOCKER (RESEARCH 11 falsifier triggered:
   would mean source data missing or schema mismatched).

2. Idempotent re-run check:
   ```bash
   cp .planning/metrics/agent-token-spend.jsonl /tmp/ats-snapshot-1.jsonl
   node super-gsd/tools/token-attribution/report.cjs --backfill 2>&1 | tail -3
   diff -q .planning/metrics/agent-token-spend.jsonl /tmp/ats-snapshot-1.jsonl
   ```
   Re-run MUST report `rowsAppended:0` AND diff MUST be silent
   (byte-identical). If diff differs: STOP; dedup is broken; rewind T1.

3. Canonical-source untouched check (LOCK 3):
   ```bash
   git status --porcelain .planning/metrics/token-attribution.jsonl
   git status --porcelain .planning/metrics/codex-log.jsonl
   git status --porcelain .planning/metrics/token-log.jsonl
   git status --porcelain .planning/metrics/activity-log.jsonl
   ```
   All four MUST emit zero lines (no modifications). If any source
   stream shows modification: STOP IMMEDIATELY; revert; dead-end 3
   violated.

4. Envelope-v1 conformance spot-check on 5 random rows:
   ```bash
   node -e "
   const fs = require('fs');
   const lines = fs.readFileSync('.planning/metrics/agent-token-spend.jsonl','utf8').split(/\r?\n/).filter(Boolean);
   const required = ['envelope_version','ts','command','status','reason_codes','artifacts','evidence','next_action','risk','duration_ms','run_id','phase','milestone','role','provider','token_breakdown'];
   const RUN_ID = /^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(?:\.[0-9]+)?Z-[a-f0-9]{4}\$/;
   for (let i = 0; i < 5; i++) {
     const idx = Math.floor(Math.random() * lines.length);
     const r = JSON.parse(lines[idx]);
     for (const k of required) {
       if (!(k in r)) { console.error('row',idx,'missing',k); process.exit(1); }
     }
     if (r.envelope_version !== 1) { console.error('envelope_version'); process.exit(1); }
     if (r.command !== 'logTokenSpend') { console.error('command'); process.exit(1); }
     if (!RUN_ID.test(r.run_id)) { console.error('run_id pattern'); process.exit(1); }
   }
   console.log('PASS 5/5 envelope-v1 conformance');
   "
   ```

5. Role distribution sanity check:
   ```bash
   node -e "
   const fs = require('fs');
   const rows = fs.readFileSync('.planning/metrics/agent-token-spend.jsonl','utf8').split(/\r?\n/).filter(Boolean).map(JSON.parse);
   const counts = {};
   for (const r of rows) counts[r.role] = (counts[r.role]||0) + 1;
   console.log(JSON.stringify(counts,null,2));
   if (!counts.orchestrator || counts.orchestrator < 100) { console.error('FAIL orchestrator <100 (LOCK 6 violation)'); process.exit(1); }
   if (!counts.researcher) { console.error('FAIL no researcher rows'); process.exit(1); }
   console.log('PASS role distribution');
   "
   ```

Commit: `feat(41-01): backfill agent-token-spend.jsonl from canonical streams (>=10k rows)`
  </action>
  <verify>
<automated>
[ "$(wc -l < .planning/metrics/agent-token-spend.jsonl)" -ge 10000 ] && echo "PASS BASE-02 row count" || (echo "FAIL BASE-02"; exit 1)
cp .planning/metrics/agent-token-spend.jsonl /tmp/ats-snapshot-2.jsonl
node super-gsd/tools/token-attribution/report.cjs --backfill 2>&1 | tail -1
diff -q .planning/metrics/agent-token-spend.jsonl /tmp/ats-snapshot-2.jsonl && echo "PASS idempotent" || (echo "FAIL idempotent"; exit 1)
git diff --quiet HEAD -- .planning/metrics/token-attribution.jsonl .planning/metrics/codex-log.jsonl .planning/metrics/token-log.jsonl .planning/metrics/activity-log.jsonl && echo "PASS sources read-only" || (echo "FAIL sources modified"; exit 1)
</automated>
  </verify>
  <done>
- .planning/metrics/agent-token-spend.jsonl exists with >=10,000 rows.
- Re-run `--backfill` reports `rowsAppended:0` and yields byte-identical
  output (diff silent).
- All 4 canonical source streams unmodified (git diff silent).
- 5 random rows pass envelope-v1 conformance check.
- Role distribution includes orchestrator (>=100; LOCK 6 honored) and
  researcher (>0).
- Ledger committed: `feat(41-01): backfill agent-token-spend.jsonl from canonical streams (>=10k rows)`.
  </done>
</task>

<task type="auto">
  <name>Task T1.A3: Run --report, generate baseline-token-spend.md</name>
  <files>.planning/milestones/v1.9/baseline-token-spend.md</files>
  <action>
PRECONDITION: Task T1.A2 produced a >=10k-row ledger and verified
idempotency + canonical untouched.

Run:

```bash
node super-gsd/tools/token-attribution/report.cjs --report --milestone v1.9
```

Expected stdout:
```
baseline-token-spend.md generated for v1.9
```

Acceptance gates (all 3 BASE-03 + BASE-04 acceptance):

1. File exists at the locked path:
   ```bash
   test -f .planning/milestones/v1.9/baseline-token-spend.md
   ```

2. All 7 RESEARCH 4.2 sections present:
   ```bash
   grep -q "^# v1.9 Baseline Token Spend Report" .planning/milestones/v1.9/baseline-token-spend.md
   grep -q "^## 1. Headline Numbers" .planning/milestones/v1.9/baseline-token-spend.md
   grep -q "^## 2. Top Consumers by Role x Milestone" .planning/milestones/v1.9/baseline-token-spend.md
   grep -q "^## 3. Top Consumers by Role x Phase x Provider" .planning/milestones/v1.9/baseline-token-spend.md
   grep -q "^## 4. Outliers (Bloat Signature)" .planning/milestones/v1.9/baseline-token-spend.md
   grep -q "^## 5. Substitution Candidates" .planning/milestones/v1.9/baseline-token-spend.md
   grep -q "^## 6. Audit Crosscheck" .planning/milestones/v1.9/baseline-token-spend.md
   grep -q "^## 7. Methodology" .planning/milestones/v1.9/baseline-token-spend.md
   ```
   ALL 8 grep MUST succeed (zero exit). One miss = STOP; fix renderer.

3. Substitution-candidate enumeration (BASE-04):
   ```bash
   grep -q "R1 Researcher local-script candidates" .planning/milestones/v1.9/baseline-token-spend.md
   grep -q "R2 Codex reviewer fallback candidates" .planning/milestones/v1.9/baseline-token-spend.md
   grep -q "R3 Executor context-packet candidates" .planning/milestones/v1.9/baseline-token-spend.md
   grep -q "R4 Verifier goal-backward candidates" .planning/milestones/v1.9/baseline-token-spend.md
   grep -q "R5 Orchestrator turn-trim candidates" .planning/milestones/v1.9/baseline-token-spend.md
   ```
   All 5 R-rules MUST appear. Each MUST display a row count
   ("N rows").

4. Audit crosscheck markers present (RESEARCH 3.5):
   ```bash
   grep -q "P36 researcher" .planning/milestones/v1.9/baseline-token-spend.md
   grep -q "P40 researcher" .planning/milestones/v1.9/baseline-token-spend.md
   grep -q "v1.9/P41 orchestrator" .planning/milestones/v1.9/baseline-token-spend.md
   ```
   3 crosscheck lines MUST exist (each can show found OR explicitly
   unavailable; both are acceptable per RESEARCH 3.5).

5. ASCII compliance:
   ```bash
   node -e "const s=require('fs').readFileSync('.planning/milestones/v1.9/baseline-token-spend.md','utf8');for(let i=0;i<s.length;i++){if(s.charCodeAt(i)>127){console.error('non-ASCII at',i);process.exit(1)}}console.log('PASS ASCII-only')"
   ```

6. NOT a raw row dump (LOCK 10): file must be < 200KB. Outlier section
   MUST cap at 50 rows; substitution sections cap at 20 rows each:
   ```bash
   sz=$(wc -c < .planning/milestones/v1.9/baseline-token-spend.md)
   [ "$sz" -lt 200000 ] && echo "PASS size guard ($sz bytes)" || (echo "FAIL too large ($sz)"; exit 1)
   ```

Commit: `feat(41-01): generate baseline-token-spend.md (top-consumer + outlier + substitution)`
  </action>
  <verify>
<automated>
test -f .planning/milestones/v1.9/baseline-token-spend.md && echo "PASS file exists" || (echo "FAIL no file"; exit 1)
grep -q "Top Consumer" .planning/milestones/v1.9/baseline-token-spend.md && echo "PASS top-consumer table"
grep -q "Outlier" .planning/milestones/v1.9/baseline-token-spend.md && echo "PASS outlier section"
grep -q "Substitution Candidate" .planning/milestones/v1.9/baseline-token-spend.md && echo "PASS substitution section"
grep -q "Audit Crosscheck" .planning/milestones/v1.9/baseline-token-spend.md && echo "PASS audit crosscheck"
grep -q "Methodology" .planning/milestones/v1.9/baseline-token-spend.md && echo "PASS methodology"
node -e "const s=require('fs').readFileSync('.planning/milestones/v1.9/baseline-token-spend.md','utf8');for(let i=0;i<s.length;i++){if(s.charCodeAt(i)>127){console.error('non-ASCII at',i);process.exit(1)}}console.log('PASS ASCII-only')"
</automated>
  </verify>
  <done>
- .planning/milestones/v1.9/baseline-token-spend.md exists.
- All 7 RESEARCH 4.2 sections present (1. Headline Numbers, 2. Top
  Consumers Role x Milestone, 3. Top Consumers Role x Phase x Provider,
  4. Outliers, 5. Substitution Candidates, 6. Audit Crosscheck, 7.
  Methodology).
- All 5 R-rules enumerated with row counts.
- 3 audit crosscheck lines present (found OR explicitly unavailable).
- File size <200KB (filtered/aggregated, not raw dump).
- ASCII-only.
- Report committed: `feat(41-01): generate baseline-token-spend.md (top-consumer + outlier + substitution)`.
  </done>
</task>

</tasks>

<live_or_local_fallback>
RESEARCH section 8.

| Mode | Source | Use case |
|------|--------|----------|
| LIVE | `--backfill` walks production .planning/metrics/*.jsonl | Real baseline derivation; runs in T1.A2 against this repo |
| LOCAL | `--self-test` seeds tmpdir with synthetic rows (4 source-stream cases per assertion 11) | CI-safe; never touches canonical streams |

LIVE is hard requirement (audit:103-112 confirms v1.9/P41 itself spent
1.24M orchestrator tokens; the phase MUST be backfillable). LOCAL is
required by EXISTING-SURFACE-AUDIT.md:54-60 ("CLI entrypoint, --self-test,
deterministic fixtures, production caller path, JSON output where
practical"). Both wired by Task T1 self-test (assertions 5-14 are LOCAL;
T1.A2 is LIVE).
</live_or_local_fallback>

<schema_without_consumer_rule>
RESEARCH section 9. Phase 41 ships 4 in-phase consumers exercising the
schema:

1. `appendTokenSpend` (canonical writer) -- writes the schema. Self-test
   assertions 6, 7, 8, 9, 10 exercise it.
2. `backfillFromMetrics` (bootstrap consumer) -- reads upstream, writes
   envelope-v1 rows. Self-test assertion 11 exercises it. T1.A2 runs
   it against the live repo.
3. `report` (human consumer) -- reads ledger, renders markdown.
   T1.A3 runs it against the live ledger.
4. `summarize` (machine consumer) -- reads ledger, returns JSON
   aggregations. Self-test assertions 12, 13 exercise it. Phase 42
   `token-waste/check.cjs` (BUDGET-01) imports this signature verbatim.

All 4 exported from one file. All 4 exercised by self-test +
LIVE backfill + LIVE report. No schema field unused. Rule satisfied.

Phase 42, 47, 51 are FUTURE consumers; this phase satisfies the rule on
the merits of its 4 in-phase consumers without depending on future work.
</schema_without_consumer_rule>

<constraints>
- ASCII only (Phase 39 W4 lesson). Use `--` not em-dashes; `->` not
  arrows; `>=` not the unicode glyph.
- LF line endings (no CRLF; the lib loads on WSL CI which is strict).
- No new dependencies. Node built-ins only: fs, path, os, crypto.
  Manual minimal markdown render (string-template; no engine).
- Mirror gate-value-log.cjs architecture 1:1: frozen consts, _normalize
  + _assertEnvelopeV1 + _appendRowInternal trio, public APIs in
  try/catch, defensive read, __dirname-anchored fingerprint guard.
- LOCK 6: orchestrator self-spend INCLUDED.
- LOCK 12: never use `process.cwd()` for canonical-path default.
  Always anchor to `__dirname` with 3-up walk to `.planning`.
- File must load in <50ms (mirror property; no module-level work
  beyond const declarations).
- Public API failure contract: NEVER throw upward at boundary. Closed-
  enum violations raise inside `_appendRowInternal`; the public helper
  wraps every call in try/catch; on error console.warn to stderr and
  return false.
- Header docblock MUST be rewritten (no `gate` / `outcome` /
  `retroactive` leak; risk row 1 in RESEARCH 12.4).
- Report file size guard: <200KB. Outlier rows capped at 50; each R-rule
  capped at 20 rows.
</constraints>

<commit_plan>
Three atomic commits, in order:

1. `feat(41-01): token-attribution/report.cjs lib + 14-assertion self-test`
   Files: super-gsd/tools/token-attribution/report.cjs

2. `feat(41-01): backfill agent-token-spend.jsonl from canonical streams (>=10k rows)`
   Files: .planning/metrics/agent-token-spend.jsonl

3. `feat(41-01): generate baseline-token-spend.md (top-consumer + outlier + substitution)`
   Files: .planning/milestones/v1.9/baseline-token-spend.md

Commit discipline (CLAUDE.md):
- Stage specific files by name. Never `git add -A`.
- Commit after EACH atomic deliverable. Do not batch.
- Commit message format: `feat({phase}-{plan}): {one-liner}`.
- If self-test fails after a commit, the NEXT commit fixes it -- never
  amend. (CLAUDE.md: NEVER amend.)
</commit_plan>

<verification>
Runnable phase-acceptance script. Executor MUST run end-to-end after
T1.A3:

```bash
# === BASE-01 + envelope-v1 conformance ===
node super-gsd/tools/token-attribution/report.cjs --self-test
# expect: agent-token-spend self-test: 14 pass, 0 fail

# === BASE-02 row count ===
c=$(wc -l < .planning/metrics/agent-token-spend.jsonl)
[ "$c" -ge 10000 ] && echo "PASS BASE-02 ($c rows)" || (echo "FAIL BASE-02"; exit 1)

# === BASE-02 idempotency ===
cp .planning/metrics/agent-token-spend.jsonl /tmp/ats-final.jsonl
node super-gsd/tools/token-attribution/report.cjs --backfill 2>&1 | tail -1
diff -q .planning/metrics/agent-token-spend.jsonl /tmp/ats-final.jsonl \
  && echo "PASS idempotent" \
  || (echo "FAIL idempotent"; exit 1)

# === BASE-02 canonical sources untouched ===
git diff --quiet HEAD -- \
  .planning/metrics/token-attribution.jsonl \
  .planning/metrics/codex-log.jsonl \
  .planning/metrics/token-log.jsonl \
  .planning/metrics/activity-log.jsonl \
  && echo "PASS sources read-only" \
  || (echo "FAIL sources modified"; exit 1)

# === BASE-03 + BASE-04 sections ===
node super-gsd/tools/token-attribution/report.cjs --report
test -f .planning/milestones/v1.9/baseline-token-spend.md \
  && echo "PASS report file exists"
grep -q "Top Consumer" .planning/milestones/v1.9/baseline-token-spend.md \
  && echo "PASS top-consumer table"
grep -q "Outlier" .planning/milestones/v1.9/baseline-token-spend.md \
  && echo "PASS outlier section"
grep -q "Substitution Candidate" .planning/milestones/v1.9/baseline-token-spend.md \
  && echo "PASS substitution section"
grep -q "R1 Researcher local-script" .planning/milestones/v1.9/baseline-token-spend.md \
  && echo "PASS R1"
grep -q "R5 Orchestrator turn-trim" .planning/milestones/v1.9/baseline-token-spend.md \
  && echo "PASS R5"
grep -q "Audit Crosscheck" .planning/milestones/v1.9/baseline-token-spend.md \
  && echo "PASS audit crosscheck"
```

All 12 PASS lines required. Any FAIL = phase NOT complete; surface as
gap in VERIFICATION.md.
</verification>

<success_criteria>
Phase 41 ships when ALL of the following are TRUE:

- [ ] `super-gsd/tools/token-attribution/report.cjs` exists, ASCII-only,
      LF line endings, no new deps, exports the locked 4+1 public APIs
      and 6 frozen consts.
- [ ] `node super-gsd/tools/token-attribution/report.cjs --self-test`
      exits 0 with 14 pass, 0 fail.
- [ ] `.planning/metrics/agent-token-spend.jsonl` exists with >=10,000
      rows; every row passes envelope-v1 manual schema check (BASE-01).
- [ ] Re-running `--backfill` reports `rowsAppended:0` and produces
      byte-identical output (BASE-02 idempotency).
- [ ] All 4 canonical source streams (token-attribution.jsonl,
      token-log.jsonl, codex-log.jsonl, activity-log.jsonl) are
      byte-identical to HEAD (read-only invariant; LOCK 3).
- [ ] `.planning/milestones/v1.9/baseline-token-spend.md` exists, ASCII,
      <200KB, contains all 7 RESEARCH 4.2 sections (BASE-03).
- [ ] All 5 R-rules enumerated in section 5 with row counts (BASE-04).
- [ ] 3 audit crosscheck lines present in section 6 (RESEARCH 3.5).
- [ ] 3 atomic commits landed: `feat(41-01): ... lib`, `feat(41-01): ...
      backfill`, `feat(41-01): ... report`.

Falsifier (RESEARCH 11 / CONTEXT kill condition): backfill produces
<100 rows. If observed: STOP; do NOT commit; surface BLOCKER citing
"source data missing or schema mismatched"; revisit Phase 41 scope.

Hard stop (LOCK 3): backfill writes to ANY of the 4 canonical source
streams. Revert immediately; the lib has a path bug that violates
read-only invariant.
</success_criteria>

<output>
After completion, create
`.planning/milestones/v1.9/phases/41-baseline-token-attribution/41-01-baseline-token-attribution-SUMMARY.md`

Required SUMMARY contents (per template):
- Tools created: super-gsd/tools/token-attribution/report.cjs (~600 LOC)
- Artifacts produced:
  - .planning/metrics/agent-token-spend.jsonl ({N} rows)
  - .planning/milestones/v1.9/baseline-token-spend.md ({N} bytes)
- Self-test result: 14/14 PASS
- Backfill result: {rowsRead, rowsAppended, rowsSkipped} JSON
- Top-3 token-consumer roles by total (from summarize --group-by role)
- Outlier count (rows with bloat signature)
- Substitution candidate counts: R1, R2, R3, R4, R5
- Audit crosscheck status: P36 researcher / P40 researcher / v1.9/P41
  orchestrator (each: found OR explicitly unavailable)
- Cross-phase contracts unblocked: Phase 42 (BUDGET-01 imports
  summarize), Phase 47 (ROUTE-02 reads R1 candidates), Phase 51
  (BENCH-01 reads baseline-token-spend.md as the "before" target).
- Commits: 3 atomic feat(41-01) commits with their SHAs.
- ATC tier observed: FULL (>=600 LOC, new file).
- Confidence: HIGH (mirror discipline preserved; envelope-v1 contract
  untouched; canonical streams read-only).
</output>
