---
name: Auto-advance phase stages without prompting - research -> plan -> execute -> close flows straight through
description: After any phase-stage command completes, immediately dispatch the next stage. Do not ask the operator what next. Missing discuss/context is auto-synthesized in auto mode.
type: feedback
originSessionId: e05ed485-05ef-4965-87f3-f385ab55c621
---

**Rule:** After `/gsd-research-phase` completes, immediately dispatch
`/gsd-plan-phase`. After plan completes, immediately dispatch plan-check
(optional) then executor. After executor, verifier + phase-ATC + MUDA + phase
SUMMARY + STATE bump. At phase close, advance to next phase automatically. At
milestone close, run `sgsd-complete-milestone`. Stop only at the 3 valid exit
conditions:

1. all phases complete,
2. genuine blocker requiring human judgment or runtime cannot continue,
3. explicit operator stop/pause.

Context percentage is not an exit condition.

**Why:** Operator directive 2026-04-24: "this entire process should be
automatic, we should move on automatically without me. It goes research - plan
- orchestrate go till complete milestone close."

This was the whole point of v1.4 Phase 20 Autonomous Session Handoff. Even
session boundaries should not interrupt the loop. Inserting operator prompts at
stage transitions is a regression.

**How to apply:** When a stage finishes, do not write a menu. Chain the next
stage:

- research done -> dispatch planner
- plan done -> dispatch plan-checker if configured -> executor
- executor done -> next executor if pending OR verifier if all plans shipped
- verifier pass -> phase-ATC -> MUDA -> phase-close SUMMARY + STATE + ROADMAP
  update + commit
- phase close -> if more phases in milestone -> next phase
- missing CONTEXT.md in auto mode -> synthesize CONTEXT.md + discussion
  decision record from roadmap/checkpoint/audit evidence, then dispatch
  researcher
- final phase close -> `sgsd-complete-milestone`

`/gsd-discuss-phase` is interactive only when the user deliberately invokes an
interactive flow. In auto mode, the orchestrator auto-defaults the discussion
from existing roadmap/proposal/audit evidence and continues.

**Specific exception:** If operator explicitly types `stop`, `pause`, or
`hold`, respect it. If there is a genuine blocker that requires human judgment,
write a checkpoint and stop with the exact blocker.

**Never do these in auto mode after a stage completes:**

- Write "Ready for next step. Options: a/b/c/d."
- Write "Pause recommended - session fatigue."
- Write "Want me to /schedule a background agent?"
- Write "Phase needs /gsd-discuss-phase" and stop.
- Write any menu of next-step commands.

The only text between stage completions is brief status, "dispatching next
stage", and a tool call. Zero-friction progression.
