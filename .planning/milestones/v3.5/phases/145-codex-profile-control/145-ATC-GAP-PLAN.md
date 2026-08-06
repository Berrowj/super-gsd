# P145 ATC Gap Plan — phase-level ATC GATE_AUTO_HALT resolution

phase_atc: 145-ATC-REVIEW.md (openai-codex gpt-5.5/xhigh, dispatch 2 of 2;
dispatch 1 timed out at 360s exploring — retried at 900s with bounded scope)
verdict: FINDINGS 3 / CRITICAL 1 / WARNINGS 2 / PASS_RATE 2/5

## CRIT-1 — codex-exec.sh silent report-write failure (FIX IN FLIGHT)
`write_report_payload` returns "0" on write failure; success path still logs
append_jsonl 0 + "OK — written (0B)" + exit 0. Exit 0 must mean report
written. Resolution: Codex executor dispatch 145-01-RWFIX (prompt/report in
this dir) — 0-byte report on any path → dedicated nonzero exit + truthful
JSONL + new self-test probe. Phase does NOT close until this lands, spec
review passes, and per-dispatch ATC is clean.
Note: matches curated anti-pattern "codex-exec set-e silent report-loss"
(0a957d4) — same failure class, now mechanically guarded.

## WARN-1 — CLI defaults duplicated (registry / resolver builtins / shell fallback) — DEFERRED
codex-profiles.yaml:122, profile-resolver.cjs:75, codex-profile-shell.sh:65.
Partially by-design: the fail-open path must survive an unreadable registry,
so a literal fallback copy is required somewhere. Real residual risk is DRIFT
between the three copies. Deferred follow-up: single generated source or a
parity self-test asserting the three stay byte-consistent. → DEFERRED-B.

## WARN-2 — guarded but operationally inert trust/hook profile fields — DEFERRED
profile-resolver.cjs:63 exposes mutable trust/hook fields; resolver output
(profile-resolver.cjs:417) never exports them. Dead surface guarded by the
danger-mutation guard but consumed by nothing. P148/P150 (cross-model triage,
hook-trust ceremony) are the intended consumers — delete-or-consume decision
belongs there. → DEFERRED-C.

## Deferred ledger for phase close
- DEFERRED-A: selfTestCliGuard non-TTY forcing + env restore (per-dispatch ATC WARN)
- DEFERRED-B: 3-way CLI-default drift guard (WARN-1)
- DEFERRED-C: inert trust/hook fields — consume in P148/P150 or delete (WARN-2)
- DEVIATION-1 (carried): codex-exec finalize probe simplification
