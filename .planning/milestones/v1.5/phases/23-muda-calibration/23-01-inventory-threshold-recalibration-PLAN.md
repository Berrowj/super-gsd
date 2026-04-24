---
schema_version: 2
phase: 23
plan: 23-01
plan_name: Inventory threshold recalibration (MUDAC-02)
milestone: v1.5
status: ready_to_execute
expected_ATC_tier: LITE
model: sonnet
depends_on: []
created: 2026-04-25
files_touched:
  - super-gsd/scripts/sgsd-muda-probe.sh
  - super-gsd/scripts/sgsd-muda-audit.sh
  - .planning/config.json
tasks:
  - id: T-23-01-1
    hypothesis: |
      Adding config-driven `muda.inventory_thresholds` block + milestone-count-scaled
      threshold computation in sgsd-muda-probe.sh closes MUDAC-02 without breaking
      existing PASS/WARN/FAIL behaviour for current Phase 21/22 audits.
    files_touched:
      - super-gsd/scripts/sgsd-muda-probe.sh
      - .planning/config.json
    action: |
      1. In sgsd-muda-probe.sh, after `inventory_count` is computed (~line 196),
         add config read with Node-eval pattern matching codex-exec.sh:211-232.
         Defaults: INVENTORY_WARN_BASE=2, INVENTORY_FAIL_BASE=5.
      2. Count active milestones via `find .planning/milestones -maxdepth 1 -mindepth 1 -type d | wc -l`.
         Guard: if count < 1, set to 1 (divide-by-zero protection).
      3. Compute `inventory_warn_threshold = INVENTORY_WARN_BASE * milestone_count`,
         `inventory_fail_threshold = INVENTORY_FAIL_BASE * milestone_count`.
      4. Update inventory_verdict logic to use the computed thresholds.
      5. Build `inventory_threshold_str = "warn>${warn} fail>${fail} calibrated_per_milestone"`
         and use it in the JSON emit.
      6. In .planning/config.json, add `"muda": { "inventory_thresholds": { "warn_per_milestone": 2, "fail_per_milestone": 5 } }` block (matches default values for transparency).
    verification:
      - cmd: bash -n super-gsd/scripts/sgsd-muda-probe.sh
        expect: exit 0
      - cmd: bash super-gsd/scripts/sgsd-muda-probe.sh | grep -c calibrated_per_milestone
        expect: ">= 1"
      - cmd: bash super-gsd/scripts/sgsd-muda-probe.sh | node -e 'const j=JSON.parse(require("fs").readFileSync(0)); console.log(j.probes.inventory.threshold)'
        expect: contains "calibrated_per_milestone"
  - id: T-23-01-2
    hypothesis: |
      sgsd-muda-audit.sh threshold pass-through (read from probe JSON instead of hardcoding)
      keeps source of truth singular and propagates the new threshold string into WASTE.md
      output without script duplication.
    files_touched:
      - super-gsd/scripts/sgsd-muda-audit.sh
    action: |
      1. In sgsd-muda-audit.sh around line 191, change the hardcoded
         `inventory: { threshold: "warn>0 fail>5 calibrated", waste_class: "inventory" }`
         to read the threshold value from the probe JSON output (already parsed earlier
         in the script). Pattern: extract `inventory.threshold` from PROBE_JSON via Node
         and inject into the table row.
      2. Verify by running the audit on Phase 22 — WASTE.md inventory row should show
         the new calibrated threshold, and (with milestone_count=2 + base=2) the
         previous 1-stale-artifact WARN should now be PASS.
    verification:
      - cmd: bash -n super-gsd/scripts/sgsd-muda-audit.sh
        expect: exit 0
      - cmd: bash super-gsd/scripts/sgsd-muda-audit.sh 22 2>&1 | tail -5
        expect: WASTE.md written; threshold reflects calibrated_per_milestone
      - cmd: grep -c calibrated_per_milestone .planning/milestones/v1.5/phases/22-security-hardening/WASTE.md
        expect: ">= 1"
---

# 23-01 — Inventory Threshold Recalibration (MUDAC-02)

## Context

The MUDA inventory probe currently uses a hardcoded `warn>0 fail>5` threshold that fires WARN on any project with even 1 stale scratch/draft/temp artifact older than 3 days. As the framework matures and accumulates milestones, this becomes increasingly noisy — every successful milestone leaves at least one scratch artifact, so the inventory probe is effectively a constant-WARN signal that adds no information.

MUDAC-02 fixes this by making thresholds **config-driven** and **scaled per milestone**, so the threshold grows with project size.

## Implementation

See task hypotheses + actions above. Two-task plan:

1. **T-23-01-1** — sgsd-muda-probe.sh threshold computation + config block
2. **T-23-01-2** — sgsd-muda-audit.sh threshold pass-through from probe JSON

## Verification

- Probe JSON contains `calibrated_per_milestone` in threshold string
- Audit WASTE.md reflects new threshold
- Phase 22 audit re-run shows inventory PASS (was WARN at value=1 with old threshold)
- bash -n syntax checks pass

## Risk

- **Divide-by-zero**: guarded explicitly when milestone count = 0.
- **Config malformed**: Node try/catch swallows + uses defaults.
- **Phase 21 inventory anti-pattern memory** — already saved as
  `waste-inventory-p21-inventory.md`, which documented the stale 1-WARN.
  After this fix, that memory becomes "historical context" rather than
  active warning. Acceptable.

## Out of scope

- MUDAC-01/03/04 verification (handled in 23-02).
- Recurrence audit calibration.
- Probe extension.
