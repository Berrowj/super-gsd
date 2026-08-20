---
phase: "160"
slug: installer-registration-guard
milestone: v3.7-upstream-hardening
status: PASS-WITH-DEFERRED-2
closed: 2026-08-20
commits: ["9da1cb1", "e0b3d75", "1cf9a5a", "6f5a06a"]
gates: {plan_review: "GO 5/5", close_review: "1 CRIT (pipefail seam) fixed same round", verifier: "8/8 guard cases exit 0 twice under exact production launch"}
---

# P160 Summary — Installer Registration Guard

## What shipped

1. `e0b3d75` T1 — hook-registration-preflight.cjs at the shared merge boundary:
   every hook command path must exist AND pass node --check before any settings
   write; refusal is atomic (zero writes, temp-free, every bad path named). The
   Clarity vendored-nine-hook shape now refuses at install instead of failing on
   every prompt.
2. `1cf9a5a` T2 — bundled CLAUDE-OVERLAY refreshed to current contracts (DLB-01
   memory, gpt-5.6-sol provider lock); stale-marker tripwire fails the suite if
   ByteRover/haiku/sonnet era text ever returns.
3. T3 (in 6f5a06a lineage) — install.sh smoke-runs every deployed hook once;
   a hook whose sibling dependency does not resolve fails the install loud,
   naming the hook (the D3 loader:1479 class caught at install time).
4. `6f5a06a` close-fix — merge refusals propagate under plain `bash install.sh`
   (per-merge exit capture; the sed-pipe swallow was seam instance 14, caught by
   the close review after eight green-but-masked cases).

## Deferred

1. canonical-sixteen-hook showed one EBUSY-era flake before T3C's retry cleanup;
   two consecutive full-suite green runs since. Watch on next few CI-equivalent runs.
2. Close-review WARN pair (minor ATC observations) recorded in 160-CLOSE-REVIEW.md.

## Downstream contract

Installers can no longer write dead registrations, ship stale overlay text, or
deploy hooks that cannot load. The Clarity and devcp instances get all three
protections on their next sgsd-update.
