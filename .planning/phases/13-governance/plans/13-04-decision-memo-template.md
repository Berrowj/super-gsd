---
phase: 13-governance
plan: 04
type: execute
wave: 1
depends_on: []
files_modified:
  - super-gsd/templates/decision-memo.md
  - .planning/phases/13-governance/plans/13-04-SUMMARY.md
autonomous: true
requirements:
  - GOV-03
  - GOV-07

schema_version: 2
expected_ATC_tier: LITE
skip_gates: []
tasks:
  - id: 13-04-01
    agent: gsd-executor
    model: sonnet
    files_touched:
      - super-gsd/templates/decision-memo.md
    input_contract: |
      13-CONTEXT.md D-06 (decision-memo.md gains `## Falsifier` + `## Dead Ends / Paths Ruled Out`
      between `## Unresolved Tensions` and the implementation / Trade-offs section).
      Current template: 50 lines, 8 sections (Recommendation, Board Stances, Unresolved Tensions,
      Trade-offs Accepted, Risks Acknowledged, Next Actions, Deliberation Metadata).
      GOV-03: every decision memo requires a Falsifier + Dead Ends section (hard template edit).
      Invariant 10 from 13-RESEARCH.md §Q9: `grep -c "^## Falsifier\|^## Dead Ends" super-gsd/templates/decision-memo.md`
      must be >= 2 after this task commits.
    output_contract: |
      `super-gsd/templates/decision-memo.md` includes TWO new sections inserted between
      `## Unresolved Tensions` and `## Trade-offs Accepted`:
      - `## Falsifier` — with a placeholder sentence like
        "{What concrete evidence would prove this decision wrong? If that evidence shows up, reopen the decision.}"
      - `## Dead Ends / Paths Ruled Out` — with a placeholder like
        "- {Approach considered}: {why rejected}. {link to reasoning in deliberation log}"
      Section ordering preserved otherwise. Body text of existing sections UNCHANGED.
      File grows from 50 lines to ~60 lines. Headers match exactly `## Falsifier` and
      `## Dead Ends / Paths Ruled Out` (verifier invariant 10 greps the prefix `## Dead Ends`).
    hypothesis: |
      Template is the source of truth for ALL future DLB memos. Adding the two sections here
      means CEO memo-gen prompts (13-03-05) reference a template the agent already reads.
      This is pure text work — zero behavioural risk on existing DLB-01..06 memos (their files
      are untouched; only forward memos follow the new template).
    falsifier: |
      (a) `grep -q "^## Falsifier" super-gsd/templates/decision-memo.md` fails.
      (b) `grep -q "^## Dead Ends" super-gsd/templates/decision-memo.md` fails.
      (c) The sections land in wrong position (e.g., after Deliberation Metadata instead of
      between Unresolved Tensions and Trade-offs Accepted) — CEO memo-gen will emit them in the
      declared position, so template ordering must match intended output order.
      (d) An existing section header is deleted or renamed (regression).
    stop_rule: |
      Both section headers present (grep exits 0 for each), section positions verified between
      Unresolved Tensions and Trade-offs Accepted, existing header count unchanged (still 8
      original headers + 2 new = 10 `## ` headers in the file).
    verification_cmd: |
      grep -q "^## Falsifier" super-gsd/templates/decision-memo.md && \
      grep -q "^## Dead Ends" super-gsd/templates/decision-memo.md && \
      test "$(grep -c '^## ' super-gsd/templates/decision-memo.md)" -ge 10
    verification_gates:
      - "^## Falsifier header present → exit 0"
      - "^## Dead Ends header present → exit 0"
      - "total ## sections >= 10 (8 original + 2 new) → exit 0"

  - id: 13-04-02
    agent: gsd-executor
    model: sonnet
    files_touched:
      - super-gsd/templates/decision-memo.md
    input_contract: |
      13-CONTEXT.md D-14, D-14a (CEO runs a reflection pass AFTER Falsifier + Dead Ends.
      Appended as `## Post-Synthesis Reflection` section in memo footer, BEFORE `## Deliberation Metadata`).
      D-14 prompt verbatim: "Review your synthesis. What blind spots did this deliberation have?
      What archetype voices might we have missed? What did the rubric force to the foreground that
      might NOT matter?"
      D-15: GOV-05 audit (in sgsd-complete-milestone plan 13-05) reads this section and logs
      `reflection_captured: true` iff >50 chars of prose. Absence = GOV-07 adherence fail.
      Invariant 10 from 13-RESEARCH.md §Q9 also requires `^## Post-Synthesis Reflection` header.
    output_contract: |
      `super-gsd/templates/decision-memo.md` includes `## Post-Synthesis Reflection` section
      inserted between `## Next Actions` and `## Deliberation Metadata` (memo footer position
      per D-14a "memo footer"). Section includes a placeholder prompt reminding the CEO what
      to produce:
      ```
      ## Post-Synthesis Reflection

      {Review your synthesis. What blind spots did this deliberation have? What archetype
      voices might we have missed? What did the rubric force to the foreground that might
      NOT matter?}
      ```
      File grows to ~70 lines total. All three new headers (`## Falsifier`, `## Dead Ends /
      Paths Ruled Out`, `## Post-Synthesis Reflection`) now present.
    hypothesis: |
      Placing the reflection section in the footer (between Next Actions and Deliberation
      Metadata) matches D-14a "memo footer" placement and lets the GOV-05 audit (plan 13-05
      step 1) grep/parse it deterministically at a known location. The placeholder prompt
      text includes the D-14 reflection questions verbatim so the CEO, writing from the
      template, gets the rubric in-context — no separate prompt file needed.
    falsifier: |
      (a) `grep -q "^## Post-Synthesis Reflection" super-gsd/templates/decision-memo.md` fails.
      (b) Section placed outside footer (e.g., before Next Actions) — violates D-14a
      "memo footer" semantics.
      (c) Placeholder text does not reference "blind spots" (CEO won't have the prompt cue
      inline and will emit generic reflection).
      (d) `## Deliberation Metadata` no longer appears at the file end (the metadata section
      must remain the absolute last `## ` header).
    stop_rule: |
      `## Post-Synthesis Reflection` header present, placed between Next Actions and
      Deliberation Metadata, placeholder text contains the phrase "blind spots", and
      Deliberation Metadata remains the last `## ` section in the file.
    verification_cmd: |
      grep -q "^## Post-Synthesis Reflection" super-gsd/templates/decision-memo.md && \
      grep -q "blind spots" super-gsd/templates/decision-memo.md && \
      test "$(grep -n '^## ' super-gsd/templates/decision-memo.md | tail -1 | grep -c 'Deliberation Metadata')" -eq 1
    verification_gates:
      - "^## Post-Synthesis Reflection present → exit 0"
      - "placeholder mentions 'blind spots' → exit 0"
      - "Deliberation Metadata remains final ## section → exit 0"
    depends_on: [13-04-01]

