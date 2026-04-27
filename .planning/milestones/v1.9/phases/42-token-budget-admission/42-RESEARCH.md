---
phase: 42
phase_name: Token Budget Admission
milestone: v1.9
researched: 2026-04-27
domain: Token-budget admission control + degrade/reroute policy + check-tool wiring
confidence: HIGH
controlling_principle: Make bloat visible without halting autonomy.
mirror_template: gate-keep-kill/rubric.cjs (read-only check) + Phase 41 report.cjs (imports)
upstream: Phase 41 imports (`summarize`, `BLOAT_THRESHOLDS`, `ROLES`, `STATUSES`, `PROVIDERS`, `ledgerPath`)
---

# Phase 42 - Token Budget Admission - Research

## 1. Goal Restatement + Acceptance Mapping

Phase 42 turns the Phase 41 baseline ledger into a governed admission gate so
runs that trip a budget either **degrade** (continue with a flagged status row)
or **reroute** (emit a routing hint Phase 47 consumes), but never silently
burn tokens. **Autonomy is preserved**: a budget breach is never a halt; halts
remain reserved for the four hard-stop conditions in `SGSD-HANDOVER.md:79-86`
(credentials, destructive op outside repo, privacy/security judgment, runtime
cannot continue). Deliverable: one tool, one config file, one status stream,
one wire-in.

### 1.1 Acceptance criteria from ROADMAP §42 (lines 89-94, verbatim)

| # | Acceptance | Phase 42 binding |
|---|------------|------------------|
| A1 | self-test covers normal, warning, degraded, false-positive cases | §7 self-test (4 fixtures + 11 secondary) |
| A2 | researcher overrun with > 90% cache-read is flagged | §6 budget table + §4.4 verdict matrix |
| A3 | check records degrade/warn status without silently halting autonomy | §4 verdict ladder + §8 hard-stop separation |
| A4 | cockpit/report output can read the result | §5 cross-phase contract + §6.5 budgets.yaml |

### 1.2 BUDGET-01..05 binding (REQUIREMENTS.md:100-109, verbatim)

| ID | Description | Phase 42 binding |
|----|-------------|------------------|
| BUDGET-01 | `super-gsd/tools/token-waste/check.cjs` | §6.1 tool + §6.2 API |
| BUDGET-02 | researcher 25k input unless VTP route; planner 30k; executor 40k unless high-risk; verifier/reviewer 20k unless full-review | §6.3 table verbatim |
| BUDGET-03 | flag cache-read > 90% AND useful_findings < 15 | §4.4 matrix; thresholds inherited from Phase 41 BLOAT_THRESHOLDS |
| BUDGET-04 | wire into phase/milestone close as warn/degrade gate, NOT hard stop | §5.2 milestone-close Step 4.7; per-phase deferred to Phase 50 |
| BUDGET-05 | surface budget status in cockpit/reports | §5.3 cockpit JSONL + §5.4 token-waste.md |

### 1.3 Design lock 13 (REQUIREMENTS:67-68, controlling correctness rule)

> "Autonomy continues; evidence tells the truth. Budget breaches degrade or
> reroute by policy. They do not become silent overrun."

This is parallel to Phase 39 RUBRIC-03's "0 fires -> defer, never kill".
Self-test fixture F3 (§7.3) is the binding regression test.

---

## 2. Audit-Driven Evidence -- Top-Consumer Rows

The Phase 41 baseline ledger holds **11,295 rows** (verified
`wc -l .planning/metrics/agent-token-spend.jsonl`). All distributions below
were computed live against that file at research time.

### 2.1 Per-role distribution (live ledger, all milestones)

| Role | N | total P50 | total P75 | total P90 | total P95 | total max | input P75 | input P95 | cache avg |
|------|--:|---------:|---------:|---------:|---------:|---------:|---------:|---------:|---------:|
| orchestrator | 10881 | 289,065 | 544,969 | 749,548 | 833,891 | 970,034 | 543,307 | 832,525 | 96.4% |
| reviewer | 151 | 37,492 | 66,518 | 91,770 | 108,080 | 160,482 | 65,958 | 104,750 | 90.3% |
| executor | 77 | 68,195 | 96,191 | 117,325 | 134,522 | 177,002 | 95,515 | 133,448 | 98.4% |
| researcher | 31 | 114,703 | 171,175 | 198,924 | 214,301 | 223,305 | 168,360 | 212,780 | 82.1% |
| planner | 36 | 102,403 | 126,327 | 146,639 | 181,708 | 187,736 | 125,466 | 180,341 | 89.7% |
| other | 116 | 12,141 | 17,763 | 49,362 | 66,873 | 99,853 | 16,644 | 63,219 | 65.4% |
| classifier | 3 | 9,912 | 14,113 | 14,113 | 14,113 | 14,113 | 13,996 | 13,996 | 37.0% |

Computed via Node script (verified, not estimated; methodology in §6.4).

### 2.2 Top consumers from `baseline-token-spend.md`

- **Orchestrator at unknown milestone**: 5,640 calls, 2.11B tokens (96.7%
  cache read). Single largest consumer system-wide.
- **Researcher v1.8 P36**: 171,175 tokens, 98.9% cache read, 6 useful findings
  (audit:139-147 row that motivates BUDGET-02).
- **Researcher v1.8 P40**: 122,437 tokens, 98.3% cache read, 8 file reads
  (audit:139-147 canonical "did 8 reads, paid for 122k" example).
- **Reviewer v1.6**: 18 calls, 991,905 tokens, 85% cache read, 6 findings/100k.
- **Executor v1.3**: 13 calls, 1,082,103 tokens, 98.2% cache read, 413
  findings/100k -- safe zone (high findings); budget should NOT trip this.

