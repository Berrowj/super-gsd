# warning fixture

Synthetic `.planning/` tree where a gate emitted a `warn` verdict (both as
a `gate_warned` live event AND a row in legacy `gate-value-log.jsonl`).
The adapter merges both sources and computes `latest_per_gate` by max-ts.

Scenario assertions:
- `gates.latest_per_gate["phase-level-ATC"].verdict === "warn"`
- `gates.latest_per_gate["token-log"].verdict === "pass"`
