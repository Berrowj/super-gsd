---
phase: "161"
slug: hook-distribution-completion
milestone: v3.8-fleet-cockpit
status: PASS-WITH-DEFERRED-3
closed: 2026-08-21
commits: ["23de93b", "a39549d", "71f940f", "44e7861"]
gates: {plan_review: "GO 5/5", close_review: "BLOCKED (1 CRIT) then fixed in two rounds", verifier: "12/12 case invocations exit 0; install 6m04 -> 1m49 measured"}
---

# P161 Summary — Hook Distribution Completion

## What shipped

1. `23de93b` T1 — installer ships every hook type (.cjs included; 25 land) and
   runs 3.3x faster (measured 6m04 -> 1m49) after replacing per-file process
   forks with batched copies; smoke spawns node-direct with bounded concurrency.
2. `a39549d` T2 — explicit hook-manifest.json reconciling shipped hooks vs
   registrations (native statusLine/git surfaces reasoned, not double
   registered); the five missing hooks registered; silence-fails tripwire.
3. `71f940f` T3 — the real sgsd-update Clarity-recovery proof: broken exit 5
   with held pin, repaired exit 0 with pin advance, dead sgsd_managed rows
   preserved untouched for the operator-ordered removal (SKILL.md documents the
   2026-08-13 ordering). Governing principle landed: SGSD validates ONLY rows
   it owns; operator rows are byte-preserved and never parsed.
4. `44e7861` close-fix — files created by distribution are re-smoked (fail loud
   on broken runtime); recovery fixture ships the true sibling runtime.

## Deferred

1. Close-review WARN: T3I's operator-row preservation proof reserialises
   subtrees rather than comparing raw bytes; tighten on next touch.
2. Close-review WARN: task prompts broadened locked file scopes mid-phase and
   renamed the SAC case (aliased); provenance recorded in the nine-round trail.
3. The 27s network `npx get-shit-done-cc@latest` call inside install.sh
   (measured) is an offline-install liability; carry as a small follow-up.

## Downstream contract

devcp/Clarity's sgsd-update completes: distribution covers every hook type, the
manifest keeps overlays honest, and the recovery path is regression-guarded.
P162 (fleet service) builds on a fleet whose hooks actually run.
