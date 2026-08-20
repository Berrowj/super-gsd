---
phase: "158"
slug: notification-routing
milestone: v3.6-vtp-bridge
status: ACTIVE
depends_on: ["155"]
carved_from: "155"
governing_decision: .planning/milestones/v3.6-vtp-bridge/phases/155-propagation-readiness/155-PLANREVIEW-REPORT.md
opened: 2026-08-20
---

# P158 Context — Notification Routing (T6 carve-out)

## Goal

The UserPromptSubmit classifier's route predicates must not fire on automated
task-notification turns. Two false positives were recorded 2026-08-19: harness
task-notification text matched planning-shaped predicates and appended
suggestion rows for turns no operator wrote.

## Defect shape

Task notifications arrive as prompt-like text containing phrases such as
"Background command ... completed" and system-reminder framing. The lexical
router (P149 24-route table + P152 kb-lookup-triage) sees planning verbs in
quoted summaries and fires. The ledger then records operator demand that never
existed, polluting the Phase-0 demand baseline (P151) whose whole purpose is
honest demand measurement.

## Scope (single task expected)

ORIGIN GATING, not phrase blacklists: the classifier detects the automated-turn
class structurally (system-reminder / task-notification envelope markers at the
payload level, the way the hook payload distinguishes them) and exits silently
BEFORE route evaluation, writing a text-free `automated_turn_skip` ledger row so
the negative evidence is a written row, never an absent one (P153 T1 rule).

Falsifier BOTH directions with real payloads:
1. A genuine operator planning prompt still fires its matched route.
2. A task-notification turn (real recorded payload shape from 2026-08-19 class)
   writes `automated_turn_skip` and evaluates zero routes.
3. An operator prompt that merely QUOTES notification-like text still fires
   (phrase blacklists would fail this; origin gating must pass it).

## Boundaries

- Existing classifier and KB-shadow self-tests stay green unchanged.
- No new routes, no predicate weakening, no cosine (Phase 47/48 lock).
- Text-free ledger discipline (P151/P152): the skip row carries markers/counters
  only, never prompt text.
- Claude orchestrates; Codex gpt-5.6-sol authors source; task revertable;
  real-data SACs.

## Evidence for the planner

- `super-gsd/hooks/sgsd-intent-classifier.cjs` — the router; its ledger append
  sites and no_match row shape (P153 T1).
- The two false-positive ledger rows dated 2026-08-19 in
  `.planning/metrics/route-decisions.jsonl` (structure, not text, is recorded).
- Claude Code UserPromptSubmit payload shape: the hook receives the prompt
  field; automated turns carry system-reminder envelope markers.
