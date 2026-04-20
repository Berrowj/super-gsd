---
type: governance-rule
date: 2026-04-20
origin: DLB-06
rounds: 2
vote: "UNANIMOUS meta-endorsement (Contrarian proposed, 3/4 explicit agreement, Moonshot at 70%)"
---

# Deliberation Floor — Governance Pre-Check

## The Rule

**Any brief whose primary Q1 implementation estimate is <2 hours AND reversible via git revert does NOT require board deliberation.**

- Ship the implementation directly.
- File a 1-paragraph decision note in `.planning/decisions/{YYYY-MM-DD}-{slug}.md`.
- Retrospect at milestone close — scan shipped-under-floor items for any that needed board review in hindsight.
- Reopen via formal brief ONLY IF the retrospective surfaces real disagreement that building and observing didn't settle.

## What "the floor" IS NOT

- **Not** "is this worth thinking about." Every implementation decision is worth thinking about.
- **Not** "skip documentation." A 1-paragraph decision note is still required.
- **Not** a license to skip `/sgsd-deliberate` for decisions that DO meet the threshold. The gate is specific: implementation cost AND reversibility. Both conditions must hold.

## What "the floor" IS

A process-level kill condition that recognises: **when deliberation cost exceeds implementation cost + revert cost combined, the deliberation is inventory waste.** The board's 5 prior deliberations averaged 117k tokens; DLB-05 peaked at 185k. If the implementation a deliberation decides is 30 minutes of shell script, the cost inversion is catastrophic.

The floor assumes:
- Building-and-observing is a cheap way to discover whether a decision is real
- Git revert is a legitimate kill-mechanism for reversible changes
- Retrospectives at milestone close catch floor-rule false-negatives
- The operator remains the ultimate decider on whether a floor-dispatched decision is worth re-opening

## Integration with `/sgsd-deliberate`

Step 0 of the `/sgsd-deliberate` skill gains a pre-check:

```
If brief Q1 implementation estimate < 2 hours AND changes are fully git-revertable:
  echo "Below deliberation floor per DELIBERATION-FLOOR.md. Ship directly."
  echo "File 1-paragraph decision note. Retrospect at milestone close."
  exit 0
```

The gate runs BEFORE the existing `phases_affected >= 3` check. A brief can fail the floor check even if it passes the phase-impact check. Both gates must pass for deliberation to fire.

## Examples

**Below floor (ship without board):**
- Add a new slash command that wraps an existing shell script (<30m, revertable)
- Rename a metric field in `token-log.jsonl` (<15m, revertable)
- Change the default value of a config flag (<5m, revertable)
- Add a warn-only log field to an existing write path (<30m, revertable)
- Write a `super-gsd update` shell wrapper over `git pull && install.sh` (<1h, revertable)

**Above floor (board required):**
- Change the architecture of the memory tier (hours, partially reversible)
- Add a new gate step in the 6.x chain (touches dispatch, multi-file, not cleanly revertable)
- Reopen a prior DLB deferral (evidence judgment required)
- Adopt a new cross-cutting pattern (sets precedent, hard to revert)
- Retire an existing mechanism (operator-decides-retirements invariant)

## Kill Condition for the Floor Rule

If across 2 milestones, 2+ floor-rule dispatches ship and retrospectively needed board review (i.e., caused real friction that building didn't settle), **raise the threshold** — either:
- Increase the time estimate from 2h to 3h (lower bar for deliberation)
- Add reversibility complexity rubric (distinguish "revert one commit" from "revert commits + fix downstream")
- Add scope constraint (e.g., if touches >N files, deliberate regardless of time)

If across 4 milestones with 0 false-negatives, **lower the threshold** — reduce to 1h, since the build-and-observe path is clearly cheaper than deliberation at that scale.

## Why This Rule Exists

DLB-06 itself was marginal. Three of four board agents explicitly acknowledged that the deliberation cost exceeded the implementation cost for its primary question (Q1a: a 1-hour shell script). Contrarian proposed this rule; Architect, Pragmatist, and Moonshot all endorsed it (Moonshot at 70%). The board self-corrected on its own cost-of-governance problem.

The deeper pattern across DLB-01 → DLB-05: the board has been consistently right that deferring machinery until evidence justifies it is the correct architectural discipline. DLB-06's contribution is applying the same discipline to the deliberation mechanism itself. **The board sets its own kill condition.**

## Related

- `.planning/decisions/DLB-06-central-distribution.md` — origin deliberation
- `.planning/deliberations/2026-04-20-central-distribution/` — full R1/R2 transcripts
- `.planning/decisions/DLB-02-muda-learning-loop.md` — precedent for kill conditions on mechanisms
- `super-gsd/skills/sgsd-deliberate/SKILL.md` — Step 0 pre-check integration point
