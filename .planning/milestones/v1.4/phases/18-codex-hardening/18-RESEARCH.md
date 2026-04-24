# Phase 18: Codex Hardening — Research (Internal Validation)

**Researched:** 2026-04-24
**Domain:** codex-exec.sh arg parser + SKILL.md shellDispatch + commit-reviews.jsonl schema
**Mode:** Codebase validation only — no external research

---

## Validation Results

| # | Claim | Result | Evidence |
|---|-------|--------|----------|
| 1 | `--self-test`/`--skip-network` flags follow existing arg-parser pattern without conflict | PASS | `while [[ $# -gt 0 ]]; do case "$1" in` at line 65; all flags use `--name) VAR="$2"; shift 2 ;;` or `--name) FLAG=true; shift ;;`. New flags slot cleanly. No wildcard conflict — unknown flags hit `-*)` at line 77 (exit 1), which `--self-test` will replace before that fallthrough. |
| 2 | Exit codes 10/11/12/13 are unused — no collision with 0/1/3/4/5/6 | PASS | codex-exec.sh header (lines 28-34) documents exactly 0,1,3,4,5,6. No other exit call in the file. 10-13 are free. |
| 3 | `append_jsonl` usable with `step: "self-test"` | PASS | `append_jsonl` at line 296-308 uses `$STEP_TAG` which is a free-form string rendered as JSON string. `step: "self-test"` is a valid value. `resolve_step_timeout` already maps `self-test` at line 197 (returns `$TIER_DEFAULT`). |
| 4 | SKILL.md shellDispatch exit-0 read path where validateContract hooks | PASS | Step 9.5 line 937: `report = { content: dispatchResult.report, _provider: 'openai-codex' }` — this is the EXACT post-exit-0 assignment. validateContract must be inserted BEFORE this line, after `dispatchResult.exit === 0` is confirmed. Mirror pattern at Step 6.5 line 521. |
| 5 | commit-reviews.jsonl schema is open/additive for `fallback_reason` field | PASS | Rows are JSON-per-line appended via `printf`/Node. No schema validation exists. Row 4 already demonstrates additive fields: `"note":"re-review..."` not present in row 1. `fallback_reason` appends safely. |
| 6 | commit-reviews.jsonl has 5 rows with `provider: openai-codex` | PASS | All 5 rows counted: rows 1-4 are per-dispatch (plans 17-01 ×2, 17-03 ×2); row 5 is phase-level (plan 17-phase). All have `"provider":"openai-codex"`. CONTEXT.md D-04 claim of "4 per-dispatch + 1 phase-level" is CORRECT. |
| 7 | 17-ATC-REVIEW.md frontmatter has `provider: "openai-codex"` + `gate: "phase-level-ATC"` | PASS | Lines 3-4 confirm exactly: `gate: "phase-level-ATC"` and `provider: "openai-codex"`. CXOPS-04 evidence is solid. |

**All 7 claims: PASS. CONTEXT.md is accurate.**

---

## Gaps Found

1. **`--self-test` early-exit placement**: `--prompt-file` and `--report-out` are checked REQUIRED at lines 88-93, which fires before any `--self-test` branch would run. Planner must insert `--self-test` handling either (a) before the required-flag guard or (b) make those flags optional when `SELF_TEST=true`. Option (b) is simpler — guard becomes `if [[ "$SELF_TEST" == false && (empty prompt || empty report) ]]`.

2. **OPENAI_API_KEY gate at line 96 runs before `--self-test` branch**: Self-test probe #2 explicitly checks that `$OPENAI_API_KEY` is NOT set (exit 11 = auth). The existing early-exit at line 96-99 will fire first with exit 4, not 11. Need to skip the OPENAI_API_KEY guard (or move auth probe inside self-test harness) when `SELF_TEST=true`.

3. **`step: "6.5"` string in SKILL.md does NOT match the step-name resolver**: `resolve_step_timeout` maps `phase-level-ATC` → TIER_REVIEW but SKILL.md passes `step: '6.5'` (the literal step number). The self-test probe #3 must verify the STEP_TAG-to-tier map using the canonical step labels (`per-dispatch-ATC`, `phase-level-ATC`), not step numbers. This is a pre-existing calibration issue, not new to Phase 18.

4. **SKILL.md `dispatchResult.report`**: The `shellDispatch` call result field is named `.report` (Step 9.5 line 937) — validateContract receives this string content, not a file path. Planner must clarify: does `shellDispatch` return the file contents, or the path? If path, `validateContract(dispatchResult.reportPath)` is more accurate. Needs one grep to confirm `shellDispatch` return shape before implementing.

---

## Planner Guidance

- **CXOPS-01 T1**: Insert `SELF_TEST=false; SKIP_NETWORK=false` in Defaults block (line 40 area). Add `--self-test) SELF_TEST=true; shift ;;` and `--skip-network) SKIP_NETWORK=true; shift ;;` in the case block. Then make the required-flag guard skip when `SELF_TEST=true`. Keep `set -u` — all new vars must be initialised.

- **CXOPS-01 T2**: Probe harness order: PATH → auth → timeout-math → contract. Each probe writes a local `probe_result` var and sets an exit code accumulator. Final `append_jsonl` call uses `step: "self-test"` + new `self_test_probes` JSON object field in the JSONL line. The existing `append_jsonl` signature only takes 3 args; extend it or add a separate `append_self_test_jsonl` variant.

- **CXOPS-01 T3 — timeout-math probe**: Call `resolve_timeout_tier review` and compare against `$TIER_REVIEW`. Do NOT call codex binary. Exit 12 if resolver returns empty or wrong value.

- **CXOPS-02 hook sites in SKILL.md**: Two insertion points — Step 9.5 line ~937 and Step 6.5 line ~521. Pattern is identical: after `dispatchResult.exit === 0` branch, before assigning `report`. A single `validateContract(content)` function defined once (above Step 6.5) and called at both sites keeps the diff tight.

- **CXOPS-02 fallback_reason field**: `append_jsonl` currently hard-codes `"fallback_triggered":false`. When validateContract fires, the orchestrator-side JSONL append (commit-reviews.jsonl, NOT codex-log.jsonl) gains `"fallback_triggered":true,"fallback_reason":"parse_failure"`. These are different log files — don't conflate them.

- **CXOPS-03/04 (18-02)**: Both are already satisfied by Phase 17 evidence. 18-02's AUDIT.md is a documentation task only. Copy the 17-ATC-REVIEW.md frontmatter shape. Cite row-by-row with line references to commit-reviews.jsonl (5 rows, all verified above).

- **Commit format**: `feat(18-01/T1): CXOPS-01 --self-test flag + probe harness`, `feat(18-01/T2): CXOPS-02 validateContract hook at Steps 6.5+9.5`, `audit(18-02): CXOPS-03/04 Phase 17 dogfood evidence`.

---

## Per-CXOPS Commit Hints

| REQ | Suggested commit message |
|-----|--------------------------|
| CXOPS-01 | `feat(18-01/T1): CXOPS-01 codex-exec --self-test + --skip-network probes (exit 10-13)` |
| CXOPS-02 | `feat(18-01/T2): CXOPS-02 validateContract hook in SKILL.md Steps 6.5+9.5 + fallback_reason telemetry` |
| CXOPS-03 | `audit(18-02/T1): CXOPS-03 dogfood evidence — 4 per-dispatch Codex ATC rows from Phase 17` |
| CXOPS-04 | `audit(18-02/T1): CXOPS-04 dogfood evidence — Phase 17 phase-level ATC-REVIEW.md authored by Codex` |
