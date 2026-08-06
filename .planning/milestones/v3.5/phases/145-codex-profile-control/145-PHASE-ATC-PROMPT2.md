# Step 6.5 Phase-Level ATC — P145 codex-profile-control (tier: GATE)

Review the ENTIRE phase's work as one coherent unit (not individual commits).
Apply ATC 7-step (first-principles, delete, simplify, accelerate, automate,
validate, checklist) + 10-point anti-slop. Phase goal: operator-controllable
Codex CLI profile registry (executor/review/triage) + resolver + shell shim,
consumed by codex-executor.sh/codex-exec.sh with byte-identical defaults, +
/sgsd-codex-control skill with TTY+confirm-phrase danger guard. Security
invariants: fail-open never escalates; danger profile never settable
non-interactively.

## Phase stats (b3ad4b4~1..HEAD, source only)
11 files, +1737/-134:
codex-profiles.yaml +22 · profile-resolver.cjs +699 · codex-exec.sh +283(net)
codex-executor.sh +121 · codex-profile-shell.sh +167(new) ·
sgsd-codex-control.sh +213(new) · skills/sgsd-codex-control/SKILL.md +61(new)
run-self-test.cjs +198 · docs ~107

## Review history already on record
- Per-dispatch ATC #1: 2 CRITICAL found (fail-open priv-esc; TTY guard gap) → fixed pre-commit.
- Verifier: GAP-1 CRIT env-var TTY bypass → fixed (92a6096), regression-guarded.
- Per-dispatch ATC #2 (fix diff): 0 CRIT, 1 WARN (test robustness, deferred).
- Spec reviews: pass. Host self-tests: 21/21 + PASS + parity PASS + Probes 1-6 PASS.

## Your focus (phase-level, don't re-litigate per-dispatch findings)
1. Cross-file coherence: registry schema ↔ resolver ↔ shell shim ↔ two wrapper
   consumers — one source of truth or duplicated profile logic?
2. resolver grew +699 lines: is there dead/speculative surface (anti-slop 4/5/7)?
3. Guard architecture: after 3 CRIT fixes, is the security posture now
   structural (single chokepoint) or patched-in-places?
4. ΔComplexity of codex-exec.sh +283: justified by registry consumption?
5. Read the files, cite file:line for findings.

## Report contract (exact — all 5 lines mandatory)
FINDINGS: <int>
CRITICAL: <int>
WARNINGS: <int>
PASS_RATE: <n>/<m>
ONE_LINER: <summary>
FINDINGS_DETAIL: [severity] [dimension] <description>  (one per CRIT/WARN)

## BUDGET DISCIPLINE (retry dispatch — previous attempt timed out exploring)
- Hard wall-clock budget. Do NOT run any self-test suite (all already green on
  host: 21/21, control PASS, parity PASS, Probes 1-6 PASS). Do NOT re-probe
  resolver behavior (already behaviorally verified).
- Read at most these files, skimming for the 5 focus questions:
  super-gsd/tools/codex-pro/profile-resolver.cjs,
  super-gsd/registry/codex-profiles.yaml,
  super-gsd/scripts/lib/codex-profile-shell.sh,
  super-gsd/scripts/sgsd-codex-control.sh,
  and `git diff b3ad4b4~1..HEAD -- super-gsd/scripts/codex-exec.sh` (diff only).
- Write the 5 mandatory contract lines BEFORE any prose elaboration, and emit
  them even if your review is partial.
