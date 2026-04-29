---
schema_version: 2
phase: 55
plan: 1
type: execute
wave: 1
model: sonnet
expected_ATC_tier: FULL
depends_on: ["54"]
autonomous: true
prior_errors_lookup: true
skip_gates: []
lessons_path: null
files_modified:
  - super-gsd/scripts/lib/provider-circuit.cjs
  - super-gsd/scripts/codex-exec.sh
  - super-gsd/scripts/sgsd-complete-milestone.cjs
  - .planning/metrics/provider-circuit.json
requirements:
  - PROVIDER-CIRCUIT-01
  - PROVIDER-CIRCUIT-02
  - PROVIDER-CIRCUIT-03
  - PROVIDER-CIRCUIT-04
  - QUINT-GATE-V2.0-01
tags:
  - provider-circuit
  - timeout-tier-hardening
  - circuit-breaker
  - quint-gate-v2.0
  - codex-exec-extension
  - phase-55
  - v2.0
tasks:
  - id: T1
    agent: gsd-executor
    model: sonnet
    files_touched:
      - super-gsd/scripts/lib/provider-circuit.cjs
      - .planning/metrics/provider-circuit.json
    input_contract: 55-CONTEXT.md + 55-RESEARCH.md + Phase 51-54 surface convention reference (NOT imported - mirrored)
    output_contract: provider-circuit.cjs with 6 Lock-13 wrapped public APIs (getCircuitState, recordProviderResult, shouldFallback, resetCircuit, getDefaultFallback, selfTest) + closed-vocab DEFAULT_FALLBACK + initial empty state file
    hypothesis: A 6-API surface with byte-equality milestone+provider matching, atomic tmp+rename writes, and a tmp-state-file env override for the bootstrap suite gives mechanical fail-closed coverage of the threshold + reset + persistence + Lock-13 invariants.
    falsifier: If recording 3 consecutive failures fails to flip fallback_active OR a single success fails to close the circuit OR atomic writes leave a stale .tmp on disk OR any public API throws on bad input, the contract is broken.
    stop_rule: node super-gsd/scripts/lib/provider-circuit.cjs --self-test exits 0 with all assertions green.
    verification_cmd: "node super-gsd/scripts/lib/provider-circuit.cjs --self-test"
  - id: T2
    agent: gsd-executor
    model: sonnet
    files_touched:
      - super-gsd/scripts/codex-exec.sh
    input_contract: provider-circuit.cjs from T1 + existing codex-exec.sh shape (Phase 14-54 byte-equivalent)
    output_contract: codex-exec.sh extended with --milestone flag, pre-invocation shouldFallback probe (exit 7 on open circuit), and recordProviderResult calls at all 5 exit paths (success / timeout / auth-deny / generic-error / contract-violation)
    hypothesis: A surgical extension that is no-op when --milestone is unset OR =none preserves the Phase 14-54 invocation path byte-equivalent for callers that have not opted in, while enabling the circuit-breaker semantics for callers that pass --milestone v2.0.
    falsifier: If passing --milestone v2.0 against an open-circuit fixture does NOT exit 7, OR if passing --milestone none changes any observable codex-log.jsonl row vs the pre-Phase-55 baseline, the contract is broken.
    stop_rule: bash -n codex-exec.sh exits 0 AND end-to-end fixture (open-circuit state file + --milestone v2.0) exits 7 AND --milestone none baseline path runs codex normally.
    verification_cmd: "bash -n super-gsd/scripts/codex-exec.sh"
  - id: T3
    agent: gsd-executor
    model: sonnet
    files_touched:
      - super-gsd/scripts/sgsd-complete-milestone.cjs
    input_contract: existing quad-gate sgsd-complete-milestone.cjs from Phase 54 + provider-circuit.cjs from T1
    output_contract: sgsd-complete-milestone.cjs extended with a 5th gate (provider-circuit self-test via spawnSync) at the v2.0 milestone-close path; v1.9 dual-gate path preserved byte-untouched up to the provider-circuit insertion point
    hypothesis: A surgical extension that runs ONLY when milestone === 'v2.0' AND the prior 4 gates already passed preserves the v1.9 dual-gate AND Phase 53 triple-gate AND Phase 54 quad-gate invariants.
    falsifier: If running --milestone v1.9 changes any observable output vs the Phase 54 baseline, OR if --milestone v2.0 fails to exit 0 when all 5 self-tests pass, the contract is broken.
    stop_rule: node sgsd-complete-milestone.cjs --milestone v2.0 exits 0 with quint-gate green emission AND node sgsd-complete-milestone.cjs --milestone v1.9 exits 0 with the same dual-gate green emission as before Phase 55.
    verification_cmd: "node super-gsd/scripts/sgsd-complete-milestone.cjs --milestone v2.0"
  - id: T4
    agent: gsd-executor
    model: sonnet
    files_touched:
      - .planning/milestones/v2.0/phases/55-provider-backpressure-timeout-circuits/55-RESEARCH.md
      - .planning/milestones/v2.0/phases/55-provider-backpressure-timeout-circuits/55-VERIFICATION.md
      - .planning/milestones/v2.0/phases/55-provider-backpressure-timeout-circuits/WASTE.md
      - .planning/milestones/v2.0/phases/55-provider-backpressure-timeout-circuits/commit-reviews.jsonl
      - .planning/STATE.md
    input_contract: T1+T2+T3 implementations green
    output_contract: full 55-* artifact set (RESEARCH, VERIFICATION, WASTE) + commit-reviews.jsonl + STATE.md advanced 55->56 with phase_55 PASS row
    hypothesis: Closing the phase with the standard 55-* artifact set + STATE advance follows the Phase 41-54 precedent and emits the muda audit + verification artifacts the next phase / milestone close depends on.
    falsifier: If STATE.md current_phase is not 56 after T4 OR if any 55-* artifact is missing, the phase-close contract is broken.
    stop_rule: ls .planning/milestones/v2.0/phases/55-provider-backpressure-timeout-circuits/ shows {55-CONTEXT.md, 55-RESEARCH.md, 55-01-provider-backpressure-timeout-circuits-PLAN.md, 55-VERIFICATION.md, WASTE.md, PHASE-CAPSULE.json, commit-reviews.jsonl} AND STATE.md current_phase == 56.
    verification_cmd: "node super-gsd/tools/plan-schema/validate.cjs --mode load .planning/milestones/v2.0/phases/55-provider-backpressure-timeout-circuits/55-01-provider-backpressure-timeout-circuits-PLAN.md"
