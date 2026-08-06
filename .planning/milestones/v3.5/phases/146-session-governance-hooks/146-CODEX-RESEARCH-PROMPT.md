# P146 Research — Session Governance Hooks (all modes)

<intent milestone="v3.5">
Always-On Orchestration — governance as runtime mechanism in all session modes.
</intent>

You are the phase researcher. Read-only. Produce an implementation-ready
research report. Do NOT write code, do NOT modify files. Budget-disciplined:
do NOT run self-test suites; do NOT explore beyond the files listed below plus
what they directly reference.

## Phase goal (CONTEXT.md, condensed)
Governance must fire in EVERY session type via repo-local
`.claude/settings.json` hooks (installer-managed, never machine-global):
1. SessionStart hook injecting the governance contract (ATC tier table, gates
   per mode, active milestone/phase from STATE.md frontmatter).
2. UserPromptSubmit `sgsd-intent-classifier.cjs` — local node, <1s p95, NO LLM.
   Classes: planning / execution / retrospective / trivial. Lexicon from
   sgsd-triage triggers + (later) skill-routing.yaml from P149; ship embedded
   lexicon now, registry-read after P149.
3. `sgsd-quality-gate.js` — PostToolUse, REPORT-ONLY (board-binding: never
   blocks). Resolves phase from STATE.md frontmatter, globs real
   `{NN}-*-PLAN-LOCKED.md`, appends rows to
   `.planning/metrics/gate-evidence.jsonl`.
4. Board cheap fixes (unbundled): handoff-chain latch reset on `refused` rows
   in sgsd-stop-handoff.sh (latched since 2026-04-24); autopilot-watchdog phase
   resolution from STATE frontmatter instead of prose regex; unregister dead
   `gsd-atc-slice-gate.js`; delete dead config knobs.

## Board-binding constraints (non-negotiable)
- NO edit-seam blocking; report-only; exit 0 always in non-SGSD repos.
- Every hook: narrow try/catch; unexpected error → exit 0 + logged failure row.
- No hook may read `~/.claude/settings.json` env block (contains live API keys).
- Paths resolved at INSTALL time from the target repo; no hardcoded machine paths.
- Classifier latency <1s p95 (measure; AHE-P-09 hook-stacking risk).

## Read these (start here)
- .planning/milestones/v3.5/phases/146-session-governance-hooks/CONTEXT.md
- .planning/analyses/2026-08-05-always-on-orchestration-DESIGN.md (the #p146
  section AND the AC-146 (a)(b)(c)(d) definitions — quote them verbatim in
  your report)
- .planning/milestones/v3.5/INTENT.md
- Existing hook surface: whatever `.claude/settings.json` in THIS repo already
  registers (hooks block only — do NOT read or echo any env block), plus
  super-gsd/hooks/ (list + read the ones relevant to SessionStart /
  UserPromptSubmit / PostToolUse)
- super-gsd/scripts/sgsd-stop-handoff.sh (latch logic)
- the autopilot-watchdog script (find it under super-gsd/scripts/)
- super-gsd/skills/sgsd-triage/SKILL.md (trigger lexicon source)
- super-gsd/scripts/lib/ — existing helpers you should REUSE rather than
  reimplement (STATE frontmatter parsing, JSONL append, project-root walk-up)

## Questions to answer
Q1. Claude Code hook contract: exact `.claude/settings.json` schema for
    SessionStart / UserPromptSubmit / PostToolUse in this harness version —
    input shape on stdin, how output is injected into context, exit-code
    semantics, and whether a nonzero exit can block (must confirm report-only
    is achievable).
Q2. Which existing super-gsd hooks already register on these events? Collision
    or ordering risk? What is the current total hook latency?
Q3. STATE.md frontmatter phase resolution: what helper already exists; what
    does autopilot-watchdog do today (quote the prose regex) and what should it
    call instead?
Q4. sgsd-stop-handoff.sh latch: where is the latch set, why does a `refused`
    row not reset it, and what is the minimal correct reset condition?
Q5. Intent-classifier design: minimal deterministic approach that hits <1s
    without an LLM. Where does the lexicon live so the P149 registry swap is a
    one-line change? What does "neglected-skill signature" mean concretely and
    what data source detects it?
Q6. gate-evidence.jsonl: does it exist; what row shape do existing consumers
    (cockpit tiles / gate-value-log / review-ledger) expect; should this reuse
    an existing envelope writer?
Q7. Installer wiring: how does the SGSD installer manage `.claude/settings.json`
    today (merge vs overwrite), and what is the idempotent way to add hooks
    without touching the env block? Cite the installer path.
Q8. Dead surface inventory: is `gsd-atc-slice-gate.js` registered anywhere;
    which config knobs are provably dead (grep evidence: declared but zero
    readers).
Q9. Risks + failure modes: hook-stacking latency, non-SGSD-repo invocation,
    Windows path/shell quoting in hook commands, hook running under a
    different cwd than the repo root.

## Report format (write to the report path; be concrete, cite file:line)
1. AC-146 verbatim quotes
2. Q1–Q9 answers with evidence
3. Files to create / modify (exact paths) with a one-line purpose each
4. Reuse inventory (existing helpers to call, NOT reimplement)
5. Recommended plan-task decomposition (3–6 tasks, each independently verifiable)
6. Verification commands per task (deterministic, Windows-safe, no chmod
   reliance, no network)
7. Open questions / decisions the planner must make
Max ~1200 words. No filler.