### 2.3 Outliers + R1-R5 substitution candidates

Baseline §4 outlier table (50 rows above bloat-signature: cache > 0.9 AND
findings < 15) is **100% orchestrator rows**, totals 950k-970k. R5
(orchestrator turn-trim) tripped 6,710 times in baseline §5; R1
(researcher local-script) tripped 1; R2/R3/R4 tripped 0. R5 dominates
volume; this is the highest-volume reroute hint Phase 42 emits.

### 2.4 Phase 41 P41 self-evidence (audit:103-112)

```text
scope: v1.9 / phase 41
events: 4 orchestrator turns
total tokens: 1,244,893 (cache_read 1,220,293 = 98.0%)
agent calls: 0
```

Four orchestrator turns burned 1.24M tokens, no sub-agents. Phase 42 must
emit `degraded:orchestrator_turn_trim` for this pattern.

---

## 3. Existing Surface Inventory

### 3.1 Consume, do not duplicate

| Surface | Path | Phase 42 use |
|---------|------|--------------|
| Phase 41 reporter | `super-gsd/tools/token-attribution/report.cjs` | **IMPORT** `summarize`, `BLOAT_THRESHOLDS`, `ROLES`, `STATUSES`, `PROVIDERS`, `ledgerPath` |
| Phase 41 ledger | `.planning/metrics/agent-token-spend.jsonl` | **READ-ONLY** input |
| envelope-v1 | `super-gsd/templates/command-envelope-v1.json` | status row shape |
| backlog-schema check | `super-gsd/tools/backlog-schema/check.cjs` | **MIRROR** CLI exit-code contract |
| gate-keep-kill rubric | `super-gsd/tools/gate-keep-kill/rubric.cjs` | **MIRROR** read-only check + closed-enum verdict + render table |
| phase-folder audit | `super-gsd/tools/phase-folder-audit/audit.cjs` | **MIRROR** soft-warn-only verdict pattern |
| sgsd-complete-milestone | `super-gsd/skills/sgsd-complete-milestone/SKILL.md` | **EDIT** Step 4.7 + Step 6 subsection (mirror Step 4.5/4.6 shape) |
| sgsd-token-audit skill | `super-gsd/skills/sgsd-token-audit/SKILL.md` | **DO NOT DUPLICATE** -- that is Claude-skill analysis; Phase 42 is deterministic local check |
| gates-registry yaml load | `super-gsd/scripts/lib/gates-registry.cjs:38-93` | **REUSE** pinned js-yaml load pattern for `budgets.yaml` |

### 3.2 Phase 42 creates exclusively

| New artifact | Reason |
|--------------|--------|
| `super-gsd/tools/token-waste/check.cjs` | BUDGET-01 verbatim |
| `super-gsd/tools/token-waste/budgets.yaml` | BUDGET-02 first-pass role budgets |
| `.planning/metrics/token-waste-status.jsonl` | BUDGET-04 status output (envelope-v1 rows) |
| `.planning/milestones/{id}/token-waste.md` | BUDGET-05 verdict table at milestone close |

### 3.3 Surfaces NOT to duplicate (EXISTING-SURFACE-AUDIT.md:136-144)

- No second backlog file -- Phase 42 writes its own stream.
- No second route-decision ledger -- Phase 42 emits a *hint*; Phase 47 owns
  route writes.
- Phase 42 NEVER invokes Codex or VTP -- it is deterministic local.

---

## 4. Q1-Q10 Locked Decisions

### Q1 -- Budget shape

**LOCKED: per-call (per-row), evaluated at phase-close + milestone-close
granularity.** Each Phase 41 row has stable `role`, `phase`, `milestone`,
`provider`, `token_breakdown`. BUDGET-02 is "researcher 25k *per call*",
not per phase. Aggregations are derivative (sums for the verdict table).
Per-task is rejected: task identity is not preserved in the ledger
(`tool_use_id` is per-tool, not per-task) -- out of scope.

### Q2 -- Threshold values per role

**LOCKED: BUDGET-02 verbatim for 5/8 roles; remaining 3 derived from
observed P75/P90/P95.** Full table in §6.3.

For BUDGET-02 budgets where "unless" is binary justification (e.g., VTP),
warn = degrade (single threshold). For derived budgets (orchestrator,
classifier, other) where the distribution shows graduated overrun, warn <
degrade (two thresholds). Orchestrator budgets are intentionally lenient
(P75=545k, set warn=200k / degrade=750k=P90) because P50 alone is 289k
-- a 25k orchestrator budget would flag every row and produce no signal.

### Q3 -- Cache-read-ratio policy (BUDGET-03)

**LOCKED: cache-read ratio is a SECONDARY signal that combines with input
volume to produce verdict.** Cache-read ratio alone is not actionable -- a
researcher reading 50k cached tokens to produce 5k of high-value output is
fine. Ratio matters only with low useful_findings (Phase 41 R1) AND high
input.

### 4.4 Verdict matrix (Phase 42's core rule)

| input over warn | cache_read > 0.90 | useful_findings < 15 | verdict |
|:---------------:|:-----------------:|:--------------------:|---------|
| no | no | no | ok |
| no | yes | no | ok (cache hit, productive) |
| no | yes | yes | warn (low-yield small call) |
| yes | no | any | warn (overrun, no bloat-signature) |
| yes | yes | no | warn (overrun, findings exist) |
| yes | yes | yes | **degraded** (BUDGET-03 trip) |
| input over degrade | any | any | **degraded** (hard ceiling) |

