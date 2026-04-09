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
gate_score: pending

<!-- phases_affected is read by the Haiku gate before the board is spawned.
     Deliberation only proceeds if phases_affected >= 3.
     max_rounds caps the CEO at this many debate rounds (hard limit, never exceeded).
     gate_score is filled in by the gate after evaluation. -->
