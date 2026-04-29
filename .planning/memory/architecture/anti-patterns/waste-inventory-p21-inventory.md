---
title: waste inventory p21 inventory
tags: [muda, inventory, phase-21, automated]
importance: 75
maturity: raw
created: 2026-04-24T21:03:05Z
---

Phase 21 waste probe: **inventory** returned WARN (value: 1, threshold: warn>0 fail>5 calibrated).

Waste class: inventory
Evidence: 1 stale scratch/draft/temp artifacts >3d; first=scratch-findings.md
Run at: 2026-04-24T21:03:00Z
Source: sgsd-muda-probe via sgsd-muda-audit

## Why this matters

Automated watchdog caught this pattern. If the same `inventory` waste class
appears in a subsequent phase audit, the classifier (post-v1.2) will surface
the earlier finding pre-dispatch so the executor can avoid the same cost.

## Canonical remediation

See [DLB-02 memo](../../decisions/DLB-02-muda-learning-loop.md) for the
broader waste-detection design. Individual probe fixes:

- **defects** (haiku_fails): check `claude --print` auth, PATH, and model
  compatibility. Clear `narrative.md.lastfail` after fix.
- **waiting** (narrative_age_sec): ensure the Haiku background worker is
  running; check for stale `narrative.md.lock`.
- **motion** (git_spawn_pct): review dashboards / skills for N+1 git
  invocation patterns. Batch via `Invoke-CachedGit` (see DLB-01 render-cache).
- **extra-processing** (extra_processing): review ATC tier rules against actual
  changed-line counts; tune tier thresholds rather than adding another review pass.
- **inventory** (inventory): archive or delete stale scratch/draft/temp planning
  artifacts; canonical phase records are not waste by age alone.
