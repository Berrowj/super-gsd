---
phase: "158"
slug: notification-routing
milestone: v3.6-vtp-bridge
status: PASS-WITH-DEFERRED-1
closed: 2026-08-20
commits: ["ee2274f", "8aa16c8"]
gates: {plan_review: "GO 5/5", close_review: "PASS-WITH-DEFERRED, 0 CRIT", verifier: "classifier self-test 25/25 exit 0"}
---

# P158 Summary — Notification Routing

## What shipped

`8aa16c8` — structural automated-turn origin gate in
super-gsd/hooks/sgsd-intent-classifier.cjs. Payload-level envelope detection runs
BEFORE any route evaluation: automated turns write one text-free
automated_turn_skip ledger row and evaluate zero routes; genuine operator prompts
fire unchanged; an operator prompt quoting notification text still fires (phrase
blacklists were the rejected approach, recorded in known_deadends). The 2026-08-19
false-positive class is structurally impossible, restoring Phase-0 demand-ledger
honesty (P151).

## Deferred

1. The two historical false-demand rows from 2026-08-19 remain in the ledger;
   reconciliation (annotate or filter at read time) is a P151-family follow-up.

## Downstream contract

Every ledger row now attests origin: operator demand rows are operator-authored.
P159's expanded routing builds on a classifier that cannot self-pollute.
