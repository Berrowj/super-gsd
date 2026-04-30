---
phase: 104
artifact: research
authored_by: orchestrator (Opus)
---

# Phase 104 -- Research

## Sources
- AHE paper AHE-P-07 (transfer as overfit test)
- REQUIREMENTS.md AHE-EVAL-03..05
- Phase 98 catalog (harness-benchmark = tool, not protected; we may invoke)
- Phase 102 runner (provides frozen-candidate workflow)
- Existing super-gsd/tools/harness-benchmark/sgsd-blind-live-controller.mjs

## Key decisions

### D1 -- Transfer result schema (frozen at row level)
```json
{
  "transfer_id": "tx-2026-04-30-001",
  "change_id": "ch-2026-04-30-001",
  "frozen_at": "ISO-8601",          // candidate freeze ts (before run)
  "started_at": "ISO-8601",          // transfer run start
  "completed_at": "ISO-8601",
  "deck": "smoke|hidden_live|held_out_live",
  "environment": {
    "vtp_enabled": true,
    "codex_available": true,
    "shell": "powershell|bash|other",
    "warp_assisted": false,
    "fresh_clone": false
  },
  "outcome": {
    "success_rate": 1.0,
    "failures_detected": 0,
    "token_cost": 12000,
    "runtime_ms": 45000,
    "regressions_observed": []
  }
}
```

### D2 -- "Frozen before run" enforcement (hard rule)
The evaluator REFUSES to attribute a transfer result to a manifest entry
whose `_appended_at` (Phase 100 timestamp) is AFTER the transfer's
`started_at`. Self-test asserts this with synthetic timestamps.

### D3 -- 8 transfer axes (per CONTEXT)
- deterministic_smoke
- hidden_live
- held_out_live
- no_vtp
- codex_unavailable
- fresh_clone
- powershell_only
- warp_assisted

Each is a row in the transfer schema's `environment` block. Self-test
covers 2+ axes per acceptance #3.

### D4 -- Critical-regression detector
A transfer result is a "critical regression" if:
- success_rate < baseline.success_rate - 0.05 (5%+ drop), OR
- token_cost > baseline.token_cost * 1.5 (50%+ token bloat), OR
- regressions_observed.length >= 1.

The evaluator returns `critical_regression: true|false` per row.

### D5 -- Lock-13 Public API
- evaluateTransfer(opts) -> { ok, transfer_record, errors }
- writeTransferReport(opts) -> { ok, report_path, errors }
- detectCriticalRegression(record, baseline) -> { critical, reasons[] }
- isFrozenBeforeRun(manifest_appended_at, run_started_at) -> bool
- recordTransfer(record, opts) -> { ok, errors }
- readTransfers(projectDir) -> { ok, rows, errors }

### D6 -- Self-test ≥10 assertions
- Frozen-before-run rule enforces (manifest after start = refused)
- Frozen-before-run rule passes (manifest before start = accepted)
- Critical regression: success_rate drop
- Critical regression: token bloat
- Critical regression: regressions_observed
- 2+ environment axes covered
- Lock-13 no-throw on bad input
- Append/read JSONL round-trip
- Report writer produces non-empty markdown
- ASCII-only source
- Public API stable

## Risks
- R1: Real benchmark invocation in self-test would be slow + non-deterministic.
  Mitigation: self-test uses synthetic transfer records; operator runs the
  actual benchmark via existing harness-benchmark tool.
- R2: Environment detection (e.g., vtp_enabled) could vary across machines.
  Mitigation: environment block is operator-supplied input, not
  auto-detected.
