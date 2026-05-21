---
phase: 118
phase_name: Chronicle Cockpit Integration (Sidecar)
milestone: v3.1
created: 2026-05-21
status: queued-planning-only
implementation_status: not-started
source: DLB-11.6 — Operator Chronicle Layer; sixth phase
predecessor: v3.1 P117 PASS (storage adapter shipped)
---

# Phase 118 — Chronicle Cockpit Integration (Sidecar)

> Adds operator-visible chronicle awareness without touching the v2.9-frozen cockpit array. Ships a standalone sidecar CLI that reads the chronicle index + validator log + cockpit-state + dispatch metrics → emits a side-rail view with Fog Score + latest chronicle link + binding-gate status. Sidecar pattern keeps Lock-13 untouched.

## Goal

Ship `cockpit-chronicle-sidecar.cjs` + Fog Score calculator + self-test extension + golden sidecar output. Operator can run the sidecar standalone OR have a future cockpit version compose it; v3.1 ships the sidecar.

## Binding invariants

1. **Sidecar only — no Lock-13 violation.** Do NOT modify `super-gsd/tools/cockpit/*` source or any existing cockpit-state schema. Sidecar reads cockpit-state output (read-only); doesn't extend the frozen array.
2. **Fog Score is deterministic.** Same inputs → same score. Formula explicit + simple (weighted sum of observable signals). No ML, no thresholds tuned to fixtures.
3. **Read-only on all sources.** Sidecar reads: cockpit-state file, `.planning/chronicles/INDEX.jsonl`, `.planning/metrics/chronicle-validation-log.jsonl`, `.planning/metrics/codex-executor-log.jsonl`, `.planning/metrics/token-attribution.jsonl`, git log. Never writes anything except its own stdout/stderr.
4. **Offline-first.** No network. No external tools beyond `git`. Falls back to "data unavailable" gracefully if any source absent.

## Files this phase will create

| Path | Op |
|---|---|
| `super-gsd/tools/chronicle/cockpit-sidecar.cjs` | create — CLI sidecar tool (~200-300 LOC) |
| `super-gsd/tools/chronicle/fog-score.cjs` | create — pure-function Fog Score calculator (~100-150 LOC) |
| `super-gsd/tools/chronicle/run-self-test.cjs` | modify — extend with SAC-P118-NN |
| `super-gsd/tools/chronicle/fixtures/sample-sidecar-output.json` | create — golden output for byte-parity |
| `super-gsd/tools/chronicle/fixtures/sample-fog-inputs.json` | create — synthetic input signals for self-test |

5 file ops (4 new + 1 modify).

## cockpit-sidecar.cjs contract

### Invocation
```
node super-gsd/tools/chronicle/cockpit-sidecar.cjs \
  [--cockpit-state <path-to-cockpit-state.json>] \
  [--chronicle-index .planning/chronicles/INDEX.jsonl] \
  [--validator-log .planning/metrics/chronicle-validation-log.jsonl] \
  [--executor-log .planning/metrics/codex-executor-log.jsonl] \
  [--token-attribution .planning/metrics/token-attribution.jsonl] \
  [--milestone <id>] [--phase <id>] \
  [--format json|text]
```

If `--milestone` / `--phase` absent, derive from latest cockpit-state row OR latest INDEX row.

### Pipeline
1. Read cockpit-state (if --cockpit-state provided) — read-only; tolerate absence
2. Tail INDEX.jsonl for latest 5 chronicle entries
3. Tail validator-log for current-phase verdict
4. Tail executor-log for dispatch counts
5. Tail token-attribution for current-phase spend
6. Run git log for commit count since phase start (or skip if git unavailable)
7. Compute Fog Score via `fog-score.cjs`
8. Compose sidecar output:
   ```json
   {
     "milestone": "v3.1",
     "phase": "118",
     "phase_status": "ACTIVE|CLOSED|PASS|BLOCKED",
     "latest_chronicle": {"location": "...", "validator_verdict": "REPORT_GROUNDED", "published_at": "..."},
     "binding_gate_status": "GREEN|YELLOW|RED",
     "fog_score": {"value": 42, "tier": "low|medium|high", "must_read_sections": []},
     "recent_chronicles": [...],
     "dispatch_count": 12,
     "token_spend_estimate": 145000,
     "commits_in_phase": 7,
     "warnings": []
   }
   ```
9. If `--format text`: render as human-readable side-rail; else emit JSON

### Exit codes
- 0 — sidecar emitted successfully
- 1 — usage error
- 2 — all data sources missing (degenerate — nothing to report)

## fog-score.cjs contract

Pure function: `compute(signals) → {value, tier, must_read_sections, breakdown}`

Signals object:
```json
{
  "dispatch_count": 12,
  "token_spend": 145000,
  "files_changed": 23,
  "review_loops": 2,
  "disputed_claims_count": 0,
  "stale_findings_count": 1,
  "plan_revisions": 1,
  "unresolved_risks_count": 2,
  "minutes_since_operator_decision": 45,
  "dependency_depth": 3
}
```

