# Step 9.4 Spec-Compliance Review — P146 T146-01 (shared helpers)

SDD spec reviewer. Judge ONLY plan conformance: missing requirements, extra
scope, and whether verification evidence maps to the task contract. Style and
quality are ATC's job (next stage). Do NOT trust the executor's summary —
judge the raw files. Do NOT run commands. Do NOT explore beyond the files
named here. Emit the contract lines FIRST.

## The task spec (T146-01, from the locked plan)
files_touched (the ONLY permitted surface):
  .planning/STATE.md, super-gsd/scripts/lib/sgsd-state.cjs,
  super-gsd/scripts/lib/gate-evidence-log.cjs,
  .planning/metrics/gate-evidence.jsonl

output_contract: Add shared SGSD root, STATE frontmatter, active phase,
PLAN-LOCKED glob, and gate-evidence envelope writer helpers. Add
current_phase: "146" to .planning/STATE.md if absent. T146-01 OWNS creation of
both libs and the evidence stream; later tasks consume helpers and append
envelope-v1 rows only.

input_contract: Canonical STATE frontmatter phase key is current_phase. Keep
legacy `phase` as READ-ONLY compatibility. Do NOT parse prose status.

falsifier (task fails if ANY holds): any caller parses prose status for a
phase; throws in a non-SGSD repo; writes malformed JSONL; or cannot
distinguish missing phase frontmatter from a real phase.

Required exports (plan verification depends on these):
  sgsd-state.cjs: findSgsdRoot(startDir) → root|null never throws;
    readState(root) → {milestone, phase, phaseSource}|null with phaseSource in
    {current_phase, legacy_phase, status_prose, absent} and NEVER returning
    status_prose; a PLAN-LOCKED glob helper handling BOTH .planning/phases/
    and .planning/milestones/*/phases/ layouts.
  gate-evidence-log.cjs: never-throw envelope-v1 append writer mirroring
    super-gsd/scripts/lib/gate-value-log.cjs conventions.

Board-binding: no ~/.claude/settings.json reads; no hardcoded machine paths;
Windows-safe; zero new runtime deps (Node built-ins only); never throw upward.

## Files to read (complete list)
- super-gsd/scripts/lib/sgsd-state.cjs (new, 188 lines)
- super-gsd/scripts/lib/gate-evidence-log.cjs (new, 194 lines)
- super-gsd/scripts/lib/gate-value-log.cjs (the convention being mirrored)
- git diff of .planning/STATE.md is exactly one added line: current_phase: "146"

## Orchestrator host verification (already run — do not re-run)
node --check both files → exit 0.
Resolver on real repo → milestone=v3.5, phase=146, phaseSource=current_phase.
findSgsdRoot(os tmpdir) → null, no throw.
logGateEvidence to temp planningDir → envelope-v1 row, parses as JSON.
logGateEvidence(null,null) → logs a warning, returns without throwing.

## Interrogate specifically
1. Does any code path parse the prose `status:` line for a phase number?
2. Can readState distinguish "no phase frontmatter" from a real phase, per the
   falsifier? Which phaseSource value does each case yield?
3. Is `status_prose` genuinely unreachable as a return value?
4. Does the PLAN-LOCKED helper handle BOTH directory layouts?
5. Any file touched outside the permitted surface? Any extra/unrequested scope
   (speculative exports, unused options, features no later task consumes)?
6. Any new runtime dependency, home-settings read, or hardcoded machine path?

## Report contract (exact)
SPEC_VERDICT: pass|fix_required|blocked
MISSING_REQUIREMENTS: none|<list>
EXTRA_SCOPE: none|<list>
VERIFICATION_MAPPING: <evidence → contract clause>
ONE_LINER: <summary>