This pulls **BUDGET-03 directly through Phase 41's
`BLOAT_THRESHOLDS.cache_read_ratio_high=0.9` and `useful_findings_low=15`**
-- no new threshold values introduced.

### Q4 -- Degrade vs reroute vs halt

**LOCKED: 5-state verdict ladder. Halt is NOT in the ladder.**

| Verdict | Action | Cockpit | Phase 47 hint |
|---------|--------|---------|---------------|
| `ok` | continue silently | green | none |
| `warn` | log envelope row `status: "warn"` + reason_codes | yellow | none |
| `degraded` | log envelope row `status: "warn"` (NOT `blocked`); set `next_action` + `route_hint` | orange | populate route_hint |
| `false_positive` | log envelope row `status: "skipped"` + `reason_codes: ['budget_check_false_positive']` | gray | none |
| `error` | log envelope row `status: "fail"`; CLI exit non-zero only on bad invocation | red | none |

**No `blocked` verdict.** Design lock 13 bans halt-on-budget. Envelope
`blocked` is reserved for downstream consumers with their own hard-stop
semantics; Phase 42 never emits it. Per-row override produces
`false_positive` (not warn/degraded). Per Phase 47 forward contract, the
route_hint shape is:

```json
{
  "from_role": "researcher",
  "from_provider": "claude",
  "to_provider_candidates": ["local-script", "codex", "vtp"],
  "reason": "researcher_local_script_candidate",
  "evidence_event_id": "agent:54c3e039-...:a4b4b87c19222f2aa"
}
```

`reason` enum is verbatim Phase 41 R1-R5 names (§5.2).

### Q5 -- Phase/milestone close integration

**LOCKED: milestone-close wire-in via `sgsd-complete-milestone` Step 4.7.**
Per-phase wire deferred to Phase 50. BUDGET-04 is satisfied by either; Phase
42 ships milestone-close.

Step 4.7 placement: AFTER Step 4.6 (phase-folder audit, the most-recent
soft-warn step) and BEFORE Step 5 (cross-phase check). Mirrors Step 4.5
and 4.6 verbatim:

```javascript
const path = require('path');
const fs   = require('fs');
const { runCheck, renderTable } = require(
  path.join(process.cwd(), 'super-gsd', 'tools', 'token-waste', 'check.cjs')
);
const planningDir = path.join(process.cwd(), '.planning');
const result = runCheck(planningDir, { milestone: '{{version}}' });
fs.writeFileSync(
  path.join(planningDir, 'milestones', '{{version}}', 'token-waste.md'),
  '# Token Waste (milestone {{version}})\n\n' +
  '> Soft-warn / degraded only. Per design lock 13.\n\n' +
  renderTable(result) + '\n', 'utf8');
```

Step 6 SUMMARY.md gets a new subsection AFTER "Phase Folder Audit" and
BEFORE "Connections", embedding `token-waste.md` inline. If the file is
missing (Step 4.7 failed), write the literal `(token-waste output unavailable
-- see token-waste-status.jsonl)`.

**Why milestone-close-first:** milestone close already runs Steps 4.5
(rubric), 4.6 (folder audit), and the deliberation/MUDA/cross-phase steps
in series; Step 4.7 inherits the existing infrastructure (idempotency,
stderr-on-failure, summary subsection). Per-phase wiring requires editing
the auto-mode loop (higher risk).

### Q6 -- Cockpit consumption

**LOCKED: SGSD1 dashboard reads `token-waste-status.jsonl` directly.**
Format: envelope-v1 rows with 4 extension fields (`scope`, `verdict`,
`totals`, `rules_tripped`, `route_hints`). Phase 50 displays latest run
verdict + top 3 rules + top 3 hints. JSONL tail read suffices; no Redis
needed (design lock 1).

### Q7 -- False-positive handling

**LOCKED: data-driven, opt-in, never silent.** A row is false_positive when:

1. `budgets.yaml` has an explicit `overrides:` row matching role+milestone+phase
2. row's `reason_codes` contains `vtp_research_route` (BUDGET-02 "unless VTP")
3. row's `reason_codes` contains `high_risk_code_phase` (BUDGET-02 "unless
   high-risk code phase")
4. row's `reason_codes` contains `full_review_tier` (BUDGET-02 "unless
   explicit full-review tier")

Envelope row writes `status: "skipped"` + `reason_codes` includes the
override reason -- the cockpit shows "1 deliberate false positive, not 1
unexplained overrun".

Realistic example: P51 benchmark researcher legitimately fires a
`vtp_research_gate` MCP call costing 60k input tokens. With override
`{ phase: "51", role: "researcher", exempt_via: vtp_research_route }`, the
row writes `false_positive` rather than `warn`.

### Q8 -- Provider-substitution hint (Phase 47 contract)

**LOCKED: route_hint emitted whenever verdict in {`warn`, `degraded`} AND
the row matches one of Phase 41 R1-R5 rules.** Reason vocab:

| Phase 41 rule | route_hint.reason |
|---------------|-------------------|
| R1 | `researcher_local_script_candidate` |
| R2 | `codex_reviewer_fallback_candidate` |
| R3 | `executor_context_packet_candidate` |
| R4 | `verifier_goal_backward_candidate` |
| R5 | `orchestrator_turn_trim_candidate` |

When `degraded` AND multiple rules trip, `route_hint.reason` takes the FIRST
tripped rule in R1..R5 priority order; full list goes into `rules_tripped`.

### Q9 -- Idempotency + read-only invariant

**LOCKED: read-only against ALL canonical streams. Status output is
append-only to a NEW stream.**

