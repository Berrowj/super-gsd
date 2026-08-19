---
phase: 153
slug: 153-hook-transport-completion
run_at: 2026-08-18T17:01:23Z
probe: sgsd-muda-probe
warn_count: 0
fail_count: 1
exit_code: 2
---

# MUDA Waste Audit — Phase 153

## Summary

**1 FAIL** + 0 WARN across active probes. Findings curated to `.planning/memory/architecture/anti-patterns/` for future classifier consult.

## Probe Results

| Probe | Verdict | Value | Threshold | Waste Class | Evidence |
|-------|---------|-------|-----------|-------------|----------|
| haiku_fails | PASS | 0 | warn>=3 fail>=8 | defects | narrative.md.lastfail absent (good — no recent failure) |
| narrative_age_sec | FAIL | 10685 | warn>1800 fail>3600 | waiting | narrative.md age 10685s |
| git_spawn_pct | PASS | 0% | warn>20% fail>40% | motion | 0/100 Bash-git calls in last 100 activity entries |
| extra_processing | PASS | 0 | warn>3 fail>8 | extra-processing | 39 commit-review files, 149 rows, 0 with line counts, 0 tier/line mismatches |
| inventory | PASS | 0 | warn>54 fail>135 calibrated_per_milestone | inventory | 0 stale scratch/draft/temp planning artifacts >3d |

<!-- qual-row-insert -->

## Raw Probe JSON

```json
{"project":"/c/Users/jack.berrow/AppData/Roaming/warp/Warp/data/worktrees/GSDedits/luminaria-hogback","generated_at":"2026-08-18T17:01:22Z","probes":{"haiku_fails":{"value":0,"verdict":"PASS","threshold":"warn>=3 fail>=8","evidence":"narrative.md.lastfail absent (good — no recent failure)","waste_class":"defects"},"narrative_age_sec":{"value":10685,"verdict":"FAIL","threshold":"warn>1800 fail>3600","evidence":"narrative.md age 10685s","waste_class":"waiting"},"git_spawn_pct":{"value":0,"verdict":"PASS","threshold":"warn>20% fail>40%","evidence":"0/100 Bash-git calls in last 100 activity entries","waste_class":"motion"},"extra_processing":{"value":0,"verdict":"PASS","threshold":"warn>3 fail>8","evidence":"39 commit-review files, 149 rows, 0 with line counts, 0 tier/line mismatches","waste_class":"extra-processing"},"inventory":{"value":0,"verdict":"PASS","threshold":"warn>54 fail>135 calibrated_per_milestone","evidence":"0 stale scratch/draft/temp planning artifacts >3d","waste_class":"inventory"}},"overall_exit":2}
```

## Notes

- Probes run live; values reflect state at 2026-08-18T17:01:23Z.
- WARN/FAIL findings are curated to the MUDA context-tree section (unless `--no-curate` passed).
- Kill condition (DLB-02): if no waste class recurs across 2 consecutive milestones, the MUDA
  skill is flagged for retirement. Run `sgsd-muda-recurrence.sh` at milestone close to check.
## Deletion Candidates

> Heuristic suggestions only. Phase 39 rubric reviews these at milestone close.
> Operator may dismiss any row. Auto-disable is NOT performed (locked 37=A).

_No deletion candidates surfaced by current heuristics._
