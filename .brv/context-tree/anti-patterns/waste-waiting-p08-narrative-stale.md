---
title: waste waiting p08 narrative stale 2026 04 19 20 01 38z
tags: [muda, waiting, phase-08, automated]
importance: 75
maturity: raw
created: 2026-04-19T20:01:40Z
---

Phase 08 waste probe: **narrative-stale** returned FAIL (value: 557703, threshold: warn>1800s fail>3600s).

Waste class: waiting
Evidence: narrative.md age 557703s
Run at: 2026-04-19T20:01:38Z
Source: sgsd-muda-probe via sgsd-muda-audit

## Why this matters

Automated watchdog caught this pattern. If the same `waiting` waste class
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
