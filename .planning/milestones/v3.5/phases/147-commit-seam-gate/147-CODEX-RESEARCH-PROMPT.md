# P147 Research — Commit-Seam Gate (warn → earned block)

<intent milestone="v3.5">
Always-On Orchestration — governance as runtime mechanism in all session modes.
</intent>

Read-only phase researcher. Produce an implementation-ready report. Do NOT
write code or modify files. BUDGET: you MUST read files (reading is required —
use whatever read command your environment provides), but do NOT run
self-tests, benchmarks, or long探 exploration beyond the list below.

## Phase goal (CONTEXT.md)
The eventual BLOCKING control lives at the commit seam:
`super-gsd/hooks/sgsd-commit-gate.cjs` as an installer-managed git pre-commit
hook. One invocation per commit, full `git diff --cached` evidence, failure
mode "commit refused, files intact" — never "cannot touch source".
- **Warn mode (ships enabled):** a source-touching commit lacking phase evidence
  (PLAN-LOCKED + ATC/AUDIT artifacts for the active phase) emits a loud
  governance warning + a shadow row in
  `.planning/metrics/commit-gate-shadow.jsonl`.
- **Block mode (earned only):** activates ONLY when `--shadow-report` shows the
  board falsifier met: ≥200 real payloads across GSDedits AND devcp, with a
  false-block rate <5% against each repo's ACTUAL artifact naming. Activation
  is an explicit operator step informed by the report — never silent.
- **Sentinel:** `.sgsd-gate-off` skips block and LOGS that it did.

## Board-binding constraints
- Artifact predicates must match REAL naming per repo (`{NN}-*-PLAN-LOCKED.md`
  here; devcp's own convention must be DISCOVERED, not assumed — the original
  plan's `PLAN.md`/`AUDIT.md` predicate was false-positive on day one).
- The rollback path must NOT pass through the gate itself (self-locking
  rollback is the failure the board called out). Uninstall = remove the hook
  file; must be documented.
- Exit 0 in non-SGSD repos and on internal error — fail open, LOUDLY.

## Carry-forward from P146 (this is the same surface — do not re-solve badly)
P146 shipped 11 CRITICALs in two classes that WILL recur here:
1. **Writer accepts a caller-supplied destination** (5 instances). P146 ended
   with ONE contract: `resolveContainedPath(root, subpath)` in
   `super-gsd/scripts/lib/sgsd-state.cjs` (realpath + symlink/junction refusal,
   returns null, never throws). The shadow-ledger writer MUST use it.
2. **Silent success** (7 instances). Degradation must be observable: distinct
   reason codes + evidence rows, never a bare stderr warn, never "looks clean
   because it did nothing".
Also relevant: `readGateEvidenceRows` tail-reads with a `limit`;
`gate-evidence-log.cjs` is the envelope-v1 writer; `sgsd-state.cjs` exposes
`findSgsdRoot`, `readState` (frontmatter only, never prose), and
`findPlanLockedFiles` (milestone-scoped).

## Deferred items this phase should consider absorbing
- **DEFERRED-F:** source can be mutated via `Bash` redirection, invisible to
  P146's PostToolUse hook. A commit-seam gate sees `git diff --cached`
  regardless of HOW the file changed — does that close the coverage gap?
- **DEFERRED-G:** P146's SessionStart contract is injected into EVERY session's
  first turn; the phase ATC recommended trimming it and moving the tier/gate
  tables to a referenced artifact. Is P147 the right home for that trim?

## Read these
- .planning/milestones/v3.5/phases/147-commit-seam-gate/CONTEXT.md
- .planning/analyses/2026-08-05-always-on-orchestration-DESIGN.md (the #p147
  section AND AC-147 (a)(b)(c)(d) — quote them VERBATIM)
- .planning/milestones/v3.5/INTENT.md
- super-gsd/scripts/lib/sgsd-state.cjs and gate-evidence-log.cjs (reuse surface)
- super-gsd/hooks/sgsd-quality-gate.js (the P146 analogue — evidence + degradation shape)
- super-gsd/scripts/merge-settings.js + super-gsd/install.sh (how P146 installs
  repo-local hooks; git hooks are a DIFFERENT mechanism — say how)
- .planning/milestones/v3.5/phases/146-session-governance-hooks/146-ATC-GAP-PLAN.md

## Questions
Q1. Git pre-commit hook mechanics: install location (`.git/hooks/pre-commit`
    vs `core.hooksPath`), interaction with worktrees (this repo IS a worktree —
    does `.git` resolve to a file?), Windows shebang/execution reality, and how
    an installer manages it idempotently without clobbering an existing hook.
Q2. `git diff --cached` in a pre-commit hook: exact invocation for reliable
    staged-only paths, handling renames/deletes/binary, and cost on a large diff.
Q3. What counts as "source-touching"? Propose a concrete predicate and name its
    false-positive risks (planning-only commits, docs, config, .planning itself).
Q4. Artifact predicate for THIS repo: exact naming and locations for
    PLAN-LOCKED and ATC/AUDIT artifacts per active phase, using the P146
    milestone-scoped helper. Cite real paths.
Q5. devcp's actual convention: is devcp reachable from here? If not, what is
    the safe design so its predicate is DISCOVERED at runtime rather than
    hardcoded? What does the gate do in a repo whose convention it cannot
    determine (must be warn/skip, never block)?
Q6. Shadow-report format: what must `--shadow-report` compute to evidence the
    ≥200-payload / <5%-false-block falsifier, and where does it read from?
Q7. Rollback safety: enumerate every way the gate could self-lock (e.g.
    blocking the commit that removes the gate) and the mitigations.
Q8. Non-SGSD + error behavior: how does a git hook fail open LOUDLY without
    breaking commits, and what should it write where?
Q9. Risks: commit latency budget, hooks disabled by `--no-verify`, IDE/GUI
    clients that bypass hooks, and what that implies about relying on this seam.

## Report format (concrete, cite file:line)
1. AC-147 verbatim
2. Q1–Q9 answers with evidence
3. Files to create/modify (exact paths) + one-line purpose each
4. Reuse inventory (P146 helpers to call, NOT reimplement)
5. Recommended task decomposition (4–7 tasks, each independently verifiable)
6. Per-task verification commands (deterministic, Windows-safe, no network)
7. Open decisions the planner must make
Max ~1200 words.
