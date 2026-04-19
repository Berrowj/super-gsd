---
phase: 08
slug: 08-sgsd-self-audit
run_at: 2026-04-19T20:01:38Z
probe: sgsd-muda-probe
warn_count: 0
fail_count: 1
exit_code: 2
---

# MUDA Waste Audit — Phase 08

## Summary

**1 FAIL** + 0 WARN across 3 probes. Findings curated to `.brv/context-tree/anti-patterns/` for future classifier consult.

## Probe Results

| Probe | Verdict | Value | Threshold | Waste Class | Evidence |
|-------|---------|-------|-----------|-------------|----------|
| haiku_fails       | PASS | 0 | warn>=3 fail>=8 | defects | narrative.md.lastfail absent (good — no recent failure) |
| narrative_age_sec | FAIL  | 557703  | warn>1800s fail>3600s | waiting | narrative.md age 557703s |
| git_spawn_pct     | PASS   | 0%  | warn>20% fail>40% | motion  | 0/100 Bash-git calls in last 100 activity entries |

## Raw Probe JSON

```json
{"project":"/c/Users/jack.berrow/GSDedits","generated_at":"2026-04-19T20:01:37Z","probes":{"haiku_fails":{"value":0,"verdict":"PASS","threshold":"warn>=3 fail>=8","evidence":"narrative.md.lastfail absent (good — no recent failure)","waste_class":"defects"},"narrative_age_sec":{"value":557703,"verdict":"FAIL","threshold":"warn>1800 fail>3600","evidence":"narrative.md age 557703s","waste_class":"waiting"},"git_spawn_pct":{"value":0,"verdict":"PASS","threshold":"warn>20% fail>40%","evidence":"0/100 Bash-git calls in last 100 activity entries","waste_class":"motion"}},"overall_exit":2}
```

## Notes

- Probes run live; values reflect state at 2026-04-19T20:01:38Z.
- WARN/FAIL findings are curated to the MUDA context-tree section (unless `--no-curate` passed).
- Kill condition (DLB-02): if no waste class recurs across 2 consecutive milestones, the MUDA
  skill is flagged for retirement. Run `sgsd-muda-recurrence.sh` at milestone close to check.
