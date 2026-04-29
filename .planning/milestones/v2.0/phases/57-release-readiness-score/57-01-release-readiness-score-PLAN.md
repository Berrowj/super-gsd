---
schema_version: 2
phase: 57
plan: 1
type: execute
wave: 1
model: sonnet
expected_ATC_tier: FULL
depends_on: ["56"]
autonomous: true
prior_errors_lookup: true
skip_gates: []
lessons_path: null
files_modified:
  - super-gsd/tools/release-readiness/score.cjs
  - super-gsd/tools/release-readiness/run-self-test.cjs
  - super-gsd/tools/release-readiness/fixtures/score-70-clean/README.md
  - super-gsd/tools/release-readiness/fixtures/score-69-amber/README.md
  - super-gsd/tools/release-readiness/fixtures/score-with-edge-guard-miss/crit-backlog.jsonl
  - super-gsd/scripts/sgsd-complete-milestone.cjs
requirements:
  - RELEASE-READINESS-01
  - RELEASE-READINESS-02
  - RELEASE-READINESS-03
  - RELEASE-READINESS-04
  - SEPT-GATE-V2.0-01
  - V2-0-MILESTONE-CLOSE
tags:
  - release-readiness
  - 8-bucket-score
  - edge-guard-miss-override
  - sept-gate-v2.0
  - phase-57
  - v2.0
tasks:
  - id: T1
    agent: gsd-executor
    model: sonnet
    files_touched:
      - super-gsd/tools/release-readiness/score.cjs
      - super-gsd/tools/release-readiness/run-self-test.cjs
      - super-gsd/tools/release-readiness/fixtures/score-70-clean/README.md
      - super-gsd/tools/release-readiness/fixtures/score-69-amber/README.md
      - super-gsd/tools/release-readiness/fixtures/score-with-edge-guard-miss/crit-backlog.jsonl
    input_contract: 57-CONTEXT.md + 57-RESEARCH.md + Phase 55 provider-circuit module pattern + Phase 56 scenario-suite manifest pattern (mirror; never imported)
    output_contract: score.cjs (~600-800L) with 6 Lock-13 wrapped public APIs (computeScore, getBucketScore, hasEdgeGuardMiss, getColor, selfTest, _internals) + frozen BUCKET_NAMES + frozen MAX_POINTS table + REASON_CODES + 12-15 self-test assertions covering each bucket formula, edge_guard_miss override, color thresholds GREEN/AMBER/RED, exit code mapping, missing-data degraded path, Lock 13 never-throws, ASCII-only; run-self-test.cjs thin shell; 3 fixture cases
    hypothesis: A frozen BUCKET_NAMES array of length 8 with a sibling frozen MAX_POINTS table summing to 100, plus a hard precondition on edge_guard_miss row presence in crit-backlog.jsonl, gives a deterministic 0-100 score that matches the locked specification.
    falsifier: If --self-test exits non-zero OR BUCKET_NAMES.length !== 8 OR sum of MAX_POINTS !== 100 OR a synthetic edge_guard_miss fixture does not produce color RED + score 0, the contract is broken.
    stop_rule: node super-gsd/tools/release-readiness/score.cjs --self-test exits 0 with all 12-15 assertions PASS green AND node run-self-test.cjs delegates correctly.
    verification_cmd: "node super-gsd/tools/release-readiness/score.cjs --self-test"
  - id: T2
    agent: gsd-executor
    model: sonnet
    files_touched:
      - super-gsd/scripts/sgsd-complete-milestone.cjs
    input_contract: existing sext-gate sgsd-complete-milestone.cjs from Phase 56 + score.cjs from T1
    output_contract: sgsd-complete-milestone.cjs extended with a 7th gate (release-readiness via spawnSync score.cjs --milestone v2.0) at the v2.0 milestone-close path; v1.9 dual-gate path + Phase 53 triple-gate + Phase 54 quad-gate + Phase 55 quint-gate + Phase 56 sext-gate paths preserved byte-untouched up to the release-readiness insertion point
    hypothesis: A surgical extension that runs ONLY when milestone === 'v2.0' AND the prior 6 gates already passed preserves all earlier gate invariants while adding the release-readiness as the closing 7th gate (sept-gate).
    falsifier: If running --milestone v1.9 changes any observable output vs the Phase 56 baseline OR if --milestone v2.0 fails to exit 0 when all 7 gates pass, the contract is broken.
    stop_rule: node sgsd-complete-milestone.cjs --milestone v2.0 exits 0 with sept-gate green emission AND node sgsd-complete-milestone.cjs --milestone v1.9 exits 0 with the same dual-gate green emission as before Phase 57.
    verification_cmd: "node super-gsd/scripts/sgsd-complete-milestone.cjs --milestone v2.0"
  - id: T3
    agent: gsd-executor
    model: sonnet
    files_touched:
      - .planning/milestones/v2.0/phases/57-release-readiness-score/57-RESEARCH.md
      - .planning/milestones/v2.0/phases/57-release-readiness-score/57-VERIFICATION.md
      - .planning/milestones/v2.0/phases/57-release-readiness-score/WASTE.md
      - .planning/milestones/v2.0/phases/57-release-readiness-score/commit-reviews.jsonl
      - .planning/milestones/v2.0/SUMMARY.md
      - .planning/STATE.md
    input_contract: T1+T2 implementations green; v1.9 SUMMARY.md as mirror pattern
    output_contract: full 57-* artifact set (RESEARCH, VERIFICATION, WASTE) + commit-reviews.jsonl + .planning/milestones/v2.0/SUMMARY.md (5-phase ledger 53-57; status SHIPPED) + STATE.md advanced 57->58 with phase_57 PASS row + v2_0_complete block
    hypothesis: Closing the phase with the standard 57-* artifact set AND closing the milestone with v2.0/SUMMARY.md AND advancing STATE.md to v2.1 follows the v1.9 milestone-close precedent and ships v2.0.
    falsifier: If STATE.md current_milestone is not v2.1 after T3 OR if v2.0/SUMMARY.md is missing OR if any 57-* artifact is missing, the close contract is broken.
    stop_rule: ls .planning/milestones/v2.0/phases/57-release-readiness-score/ shows {57-CONTEXT.md, 57-RESEARCH.md, 57-01-...-PLAN.md, 57-VERIFICATION.md, WASTE.md, PHASE-CAPSULE.json, commit-reviews.jsonl} AND v2.0/SUMMARY.md exists AND STATE.md current_milestone == 'v2.1' AND current_phase == 58.
    verification_cmd: "node super-gsd/tools/plan-schema/validate.cjs --plan-file .planning/milestones/v2.0/phases/57-release-readiness-score/57-01-release-readiness-score-PLAN.md --mode load"
