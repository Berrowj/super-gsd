---
name: Missing phase context does not pause full autopilot
description: In /sgsd-orchestrate go/auto/continue mode, a missing CONTEXT.md or not-discussed phase must be auto-defaulted from roadmap/checkpoint/audit evidence and must not stop for /gsd-discuss-phase.
type: feedback
originSessionId: full-roadmap-autopilot-v2.0-boundary-2026-04-28
---

**Rule:** In autonomous mode, "Phase needs CONTEXT.md" is not a hard stop and
not an operator-scoped decision by itself.

**Why:** 2026-04-28 incident - after v1.9 shipped cleanly, the orchestrator
stopped at v2.0 Phase 53 because it treated missing CONTEXT/discussion as a
reason to suggest `/gsd-discuss-phase 53`. That contradicts the full-autopilot
instruction: do not stop at phase or milestone boundaries.

**How to apply:** If a phase is queued but has no CONTEXT.md:

1. Read `.planning/STATE.md`, `.planning/ROADMAP.md`,
   `.planning/ORCHESTRATOR-CHECKPOINT.md`, the milestone proposal/roadmap
   source, and the implementation audit.
2. Create the missing CONTEXT.md and a compact discussion/decision record.
3. Mark assumptions explicitly.
4. Continue directly to research -> plan -> check -> execute.

Only stop if the missing context hides a true human-judgment blocker, such as
credentials, privacy/security judgment, destructive scope outside the repo, or
unrecoverable contradictory state.
