---
phase: 99
artifact: research
authored_by: orchestrator (Opus)
---

# Phase 99 -- Research

## Sources
- VTP-AHE-EVIDENCE.md AHE-P-02 (distill before change)
- REQUIREMENTS.md AHE-EXP-01..04
- Phase 98 catalog.cjs (Lock-13 substrate)
- Existing JSONL surfaces:
  - .planning/metrics/activity-log.jsonl
  - .planning/metrics/orchestrator-pulse.jsonl
  - .planning/metrics/context-packet-log.jsonl
  - .planning/metrics/route-decisions.jsonl
  - .planning/metrics/token-attribution.jsonl
  - .planning/metrics/failure-injection-log.jsonl
  - .planning/metrics/controlled-actions-log.jsonl
- Benchmark surface: .planning/benchmarks/ahe-paper-smoke/{REPORT.md,RUN.json}

## Key decisions

### D1 -- Drill-down corpus, not flat dump
Corpus shape per run:
```
.planning/harness-evolution/runs/<run_id>/
  OVERVIEW.md         (<=4KB compressed summary)
  INDEX.json          (machine-readable pointer index)
  tasks/
    <task_id>.md      (per-task report, raw-evidence pointers, not copies)
```

OVERVIEW.md is what an agent reads first. tasks/*.md is what they open
selectively.

### D2 -- Run ID derivation
A run_id is either passed via `--run-id <id>` or auto-derived from the most
recent orchestrator-pulse `iteration` field (or current ISO timestamp).
Time-window filtering uses `--since <ISO>` and `--until <ISO>` flags.

### D3 -- Closed-vocab root causes (11 labels per PLAN)
- state_projection_drift
- missing_context_packet
- provider_unavailable
- gate_false_negative
- gate_false_positive
- token_budget_breach
- duplicate_verification
- incomplete_artifact
- hidden_fault_uncaught
- successful_recovery_pattern
- unknown

### D4 -- Classifier is rule-based, deterministic
String/regex match on event payload + status + reason_codes. No LLM.
Determinism is a contract: same input -> same labels.

### D5 -- Lock-13 in distill API
`distillRun(opts) -> { ok, run_id, overview_path, index_path, task_paths[], errors[] }`.
Never throws. Malformed JSONL line -> single error row in `errors[]`,
distillation continues.

### D6 -- Pointers not copies
Per-task .md files contain links/grep-anchors back to source JSONL +
benchmark report, not full copies. Keeps per-task reports small,
operator/agent can drill down in repo when needed.

### D7 -- Self-test fixtures (4 minimum)
- empty (no JSONL, no benchmark) -> ok=false, errors lists missing sources
- malformed (one bad JSON line) -> ok=true with single error row, valid lines parsed
- benchmark only (RUN.json + REPORT.md, no JSONL) -> ok=true, sparse overview
- live-ish (synthetic JSONL with 5 events spanning 2 phases) -> ok=true,
  overview + 2 task reports, classifier triggers >=2 labels

## Risks

- R1: Per-task report explosion if iteration count high. Mitigation:
  group by phase+plan instead of per-iteration.
- R2: Classifier drift as new failure modes emerge. Mitigation: closed
  vocab + `unknown` label catches the rest.
