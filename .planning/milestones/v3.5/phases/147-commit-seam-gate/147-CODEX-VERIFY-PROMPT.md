# P147 Phase Verification — Commit-Seam Gate (goal-backward)

<intent milestone="v3.5">
Always-On Orchestration — governance as runtime mechanism in all session modes.
</intent>

PHASE verifier: judge whether the PHASE GOAL is achieved in the codebase.
You MUST read the files listed (reading is required — use whatever read
command your environment provides). Do NOT run self-tests/benchmarks/node/
bash/git — the full 18-scenario suite passes on the host and sandbox git
spawn is blocked (EPERM) so re-running produces false failures. Emit the
report contract FIRST, then detail.

## AC-147 (verbatim)
(a) warn rows accumulate on real commits in both repos;
(b) --shadow-report computes the falsifier verdict mechanically;
(c) block mode cannot activate before the falsifier passes;
(d) sentinel bypass is logged.

## Board-binding constraints
Warn ships enabled; block is EARNED (≥200 real payloads across GSDedits AND
devcp, <5% false-block per repo, explicit operator activation, never silent);
`.sgsd-gate-off` logged with waived paths; real artifact naming per repo
(devcp runtime-discovered, unknown → never block); rollback never through the
gate; exit 0 in non-SGSD repos and on internal error, loudly.

## Read
- .planning/milestones/v3.5/phases/147-commit-seam-gate/147-01-PLAN-LOCKED.md
- super-gsd/scripts/lib/sgsd-artifact-conventions.cjs
- super-gsd/scripts/lib/commit-gate-shadow-log.cjs
- super-gsd/scripts/lib/commit-gate-shadow-report.cjs
- super-gsd/hooks/sgsd-commit-gate.cjs
- super-gsd/scripts/install-commit-gate.cjs
- super-gsd/docs/commit-gate.md

## Host evidence (treat as given)
18/18 scenarios incl. REAL `git commit` through the installed trampoline in
both modes (warn: succeeds + banner + shadow row; forced block: git exit ≠0,
files intact; node missing: commit succeeds, loud degradation). Falsifier
boundaries proven both directions: 199→fail, 240@4.2% unknown-conv→fail
(convention_unknown), 240@4.2% known-conv→PASS, 5.8% one repo→fail.
Activation refuses failing verdicts and creates no mode file; reporting is
read-only. 2 CRITs already found+closed in T147-01 (circular delete
containment; dot-config bypass).

## Verify goal-backward — the questions that matter
1. Each AC letter from SOURCE. AC-147a says "in both repos" — devcp has no
   rows yet (propagation is P150). Is warn-mode accumulation STRUCTURALLY
   ready for devcp (runtime discovery, no hardcoding), or does something
   still assume GSDedits? Name it.
2. Hunt the NEXT silent-success: this milestone has shipped 8 instances.
   Look hard at: the trampoline's node-discovery path; the hook's behavior
   when the shadow WRITER refuses (does the warn still print?); the
   installer's dry-run vs real divergence; report math over ledgers with
   only degraded rows.
3. Self-lock audit: enumerate every path by which the gate could block its
   own removal or the sentinel's addition. RESEARCH Q7 listed them —
   are ALL mitigated in source?
4. Cross-task seams: hook→shadow-log row contract; report→shadow-log read
   contract; installer→hook path assumptions; conventions→plan-lookup
   milestone scoping. Any mismatch?
5. Mechanically true but semantically vacuous invariants.

## Report contract (exact, FIRST, <300 words)
status: passed | human_needed | gaps_found
goal_achieved: yes | partial | no
evidence: <AC letter → file:line → verdict>
gaps: none | <list>
DEVIATIONS: none | <list>
ONE_LINER: <summary>
