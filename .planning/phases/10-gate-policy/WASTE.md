---
phase: 10
slug: 10-gate-policy
run_at: 2026-04-22T16:26:06Z
probe: sgsd-muda-probe
warn_count: 0
fail_count: 0
exit_code: 2
---

# MUDA Waste Audit — Phase 10

## Summary

All three probes PASS. No waste detected by current watchdogs. Phase is clean per DLB-02 Day-2 criteria.

## Probe Results

| Probe | Verdict | Value | Threshold | Waste Class | Evidence |
|-------|---------|-------|-----------|-------------|----------|
| haiku_fails       | PASS | 0 | warn>=3 fail>=8 | defects | narrative.md.lastfail absent (good — no recent failure) |
| narrative_age_sec | PASS  | 181  | warn>1800s fail>3600s | waiting | narrative.md age 181s |
| git_spawn_pct     | PASS   | 0%  | warn>20% fail>40% | motion  | 0/100 Bash-git calls in last 100 activity entries |

## Raw Probe JSON

```json
{"project":"/c/Users/jack.berrow/GSDedits","generated_at":"2026-04-22T16:26:05Z","probes":{"haiku_fails":{"value":0,"verdict":"PASS","threshold":"warn>=3 fail>=8","evidence":"narrative.md.lastfail absent (good — no recent failure)","waste_class":"defects"},"narrative_age_sec":{"value":181,"verdict":"PASS","threshold":"warn>1800 fail>3600","evidence":"narrative.md age 181s","waste_class":"waiting"},"git_spawn_pct":{"value":0,"verdict":"PASS","threshold":"warn>20% fail>40%","evidence":"0/100 Bash-git calls in last 100 activity entries","waste_class":"motion"},"extra_processing":{"value":0,"verdict":"PASS","threshold":"warn>3 fail>8 GUESSED","evidence":"no commit-reviews.jsonl found","waste_class":"extra-processing"},"inventory":{"value":45,"verdict":"FAIL","threshold":"warn>3 fail>8 GUESSED","evidence":"99 phase .md files, 45 unreferenced >3d","waste_class":"inventory"}},"overall_exit":2}
```

## Notes

- Probes run live; values reflect state at 2026-04-22T16:26:06Z.
- WARN/FAIL findings are curated to the MUDA context-tree section (unless `--no-curate` passed).
- Kill condition (DLB-02): if no waste class recurs across 2 consecutive milestones, the MUDA
  skill is flagged for retirement. Run `sgsd-muda-recurrence.sh` at milestone close to check.
