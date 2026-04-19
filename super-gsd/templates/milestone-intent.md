---
# Copy to .planning/milestones/{id}/INTENT.md when opening a new milestone.
# The orchestrator reads this file once per loop iteration and injects
# `outcome_delivered` verbatim into every executor sub-agent prompt header
# as a constraint clause. Per DLB-03 the LLM context window IS the
# enforcement — no regex presence check, no score gate.
#
# Required fields (planner refuses milestone open without all three):

milestone: v1.X                         # semantic version, must match roadmap
why: >-                                 # 1-3 sentences — the strategic rationale.
  Why this milestone exists. What prior limitation or opportunity triggered it.
  Written BEFORE any phase is scoped. If you cannot answer this, the
  milestone isn't ready.

outcome_delivered: >-                   # ≤120 chars — JOBS-TO-BE-DONE framing.
  Users can do X in ≤N steps / measurable product outcome.

parent_project: Super GSD Framework     # backref to the project vision
created_at: 2026-MM-DD                  # ISO date — never back-dated
closed_at: null                         # set to ISO date when milestone archives

# Optional but recommended:
entry_criteria: []                      # what must be true BEFORE opening this milestone
exit_criteria: []                       # what must be true BEFORE closing this milestone
open_questions: []                      # unknowns that should be resolved by phase close

# Structural injection contract (read by sgsd-orchestrate loop):
# On every executor dispatch, the orchestrator injects:
#
#   <intent milestone="v1.X">
#     outcome_delivered
#   </intent>
#
# This tag is non-optional. Silent skip = loop is broken. The executor
# cannot ignore it because it is in the instruction window before the
# task prompt.
---

# {Milestone slug} — INTENT

## Why (strategic rationale)

<!-- Inherits from frontmatter `why` — expand if more than 3 sentences needed. -->

## Outcome (Jobs-To-Be-Done)

<!-- Inherits from frontmatter `outcome_delivered`. Keep the frontmatter
     version ≤120 chars for prompt injection; expand the narrative here. -->

## How we'll know

<!-- Measurable exit criteria. Numbers preferred over adjectives. -->

## Open questions

<!-- Unknowns. Each should resolve by milestone close (or be demoted to
     acknowledged-uncertainty in a phase AUDIT.md). -->