**Read-only inputs (fingerprint-protected):** `agent-token-spend.jsonl`,
`token-attribution.jsonl`, `codex-log.jsonl`, `token-log.jsonl`,
`activity-log.jsonl`, own `budgets.yaml`.

**Owned writes:** `.planning/metrics/token-waste-status.jsonl` (envelope-v1
append-only) + `.planning/milestones/{id}/token-waste.md` (overwritten per
Step 4.7 run; outer skill idempotency via Step 0 SUMMARY.md exists -> exit
PASS).

`runCheck` is pure function over inputs; re-runs produce identical verdicts.
`appendCheckRun` writes ONE envelope-v1 row per run with unique `run_id`;
consumers read "latest by scope" via `ts` ordering -- no dedup needed.

Self-test assertion 11 binds the invariant via fingerprint guard mirroring
Phase 41 §7.1 verbatim (anchored to `__dirname` 3 dirs up to `.planning/`).

### Q10 -- Self-test design

**LOCKED: 4 named fixtures + 11 secondary = 15 total.** Detailed in §7.

---

## 5. Cross-Phase Contract

### 5.1 Phase 41 inbound (verbatim consumption)

```javascript
const {
  summarize, ROLES, PROVIDERS, STATUSES, BLOAT_THRESHOLDS, ledgerPath,
} = require(path.join(__dirname, '..', 'token-attribution', 'report.cjs'));
```

`BLOAT_THRESHOLDS.cache_read_ratio_high=0.9` and `useful_findings_low=15`
become Phase 42's bloat-signature gate verbatim (no copy). Phase 42 adds
NEW `BUDGETS` const for per-role input limits.

`summarize` produces aggregations for the verdict table. Per-call verdict
needs raw rows; Phase 41 doesn't export `_readRows` (private). Phase 42
**re-implements a private defensive-read mirror at ~20 lines** rather than
tempting Phase 41 to expose internals (cleaner boundary).

### 5.2 Phase 42 -> Phase 47 (forward) contract

```typescript
interface RouteHint {
  from_role: 'researcher' | 'planner' | 'executor' | 'verifier'
           | 'reviewer' | 'orchestrator' | 'classifier' | 'other';
  from_provider: 'claude' | 'codex' | 'local-script' | 'vtp';
  to_provider_candidates: Array<'claude'|'codex'|'local-script'|'vtp'>;
  reason: 'researcher_local_script_candidate'
        | 'codex_reviewer_fallback_candidate'
        | 'executor_context_packet_candidate'
        | 'verifier_goal_backward_candidate'
        | 'orchestrator_turn_trim_candidate';
  evidence_event_id: string;  // agent-token-spend row's source_event_id
}
```

`reason` enum is verbatim Phase 41 R1-R5. Phase 47 ROUTE-02..05 binds each
reason to a routing action.

### 5.3 Phase 50 (cockpit) read shape

Cockpit panel "Token Waste" reads `token-waste-status.jsonl` and displays:
latest run verdict, totals (ok/warn/degraded/false_positive), top 3
`rules_tripped`, top 3 `route_hints`. No SQL/Redis required.

### 5.4 BUDGET-05 milestone-close artifact (`token-waste.md`)

```markdown
# Token Waste (milestone v1.9)

| Verdict | Count | % |
|---------|------:|--:|
| ok | 4288 | 95.0% |
| warn | 100 | 2.2% |
| degraded | 50 | 1.1% |
| false_positive | 1 | 0.0% |

## Rules Tripped
| Rule | Count |
|------|------:|
| orchestrator_turn_trim | 6710 |
| ... |

## Route Hints
| from_role | reason | count |
|-----------|--------|------:|
| orchestrator | orchestrator_turn_trim_candidate | 6710 |
| ... |

## Top Offenders
| role | phase | total | cache % | findings | verdict |
| ... |
```

`renderTable(result)` produces this. Mirrors `gate-keep-kill/rubric.cjs`.

### 5.5 envelope-v1 status row shape

```json
{
  "envelope_version": 1,
  "ts": "2026-04-27T18:00:00.000Z",
  "command": "checkTokenWaste",
  "status": "warn",
  "reason_codes": ["researcher_input_over_budget", "cache_read_high"],
  "artifacts": [{"kind": "verdict_md", "path": ".planning/milestones/v1.9/token-waste.md"}],
  "evidence": [{"kind": "agent_token_spend_row", "ref": "attribution:agent:..."}],
  "next_action": "Consider local-script substitution",
  "risk": "medium",
  "duration_ms": 320,
  "run_id": "2026-04-27T18:00:00.000Z-1234",
  "phase": "42",
  "milestone": "v1.9",
  "scope": {"milestone": "v1.9", "phase": null, "role": null},
  "verdict": "warn",
  "totals": {"rows_evaluated": 11295, "ok": 11144, "warn": 100, "degraded": 50, "false_positive": 1},
  "rules_tripped": {"researcher_input_over_budget": 12, "orchestrator_turn_trim": 6710},
  "route_hints": [{"from_role": "orchestrator", "reason": "orchestrator_turn_trim_candidate", "count": 6710}]
}
```

`scope`, `verdict`, `totals`, `rules_tripped`, `route_hints` are Phase 42's
4 extension fields. envelope-v1 `additionalProperties: true` allows them
without schema bump.

---

## 6. Threshold Table -- Locked Per-Role Budgets

### 6.1 Tool location

`super-gsd/tools/token-waste/check.cjs` (BUDGET-01 verbatim). Tools/
folder hosts CLI report-style tools (matches phase-folder-audit,
gate-keep-kill, system-map). `scripts/lib/` hosts real-time canonical
writers; Phase 42 has no real-time emitter.

