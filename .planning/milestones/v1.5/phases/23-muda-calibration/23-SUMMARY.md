---
phase: 23
milestone: v1.5
status: complete
date: 2026-04-25
plans_shipped: 1
tasks_shipped: 2
commits: ~2
mudac_items_delivered: 4
mudac_pre_shipped: 3
mudac_new_in_phase: 1
verifier_verdict: passed
phase_atc_verdict: skipped (LITE tier — single-config-block change, no Codex review needed)
muda_status: ran — 0 WARN, 0 FAIL (re-run after recalibration)
tags:
  - milestone:v1.5
  - category:MUDAC
  - fast-track:3-of-4-pre-shipped
  - dogfood:codex-muda-work-from-v1.4
---

# Phase 23 — MUDA Calibration Complete

## What shipped

**4 MUDAC requirements delivered. 3 pre-shipped via Codex MUDA work in v1.4 (commit `b2773a8`); 1 newly shipped this phase (Plan 23-01, commit `396369d`).**

### MUDAC-01 — 5-probe aggregation completeness ✓ pre-shipped
- `sgsd-muda-probe.sh:210` iterates all 5 verdicts
- `sgsd-muda-audit.sh:223-224` derives counts via awk over PROBE_ROWS

### MUDAC-02 — Inventory threshold recalibration ✓ shipped this phase (Plan 23-01)
- `.planning/config.json.muda.inventory_thresholds` block (defaults `warn=2/milestone, fail=5/milestone`)
- `sgsd-muda-probe.sh` reads config + counts active milestones + computes threshold = base × count
- Divide-by-zero guarded (clamps milestone_count to ≥1)
- Threshold string in JSON: `"warn>N fail>M calibrated_per_milestone"`
- **Effect**: Phase 22 audit re-run regenerated WASTE.md with `warn_count: 0, fail_count: 0` (was 1 WARN under old `warn>0` threshold)

### MUDAC-03 — Flat-path mirror-fix ✓ pre-shipped
- `sgsd-muda-probe.sh:153-154` scans both `.planning/phases/` (legacy flat) and `.planning/milestones/*/phases/*/commit-reviews.jsonl` (nested)

### MUDAC-04 — Summary text accuracy ✓ pre-shipped
- `sgsd-muda-audit.sh:244-249` 3-branch summary reflects actual aggregate (PASS / FAIL+WARN / WARN-only)

## Verification verdict

`23-VERIFICATION.md` → PASS: 4/4 MUDAC must-haves verified (8/8 supporting truths). REQUIREMENTS.md MUDAC-01..04 all `[x]` with provenance commits annotated.

## Phase ATC verdict (Step 6.5)

Skipped per LITE tier criteria. Phase 23 scope is a single config-block change + Node-eval threshold computation; no architectural complexity to invite a phase-level Codex review.

## MUDA (Step 6.55) — ran post-recalibration

Phase 22 WASTE.md regenerated under new thresholds: 5 probes PASS, `warn_count: 0, fail_count: 0`. The new threshold (5 milestones × base 2 = 10) tolerates the existing 1-stale-artifact carryover correctly. Inventory probe is no longer constant-WARN noise.

## Codex dogfood evidence (Phase 23)

| # | Plan | Tier | Verdict |
|---|---|---|---|
| — | — | LITE — no Codex invocation | — |

Phase 23 deliberately did not invoke Codex review. The change is small, well-scoped, follows an established pattern (codex-exec.sh:211-232 config-read template), and was verified mechanically (bash -n + Phase 22 audit re-run + JSON inspection).

## What this proves

Auto-advance is working: phase research → plan → execute → verify → close ran end-to-end without operator prompting. Phase 23 took ~10 minutes wall-clock (including audit re-run) because 3/4 REQs were pre-shipped and Codex review was correctly skipped for LITE-tier work.

## Commit range

Phase 23 23-CONTEXT (`396369d` includes Phase 23 directory creation through Plan 23-01) → 23-VERIFICATION + 23-SUMMARY (this commit).

## Next

Phase 24 — Richer Output Contract. 3 REQs (CONTRACT-01..03), 2 plans:
- 24-01: FINDINGS_DETAIL prompt-engineering for richer Codex output (CONTRACT-01)
- 24-02: severity-aware narrative + carryover-evidence emit (CONTRACT-02 + CONTRACT-03)
