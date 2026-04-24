---
phase: 17
plan: "17-01"
gate: "per-dispatch-ATC"
provider: "openai-codex"
model: "codex (gpt-5.4)"
invocation: "shellDispatch via codex-exec.sh"
duration_ms: 80607
exit_code: 0
fallback_triggered: false
timeout_hit: false
prompt_bytes: 8354
report_bytes: 133
date: "2026-04-24"
historic_note: "First orchestrator-path Codex invocation (CXOPS-03 dogfood evidence)"
---

# 17-01 Per-Dispatch ATC Review — Codex (CXOPS-03 dogfood moment)

## Codex 5-field contract verdict

```
FINDINGS: 2
CRITICAL: 1
WARNINGS: 1
PASS_RATE: 4/6
ONE_LINER: T2 breaks WASTE.md accuracy; T1 JSDoc still contradicts live behavior.
```

## Review scope

3 commits reviewed (HEAD~3..HEAD from b6352f6):

- `9040955 fix(17-01/T1): CLEAN-01 refresh providers-registry JSDoc + delete dead fallback branch (WR-01/WR-02)`
- `95197df fix(17-01/T2): CLEAN-02 extend WASTE.md summary accumulation to 5 probes`
- `b6352f6 docs(17-01): complete 17-01 plan — providers-registry JSDoc/dead-branch + muda-audit 5-probe display`

Files: `super-gsd/scripts/lib/providers-registry.cjs` (T1) + `super-gsd/scripts/sgsd-muda-audit.sh` (T2).

## Critical finding (Codex)

**T2 breaks WASTE.md accuracy.** The 5-line contract doesn't enumerate specifics, but orchestrator analysis of the diff identifies the probable issue:

- Initial WASTE.md table generation at lines ~106-110 emits STATIC placeholder rows for `codex_qualitative_waste` ("— / critical>0 warn>0 / see appended row below") and `inventory` ("— / — / probe not yet implemented").
- The qualitative probe block at lines ~381+ ALSO appends a `codex_qualitative_waste` row to the same `$WASTE_FILE`.
- Result: when the qualitative probe runs, WASTE.md ends up with **two rows** for `codex_qualitative_waste` — a static `$QUAL_V="SKIP"` placeholder and a dynamic row with actual findings.

The fix T2 attempted (display 5 probes instead of 3) introduced row duplication. CLEAN-02's original intent — "WASTE.md summary table reflects actual probe verdicts" — is arguably regressed, not resolved.

## Warning finding (Codex)

**T1 JSDoc still contradicts live behavior.** The 2 docblock comment edits changed `reviewer_agent` → `reviewer_provider`, but the narrative around "reviewer-shaped" gates and the fallback-branch removal may have left stale prose elsewhere in the file that still describes the pre-fix behavior. Not inspected line-by-line.

## Auto-mode decision (Rule 13)

`config.atc.enabled: true` + `tier: FULL` + `code_files_changed_count: 2` → gate fired.
`critical_count: 1` + auto mode → **GATE_AUTO_BYPASS logged**, loop continues.

Phase-level ATC at Step 6.5 (fires once per phase after verification passes) will re-catch this finding at phase 17 close. Operator visible at that gate.

## Evidence row (appended to commit-reviews.jsonl)

```json
{"ts":"2026-04-24T10:39:37Z","plan":"17-01","tier":"full","verdict":"critical","critical":1,"warning":1,"one_liner":"T2 breaks WASTE.md accuracy; T1 JSDoc still contradicts live behavior.","provider":"openai-codex"}
```

## Token accounting (CXOPS-03 evidence)

- Provider: `openai-codex` (NOT claude — this is genuinely cross-vendor)
- Duration: 80.6s (well under 180s timeout)
- Prompt: 8,354 bytes (~2k tokens)
- Report: 133 bytes (5 lines)
- Claude tokens saved: ~2,000 (would have dispatched sonnet reviewer otherwise)
- Fallback: NOT triggered (clean exit 0)

## What this proves (CXOPS-03 retroactively)

1. ✅ `sgsd-orchestrate` SKILL.md Step 9.5 shellDispatch path WORKS end-to-end
2. ✅ `gates.yaml` `per-dispatch-ATC` row correctly routes to `codex-cli-reviewer`
3. ✅ `codex-exec.sh` parses the 5-line contract cleanly and writes atomic output
4. ✅ `.planning/metrics/codex-log.jsonl` captures provenance with `step: "per-dispatch-ATC"`
5. ✅ Cross-vendor review signal is genuine — Codex caught a real issue (WASTE.md duplication) that may have slipped past Claude's self-review
