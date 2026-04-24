---
phase: 21
slug: 21-vtp-enrichment-gates
run_at: 2026-04-24T21:03:00Z
probe: sgsd-muda-probe
warn_count: 1
fail_count: 0
exit_code: 1
---

# MUDA Waste Audit — Phase 21

## Summary

1 WARN (no FAIL) across active probes. Findings curated.

## Probe Results

| Probe | Verdict | Value | Threshold | Waste Class | Evidence |
|-------|---------|-------|-----------|-------------|----------|
| haiku_fails | PASS | 0 | warn>=3 fail>=8 | defects | narrative.md.lastfail absent (good — no recent failure) |
| narrative_age_sec | PASS | 77 | warn>1800 fail>3600 | waiting | narrative.md age 77s |
| git_spawn_pct | PASS | 0% | warn>20% fail>40% | motion | 0/100 Bash-git calls in last 100 activity entries |
| extra_processing | PASS | 0 | warn>3 fail>8 | extra-processing | 8 commit-review files, 26 rows, 0 with line counts, 0 tier/line mismatches |
| inventory | WARN | 1 | warn>0 fail>5 calibrated | inventory | 1 stale scratch/draft/temp artifacts >3d; first=scratch-findings.md |


## Raw Probe JSON

```json
{"project":"/c/Users/jack.berrow/GSDedits","generated_at":"2026-04-24T21:02:59Z","probes":{"haiku_fails":{"value":0,"verdict":"PASS","threshold":"warn>=3 fail>=8","evidence":"narrative.md.lastfail absent (good — no recent failure)","waste_class":"defects"},"narrative_age_sec":{"value":77,"verdict":"PASS","threshold":"warn>1800 fail>3600","evidence":"narrative.md age 77s","waste_class":"waiting"},"git_spawn_pct":{"value":0,"verdict":"PASS","threshold":"warn>20% fail>40%","evidence":"0/100 Bash-git calls in last 100 activity entries","waste_class":"motion"},"extra_processing":{"value":0,"verdict":"PASS","threshold":"warn>3 fail>8","evidence":"8 commit-review files, 26 rows, 0 with line counts, 0 tier/line mismatches","waste_class":"extra-processing"},"inventory":{"value":1,"verdict":"WARN","threshold":"warn>0 fail>5 calibrated","evidence":"1 stale scratch/draft/temp artifacts >3d; first=scratch-findings.md","waste_class":"inventory"}},"overall_exit":1}
```

## Notes

- Probes run live; values reflect state at 2026-04-24T21:03:00Z.
- WARN/FAIL findings are curated to the MUDA context-tree section (unless `--no-curate` passed).
- Kill condition (DLB-02): if no waste class recurs across 2 consecutive milestones, the MUDA
  skill is flagged for retirement. Run `sgsd-muda-recurrence.sh` at milestone close to check.
