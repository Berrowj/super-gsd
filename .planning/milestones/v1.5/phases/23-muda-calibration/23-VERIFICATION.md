---
phase: 23-muda-calibration
verified: 2026-04-25T00:00:00Z
status: passed
score: 4/4 must-haves verified
overrides_applied: 0
gaps: []
human_verification: []
---

# Phase 23: MUDA Calibration Verification Report

**Phase Goal:** Calibrate MUDA aggregation across 5 probes, fix mirror-path bug, fix summary text accuracy, recalibrate inventory threshold.
**Verified:** 2026-04-25
**Status:** PASSED

## Goal Achievement

### Observable Truths

| #  | Truth                                                                                  | Status     | Evidence                                                                                                                                              |
|----|----------------------------------------------------------------------------------------|------------|-------------------------------------------------------------------------------------------------------------------------------------------------------|
| 1  | MUDAC-01: 5-probe aggregation iterates all 5 verdicts                                  | VERIFIED   | `sgsd-muda-probe.sh:210` — `for v in "$haiku_verdict" "$narr_verdict" "$git_verdict" "$extra_processing_verdict" "$inventory_verdict"`                |
| 2  | MUDAC-01: warn_count / fail_count derived from awk over PROBE_ROWS, not hardcoded 3-set| VERIFIED   | `sgsd-muda-audit.sh:223-224` — awk over PROBE_ROWS yields true counts across all probes                                                                |
| 3  | MUDAC-02: Config-driven threshold via `.planning/config.json.muda.inventory_thresholds`| VERIFIED   | `sgsd-muda-probe.sh:208-225` — Node-eval reads config, falls back to defaults, sanitises numeric values                                                |
| 4  | MUDAC-02: Threshold scales linearly with milestone count                                | VERIFIED   | `sgsd-muda-probe.sh:227-237` — milestone_count counted via `find -maxdepth 1 -mindepth 1 -type d`, divide-by-zero guarded, thresholds = base × count    |
| 5  | MUDAC-02: Threshold string in JSON output reflects calibration                         | VERIFIED   | Phase 22 WASTE.md regenerated 2026-04-25 shows `warn>10 fail>25 calibrated_per_milestone` (5 active milestones × base 2/5)                              |
| 6  | MUDAC-02: 1-stale-artifact case re-classifies WARN→PASS                                | VERIFIED   | Phase 22 audit re-run: inventory `value=1, verdict=PASS` (was WARN with old `warn>0` threshold)                                                       |
| 7  | MUDAC-03: extra_processing probe scans both flat + milestone-nested paths              | VERIFIED   | `sgsd-muda-probe.sh:153-154` — finds in BOTH `$ROOT/.planning/phases` AND `$ROOT/.planning/milestones/*/phases/*/commit-reviews.jsonl`                  |
| 8  | MUDAC-04: Aggregate summary text reflects actual probe verdicts                         | VERIFIED   | `sgsd-muda-audit.sh:244-249` — 3-branch summary: `fail==0 && warn==0` (PASS) / `fail>0` (FAIL+WARN counts) / `warn-only` (WARN count)                  |

**Score:** 4/4 MUDAC requirements verified (8/8 supporting truths verified)

### Required Artifacts

| Artifact                                       | Expected                                     | Status     |
|------------------------------------------------|----------------------------------------------|------------|
| `super-gsd/scripts/sgsd-muda-probe.sh`         | 5-probe + config-driven thresholds + nested search paths | VERIFIED   |
| `super-gsd/scripts/sgsd-muda-audit.sh`         | Aggregation loop + 3-branch summary text     | VERIFIED   |
| `.planning/config.json`                        | `muda.inventory_thresholds` block present    | VERIFIED   |

### Syntax / Runtime Checks

| Check                                                       | Result   | Status  |
|-------------------------------------------------------------|----------|---------|
| `bash -n sgsd-muda-probe.sh`                                | exit 0   | PASS    |
| `bash -n sgsd-muda-audit.sh`                                | exit 0   | PASS    |
| `bash sgsd-muda-probe.sh \| jq '.probes.inventory.threshold'` | "warn>10 fail>25 calibrated_per_milestone" | PASS    |
| `bash sgsd-muda-audit.sh 22` (re-run)                        | warn_count: 0, fail_count: 0 | PASS    |
| Node config-malformed test (empty config block)              | falls back to base 2/5 defaults | PASS    |
| Empty milestones dir test (divide-by-zero guard)             | thresholds clamp to base × 1 | PASS    |

## Provenance

| REQ      | Delivered Via | Commit    | Notes                                                       |
|----------|---------------|-----------|-------------------------------------------------------------|
| MUDAC-01 | b2773a8 (Codex MUDA work, v1.4) | b2773a8 | 3→5 probe aggregation pre-shipped before Phase 23 dispatch |
| MUDAC-02 | Plan 23-01    | 396369d   | Config-driven, milestone-count-scaled thresholds            |
| MUDAC-03 | b2773a8 (Codex MUDA work, v1.4) | b2773a8 | Flat-path mirror-fix pre-shipped before Phase 23 dispatch  |
| MUDAC-04 | b2773a8 (Codex MUDA work, v1.4) | b2773a8 | 3-branch summary pre-shipped before Phase 23 dispatch      |

## Conclusion

Phase 23 PASSES with 4/4 MUDAC requirements delivered. Three were pre-shipped via Codex MUDA work in v1.4 (commit `b2773a8`); MUDAC-02 was the only Phase 23 implementation work.
