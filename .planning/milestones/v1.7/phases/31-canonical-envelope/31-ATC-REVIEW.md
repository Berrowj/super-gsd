# Phase 31 ATC Review

## Reviewers
- Provider: claude-sonnet-reviewer (sgsd-code-reviewer) -- see `31-claude-review.md`
- Provider: codex-cli-reviewer (gpt-5.5, xhigh) -- see `31-codex-review.md`
- Tier: phase-level (dual-provider per v1.7 readiness GO)
- Final verdict: pass (post-fix; both providers' findings cleared in-loop)

## Aggregate verdicts

| Provider | Pre-fix | CRIT | WARN | Anti-slop pre | Post-fix | Anti-slop post |
|----------|---------|------|------|---------------|----------|----------------|
| Claude   | warn    | 0    | 3    | 8/10          | pass     | 10/10          |
| Codex    | warn    | 1    | 2    | 7/10          | pass     | 10/10          |

## Findings (deduplicated)

### CRIT (1, fixed in-loop)

**C1 [Codex] -- ENV-01 required-field contract under-enforced**
- File: `super-gsd/templates/command-envelope-v1.json:7`
- Schema only required 5 fields; contract enumerates 13.
- Fix: widened `required` to all 13 fields; `duration_ms` made nullable for instantaneous emitters.
- Confirmed: schema_required_count=13, example_errors=0.

### WARN (5, fixed in-loop)

**W1 [Claude] -- edge-guard emitter gap references nonexistent reason_code `step_skip`**
- File: `super-gsd/registry/command-envelope-v1.yaml:67`
- Fix: `step_skip` -> `step_transition_blocked` (canonical vocab line 159).

**W2 [Claude] -- handoff emitter gap references nonexistent reason_code `auth_missing`**
- File: `super-gsd/registry/command-envelope-v1.yaml:75`
- Fix: `auth_missing` -> `codex_auth_missing` (canonical vocab line 105). Handoff is currently Codex-specific.

**W3 [Claude] -- schema examples use evidence kinds not in `kind` description**
- File: `super-gsd/templates/command-envelope-v1.json:54`
- Fix: extended evidence.kind documented values to include `muda_log_row`, `codex_log_row`, `audit_log_row`, `readiness_log_row`. Description ends with "additional values permitted" to preserve free-form intent.

**W4 [Codex] -- Mission Strip pane_state map drifts from closed 8-state vocab (DISCUSS 26.1)**
- File: `super-gsd/registry/command-envelope-v1.yaml:227-233`
- Fix: remapped to canonical 8-state tokens (`complete`, `blocked`, `unavailable`, `timed-out`); warn surfaces via `missionColor=Yellow` indicator (Phase 28 T1 design), not a new pane state. Inline comment documents the closed vocab.

**W5 [Codex] -- retrieval reason_codes look like dead code**
- File: `super-gsd/registry/command-envelope-v1.yaml:177-192`
- Fix: each retrieval code annotated `status: future_v1_9` with intent comment naming Phase 43 7-mode taxonomy as the activation point.

### NIT (0)

None.

## ATC checklist (post-fix)

### 7-Step LITE / FULL (docs+schema phase)

| Step | Verdict | Notes |
|------|---------|-------|
| 1 First Principles | PASS | Fifth contract anchors v1.7's ROUTE/REPAIR/LEDGER/MAP lanes; minimal envelope shape preserves emitter freedom. |
| 2 Delete | PASS | 2 files (1 schema + 1 registry); no helper code; no aggregator (deferred to Phase 34). |
| 3 Simplify | PASS | Required list widened to match contract (-drift); pane_state map uses closed vocab (-vocab violations). Net complexity decreased. |
| 4 Validate | PASS | Both providers' embedded verifiers run green: schema parses, 13 required fields, 5 first_wave emitters, 34 reason_codes (5 marked future_v1_9), 4 contracts cited, examples valid against new required list, 0 vocab violations. |
| 5 Anti-slop | 10/10 | Both providers post-fix. |

**Combined anti-slop score: 10/10.**

## Codex provider health (run-time evidence)

- `provider-health/check.cjs --provider codex --behavioral` -> AVAILABLE (oracle `codex_login_status` exit 0; oracle `contract_canary` exit 0).
- 4 invocation attempts; 3 transient/wrapper failures, 1 success after correcting a local prompt template error (`VERDICT:` -> `FINDINGS:` to match the wrapper's awk parser).
- Final invocation: exit 0, duration 296820ms, report_bytes 317, JSONL row appended at `2026-04-27T07:32:44Z`.
- NO "Codex unavailable" backlog row required (provider was AVAILABLE throughout; failures were prompt/wrapper mechanics).

## Status-consistency check (gate)

```
node super-gsd/tools/status-consistency/check.cjs --milestone v1.7
-> status-consistency milestone v1.7: OK
```

## Final verdict

**PASS** (post-fix). 0 unresolved CRIT, 0 unresolved WARN. Anti-slop 10/10 across both providers. No backlog row needed.

## One-liner

Phase 31 envelope-v1 schema + registry land cleanly with full 4-contract reconciliation; dual-provider review surfaced 1 CRIT (schema required under-enforced) + 5 WARNs (vocab drift / future codes / Mission Strip pane-state vocab violation), all fixed in-loop in 1 attempt each; post-fix anti-slop 10/10 both providers, no deferrals.
