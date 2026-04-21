# Round 1 — Brief 3: Intent continuity

## Architect
- Q1: ship 1+3 (INTENT block + prefix) now; hold 2 cascade until memory stable; hold 4 V-model; include 5 pre-mortem via PRE-MORTEM.md stub
- Q2: hard-block on 1+3; warn on cascade/V-model with explicit skip token
- Q3: runtime-evolving; conflict triggers `/gsd-deliberate`
- Key: 1 and 3 are load-bearing at near-zero cost

## Pragmatist
- Q1: INTENT + prefix as paired Day 3 drop (~4h); defer everything else to post-v1.1
- Q2: hard-block on prefix (silent skipping IS the failure mode)
- Q3: compile-time derivation with deliberation on conflict
- Key: **10 lines in sgsd-mission-control.ps1 is the single highest-leverage intervention**

## Contrarian
- Q1: ship CASCADE ONLY; 4 of 5 are process theater
- Q2: **"Hard-blocks are enforcement theater worse than no enforcement — they create the illusion of rigor"**
- Q3: inheritance is a non-problem; drift is absence, not competition
- Alternative: (1) CLAUDE.md rule "read PROJECT.md core-value + last SUMMARY.md before planning"; (2) `outcome_delivered:` field in SUMMARY.md template

## Moonshot
- Q1: collapse all 5 into `intent-runtime.sh` called at every dispatch
- Q2: `intent_score(phase_goal, milestone_intent) -> float`; <0.6 = refuse dispatch; orphan work thermodynamically impossible
- Q3: strict inheritance with auto `/gsd-deliberate` on conflict
- Key: **intent as gate on resource expenditure, not compliance layer**
