# P147 Planning — author 147-01-PLAN-LOCKED.md (schema-v2)

<intent milestone="v3.5">
Always-On Orchestration — governance as runtime mechanism in all session modes.
</intent>

Author ONE plan file. Write it to
`.planning/milestones/v3.5/phases/147-commit-seam-gate/147-01-PLAN-LOCKED.md`.
If the sandbox cannot write files, emit the COMPLETE file inside ONE fenced
```markdown block and say so. Output the plan ONLY — no commentary.
Do NOT re-derive the research. Do NOT run self-tests.

## Required reading
1. `.planning/milestones/v3.5/phases/147-commit-seam-gate/CONTEXT.md`
2. `.../147-RESEARCH.md` — Q1-Q9 answers are authoritative findings
3. `.../147-VTP-ENRICHMENT.md` — its 4 planner directives are BINDING
4. `super-gsd/templates/plan-schema-v2.json` — the plan MUST validate
5. `.planning/milestones/v3.5/phases/146-session-governance-hooks/146-01-PLAN-LOCKED.md`
   — SHAPE reference only (frontmatter keys, task structure)

## Source Audit (mandatory section)
One row per source: CONTEXT, RESEARCH, VTP-ENRICHMENT (status success, 2
relevant hits), plan-schema-v2, P146 plan. VTP is present — cite it.

## Hard requirements
**Schema:** YAML frontmatter validating against plan-schema-v2.json, INCLUDING
`semantic_acceptance_criteria` with REAL-DATA criteria and `rollback_plan`.
Every task needs id, type, hypothesis, falsifier, stop_rule, files_touched,
traces_to, depends_on, verification_cmd, expected_ATC_tier.

**⚠️ ANTI-STUB (the P146 plan-check REJECTED a first draft for this):**
No acceptance criterion may be satisfiable by a stub. Banned: asserting a
`--self-test` flag exits 0; asserting hardcoded output text. Required instead:
drive the REAL entrypoint against a CONSTRUCTED TEMP GIT REPO, and assert
values only a real read could produce. Pair every positive with a NEGATIVE
control. For this phase specifically: create a real temp git repo, stage real
files, run the real hook, and assert on the real shadow row's field values.

**Board-binding constraints (violating any = plan defect):**
- warn mode ships enabled; block mode CANNOT activate until the falsifier
  (≥200 real payloads across GSDedits AND devcp, false-block rate <5% per repo
  against each repo's ACTUAL naming) is met, and activation is an explicit
  operator step — never silent;
- `.sgsd-gate-off` sentinel skips block AND logs that it did;
- artifact predicates match REAL naming (`{NN}-*-PLAN-LOCKED.md` and
  `*-ATC-REVIEW*.md` here per RESEARCH Q4 — bare `PLAN.md`/`AUDIT.md` is known
  FALSE); devcp's convention is DISCOVERED at runtime, never hardcoded, and a
  repo whose convention is unknown must warn/skip and never block;
- rollback must NOT pass through the gate itself; uninstall = remove the hook
  file, documented;
- exit 0 in non-SGSD repos and on internal error — fail open, LOUDLY.

**VTP directives (binding):** per-PATH evidence in shadow rows (not just a
per-commit verdict) so the false-block rate is defensible; promotion stays
mechanical; the sentinel logs WHICH paths it waived; the phase must describe
the gate as ONE layer (RESEARCH Q9: `--no-verify` and some GUI clients bypass
hooks) and must not claim coverage it lacks.

**Carry P146's two recurring defect classes (11 CRITICALs) into the plan:**
- every writer obtains its destination via `resolveContainedPath` in
  `super-gsd/scripts/lib/sgsd-state.cjs` — never a caller-supplied path;
- degradation is observable: distinct reason codes + rows, never a bare stderr
  warn, never "clean because it did nothing".
Reuse `readState` (frontmatter only), `findPlanLockedFiles` (milestone-scoped),
and the envelope-v1 writer conventions. Do NOT reimplement them.

**RESEARCH findings the plan must honour:**
- this checkout is a LINKED WORKTREE: `git rev-parse --git-path hooks/pre-commit`
  resolves to the COMMON dir, so an installed hook is shared across worktrees.
  Say how the plan handles that (ask git for the path; honour existing
  `core.hooksPath`; never silently set it);
- Windows: install a POSIX `#!/bin/sh` trampoline invoking node; do not execute
  `.cjs` directly;
- existing-hook policy: create if absent, refresh an SGSD-marked block if
  present, refuse-or-backup an unmarked hook (decide and state which);
- staged evidence via `git diff --cached --name-status -z --find-renames`;
  binaries hashed, not embedded.

**Decide explicitly (RESEARCH §7):** the source-touching predicate and its
false-positive risks; whether DEFERRED-F (Bash-redirect mutations) is closed by
this seam for staged commits — RESEARCH says mostly yes, unstaged no; and
whether DEFERRED-G (SessionStart contract trim) belongs in this phase —
RESEARCH recommends keeping it separate and low-risk.

## Task decomposition
Follow RESEARCH §5 (4-7 tasks) unless you have concrete reason to differ.
Each task independently verifiable with a deterministic, Windows-safe,
network-free verification command. Give an explicit `depends_on` chain
producing ONE serial order (Codex executors are serial with exclusive workspace
writes), and name the OWNING task for every shared file.

Record as carried-forward, do NOT solve: DEFERRED-F, DEFERRED-G, DEVIATION-W.

Output: the plan file only.
