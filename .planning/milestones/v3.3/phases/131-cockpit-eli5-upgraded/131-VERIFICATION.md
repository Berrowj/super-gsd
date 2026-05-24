---
phase: 131
phase_name: Cockpit ELI5 Upgraded — Munroe + Duarte
milestone: v3.3
ws: core
status: PASS
verdict: PASS
completed_at: 2026-05-24
sacs_total: 4
sacs_passed: 4
files_created: 2
files_modified: 2
deviations: 0
plan_id: P131-01-eli5-upgraded
self_test_command: node super-gsd/tools/cockpit-sidecar/run-self-test.cjs
self_test_result: pass
self_test_count: 42/42
---

# Phase 131 — Cockpit ELI5 Upgraded — VERIFICATION

## Summary

P131 ships Munroe's common-words constraint as a mechanical lint over the existing Haiku-narrated ELI5 panel and rewrites the narrator prompt to ask for Duarte's 4-beat arc (What is now → What could be → S.T.A.R. moment → Call to action). New `eli5-common-words.txt` (1539 entries: Munroe ten-hundred core + SGSD vocabulary). New `eli5-lint.cjs` (pure regex tokenizer + Set-based allowlist + inline-gloss recognition). `sgsd-codex-monitor.ps1::Get-LocalClaudeEli5` prompt format-spec replaced with the 4-beat arc + jargon-gloss directive. 4 new SAC tests; full self-test **42/42 PASS, exit 0**.

## Files

- `super-gsd/tools/cockpit-sidecar/eli5-common-words.txt` (created, 1539 lines) — alphabetically sorted Munroe + SGSD vocabulary allowlist
- `super-gsd/tools/cockpit-sidecar/eli5-lint.cjs` (created, 78 lines) — `lintEli5(text, opts)` returning `{ok, violations, total_words, out_of_list_count}`
- `super-gsd/scripts/sgsd-codex-monitor.ps1` (modified, +7 / -6 lines on the prompt format-spec block)
- `super-gsd/tools/cockpit-sidecar/run-self-test.cjs` (modified, +40 lines for SAC-P131-01..04)

## SAC results

| SAC | Outcome | Result |
|---|---|---|
| SAC-P131-01 | benign all-common text → ok:true, out_of_list ≤2 | PASS |
| SAC-P131-02 | jargon text (SAC/schema/mandates/idempotent/invariants/concurrent) → ok:false, out_of_list ≥4 | PASS |
| SAC-P131-03 | orchestrator with parenthetical gloss → violation entry has glossed:true | PASS |
| SAC-P131-04 | PS monitor file contains ≥3 of 4 Duarte arc phrases | PASS |

`node super-gsd/tools/cockpit-sidecar/run-self-test.cjs` → exit 0, 42/42 PASS.

## Invariant compliance

- **Mechanical lint** — no LLM; pure regex tokenization + Set lookup.
- **Allowlist-driven** — eli5-common-words.txt is the only source of truth for what counts as "common".
- **Lock-13 untouched** — only `super-gsd/tools/cockpit-sidecar/` (2 new + 1 modified) and `super-gsd/scripts/sgsd-codex-monitor.ps1` touched. No `cockpit-state/*` or test-acceptance dirs.
- **Backward compatible** — lint is informational at this phase; binding promotion deferred to P134.

## Deviations

(none)

## Pipeline note

P131 ran 4 Codex dispatches + 1 orchestrator-authored close:
- T1 (eli5-common-words.txt) — direct `codex-executor.sh`; 1539 entries
- T2 (eli5-lint.cjs) — direct `codex-executor.sh`; orchestrator caught a subtle SAC-P131-03 spec ambiguity (absolute count comparison confounded by gloss-text content) — fixed by writing T4's test to check the glossed-flag boolean directly rather than comparing counts
- T3 (PS prompt) — `codex-patch-executor.sh`; 7+/6- localized prompt edit
- T4 (4 SAC tests) — `codex-patch-executor.sh`; 40 insertions
- T5 (this doc + capsule) — orchestrator-authored after green self-test

## Commit chain

| Commit | Subject |
|---|---|
| `1c1dc99` | feat(v3.3): P131 CONTEXT + PLAN-LOCKED |
| `892505a` | feat(P131-T1): eli5-common-words.txt — 1539-word allowlist |
| `c78d9c7` | feat(P131-T2): eli5-lint.cjs — Munroe word-list + gloss recognition |
| `65ed9de` | feat(P131-T3): Get-LocalClaudeEli5 prompt — Duarte 4-beat arc |
| `a367142` | test(P131-T4): SAC-P131-01..04 |

## Next phase

**P132 — Localhost-Live HTML Cockpit (PRIMARY SURFACE).** Node http server with SSE + fs.watch serving the 3-band cockpit as a live HTML SPA at `localhost:7777`. DOM-diff client (vanilla JS). Reuses v3.2 `--html` renderer + design system. Biggest phase of v3.3 — 6+ tasks scoped.
