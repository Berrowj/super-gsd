# Brief: {Decision Title}

## Situation

{What's happening. What triggered this decision. Factual context only — no opinions.
Include: current state, relevant history, what changed.
Minimum 50 words.}

## Stakes

{What's at risk. What happens if we get this wrong. What happens if we get this right.
Quantify where possible: time, phases affected, technical debt, user impact.
Minimum 30 words.}

## Constraints

{Non-negotiable boundaries. Timeline deadlines, technical requirements,
phase dependencies, model budget, existing architecture commitments.}

## Key Questions

{The specific questions the board needs to answer. Be precise.
Bad: "Should we do this?"
Good: "Given the 3-phase dependency chain and the existing Prisma schema,
should we add a new table or extend the existing one with a JSON column?"}

## Additional Context (optional)

{Links to relevant files, phase numbers, previous DLB decisions that inform this one.}

## Termination

phases_affected: {integer — how many project phases does this decision touch?}
max_rounds: 3
max_tokens: 120000
max_minutes: 20
q1_impl_hours: {decimal — estimated hours for the Q1 implementation, e.g. 1.5}
q1_revertable: {true | false — can changes be undone via git revert?}
gate_score: pending

<!-- phases_affected is read by the deliberation gate before the board is spawned.
     Deliberation only proceeds if phases_affected >= 3.

     max_rounds caps the CEO at this many debate rounds (hard limit).

     max_tokens + max_minutes are SOFT caps (DLB-05 Wave A). CEO checks
     cumulative spend + wall-clock elapsed before each round; if either
     is exceeded, appends [BUDGET WARN] to the memo. No synthesis-jump,
     no enforcement — log only. Default 120k/20m calibrated against
     DLB-01..05 range (105k–185k).

     q1_impl_hours + q1_revertable are read by the DELIBERATION-FLOOR
     pre-gate (DLB-06). If q1_impl_hours < 2 AND q1_revertable == true,
     deliberation is skipped — operator ships directly with a
     1-paragraph decision note. See .planning/decisions/DELIBERATION-FLOOR.md.

     gate_score is filled in by the gate after evaluation. -->