### 6.2 Public API (3 functions + frozen consts)

```javascript
module.exports = {
  runCheck,           // (planningDir, { milestone?, phase?, role? }) -> result
  renderTable,        // (result) -> markdown string
  appendCheckRun,     // (planningDir, result) -> envelope-v1 row | false

  VERDICTS,           // ['ok', 'warn', 'degraded', 'false_positive']
  ROUTE_REASONS,      // R1..R5 names verbatim from Phase 41
  BUDGETS,            // frozen: per-role { warn_input, degrade_input }
  COMMAND_NAME,       // 'checkTokenWaste'
  ENVELOPE_VERSION,   // 1
};
```

### 6.3 Per-role budget table (LOCKED)

| Role | warn_input | degrade_input | source | rationale |
|------|-----------:|--------------:|--------|-----------|
| researcher | 25,000 | 25,000 | BUDGET-02 verbatim | audit:139-147 P36/P40 ran 122-223k; 25k forces VTP justification |
| planner | 30,000 | 30,000 | BUDGET-02 verbatim | audit:124 avg 99k; 30k forces capsule-first |
| executor | 40,000 | 40,000 | BUDGET-02 verbatim | audit:123 avg 73k; 40k forces context-packet for non-high-risk |
| verifier | 20,000 | 20,000 | BUDGET-02 verbatim | audit:127 avg 70k; 20k forces goal-backward template |
| reviewer | 20,000 | 20,000 | BUDGET-02 verbatim | Codex offload candidate per audit:128 |
| orchestrator | 200,000 | 750,000 | derived: P50=289k, P75=545k, P90=750k | warn at 200k catches turn-trim; degrade at P90 catches 1.24M-class |
| classifier | 15,000 | 15,000 | derived: P95=14k | classifier should never blow P95 |
| other | 25,000 | 50,000 | derived: P75=18k, P90=49k | lenient (heterogeneous role) |

**Input** = `input_tokens + cache_read_tokens + cache_creation_tokens`
(full prompt-side total). Output is not budgeted.

### 6.4 Methodology (derived thresholds)

Live ledger queried at research time via Node script summing per-role
sorted-array percentiles for 11,295 rows. Result table verified in §2.1.
Phase 51 benchmark refines; budgets.yaml allows operator override without
code change.

### 6.5 budgets.yaml schema

```yaml
schema_version: 1

# warn == degrade => single threshold (BUDGET-02 verbatim)
# warn  < degrade => graduated overrun (derived from observed distribution)
roles:
  researcher:   { warn_input: 25000,  degrade_input: 25000 }
  planner:      { warn_input: 30000,  degrade_input: 30000 }
  executor:     { warn_input: 40000,  degrade_input: 40000 }
  verifier:     { warn_input: 20000,  degrade_input: 20000 }
  reviewer:     { warn_input: 20000,  degrade_input: 20000 }
  orchestrator: { warn_input: 200000, degrade_input: 750000 }
  classifier:   { warn_input: 15000,  degrade_input: 15000 }
  other:        { warn_input: 25000,  degrade_input: 50000 }

# Inherited verbatim from Phase 41 BLOAT_THRESHOLDS
bloat_signature:
  cache_read_ratio_high: 0.90
  useful_findings_low: 15

# Per-row overrides. Match priority: role+milestone+phase > role+milestone > role
overrides:
  - role: researcher
    milestone: v1.9
    phase: "51"
    exempt_via: vtp_research_route
    reason: "Benchmark researcher legitimately uses VTP corpus"

# Reference only; never expanded by this file
hard_stops_unchanged: true
```

**Failure mode:** if missing or malformed, `runCheck` falls back to compiled-in
`BUDGETS` const (identical values). Reason_code `budgets_yaml_fallback`
added to envelope row. Loading never throws upward. YAML parsed via pinned
`super-gsd/tools/plan-schema/node_modules/js-yaml` (matches `gates-registry.cjs:39-44`).

---

## 7. Self-Test Design (4 fixtures + 11 secondary)

### 7.1-7.4 Fixture summary

| F | Setup (researcher row) | Override | Expected verdict | Tests |
|---|------------------------|----------|------------------|-------|
| F1 normal | input total 20k, cache 80%, findings 50 | none | `ok` | A1 |
| F2 warning | input total 28k, cache 84%, findings 50 | none | `warn` (researcher_input_over_budget; no route hint) | A1 + A2 |
| F3 degraded | input total 30k, cache 99%, findings 5, source_event_id present | none | `degraded` + route_hint `researcher_local_script_candidate`; envelope `status: "warn"` (NOT `blocked`) | A1 + A2 + A3 (BINDING) |
| F4 false_positive | input total 60k, cache 86%, findings 100, reason_codes includes `vtp_research_route` | role=researcher, milestone=v1.9, phase=51, exempt_via=vtp_research_route | `false_positive`; envelope `status: "skipped"`; `reason_codes` includes `budget_check_false_positive` + `vtp_research_route` | A1 + A2 |

**F3 is the binding lock-13 test:** asserts `envelopeRow.status === 'warn'`
NOT `'blocked'`, AND `route_hint.reason === 'researcher_local_script_candidate'`,
AND `evidence_event_id` matches the source row.

### 7.5 Secondary assertions