must_haves:
  truths:
    - "`super-gsd/templates/decision-memo.md` contains `## Falsifier` section header (GOV-03)"
    - "`super-gsd/templates/decision-memo.md` contains `## Dead Ends / Paths Ruled Out` section header (GOV-03)"
    - "`super-gsd/templates/decision-memo.md` contains `## Post-Synthesis Reflection` section header (GOV-07 / D-14)"
    - "Falsifier + Dead Ends placed between `## Unresolved Tensions` and `## Trade-offs Accepted`"
    - "Post-Synthesis Reflection placed in footer between `## Next Actions` and `## Deliberation Metadata`"
    - "Post-Synthesis Reflection placeholder references 'blind spots' prompt per D-14 verbatim"
    - "`## Deliberation Metadata` remains the final `## ` section in the file"
  artifacts:
    - path: "super-gsd/templates/decision-memo.md"
      provides: "Canonical DLB memo template with Falsifier + Dead Ends + Post-Synthesis Reflection"
      contains: "`## Falsifier`, `## Dead Ends / Paths Ruled Out`, `## Post-Synthesis Reflection`"
      min_lines: 60
  key_links:
    - from: "super-gsd/templates/decision-memo.md"
      to: "super-gsd/skills/sgsd-deliberate/SKILL.md"
      via: "Step 5 memo-gen reads template placeholder sections"
      pattern: "decision-memo\\.md"
    - from: "super-gsd/templates/decision-memo.md"
      to: "super-gsd/skills/sgsd-complete-milestone/SKILL.md"
      via: "Step 1 GOV-05 audit greps `## Post-Synthesis Reflection` for reflection_captured flag"
      pattern: "Post-Synthesis Reflection"
