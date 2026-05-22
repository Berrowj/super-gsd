---
phase: 50
slug: 50-cockpit-research-dashboard
run_at: 2026-04-28T15:07:36Z
probe: sgsd-muda-probe
warn_count: 0
fail_count: 0
exit_code: 0
---

# MUDA Waste Audit — Phase 50

## Summary

All active probes PASS. No waste detected by current watchdogs. Phase is clean per DLB-02 Day-2 criteria.

## Probe Results

| Probe | Verdict | Value | Threshold | Waste Class | Evidence |
|-------|---------|-------|-----------|-------------|----------|
| haiku_fails | PASS | 0 | warn>=3 fail>=8 | defects | narrative.md.lastfail absent (good — no recent failure) |
| narrative_age_sec | PASS | 244 | warn>1800 fail>3600 | waiting | narrative.md age 244s |
| git_spawn_pct | PASS | 0% | warn>20% fail>40% | motion | 0/100 Bash-git calls in last 100 activity entries |
| extra_processing | PASS | 0 | warn>3 fail>8 | extra-processing | 23 commit-review files, 62 rows, 0 with line counts, 0 tier/line mismatches |
| inventory | PASS | 1 | warn>18 fail>45 calibrated_per_milestone | inventory | 1 stale scratch/draft/temp artifacts >3d; first=scratch-findings.md |

<!-- qual-row-insert -->

## Raw Probe JSON

```json
{"project":"/c/Users/user/GSDedits","generated_at":"2026-04-28T15:07:35Z","probes":{"haiku_fails":{"value":0,"verdict":"PASS","threshold":"warn>=3 fail>=8","evidence":"narrative.md.lastfail absent (good — no recent failure)","waste_class":"defects"},"narrative_age_sec":{"value":244,"verdict":"PASS","threshold":"warn>1800 fail>3600","evidence":"narrative.md age 244s","waste_class":"waiting"},"git_spawn_pct":{"value":0,"verdict":"PASS","threshold":"warn>20% fail>40%","evidence":"0/100 Bash-git calls in last 100 activity entries","waste_class":"motion"},"extra_processing":{"value":0,"verdict":"PASS","threshold":"warn>3 fail>8","evidence":"23 commit-review files, 62 rows, 0 with line counts, 0 tier/line mismatches","waste_class":"extra-processing"},"inventory":{"value":1,"verdict":"PASS","threshold":"warn>18 fail>45 calibrated_per_milestone","evidence":"1 stale scratch/draft/temp artifacts >3d; first=scratch-findings.md","waste_class":"inventory"}},"overall_exit":0}
```

## Notes

- Probes run live; values reflect state at 2026-04-28T15:07:36Z.
- WARN/FAIL findings are curated to the MUDA context-tree section (unless `--no-curate` passed).
- Kill condition (DLB-02): if no waste class recurs across 2 consecutive milestones, the MUDA
  skill is flagged for retirement. Run `sgsd-muda-recurrence.sh` at milestone close to check.