Formula (deterministic, simple weighted sum):
```
fog = clamp(
  3 * dispatch_count +
  0.0001 * token_spend +
  0.5 * files_changed +
  5 * review_loops +
  10 * disputed_claims_count +
  3 * stale_findings_count +
  8 * plan_revisions +
  6 * unresolved_risks_count +
  0.2 * minutes_since_operator_decision +
  4 * dependency_depth,
  0, 100
)
```

Tier thresholds:
- 0-30 → low (clean grip; can skim chronicle)
- 31-60 → medium (read ELI5 + risks)
- 61-100 → high (read ELI5 + risks + decisions + denominators)

`must_read_sections` populated based on tier + which signals are highest:
- High dispatch_count or token_spend → recommend Architecture + Files Impacted
- High disputed_claims → recommend Claims + Evidence Verdicts
- High plan_revisions → recommend Decisions + Denominators

## Semantic acceptance criteria (target — 118-01 PLAN declares verbatim)

```yaml
semantic_acceptance_criteria:
  - id: SAC-P118-01
    input: "sample fog-score signals with low dispatch_count, low token_spend, zero disputes"
    expected_outcome: "fog-score returns value in 0-30 (low tier); must_read_sections empty"
    verification_cmd: "node super-gsd/tools/chronicle/run-self-test.cjs --sac SAC-P118-01"

  - id: SAC-P118-02
    input: "sample fog-score signals with high dispatch_count + plan revisions"
    expected_outcome: "fog-score returns 61-100 (high tier); must_read_sections includes Decisions + Denominators"
    verification_cmd: "node super-gsd/tools/chronicle/run-self-test.cjs --sac SAC-P118-02"

  - id: SAC-P118-03
    input: "same signals twice"
    expected_outcome: "fog-score deterministic (same value)"
    verification_cmd: "node super-gsd/tools/chronicle/run-self-test.cjs --sac SAC-P118-03"

  - id: SAC-P118-04
    input: "cockpit-sidecar.cjs with all default paths + synthetic INDEX.jsonl having 3 entries"
    expected_outcome: "sidecar JSON output contains recent_chronicles[3], latest_chronicle populated"
    verification_cmd: "node super-gsd/tools/chronicle/run-self-test.cjs --sac SAC-P118-04"

  - id: SAC-P118-05
    input: "cockpit-sidecar.cjs --format text"
    expected_outcome: "human-readable side-rail output (lines with milestone:, phase:, fog_score:, etc)"
    verification_cmd: "node super-gsd/tools/chronicle/run-self-test.cjs --sac SAC-P118-05"

  - id: SAC-P118-06
    input: "cockpit-sidecar.cjs with absent INDEX.jsonl + absent validator-log"
    expected_outcome: "degraded output: latest_chronicle null, binding_gate_status null, warnings[] populated with reasons; exit 0 (not 2 — partial data is still reportable)"
    verification_cmd: "node super-gsd/tools/chronicle/run-self-test.cjs --sac SAC-P118-06"

  - id: SAC-P118-07
    input: "validator-log row with REPORT_UNGROUNDED for current phase"
    expected_outcome: "sidecar binding_gate_status = RED; warning emitted"
    verification_cmd: "node super-gsd/tools/chronicle/run-self-test.cjs --sac SAC-P118-07"

  - id: SAC-P118-08
    input: "git rev-list --count + sample executor log"
    expected_outcome: "dispatch_count + commits_in_phase populated from real signals (or 0 with reason if git absent)"
    verification_cmd: "node super-gsd/tools/chronicle/run-self-test.cjs --sac SAC-P118-08"

  - id: SAC-P118-09
    input: "sidecar run; check it does NOT mutate any source file (cockpit-state, INDEX, logs)"
    expected_outcome: "all source mtimes unchanged after sidecar run"
    verification_cmd: "node super-gsd/tools/chronicle/run-self-test.cjs --sac SAC-P118-09"

  - id: SAC-P118-10
    input: "full self-test"
    expected_outcome: "all assertions green (existing 70 + 9 SAC-P118 + STRUCT)"
    verification_cmd: "node super-gsd/tools/chronicle/run-self-test.cjs"
```

10 SACs. STRUCT additions for: Fog Score clamp at boundaries, sidecar JSON shape matches schema, text format includes key fields.

## Out of scope

- Modifying `super-gsd/tools/cockpit/*` (Lock-13 protection)
- Real-time terminal UI / TUI (sidecar prints + exits)
- Milestone chronicle / roadmap miner (P119)
- ML / heuristic-tuned Fog Score (formula stays simple + deterministic)

## Cross-references

- `.planning/decisions/DLB-11-CHRONICLE-LAYER.md` — Fog Score design
- `super-gsd/tools/chronicle/publish.cjs` (P117) — emits INDEX.jsonl rows sidecar reads
- `super-gsd/tools/chronicle/validate-chronicle.cjs` (P116) — emits validator-log rows sidecar reads
- v2.9 DEFERRED-2 (cockpit 12th section) — UNTOUCHED here; sidecar avoids the constraint