---

# Plan 13-04: Decision Memo Template Extension

## Objective

Extend `super-gsd/templates/decision-memo.md` with three new sections — `## Falsifier`,
`## Dead Ends / Paths Ruled Out`, and `## Post-Synthesis Reflection` — so every forward
DLB memo carries skin-in-the-game invalidators, documented rejected approaches, and a
post-synthesis blind-spot audit.

Purpose: Satisfies **GOV-03** (Falsifier + Dead Ends required per D-06/D-06a) and
**GOV-07** (post-synthesis reflection per D-14/D-14a). Template-only edit; no runtime
code paths change in this plan. The CEO synthesis rubric update that POPULATES these
sections ships in plan 13-03 (task 13-03-05, absorbing the ex-13-04-03 CEO-rubric work
per the 6-wave split-13-04 wave model documented in the Phase 13 planning log).

Output: 1 file (`super-gsd/templates/decision-memo.md`). Wave 1 — parallel with plan
13-05 (new skill directory, zero file overlap with templates/).

## Tasks

Task breakdown follows 13-VALIDATION.md tasks 13-04-01 (Falsifier + Dead Ends) and
13-04-02 (Post-Synthesis Reflection). All contracts, hypotheses, falsifiers, stop rules
live in the frontmatter above — canonical executor contract.

### 13-04-01 — Insert Falsifier + Dead Ends

Add two headers between `## Unresolved Tensions` (line 27-28 in current template) and
`## Trade-offs Accepted` (line 31-32 current). Placeholder text for each matches D-06
verbatim:

- `## Falsifier`: "{What concrete evidence would prove this decision wrong? If that evidence shows up, reopen the decision.}"
- `## Dead Ends / Paths Ruled Out`: "- {Approach considered}: {why rejected}. {link to reasoning in deliberation log}"

### 13-04-02 — Insert Post-Synthesis Reflection

Add `## Post-Synthesis Reflection` between `## Next Actions` and `## Deliberation Metadata`
(memo footer per D-14a). Placeholder includes the D-14 prompt text verbatim
("blind spots / archetype voices missed / rubric forced-to-foreground that doesn't matter")
so CEO agents pick up the rubric inline without a separate prompt file.

## Verification Gates (Wave close)

Run in sequence:

1. `grep -q "^## Falsifier" super-gsd/templates/decision-memo.md` → exit 0
2. `grep -q "^## Dead Ends" super-gsd/templates/decision-memo.md` → exit 0
3. `grep -q "^## Post-Synthesis Reflection" super-gsd/templates/decision-memo.md` → exit 0
4. `grep -q "blind spots" super-gsd/templates/decision-memo.md` → exit 0
5. `grep -n '^## ' super-gsd/templates/decision-memo.md | tail -1 | grep -q "Deliberation Metadata"` → exit 0

## Success Criteria

- All three new section headers present.
- Falsifier + Dead Ends positioned between Unresolved Tensions and Trade-offs Accepted.
- Post-Synthesis Reflection positioned between Next Actions and Deliberation Metadata.
- Deliberation Metadata remains the final `## ` section.
- Placeholder text for Post-Synthesis Reflection mentions "blind spots" (D-14 verbatim).

## Output

After completion, create `.planning/phases/13-governance/plans/13-04-SUMMARY.md` summarising:
- 1 file modified (+3 new sections, ~20 lines added)
- Final template section count (original 8 + new 3 = 11 `## ` headers)
- 2 commit SHAs (one per task)
- Note: CEO rubric integration (ex-13-04-03) deferred to plan 13-03 task 13-03-05 per
  6-wave split-13-04 decision.