acceptance:
  - "node super-gsd/tools/release-readiness/score.cjs --self-test exits 0 with 12-15/12-15 PASS green sub-5s"
  - "node super-gsd/tools/release-readiness/score.cjs --milestone v2.0 exits 0 with score>=70 + color GREEN"
  - "node super-gsd/tools/release-readiness/score.cjs --milestone v2.0 --planning-dir <fixture-with-edge-guard-miss> exits 1 with color RED + reason edge_guard_miss_present"
  - "node super-gsd/tools/release-readiness/run-self-test.cjs exits 0 (delegates to score.cjs --self-test)"
  - "node super-gsd/scripts/sgsd-complete-milestone.cjs --milestone v2.0 exits 0 (sept-gate green: 33+26+24+10+18+8+~21+12+score>=70)"
  - "node super-gsd/scripts/sgsd-complete-milestone.cjs --milestone v1.9 exits 0 (no regression on dual-gate)"
  - "ASCII-only across score.cjs, run-self-test.cjs, fixture seeds, and the sgsd-complete-milestone.cjs delta (first_nonascii_idx === -1)"
  - "Lock 4: git diff --quiet on Phase 41-56 trees + sgsd-cockpit-shell.cjs post-T3 (only the 4 surgical files + new release-readiness tree changed)"
threat_model:
  - file: super-gsd/tools/release-readiness/score.cjs
    surface: jsonl reader on canonical streams + module-presence probes
    threats:
      - JSONL line poisoning -> mitigated by per-line try/catch JSON.parse + skip-on-error counted as zero-pass
      - require() of broken module side-effect -> mitigated by try/catch around every probe; missing module -> degraded score 0
      - non-ASCII smuggling in reason codes -> mitigated by ASCII-only assertion in self-test
  - file: super-gsd/tools/release-readiness/fixtures/score-with-edge-guard-miss/crit-backlog.jsonl
    surface: synthetic JSONL fixture
    threats:
      - real edge_guard_miss leaking into canonical stream -> mitigated by fixture-only directory under release-readiness/fixtures/; never written to .planning/metrics/
  - file: super-gsd/scripts/sgsd-complete-milestone.cjs
    surface: milestone-close gate dispatch
    threats:
      - gate skipped when score.cjs require fails -> mitigated by Lock 13 wrap that emits milestone_close_blocked:release_readiness_unavailable + exit 1
      - score below threshold escapes -> mitigated by spawnSync exit-code propagation; non-zero -> milestone_close_blocked:release_score_below_threshold + exit 1
      - regression on v1.9 path -> mitigated by surgical-extension-only contract; insertion is gated on milestone==='v2.0' upstream
