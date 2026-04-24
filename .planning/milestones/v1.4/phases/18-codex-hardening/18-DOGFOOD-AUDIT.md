---
gate: "dogfood-evidence-audit"
phase: 18
plan: "18-02"
milestone: v1.4
category: "CXOPS"
audited: "2026-04-24T00:00:00Z"
cxops_03_status: satisfied
cxops_04_status: satisfied
cxops_03_rows: 5
cxops_04_rows: 1
total_codex_invocations: 6
verdict: "CXOPS-03 SATISFIED / CXOPS-04 SATISFIED"
---

# Phase 18: Codex Dogfood Evidence Audit

## CXOPS-03 — Per-dispatch ATC via Codex

### Requirement (verbatim from REQUIREMENTS.md)

> Dogfood proof — execute at least one v1.4 phase end-to-end with `codex_enabled: true` + new SKILL.md wiring active. Observe `.planning/phases/{N}/commit-reviews.jsonl` contains at least one Step 9.5 per-dispatch ATC row with `provider: openai-codex` and valid FINDINGS contract. Documented as evidence artifact.

### Evidence rows

Source: `.planning/milestones/v1.4/phases/17-debt-sweep/commit-reviews.jsonl` (rows 1–4) +
        `.planning/milestones/v1.4/phases/18-codex-hardening/commit-reviews.jsonl` (row 5)

| Row | Plan      | Tier | Exit | Verdict  | Critical | Warning | Provider      | Timestamp              |
|-----|-----------|------|------|----------|----------|---------|---------------|------------------------|
| 1   | 17-01     | full | 0    | critical | 1        | 1       | openai-codex  | 2026-04-24T10:39:37Z   |
| 2   | 17-01     | full | 0    | warn     | 0        | 2       | openai-codex  | 2026-04-24T10:52:09Z   |
| 3   | 17-03     | full | 0    | critical | 1        | 1       | openai-codex  | 2026-04-24T11:52:01Z   |
| 4   | 17-03     | full | 0    | clean    | 0        | 0       | openai-codex  | 2026-04-24T12:02:01Z   |
| 5   | 18-01     | full | 0    | warn     | 0        | 2       | openai-codex  | 2026-04-24T13:13:28Z   |

Row 1 ONE_LINER: "T2 breaks WASTE.md accuracy; T1 JSDoc still contradicts live behavior."
Row 2 ONE_LINER: "Duplication fixed, but awk insert is brittle and T1 warning remains."
Row 3 ONE_LINER: "Core tier wiring works, but config-backed tier resolution is not correct."
Row 4 ONE_LINER: "Fix is sound; config-backed tiers now resolve safely without regressions."
Row 5 ONE_LINER: "Two regressions: self-test exit precedence and parse-fallback gating." (meta-dogfood — Codex reviewing the code that adds validateContract to the very path invoking it)

**Row count with provider:openai-codex (per-dispatch): 5**

### Cross-reference with codex-log.jsonl

Source: `.planning/metrics/codex-log.jsonl`

Matching per-dispatch-ATC entries (exit 0, phase 17 + 18):

| Timestamp              | Phase | Plan  | Step              | Duration (ms) | Fallback | Parse fail |
|------------------------|-------|-------|-------------------|---------------|----------|------------|
| 2026-04-24T10:39:37Z   | 17    | 17-01 | per-dispatch-ATC  | 80,607        | false    | false      |
| 2026-04-24T10:50:08Z   | 17    | 17-01 | per-dispatch-ATC  | 97,914        | false    | false      |
| 2026-04-24T11:55:36Z   | 17    | 17-03 | per-dispatch-ATC  | 63,233        | false    | false      |
| 2026-04-24T11:59:15Z   | 17    | 17-03 | per-dispatch-ATC  | 105,227       | false    | false      |
| 2026-04-24T13:11:08Z   | 18    | 18-01 | per-dispatch-ATC  | 95,241        | false    | false      |

All 5 commit-reviews.jsonl rows have a matching provenance entry in codex-log.jsonl. No fallback_triggered events. No parse failures (validateContract first live-fire in 18-01 was clean).

