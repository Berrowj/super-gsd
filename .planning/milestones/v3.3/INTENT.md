---
milestone: v3.3
title: Live Contextual Awareness — localhost-live cockpit + Bands 1-2-3 grammar
why: >-
  v3.2 (DLB-12) shipped two answer-first surfaces — the chronicle HTML and a
  tight 405-line cockpit-sidecar.cjs — both grounded in 12 book-cited rules.
  But the surface the operator actually watches all day during autonomous runs
  is sgsd-codex-monitor.ps1: a 2446-line PowerShell live monitor with 15+
  panels that pre-dates v3.2's answer-first discipline. It is stale and noisy.
  The chronicle's explanation grammar (Operator Decision Panel, SCQA framing,
  cited rationale, fog gauge) only fires at phase close, not during the run.
  Operator wants full contextual awareness LIVE: where we are, why this phase,
  what unlocks, what's blocked, what to do next — in ≤10 seconds of glance.
outcome_delivered: >-
  One live operator surface — a localhost HTML cockpit at localhost:7777 —
  that translates the v3.1 chronicle's explanation grammar into a live experience.
  A 3-band IA (visceral / behavioral / reflective) honours 17 cited design
  principles (Brooks sharp-edged stages, Norman cause+ETA, Krug one-loud-line,
  Tufte data-ink + sparklines, Cockburn use-case extensions, Minto SCQA + MECE,
  Heath SUCCES, Roam 6×6 visual frames, Munroe ten-hundred, Duarte arc beat,
  Sullivan ≤10-words, Knaflic declutter, GitHub Primer 5-tier colour) plus
  operator's own JCL Project Clarity Suite 6-stage pipeline pattern (re-scoped
  to 5 stages after operator decision 2026-05-24). The PowerShell monitor
  becomes terminal fallback; conformance gate (P134) covers all 4 surfaces
  (chronicle HTML, sidecar --html, localhost-live cockpit, terminal fallback).
parent_project: Super GSD Framework
created_at: 2026-05-24
closed_at: null
predecessor: v3.2 / DLB-12 Operator Comprehension System (closed 2026-05-22, ALL-PHASES-CLOSED PASS)
source_brief: .planning/briefs/2026-05-24-cockpit-v3.3-assessment.md (committed 96e4767)
companion_explainer: .planning/briefs/2026-05-24-cockpit-v3.3-assessment.html
source_plan: .planning/plans/2026-05-24-cockpit-v3.3-implementation.md
entry_criteria:
  - v3.2 ALL-PHASES-CLOSED (DLB-12 Operator Comprehension System complete; chronicle 111/111, cockpit 18/18)
  - cockpit-sidecar.cjs (v3.2) exists with --json --text --brief --html modes and binding_fail=0 cross-surface conformance
  - sgsd-design-system.css (v3.2 P120 shared) exists with 12 book-cited rules R01-R12
  - conformance-check.cjs (v3.2 P127) wired for cockpit + chronicle surfaces (advisory on chronicle path)
  - Brief approved by operator 2026-05-24; plan written and self-reviewed
exit_criteria:
  - stage_pipeline data model present additively in cockpit-sidecar.cjs --json (5 stages, byte-stable for v3.2 keys)
  - renderText + renderBrief rebuilt as 3-band terminal layout with inline ANSI sparklines + Primer 5-tier alert palette
  - Band 3 rationale layer reads PROJECT.md + INTENT.md + last SUMMARY.md cascade per DLB-03; SUCCES self-test passes
  - ELI5 narrator lint-checked against Munroe common-words list; prompt uses Duarte 4-beat arc
  - localhost-live HTML cockpit (Node http + SSE + fs.watch + DOM-diff) serves at localhost:7777 with ≤2s freshness
  - sgsd-codex-monitor.ps1 migrated per keep/kill audit (Band-aware layout; off-stage panels behind --drill flag)
  - conformance-check.cjs promoted advisory→binding; covers all 4 surfaces with rules R01-R20 binding_fail=0
  - Cross-cutting 5-question acceptance test: operator can answer each in ≤10s by glance
  - Zero regression in v3.2 self-tests (chronicle 111/111, cockpit 18/18 still green)
