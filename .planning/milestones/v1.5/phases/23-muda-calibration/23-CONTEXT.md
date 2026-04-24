---
phase: 23
phase_name: MUDA Calibration
milestone: v1.5
status: discussed
date: 2026-04-25
discussed_via: fast-track (3/4 REQs pre-shipped via b2773a8)
---

# Phase 23 — MUDA Calibration

## Goal

Close the 4 MUDAC requirements: MUDAC-01..04. Three (MUDAC-01, MUDAC-03, MUDAC-04) are conceptually pre-shipped via commit `b2773a8` (Codex MUDA work during 5.5 pinning session). MUDAC-02 (config-driven inventory thresholds scaling with milestone count) is the only outstanding implementation.

## Pre-shipped REQs (confirmed by inspection)

### MUDAC-01 — 5-probe aggregation completeness ✓ pre-shipped
- Evidence: `super-gsd/scripts/sgsd-muda-probe.sh:210` — `for v in "$haiku_verdict" "$narr_verdict" "$git_verdict" "$extra_processing_verdict" "$inventory_verdict"` iterates all 5 verdicts.
- Evidence: `super-gsd/scripts/sgsd-muda-audit.sh:223-224` — `warn_count`/`fail_count` derived from awk over PROBE_ROWS.
- Verdict aggregation reflects all 5 probes, no longer just 3.

### MUDAC-03 — `sgsd-muda-probe.sh` flat-path mirror-fix ✓ pre-shipped
- Evidence: `super-gsd/scripts/sgsd-muda-probe.sh:153-154` — `extra_processing` probe scans BOTH `.planning/phases/` (flat) AND `.planning/milestones/*/phases/*/commit-reviews.jsonl` (nested).
- Pattern matches Phase 17 audit-script fix `1cef1b4`.

### MUDAC-04 — Summary text accuracy ✓ pre-shipped
- Evidence: `super-gsd/scripts/sgsd-muda-audit.sh:244-249` — 3-branch summary (`fail==0 && warn==0` / `fail>0` / `warn-only`) reflects actual aggregate verdict, no longer hardcoded "All active probes PASS".

## Outstanding REQ

### MUDAC-02 — Inventory probe threshold recalibration ❌ TODO

**Current state:**
- `super-gsd/scripts/sgsd-muda-probe.sh:223` — threshold hardcoded as `"warn>0 fail>5 calibrated"`. Inventory probe verdict logic lives in lines 196-205 with hardcoded `>0` / `>5` comparisons.
- `super-gsd/scripts/sgsd-muda-audit.sh:191` — also references hardcoded `"warn>0 fail>5 calibrated"`.
- Phase 22 inventory probe fired WARN at value=1 (the `scratch-findings.md` artifact). This is the threshold problem MUDAC-02 wants to solve: noise at low N for clean projects.

**Required:**
- `.planning/config.json` add `muda.inventory_thresholds` block:
  ```json
  {
    "muda": {
      "inventory_thresholds": {
        "warn_per_milestone": 2,
        "fail_per_milestone": 5
      }
    }
  }
  ```
- `sgsd-muda-probe.sh` reads config, counts active milestones (`ls .planning/milestones/`), computes `warn_threshold = warn_per_milestone * milestone_count`, `fail_threshold = fail_per_milestone * milestone_count`. Falls back to current hardcoded `0/5` if config absent.
- Threshold string in JSON output reflects the resolved values for the run (e.g. `"warn>4 fail>10 calibrated_per_milestone"`).

**Sanity checks to ship with implementation:**
- Empty milestones dir → fall back to base thresholds, don't divide-by-zero.
- Config missing → use defaults (current behaviour preserved).
- Config malformed → log to stderr, use defaults.

## Plan structure

- **23-01** — MUDAC-02 implementation: config block + probe threshold computation + audit metadata pass-through.
- **23-02** — MUDAC verification + REQUIREMENTS update: confirm MUDAC-01/03/04 already shipped (mark `[x]`), confirm MUDAC-02 newly shipped, write 23-VERIFICATION.md, close phase.

## Decisions locked

- **Q: scale model** → linear per milestone (`base * milestone_count`); not log-scale, not piecewise. Simple is safer; can recalibrate in v1.6.
- **Q: defaults** → `warn_per_milestone: 2, fail_per_milestone: 5`. Phase 21 + Phase 22 each show 1 inventory artifact (scratch dir leftovers); 2/milestone allows 1 carryover per phase + 1 buffer, 5/milestone is genuinely a hoarding signal.
- **Q: aggregation function** → `count of stale artifacts >3d` (current probe definition); MUDAC-02 only changes the threshold, not the value.

## Out of scope (deferred)

- MUDA recurrence audit calibration (separate concern, lives in `sgsd-muda-recurrence.sh`).
- Probe extension to v6+ (no current REQ).

## Next

Plan Phase 23 → execute → verify → close → advance to Phase 24 (Richer Output Contract).