| # | Assertion |
|---|-----------|
| 5 | `VERDICTS` frozen 4-entry: ok, warn, degraded, false_positive |
| 6 | `ROUTE_REASONS` frozen 5-entry: R1-R5 names verbatim |
| 7 | `BUDGETS.bloat_signature` values match Phase 41 BLOAT_THRESHOLDS |
| 8 | empty ledger -> empty result; no failure; no rows written |
| 9 | malformed budgets.yaml -> graceful fallback; reason_code `budgets_yaml_fallback`; default BUDGETS used |
| 10 | override match priority: role+milestone+phase > role+milestone > role |
| 11 | canonical-stream fingerprint guard: 6 inputs + 1 owned output untouched during `--self-test` |
| 12 | 1000-row synthetic ledger -> deterministic verdict counts |
| 13 | envelope-v1 schema check on emitted status row (13 required + 4 ext + RUN_ID_REGEX) |
| 14 | CLI exit codes: `--self-test` pass=0; runCheck all-ok=0; runCheck degraded=0 (NOT 1); malformed budgets.yaml=0; bad invocation=2 |
| 15 | runCheck never throws upward (try/catch contract; identical to Phase 41) |

**Assertion 14 binds design lock 13 mechanically:** `degraded` verdict
**does NOT** cause non-zero exit. CLI is informational. Exit 0 unless
invocation is malformed (exit 2).

---

## 8. Hard Stop Conditions

Halt is reserved for `SGSD-HANDOVER.md:79-86`:

1. credentials required (provider-health owns this; not Phase 42)
2. destructive operation outside repo (not Phase 42)
3. privacy/security judgment required (not Phase 42)
4. filesystem/runtime cannot continue (not Phase 42; failure to read inputs
   falls back to empty result, never blocks close)

**Phase 42 NEVER does:**
- emit envelope status `blocked`
- exit non-zero on `degraded`
- write to `crit-backlog.jsonl`
- modify `gates.yaml` or canonical token streams
- ask the operator for confirmation

**Phase 42 ALWAYS does on `degraded`:**
- write envelope-v1 row with `status: "warn"` + `verdict: "degraded"`
- populate `route_hint` (Phase 47 contract)
- update `token-waste.md` at milestone close
- continue auto-mode loop

This is design lock 13's mechanical embodiment.

---

## 9. Read-Only Invariant (Canonical Streams)

Phase 42 MUST NOT write to:

| Stream | Owner |
|--------|-------|
| `agent-token-spend.jsonl` | Phase 41 |
| `token-attribution.jsonl` | `tools/token-attribution/collect.cjs` |
| `codex-log.jsonl` | `scripts/codex-exec.sh` |
| `token-log.jsonl` | legacy SGSD |
| `activity-log.jsonl` | runtime activity logger |
| `crit-backlog.jsonl` | `scripts/lib/crit-backlog.cjs` |
| `gate-value-log.jsonl` | Phase 36 |
| `route-decisions.jsonl` | Phase 32 / Phase 47 future writer |
| `edge-guard-log.jsonl`, `review-ledger.jsonl` | edge-guard / Phase 34 |
| `gates.yaml`, `STATE.md` | registry / orchestrator |

Phase 42 OWNS exclusively:

| Stream | Op |
|--------|-----|
| `token-waste-status.jsonl` | append-only envelope-v1 |
| `milestones/{id}/token-waste.md` | overwrite per close run |
| `tools/token-waste/check.cjs` | own source |
| `tools/token-waste/budgets.yaml` | read at runCheck; never written |

Self-test assertion 11 binds via fingerprint guard (Phase 32 W3 + Phase 36
W2 + Phase 39 W3 lessons).

---

## 10. Open Derivation Calls -- LOCKED

| Q | Status | Lock |
|---|--------|------|
| Q1 budget shape | LOCKED | per-call, evaluated at phase/milestone close |
| Q2 thresholds | LOCKED | BUDGET-02 verbatim + audit-derived for orchestrator/classifier/other |
| Q3 cache-read policy | LOCKED | secondary signal combined with input via §4.4 matrix |
| Q4 verdict ladder | LOCKED | 5-state {ok, warn, degraded, false_positive, error}; halt NOT in ladder |
| Q5 close integration | LOCKED | milestone-close Step 4.7; per-phase deferred to Phase 50 |
| Q6 cockpit | LOCKED | envelope-v1 status JSONL with 4 extension fields |
| Q7 false-positives | LOCKED | budgets.yaml overrides; verdict=false_positive; envelope status=skipped |
| Q8 reroute hints | LOCKED | route_hint with Phase 41 R1-R5 reason vocab |
| Q9 idempotency + read-only | LOCKED | 6 input streams + 1 config; 1 status JSONL + 1 md |
| Q10 self-test | LOCKED | 4 fixtures + 11 secondary = 15 total |

**Status: zero open derivations. Phase 42 is plan-ready.**

---

## 11. Single Plan Recommendation

### 11.1 File count

| Path | Status | Lines |
|------|--------|------:|
| `super-gsd/tools/token-waste/check.cjs` | NEW | ~500 |
| `super-gsd/tools/token-waste/budgets.yaml` | NEW | ~50 |
| `super-gsd/skills/sgsd-complete-milestone/SKILL.md` | EDIT (Step 4.7 + Step 6 sub) | +60 |
| `.planning/metrics/token-waste-status.jsonl` | NEW (canonical, runtime) | grows |
| `.planning/milestones/v1.9/token-waste.md` | NEW (Step 4.7 generated) | ~80 |

**Hand-written total: ~720 lines.**

### 11.2 Plan task structure (single 42-01-PLAN.md)

