---
phase: 41-baseline-token-attribution
milestone: v1.9
verified: 2026-04-27T00:00:00Z
status: passed
score: 4/4 must-haves verified
verdict: PASS
---

# Phase 41 Verification — Baseline Token Attribution

GOAL_ACHIEVED: YES — ledger (11,294 rows) + bloat report (7 H2 sections, 5 R-rules, all 3 audit markers) emitted by a read-only mirror of Phase 36; orchestrator self-spend included; idempotent backfill confirmed.

## Field-by-field

- BASE_01_ENVELOPE_V1: PASS — Per `_assertEnvelopeV1` (report.cjs:242-259) the canonical envelope is `envelope_version, ts, command, status, reason_codes, artifacts, evidence, next_action, risk, duration_ms, run_id, phase, milestone` (13 fields). Sampled rows contain all 13 + the 3 extension fields (`role, provider, token_breakdown`). The verifier prompt's alternate field list (`source, agent, event, args, metadata`) is not the envelope-v1 contract used by Phase 36 and is correctly absent. envelope_version=1 on all sampled rows; run_id matches regex pattern.
- BASE_02_ROW_COUNT_IDEMPOTENCY: PASS — 11,294 rows (>=10,000 threshold). Re-running `--backfill` on a snapshotted copy returns `rowsAppended:0, rowsSkipped:11308`; `diff -q` reports byte-identical files. Skip-set keyed on `metadata.source_event_id` works correctly.
- BASE_03_REPORT_SECTIONS: PASS — 7 H2 sections present; "Top Consumer", "Outlier", "Substitution" headings all matched.
- BASE_04_SUBSTITUTION_CANDIDATES: PASS — Exactly 5 R-rules present (R1..R5); each table renders threshold-trip rationale. R2/R3/R4 tables empty body is expected when no rows trip those thresholds in current corpus (R1=cache>0.9+findings<15, R5=total>200k both populated).

SELF_TEST: PASS — `15 pass, 0 fail`, exit=0. Two `[SGSD] ... appendTokenSpend failed:` warnings are intentional negative-path tests (banana role / foo provider) proving `_assertEnvelopeV1` rejects invalid enum values.

READ_ONLY_INVARIANT: PASS — `grep` confirms zero `appendFileSync/writeFileSync` calls in production code paths target `.planning/metrics/{codex-log,token-log,activity-log,muda-log}.jsonl`. Two `writeFileSync` matches at lines 871/876 are inside `--self-test` only and write to OS-tmpdir test fixtures, never to canonical streams. Production writes target only `agent-token-spend.jsonl` (line 279) and `baseline-token-spend.md` (line 738).

MIRROR_FIDELITY: PASS — 4x `Object.freeze` (constants), 7 references to `_normalize`/`_assertEnvelopeV1`. Public APIs (`appendTokenSpend`, `backfillFromMetrics`, `report`) wrap `_*Internal` in try/catch returning `false`/`''`/`{errors}` — never throws upward, mirrors gate-value-log.cjs.

LOCK_6_ORCHESTRATOR_INCLUDED: YES — orchestrator=10,881 rows of 11,294 total (96.3%); confirms self-telemetry inclusion per LOCK 6. Distribution: orchestrator:10881, reviewer:150, other:116, executor:77, planner:36, researcher:31, classifier:3.

AUDIT_CROSSCHECK_MARKERS: ALL_PRESENT — Report explicitly cites:
- P36 researcher >=170k (run_id 2026-04-27T17:09:06.990Z-681e)
- P40 researcher >=122k (run_id 2026-04-27T17:09:07.392Z-aca2)
- v1.9/P41 orchestrator 1,244,893 (4 rows)

ANTI_PATTERNS_FOUND: none

## Evidence appendix

- Ledger: `.planning/metrics/agent-token-spend.jsonl` (11,294 rows, envelope-v1 conformant)
- Report: `.planning/milestones/v1.9/baseline-token-spend.md` (7 H2 sections, 5 R-rules)
- Tool: `super-gsd/tools/token-attribution/report.cjs` (1020 lines, ASCII-only, self-test 15/15)
- Idempotency: snapshot diff byte-identical post-backfill
- Read-only: zero writes to canonical source streams in production code paths

VERDICT: PASS
ONE_LINER: Phase 41 ships a faithful Phase-36-mirror token-attribution tool that produces an envelope-v1-conformant 11,294-row ledger plus a substantive bloat report exposing the 1.24M-token v1.9/P41 orchestrator signature; idempotent, read-only, self-test green, all 5 substitution rules and 3 audit markers honored.