acceptance:
  - "node super-gsd/scripts/lib/provider-circuit.cjs --self-test exits 0 with N/N PASS green"
  - "node super-gsd/scripts/sgsd-complete-milestone.cjs --milestone v2.0 exits 0 (quint-gate green: 33+26+24+10+18+12)"
  - "node super-gsd/scripts/sgsd-complete-milestone.cjs --milestone v1.9 exits 0 (no regression on dual-gate)"
  - "bash -n super-gsd/scripts/codex-exec.sh exits 0 (no syntax error)"
  - "End-to-end fixture: open-circuit state file + bash codex-exec.sh --milestone v2.0 exits 7"
  - "End-to-end fixture: --milestone none + bash codex-exec.sh runs codex normally (exit 0 with fake codex)"
  - "ASCII-only across provider-circuit.cjs and the new codex-exec.sh helpers"
  - "Lock 4: git diff --quiet on Phase 41-53 trees AND chaos-restart tree (Phase 54) post-T4 (only the 3 surgical files changed)"
threat_model:
  - file: super-gsd/scripts/lib/provider-circuit.cjs
    surface: state-file IO
    threats:
      - corrupted JSON state file -> mitigated by parse + shape validation in _readStateRaw -> empty-state sentinel
      - concurrent writes -> mitigated by tmp+rename atomic pattern
      - schema drift -> mitigated by SCHEMA_VERSION constant + write-time bump
  - file: super-gsd/scripts/codex-exec.sh
    surface: pre-invocation probe
    threats:
      - node missing or lib missing -> mitigated by Lock 13 fallback to "no fallback" (never block codex)
      - milestone string injection -> mitigated by byte-equality + ASCII-only validation in provider-circuit.cjs._validInputs