```
T1.  Skeleton: frozen consts (VERDICTS, ROUTE_REASONS, BUDGETS, COMMAND_NAME,
     ENVELOPE_VERSION) + Phase 41 imports
T2.  budgets.yaml schema + loader (`_loadBudgets` with malformed-yaml fallback)
T3.  Verdict logic: `_classifyRow(row, budgets)` -> { verdict, rules_tripped[], route_hint? }
T4.  Override matcher: priority role+milestone+phase > role+milestone > role
T5.  runCheck: defensive-read mirror + aggregate { verdict, totals,
     rules_tripped, route_hints, top_offenders }
T6.  appendCheckRun: envelope-v1 row to token-waste-status.jsonl;
     status='warn' for degraded (NOT 'blocked'); run_id matches Phase 41 pattern
T7.  renderTable: 4-section markdown
T8.  CLI argv (--self-test, --milestone, --phase, --role, --budgets-yaml,
     --planning-dir)
T9.  Self-test: 4 fixtures + 11 secondary = 15 assertions + __dirname fingerprint
T10. SKILL.md Step 4.7 wire-in (mirror 4.5/4.6) + Step 6 SUMMARY.md subsection
T11. Live integration: --self-test 15/15; --milestone v1.9 vs live ledger;
     verify token-waste.md renders + token-waste-status.jsonl gets one new row
T12. Verifier acceptance: BUDGET-01..05 + ROADMAP §42 acceptance A1-A4 green
```

T1-T9 mechanical. T10 mirrors known Step 4.5/4.6 pattern. T11-T12 integration.

### 11.3 Risks (with mitigations)

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| `degraded` accidentally emits envelope `blocked` | High (lock-13 binding regression) | F3 self-test asserts `status === 'warn'` |
| Per-row override is O(N*M) | Low | Overrides expected < 50; N <= 11k; quadratic on small inputs is fine |
| Malformed `budgets.yaml` halts close | High (Phase 32 W3-class) | runCheck swallows yaml errors; fallback to compiled BUDGETS; reason_code `budgets_yaml_fallback` |
| Per-phase wire breaks auto-mode loop | High if attempted | DEFER to Phase 50; ship milestone-close only for v1.9 |
| route_hint vocab drifts from Phase 41 R1-R5 | Medium | ROUTE_REASONS frozen const verbatim; assertion 6 binds |
| Self-test pollutes canonical token-waste-status.jsonl | Critical | Assertion 11 fingerprints 6 inputs + 1 output |
| Cache-read ratio threshold drifts from Phase 41 0.90 | Low | Imported by reference from Phase 41 BLOAT_THRESHOLDS; assertion 7 verifies |

### 11.4 Pattern summary

Phase 42 is the **first read-only check tool** that imports a Phase 41
canonical writer's exports. Boundary lock established here:

```text
canonical writer:    super-gsd/scripts/lib/*-log.cjs       (one per stream)
canonical reporter:  super-gsd/tools/<stream>/report.cjs   (Phase 41 pattern)
canonical checker:   super-gsd/tools/<gate>/check.cjs      (Phase 42 pattern)
```

A focused executor with `report.cjs` + `rubric.cjs` in context can produce
the finished tool in ONE plan.

---

## Sources

### Primary (HIGH confidence)

- `.planning/milestones/v1.9/REQUIREMENTS.md:67-68` (design lock 13 verbatim)
- `.planning/milestones/v1.9/REQUIREMENTS.md:100-109` (BUDGET-01..05 verbatim)
- `.planning/milestones/v1.9/ROADMAP.md:79-94` (Phase 42 deliverables + acceptance)
- `.planning/milestones/v1.9/SGSD-HANDOVER.md:79-86` (4 hard-stop conditions)
- `.planning/milestones/v1.9/SGSD-HANDOVER.md:88-101` (Implementation Rules)
- `.planning/milestones/v1.9/EXISTING-SURFACE-AUDIT.md:21-60`, `124-144` (existing surfaces / no-duplicate)
- `.planning/milestones/v1.9/phases/41-baseline-token-attribution/41-RESEARCH.md` (Phase 41 contract; §6 public API; §11 locks)
- `super-gsd/tools/token-attribution/report.cjs:73-100` (frozen consts to import)
- `super-gsd/tools/token-attribution/report.cjs:281-322` (defensive `_readRows` mirror target)
- `super-gsd/tools/token-attribution/report.cjs:502-552` (`summarize` to import)
- `.planning/milestones/v1.9/baseline-token-spend.md` (live distributions §1-§5)
- `.planning/analyses/2026-04-27-agent-context-bloat-audit.md:79-95` (live ledger)
- `.planning/analyses/2026-04-27-agent-context-bloat-audit.md:103-112` (v1.9/P41 1.24M evidence)
- `.planning/analyses/2026-04-27-agent-context-bloat-audit.md:139-158` (v1.8 P36-P40 cache-read share)
- `.planning/analyses/2026-04-27-agent-context-bloat-audit.md:568-597` (waste detector + role budgets)
- `.planning/analyses/2026-04-27-agent-context-bloat-audit.md:680-696` (Stage 1 Token Guard concrete plan)
- `super-gsd/scripts/lib/gate-value-log.cjs:1-599` (envelope-v1 mirror template)
- `super-gsd/scripts/lib/gates-registry.cjs:38-93` (js-yaml load pattern)
- `super-gsd/tools/gate-keep-kill/rubric.cjs:1-120` (read-only check + closed-enum verdict + render table)
- `super-gsd/tools/backlog-schema/check.cjs:1-191` (CLI exit-code contract)
- `super-gsd/tools/phase-folder-audit/audit.cjs` (soft-warn-only verdict pattern)
- `super-gsd/skills/sgsd-complete-milestone/SKILL.md:96-172` (Step 4.5 + 4.6 wire-in template)
- `super-gsd/skills/sgsd-complete-milestone/SKILL.md:181-258` (Step 6 SUMMARY.md subsection template)
- `super-gsd/templates/command-envelope-v1.json` (envelope-v1 contract)
- `.planning/config.json` (workflow + parallelization keys)
- Direct file inventory: `wc -l` on agent-token-spend.jsonl (verified 11295 rows)
- Direct distribution: Node script computing per-role percentiles at research time
- Direct schema inspection: `cat baseline-token-spend.md`

