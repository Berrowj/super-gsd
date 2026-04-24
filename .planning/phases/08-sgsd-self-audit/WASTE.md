---
phase: 08
slug: 08-sgsd-self-audit
run_at: 2026-04-24T12:23:49Z
probe: sgsd-muda-probe
warn_count: 0
fail_count: 0
exit_code: 0
---

# MUDA Waste Audit — Phase 08

## Summary

All active probes PASS. No waste detected by current watchdogs. Phase is clean per DLB-02 Day-2 criteria.

## Probe Results

| Probe | Verdict | Value | Threshold | Waste Class | Evidence |
|-------|---------|-------|-----------|-------------|----------|
| haiku_fails              | PASS | 0 | warn>=3 fail>=8 | defects | skipped |
| narrative_age_sec        | PASS  | 0  | warn>1800s fail>3600s | waiting | skipped |
| git_spawn_pct            | PASS   | 0%  | warn>20% fail>40% | motion  | skipped |

## Raw Probe JSON

```json
{"probes":{"haiku_fails":{"verdict":"PASS","value":0,"evidence":"skipped"},"narrative_age_sec":{"verdict":"PASS","value":0,"evidence":"skipped"},"git_spawn_pct":{"verdict":"PASS","value":0,"evidence":"skipped"}}}
```

## Notes

- Probes run live; values reflect state at 2026-04-24T12:23:49Z.
- WARN/FAIL findings are curated to the MUDA context-tree section (unless `--no-curate` passed).
- Kill condition (DLB-02): if no waste class recurs across 2 consecutive milestones, the MUDA
  skill is flagged for retirement. Run `sgsd-muda-recurrence.sh` at milestone close to check.