### Methodology (CARRY-03 strictness — v1.5 Phase 25)

This audit counts a row as **CXOPS-03 dogfood evidence** ONLY when ALL of the following hold:

1. `provider: openai-codex` in `commit-reviews.jsonl` (excludes `claude-via-fallback` rows)
2. `fallback_triggered: false` in matching `codex-log.jsonl` row (excludes single-retry-fallback events even when the eventual provider tag is openai-codex)
3. `exit: 0` in matching `codex-log.jsonl` row (excludes timeout / auth-fail / parse-fail rows)
4. Valid 5-line FINDINGS contract present in `commit-reviews.jsonl` row (excludes contract-violation rows that triggered the validateContract single-retry path)

The 5-row count above passes all 4 criteria — verified retroactively against the v1.4 corpus. Row count unchanged after applying strict methodology.

**CXOPS-03: ☑ SATISFIED — 5 per-dispatch Codex rows across Phase 17 (4 rows) and Phase 18-01 (1 row), all under strict methodology**

---

## CXOPS-04 — Phase-level ATC via Codex

### Requirement (verbatim from REQUIREMENTS.md)

> Same phase's Step 6.5 phase-level ATC observably routes to Codex — produces `.planning/phases/{N}/{N}-ATC-REVIEW.md` authored by Codex with `provider: openai-codex` stamp in commit-reviews.jsonl and/or the review markdown frontmatter.

### Evidence

**Source 1:** `.planning/milestones/v1.4/phases/17-debt-sweep/commit-reviews.jsonl` row 5

| Row | Plan       | Tier | Exit | Verdict | Critical | Warning | Provider     | Note                                                                  |
|-----|------------|------|------|---------|----------|---------|--------------|-----------------------------------------------------------------------|
| 5   | 17-phase   | full | 0    | warn    | 0        | 3       | openai-codex | phase-level ATC (Step 6.5) via --timeout-tier analysis after initial review-tier timeout |

ONE_LINER: "Near-shippable, but MUDA qualitative reporting prevents a clean close."

**Source 2:** `.planning/milestones/v1.4/phases/17-debt-sweep/17-ATC-REVIEW.md` frontmatter

```yaml
phase: 17
gate: "phase-level-ATC"
provider: "openai-codex"
model: "codex (gpt-5.4)"
invocation: "shellDispatch via codex-exec.sh --timeout-tier analysis"
date: "2026-04-24"
duration_ms: 156018
tier: "FULL"
exit_code: 0
```

Cross-reference with codex-log.jsonl: entry at 2026-04-24T12:11:19Z, phase 17, step "phase-level-ATC", exit 0, duration_ms 156018, fallback_triggered false.

**CXOPS-04: ☑ SATISFIED — Phase 17 phase-level ATC authored by Codex, evidenced by commit-reviews.jsonl row 5 and 17-ATC-REVIEW.md frontmatter**

---

## Summary

| REQ-ID   | Status        | Evidence source                                                              |
|----------|---------------|------------------------------------------------------------------------------|
| CXOPS-03 | ☑ SATISFIED  | Phase 17 commit-reviews.jsonl rows 1–4 + Phase 18 commit-reviews.jsonl row 1 |
| CXOPS-04 | ☑ SATISFIED  | Phase 17 commit-reviews.jsonl row 5 + 17-ATC-REVIEW.md frontmatter          |

### Telemetry summary

Cumulative Codex wall-clock (successful per-dispatch + phase-level reviews): ~598s
- 17-01 review 1: 80,607ms
- 17-01 review 2: 97,914ms
- 17-03 review 1: 63,233ms
- 17-03 review 2: 105,227ms
- 17-phase review: 156,018ms
- 18-01 review: 95,241ms

fallback_triggered count: 0
parse_failure count: 0
timeout_hit on successful invocations: 0

Note: An initial phase-level ATC attempt for Phase 17 timed out (exit 5, 120,783ms) and was retried via --timeout-tier analysis. The successful retry produced the 156,018ms entry above and the 17-ATC-REVIEW.md artifact. This timeout/retry cycle is normal protocol behaviour, not a failure.
