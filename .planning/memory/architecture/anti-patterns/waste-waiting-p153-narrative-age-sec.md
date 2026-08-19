---
title: waste waiting p153 narrative age sec
tags: [muda, waiting, phase-153, automated]
importance: 75
maturity: raw
created: 2026-08-18T17:01:26Z
---

Phase 153 waste probe: **narrative-age-sec** returned FAIL (value: 10685, threshold: warn>1800 fail>3600).

Waste class: waiting
Evidence: narrative.md age 10685s
Run at: 2026-08-18T17:01:23Z
Source: sgsd-muda-probe via sgsd-muda-audit

## Why this matters

Automated watchdog caught this pattern. If the same `waiting` waste class
appears in a subsequent phase audit, the classifier (post-v1.2) will surface
the earlier finding pre-dispatch so the executor can avoid the same cost.

## Canonical remediation

See [DLB-02 memo](../../decisions/DLB-02-muda-learning-loop.md) for the
broader waste-detection design. Individual probe fixes:

- **defects** (narrator/classifier failures): check `claude --print` auth, PATH, and model
  compatibility. Clear `narrative.md.lastfail` after fix.
- **waiting** (narrative_age_sec): ensure the narrator background worker is
  running; check for stale `narrative.md.lock`.
- **motion** (git_spawn_pct): review dashboards / skills for N+1 git
  invocation patterns. Batch via `Invoke-CachedGit` (see DLB-01 render-cache).
- **extra-processing** (extra_processing): review ATC tier rules against actual
  changed-line counts; tune tier thresholds rather than adding another review pass.
- **inventory** (inventory): archive or delete stale scratch/draft/temp planning
  artifacts; canonical phase records are not waste by age alone.
