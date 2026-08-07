# P146 Phase Verification — Session Governance Hooks (goal-backward)

<intent milestone="v3.5">
Always-On Orchestration — governance as runtime mechanism in all session modes.
</intent>

You are the PHASE verifier. Judge whether the PHASE GOAL is achieved in the
codebase — not whether tasks were ticked off. Read raw evidence.

BUDGET (hard): you MUST read the files listed below (reading is required — use
whatever read command your environment provides). Do NOT run self-tests,
benchmarks, or node/bash execution — all suites already pass on the host and
re-running them inside the sandbox produces false failures (proven: the sandbox
reports adapter A7/A10 failures that do NOT reproduce on the host, and Git Bash
dies with CreateFileMapping). Emit the report contract FIRST, then detail.

## Phase goal (CONTEXT.md)
Governance fires in EVERY session type via repo-local `.claude/settings.json`
hooks (installer-managed, never machine-global): SessionStart contract
injection, UserPromptSubmit intent classifier, report-only PostToolUse quality
gate — plus the 2026-08-02 board's unbundled cheap fixes.

## AC-146 (verbatim)
(a) an `sg`-launched manual session shows the governance contract in its first
    response with zero operator action;
(b) a planning-shaped prompt in a manual session produces a visible
    `/sgsd-triage` directive;
(c) a source edit with no PLAN for the active phase produces a gate-evidence
    row and a cockpit signal within one refresh;
(d) all hooks exit 0 in a non-SGSD repo.

## Board-binding constraints (violating any = phase defect)
No edit-seam blocking; report-only. Narrow try/catch everywhere; unexpected
error → exit 0 + logged failure row. No hook reads `~/.claude/settings.json`.
Paths resolved at install time from the target repo; no hardcoded machine
paths. Classifier <1s p95, no LLM.

## Read these
- .planning/milestones/v3.5/phases/146-session-governance-hooks/146-01-PLAN-LOCKED.md
  (frontmatter: semantic_acceptance_criteria + the 7 tasks)
- super-gsd/hooks/sgsd-session-start.js
- super-gsd/hooks/sgsd-intent-classifier.cjs
- super-gsd/hooks/sgsd-quality-gate.js
- super-gsd/scripts/lib/sgsd-state.cjs
- super-gsd/scripts/lib/gate-evidence-log.cjs
- super-gsd/scripts/merge-settings.js (repo-local install path only)
- super-gsd/registry/session-governance-hooks.yaml
- super-gsd/tools/cockpit-state/adapter.cjs (governance section only)
- .claude/settings.json (hook entries only — DO NOT read or echo any env block anywhere)

## Host evidence already gathered (treat as given)
LIVE against this repo just now: SessionStart emits the contract containing
v3.5 and 146; a planning prompt emits `/sgsd-triage` while "fix the typo in
line 12" stays silent; the quality gate exits 0 and never blocks.
Per-task host suites: T146-01 11/11, T146-02 9/9, T146-03 31/31, T146-04
corpus 13/13 recall + 11/11 precision (p95 0.02ms, 10k-char prompt 102ms),
T146-05 27/27, T146-06 16/16, T146-07 10/10 + behavioral depth check.
Repo-local install re-run: 3 entries, home settings md5 unchanged.
Anti-stub proof: a fixture repo declaring milestone v9.9 / phase 873 produced a
contract containing v9.9 and 873 and containing NEITHER v3.5 NOR 146.
Chain-depth fix proven behaviorally: 6 consecutive unexpected-stop recoveries
went from [1,1,1,1,1,1] to [1,2,3,4,5,6].

## Verify goal-backward — the questions that matter
1. Does each AC-146 letter hold from the SOURCE, or only from the test fixtures?
   Name any AC that is satisfied by the harness rather than by the code.
2. Is governance genuinely ALWAYS-ON, or are there realistic session shapes
   where it silently does nothing? This phase shipped FOUR "silent success"
   CRITICALs (suppressed contract; registry resolved from the wrong root; blind
   ledger rendered as healthy; uncounted spawn rows bypassing MAX_CHAIN_DEPTH).
   Look for a fifth.
3. AC-146c end-to-end: producer → ledger → adapter → MCP. Any seam where a row
   is produced but never surfaced, or surfaced but stale/false?
4. Cross-task integration gaps: shared registry (T146-04 owns, T146-05 appends),
   shared ledger (T146-01 owns, T146-05 writes, T146-06 reads), shared state
   resolver (T146-01 owns, used by hooks + watchdog). Any contract mismatch?
5. Invariants that are mechanically true but semantically vacuous.
6. Anything in the plan's semantic_acceptance_criteria that the implementation
   satisfies in letter but not in intent.

## Report contract (exact, FIRST, <300 words)
status: passed | human_needed | gaps_found
goal_achieved: yes | partial | no
evidence: <bullets: AC letter → file:line or artifact → verdict>
gaps: none | <list>
DEVIATIONS: none | <list>
ONE_LINER: <summary>