### Secondary / Tertiary

None. Every claim anchored to file:line ref or verified shell command.
Derived budgets (orchestrator / classifier / other) reference live ledger
P75/P90/P95 with source documented in §6.4. Phase 42 has no LLM-knowledge
claims.

---

## Confidence Assessment

| Area | Level | Reason |
|------|-------|--------|
| Schema design (envelope-v1 + 4 ext) | HIGH | Mirrors Phase 41 / 36 / 32 / 34 verbatim |
| Budget thresholds | HIGH | BUDGET-02 verbatim 5/8 roles; remaining 3 from live P75/P90/P95 |
| Verdict ladder | HIGH | Design lock 13 binds; F3 self-test is the regression test |
| Cache-read policy | HIGH | Inherited Phase 41 BLOAT_THRESHOLDS; no new threshold |
| Phase/milestone close wire-in | HIGH | Step 4.5/4.6 template proven; Step 4.7 follows shape |
| Cockpit consumption | HIGH | envelope-v1 with extension fields; cockpit reads JSONL tail |
| False-positive overrides | HIGH | budgets.yaml schema modeled on existing patterns |
| Phase 47 reroute contract | MEDIUM | route_hint shape forward contract; reason enum verbatim Phase 41 R1-R5 (locked) |
| Self-test design | HIGH | 4 fixtures cover all verdicts; matches Phase 41/36 patterns |
| Read-only invariant | HIGH | Fingerprint guard binds; 6 inputs + 1 output |

---

## Project Constraints (from CLAUDE.md / SGSD design locks)

- Permissions: never ask for confirmation; auto mode owns dispatch.
- Commit discipline: `feat(42-01): {one-liner}`; commit after every unit;
  stage specific files by name.
- Mirror Phase 41 / 36 / 39 architectural template 1:1 where applicable.
- Atomic writes: `fs.appendFileSync` for status JSONL; `fs.writeFileSync`
  for token-waste.md.
- Stderr-only error logging; check tool never throws upward.
- ASCII-only RESEARCH.md.
- Redis NOT canonical (lock 1); `.planning` JSONL + git remain source of
  truth (lock 2); token spend logged by role/phase/provider/model (lock 8;
  Phase 41 IMPLEMENTS, Phase 42 GOVERNS).
- **Autonomy continues; budget breaches degrade or reroute, not halt** --
  design lock 13, the controlling correctness rule.
- Critical bypass (lock 6): stack traces, stderr, failed tests, edge-guard
  miss, security/privacy issues, destructive-op warnings,
  behaviorally-proven provider outages -- Phase 42 NEVER suppresses these
  via budget triage.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Per-role budgets for orchestrator/classifier/other can be derived from observed P75/P90/P95 distributions on the live ledger | §6.3 | Derived budgets may be too lenient/strict; Phase 51 benchmark refines; budgets.yaml allows operator override without code change |
| A2 | Phase 47 will accept `route_hint.reason` enum verbatim from Phase 41 R1-R5 names | §5.2, §6.2 | Phase 47 may need extra reasons; ROUTE_REASONS is frozen const so adding values requires explicit ledger writer extension (acceptable boundary) |
| A3 | sgsd-complete-milestone Step 4.7 placement (between 4.6 and 5) does not collide with future v2.0 phase additions | §5 (Q5) | Future steps may renumber; mitigation: Step 4.7 is referenced by name in wire-in code, not by ordinal position |
| A4 | budgets.yaml does not need a separate validator tool; runCheck malformed-yaml fallback is sufficient | §6.5 | Poisoned config silently falls back to defaults; reason_code `budgets_yaml_fallback` is the audit trail; explicit validator deferred to Phase 49 governance lifecycle |

All other claims VERIFIED via direct file inspection or CITED from
REQUIREMENTS / ROADMAP / SGSD-HANDOVER / Phase 41 RESEARCH.

---

## Metadata

**Research date:** 2026-04-27
**Valid until:** 2026-05-27 (30 days; stable -- Phase 41 contract locked,
milestone-close skill steps historically stable)

**Confidence breakdown:**
- Standard stack: HIGH (template = Phase 39 rubric + Phase 41 report)
- Architecture: HIGH (envelope-v1 locked since Phase 31; design lock 13
  is the new binding rule)
- Pitfalls: HIGH (Phase 32 W3 + Phase 36 W2 + Phase 39 W3 lessons applied)
- Threshold derivation: HIGH (live ledger; 11,295 rows verified; BUDGET-02
  verbatim 5/8 roles; remaining 3 P75/P90/P95-derived)
- Cross-phase contracts: HIGH (Phase 41 inbound verified; Phase 47 outbound
  uses Phase 41 R1-R5 vocabulary verbatim)

**Single recommendation locked:** ONE plan, ONE check.cjs (~500 LOC), ONE
budgets.yaml (~50 LOC), ONE SKILL.md edit (~60 LOC), THREE public APIs
(runCheck, renderTable, appendCheckRun), FIFTEEN self-test assertions (4
named fixtures + 11 secondary), FIVE verdict states (ok, warn, degraded,
false_positive, error). Mirror Phase 39 rubric + Phase 41 report patterns.
No new architectural surface. Phase 47 forward contract locked via Phase
41 R1-R5 reason vocabulary. Total ~720 lines hand-written.
