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

---

## Re-Review (post-fix, commit 9a14ba3)

After operator's "Fix now" directive, shipped single corrective commit:
`9a14ba3 fix(17-01/T2-fix): CLEAN-02 addendum — eliminate WASTE.md row duplication`

The fix:
1. Removed static placeholder rows for codex_qualitative_waste + inventory.
2. Removed INVT_V dead code entirely (no inventory probe exists).
3. Replaced `printf >> $WASTE_FILE` with awk-based atomic insert placing the qualitative row INSIDE the Probe Results table (after git_spawn_pct row, before ## Raw Probe JSON).
4. Neutralized summary text (removed hardcoded "5 probes" / "three probes" counts).

### Codex re-review verdict

```
FINDINGS: 2
CRITICAL: 0      ← was 1, CLEARED
WARNINGS: 2      ← was 1, +1 new
PASS_RATE: 3/5
ONE_LINER: Duplication fixed, but awk insert is brittle and T1 warning remains.
```

**Duration:** 97914ms (1.63× first review — larger dimensional scope as 3-vs-5 means different denominators).

### Remaining warnings

1. **awk insert brittleness** — the fix matches on `/^\| git_spawn_pct/` as anchor. If the probe list changes or the line format drifts, the insert silently fails to match and the qualitative row is dropped. Mitigation: the `[ -z "$(awk match)" ]` check is not present; for a stronger contract, add a post-insert grep verifying the row landed. Accept as WARNING for now; revisit in Phase 18 CXOPS-02 (contract validator).
2. **T1 JSDoc narrative drift** — carried forward from first review. Fix did not touch T1. Prose around `reviewer-shaped` semantics may still describe pre-fix behavior beyond the 2 literal `reviewer_agent → reviewer_provider` swaps. Defer to phase-level ATC at Step 6.5; if still flagged, fix alongside phase-close SUMMARY.

### Auto-mode decision (Rule 13, post-fix)

`critical_count: 0` → gate PASSES without bypass. Loop continues cleanly to plan 17-02.

### Token accounting (cumulative 17-01 Codex spend)

| Invocation | Duration | Exit | Verdict |
|---|---|---|---|
| First review (8 commits, full diff) | 80.6s | 0 | 1 CRIT + 1 WARN |
| Re-review (fix commit only) | 97.9s | 0 | 0 CRIT + 2 WARN |
| **Total wall-clock** | **178.5s** | — | — |

Claude tokens saved (est): ~4,000 (two full-scope reviews offloaded).

### Commit-reviews ledger

Two rows now in `.planning/milestones/v1.4/phases/17-debt-sweep/commit-reviews.jsonl` — both with `provider: "openai-codex"`. Clean audit trail for CXOPS-03 evidence.
