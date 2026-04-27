---
title: waste overproduction p29 findings
tags: [muda, overproduction, phase-29, automated]
importance: 75
maturity: raw
created: 2026-04-27T00:44:19Z
---

Phase 29 waste probe: **findings-** returned WARN (value: FINDINGS:, threshold: ).

Waste class: overproduction
Evidence: codex-qualitative
Run at: 2026-04-27T00:41:18Z
Source: sgsd-muda-probe via sgsd-muda-audit

## Why this matters

Automated watchdog caught this pattern. If the same `overproduction` waste class
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
