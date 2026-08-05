---
phase: "146"
slug: session-governance-hooks
milestone: v3.5
status: PENDING
design_ref: ".planning/analyses/2026-08-05-always-on-orchestration-DESIGN.md#p146"
depends_on: []
---

# P146 Context — Session Governance Hooks (all modes)

## Goal

Governance fires in every session type via repo-local `.claude/settings.json`
hooks (installer-managed, never machine-global): SessionStart contract
injection, UserPromptSubmit intent classifier, report-only quality gate.
Also lands the 2026-08-02 board's unbundled cheap fixes.

## Components

1. **SessionStart hook** — inject governance contract: ATC tier table, gates per
   mode (same table; mode changes who confirms, not what runs), active
   milestone/phase from STATE.md frontmatter.
2. **UserPromptSubmit** `sgsd-intent-classifier.cjs` — local node, <1s, NO LLM.
   Intent classes: planning / execution / retrospective / trivial. Lexicon from
   sgsd-triage triggers + skill-routing.yaml (P149; ship with embedded lexicon
   until P149 lands, then read the registry). Planning intent → inject
   "/sgsd-triage" directive. Neglected-skill signature → inject suggestion.
3. **`sgsd-quality-gate.js`** — PostToolUse, REPORT MODE ONLY (board-binding: no
   blocking). Resolve phase from STATE.md frontmatter + glob real
   `{NN}-*-PLAN-LOCKED.md` naming. Append evidence rows to
   `.planning/metrics/gate-evidence.jsonl`. Cockpit tile surfaces gaps.
4. **Board cheap fixes (unbundled):** handoff-chain latch reset on `refused`
   rows (sgsd-stop-handoff.sh, latched since 2026-04-24); autopilot-watchdog
   phase resolution from STATE frontmatter not prose regex; unregister dead
   `gsd-atc-slice-gate.js`; delete dead config knobs.

## Constraints (board-binding)

- NO edit-seam blocking. Report-only. Exit 0 always in non-SGSD repos.
- Every hook: narrow try/catch, unexpected error → exit 0 + logged failure row.
- No hook reads `~/.claude/settings.json` env block (live keys).
- Paths resolved at install time from the target repo; no hardcoded machine paths.
- Hook latency budget: classifier <1s p95 (AHE-P-09 stacking risk — measure).

## Acceptance criteria

AC-146 (a)(b)(c)(d) from the design spec.