non_goals:
  - No rewrite of cockpit-state/* or tests/cockpit-acceptance/* or tests/cockpit-regression/* (architecture lock 13)
  - No breaking change to cockpit-sidecar.cjs --json contract (additive only)
  - No LLM in any render path or stage detection (deterministic only, projection-not-opinion)
  - No external CDN / JS dependencies in localhost-live cockpit (offline-survivable, vanilla JS only)
  - No discuss stage in the live pipeline grammar (auto-mode synthesizes CONTEXT — Q-D answered 2026-05-24)
  - No ingest of the 9 named books into VTP (parallel workstream, not blocking v3.3; canonical knowledge used in interim)
  - No PowerShell monitor deletion — stays as terminal fallback during transition
open_questions:
  - Q-A · ORDER-PIPELINE-SPEC.pdf operator-folder spec — deferred (Q-A 2026-05-24); ship P128 with default 5 stages; material additions become P128.5
  - Q-B · VTP ingestion of the 9 named books — parallel workstream; conformance lint uses canonical knowledge in interim
  - Q-C · book_passages Qdrant fetch-fail — separate infra ticket; non-blocking
phase_list:
  - P128 · cockpit-v33-data-model (stage-pipeline data model + additive --json keys)
  - P129 · cockpit-v33-band1-band2-terminal (3-band terminal layout + sparklines + Primer palette)
  - P130 · cockpit-v33-band3-rationale (rationale layer cascade + SUCCES self-test)
  - P131 · cockpit-v33-eli5-upgraded (Munroe lint + Duarte arc structure)
  - P132 · cockpit-v33-localhost-live (Node http + SSE + fs.watch + DOM-diff browser SPA — PRIMARY SURFACE)
  - P133 · cockpit-v33-monitor-migration (PowerShell keep/kill audit → terminal fallback)
  - P134 · cockpit-v33-conformance-promotion (advisory→binding; 4-surface coverage; inherited from v3.2 backlog)
---

# Milestone v3.3 — Live Contextual Awareness

> Translate the v3.1 chronicle's answer-first explanation grammar into a live cockpit at `localhost:7777`. Operator gets full contextual awareness during the run — not just at phase close. Same explanation grammar across 4 surfaces, one machine-checked conformance gate covering all of them.

## Why now

v3.2 closed the answer-first primitive on the *compact terminal sidecar* (binding_fail=0, 18/18 self-test). The surface operator watches daily is *different*: a 2446-line PowerShell live monitor that pre-dates v3.2's discipline. Two complaints surfaced 2026-05-24:

1. **Freshness** — doesn't always show the most up-to-date relevant information
2. **Usefulness** — a lot of the info isn't useful

The fix is not to strip the monitor — it's to **port the chronicle's explanation experience to live cockpit terms**, with a richer surface (localhost HTML) as the primary view. Operator explicitly wants the Context and ELI5 sections *expanded*, not stripped.

## What changes

| Surface | Before (v3.2) | After (v3.3) |
|---|---|---|
| Chronicle HTML | Answer-first 11-section, gold-reference | Same + binding conformance gate (P134) |
| Sidecar `--html` | Static snapshot, design-system styled | Same + extended Band 1-2-3 grammar (P129+P130) |
| **Live operator surface** | PS monitor (2446 lines, 15 panels, pre-v3.2 grammar) | **localhost:7777 HTML cockpit, 3 bands, ≤2s freshness, SSE-driven (P132)** |
| Terminal fallback | (none) | PS monitor stripped to bands per keep/kill audit (P133) |

Each surface consumes the same `cockpit-sidecar.cjs --json` output (additively extended in P128). One conformance gate (P134) covers all four.

## How it's structured

7 phases (5 originating + 1 inherited from v3.2 backlog + this scaffold):

1. **P128** — stage-pipeline data model (5 stages: research → vtp-enrich → plan → execute → verify)
2. **P129** — Band 1 + Band 2 terminal layout (rebuild renderText/renderBrief, add sparklines, Primer 5-tier alert palette)
3. **P130** — Band 3 rationale layer (cascade-read PROJECT/INTENT/SUMMARY/CONTEXT, SUCCES lint)
4. **P131** — ELI5 upgraded (Munroe common-words lint, Duarte 4-beat arc in prompt)
5. **P132** — localhost-live HTML cockpit at `localhost:7777` (PRIMARY SURFACE, Node http + SSE + fs.watch + DOM-diff)
6. **P133** — PS monitor keep/kill migration (terminal fallback)
7. **P134** — conformance promotion advisory→binding across 4 surfaces (inherited from v3.2 backlog)

Detailed plan: `.planning/plans/2026-05-24-cockpit-v3.3-implementation.md`. Each phase authors its own SGSD-shaped `PLAN-LOCKED.md` via `sgsd-write-plan` when its turn comes (mirrors v3.2 pattern).
