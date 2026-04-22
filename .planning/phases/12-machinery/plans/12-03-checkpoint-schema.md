---
phase: 12-machinery
plan: 03
type: execute
wave: 3
depends_on:
  - 12-02
files_modified:
  - super-gsd/templates/checkpoint.md
  - super-gsd/skills/sgsd-orchestrate/SKILL.md
  - super-gsd/scripts/lib/context-gauge.cjs
  - .planning/phases/12-machinery/verify.mjs
  - .planning/phases/12-machinery/plans/12-03-SUMMARY.md
autonomous: true
requirements:
  - MACH-03

# v2 schema self-referential frontmatter
schema_version: 2
expected_ATC_tier: LITE
skip_gates: []
tasks:
  - id: 12-03-01
    agent: gsd-executor
    model: sonnet
    files_touched:
      - super-gsd/templates/checkpoint.md
      - .planning/phases/12-machinery/verify.mjs
    input_contract: |
      12-CONTEXT.md D-09 — three new checkpoint frontmatter fields:
      1. `approaches_tried_and_abandoned: []` (entries: `{approach, why_abandoned, artifact_refs}`)
      2. `rules_learned_this_session: []` (entries: `{rule, context, curated_to}`)
      3. `dispatches_summary: {total, by_agent: {executor, verifier, planner, researcher,
         classifier, code_reviewer}, by_outcome: {pass, fail, warn, blocker}}`
      12-CONTEXT.md D-11 — `emergency_halt: false` (set true on 85% hard-cap fire).
      12-CONTEXT.md D-12 — template lives at `super-gsd/templates/checkpoint.md` (EXISTS,
      confirmed via Read). Current schema has 12 fields — 4 new fields must be added without
      breaking old-checkpoint readability (new fields default to empty/false).
      12-RESEARCH.md §Q3 "Recommended checkpoint.md additions" — exact YAML block to append
      after line 15 (before `resume_instruction`).
      Append Invariant 6 to `.planning/phases/12-machinery/verify.mjs`: grep the template
      for all three new D-09 field names; all 3 must match.
    output_contract: |
      `super-gsd/templates/checkpoint.md` frontmatter now contains the 4 new fields:
      `emergency_halt`, `approaches_tried_and_abandoned`, `rules_learned_this_session`,
      `dispatches_summary`. Existing 12 fields preserved with no edits. Placement: after
      line 15 (`context_percent_at_write:`), before `resume_instruction:`.
      `dispatches_summary` is a nested object with keys `total`, `by_agent.{executor,
      verifier, planner, researcher, classifier, code_reviewer}`, `by_outcome.{pass, fail,
      warn, blocker}` — all zero-initialized.
      `.planning/phases/12-machinery/verify.mjs` gains Invariant 6 (grep for
      `approaches_tried_and_abandoned`, `rules_learned_this_session`, `dispatches_summary`
      in the template — all 3 must match). Running `node verify.mjs` exits 0 post-commit.
    hypothesis: |
      Appending 4 frontmatter fields to an existing template is a self-contained edit with
      zero blast radius on old checkpoints (YAML frontmatter permits extra keys; consumers
      that don't read the new fields ignore them). The grep-based invariant is the standard
      Phase 10 ATC-review pattern (10-ATC-REVIEW.md WR-02 cited the same shape) and
      surfaces missing-field regressions immediately on any future checkpoint.md edit.
    falsifier: |
      (a) Template missing any of 4 new fields (`grep -c` for each must return ≥1).
      (b) Any existing field from lines 1-15 was edited (regression — compare before/after).
      (c) `dispatches_summary` is flat instead of nested (contract mismatch — must have
      `by_agent` and `by_outcome` sub-objects).
      (d) verify.mjs Invariant 6 missing or doesn't check all 3 D-09 field names.
      (e) `node verify.mjs` fails after commit.
    stop_rule: |
      All 4 new fields present in template; 12 existing fields unchanged;
      `grep -cE '(approaches_tried_and_abandoned|rules_learned_this_session|dispatches_summary)' super-gsd/templates/checkpoint.md` ≥ 3;
      verify.mjs contains Invariant 6 marker; `node verify.mjs` exits 0.
    verification_cmd: |
      test $(grep -cE '(approaches_tried_and_abandoned|rules_learned_this_session|dispatches_summary)' super-gsd/templates/checkpoint.md) -ge 3 && grep -q "emergency_halt" super-gsd/templates/checkpoint.md && grep -q "by_agent:" super-gsd/templates/checkpoint.md && grep -q "by_outcome:" super-gsd/templates/checkpoint.md && test $(grep -cE 'Invariant 6\b' .planning/phases/12-machinery/verify.mjs) -ge 1 && node .planning/phases/12-machinery/verify.mjs
    verification_gates:
      - "template contains 3 D-09 field names → grep count >= 3"
      - "template contains emergency_halt field → grep exit 0"
      - "dispatches_summary has by_agent + by_outcome sub-keys → grep exit 0"
      - "verify.mjs has Invariant 6 → count >= 1"
      - "node verify.mjs → exit 0 (invariants 1-6 green)"

  - id: 12-03-02
    agent: gsd-executor
    model: sonnet
    files_touched:
      - super-gsd/skills/sgsd-orchestrate/SKILL.md
      - .planning/phases/12-machinery/verify.mjs
    input_contract: |
      12-CONTEXT.md D-10 — primary checkpoint trigger changes from `context >70% anywhere`
      to `(phase_boundary OR plan_boundary) AND context >70%`.
      12-CONTEXT.md D-11 — emergency hard cap `context >= 85%` forces checkpoint MID-TASK.
      Orchestrator on fire writes checkpoint with `emergency_halt: true`, logs DEVIATIONS
      `CHECKPOINT_EMERGENCY: context {N}% at task {id} of plan {id}`, exits loop text-only.
      12-CONTEXT.md D-11a — ≥10% emergency-halt rate in a milestone → sgsd-curate anti-pattern
      note (deferred mechanical counter to Phase 13; 12-03 only writes the marker).
      12-RESEARCH.md §Q3 integration site — SKILL.md `<checkpoint_protocol>` section at
      lines 959-989. Extend prose at line 960 to "When context ≥85% OR ((phase_boundary OR
      plan_boundary) AND context ≥70%) OR user says stop". Add an "Emergency halt path"
      subsection that writes checkpoint with `emergency_halt: true` + logs the DEVIATIONS
      row per D-11 steps 1-3.
      12-RESEARCH.md §Q3 also adds an explicit self-assess instruction at Step 1 (READ STATE)
      — agent self-reports context use; ≥85% triggers emergency checkpoint; ≥70% at
      plan/phase boundary triggers normal checkpoint.
      Append Invariant 7 to verify.mjs: grep SKILL.md for `85%` — must be ≥1 match (current
      state: 0 per research; green after this task).
    output_contract: |
      `super-gsd/skills/sgsd-orchestrate/SKILL.md` `<checkpoint_protocol>` section now:
      - Prose trigger reads `context ≥85% OR ((phase_boundary OR plan_boundary) AND context ≥70%) OR user says stop`
      - Contains an "Emergency halt path" subsection detailing the D-11 3-step sequence
      - Step 1 (READ STATE) has a self-assess instruction referencing the 85% and 70% thresholds
      Measurable greppable markers:
      - `grep -q "85%" SKILL.md` → exit 0 (at minimum 1 hit — D-11)
      - `grep -q "emergency_halt" SKILL.md` → exit 0 (field referenced)
      - `grep -q "CHECKPOINT_EMERGENCY" SKILL.md` → exit 0 (DEVIATIONS log key)
      `.planning/phases/12-machinery/verify.mjs` gains Invariant 7 (SKILL.md contains `85%`);
      `node verify.mjs` exits 0 (invariants 1-7 green).
    hypothesis: |
      The 70% trigger in SKILL.md is already self-report (verified via research grep at
      lines 30, 161, 960, 1023). Extending the same self-report convention to 85% as an
      emergency cap is consistent with existing semantics — no new oracle needed (research
      §Q3 Recommendation: Option A). The `emergency_halt` marker in the checkpoint
      frontmatter (from 12-03-01) gives a mechanical hook for future milestone-close
      counters (D-11a feedback loop deferred).
    falsifier: |
      (a) `grep -q "85%" SKILL.md` fails — the hard-cap instruction didn't land (D-11 violation).
      (b) `grep -q "emergency_halt" SKILL.md` fails — the field from the checkpoint template
      isn't referenced in the protocol prose.
      (c) `grep -q "CHECKPOINT_EMERGENCY" SKILL.md` fails — the DEVIATIONS log key name from
      D-11 step 2 isn't present (log shape not specified).
      (d) The primary trigger prose still reads "context >70% anywhere" (D-10 violation).
      (e) verify.mjs Invariant 7 missing or `node verify.mjs` non-zero after commit.
    stop_rule: |
      Three greppable markers present in SKILL.md; trigger prose updated to D-10 shape;
      verify.mjs Invariant 7 present; `node verify.mjs` exits 0.
    verification_cmd: |
      grep -q "85%" super-gsd/skills/sgsd-orchestrate/SKILL.md && grep -q "emergency_halt" super-gsd/skills/sgsd-orchestrate/SKILL.md && grep -q "CHECKPOINT_EMERGENCY" super-gsd/skills/sgsd-orchestrate/SKILL.md && test $(grep -cE 'Invariant 7\b' .planning/phases/12-machinery/verify.mjs) -ge 1 && node .planning/phases/12-machinery/verify.mjs
    verification_gates:
      - "grep 85% SKILL.md → exit 0 (D-11 hard cap)"
      - "grep emergency_halt SKILL.md → exit 0 (field referenced)"
      - "grep CHECKPOINT_EMERGENCY SKILL.md → exit 0 (DEVIATIONS key)"
      - "verify.mjs has Invariant 7 → count >= 1"
      - "node verify.mjs → exit 0 (invariants 1-7 green)"
    depends_on: [12-03-01]

  - id: 12-03-03
    agent: gsd-executor
    model: sonnet
    files_touched:
      - super-gsd/scripts/lib/context-gauge.cjs
      - .planning/phases/12-machinery/plans/12-03-SUMMARY.md
    input_contract: |
      12-RESEARCH.md §Risk 1 (MEDIUM) — 85% oracle mechanism is the one surface with two
      legitimate options. Per research Recommendation: Option A (self-report, same
      convention as 70%) is acceptable and ships in 12-03-02. Option B ships an opt-in
      helper module `super-gsd/scripts/lib/context-gauge.cjs` that sums token-log.jsonl
      rows for the current session and exposes `isEmergency(total, maxContext) → bool`
      with a 0.85 default threshold. Shipping both gives the operator a mechanical path
      for future sessions without blocking on self-report.
      Plan-internal decision (per `<research_inputs>` intent): this task ships the
      context-gauge helper as the OPT-IN mechanical fallback. Self-report (Option A)
      remains the primary trigger from 12-03-02. SKILL.md does NOT require context-gauge
      at runtime — it's available to future orchestrator versions that want mechanical
      context tracking.
      12-VALIDATION.md row 12-03-03 — `isEmergency(170000, 200000) === true` is the smoke
      test. Module is ~20 LOC of pure arithmetic over numeric inputs; zero fs/deps.
      Plan close: produce 12-03-SUMMARY.md documenting the Risk 1 decision and artefacts.
    output_contract: |
      `super-gsd/scripts/lib/context-gauge.cjs` exists as a CJS module exporting
      `{isEmergency, isWarning, computeFraction}` (plus any internal helpers private).
      Pure arithmetic; zero runtime deps (no fs, no network).
      - `isEmergency(total, maxContext, threshold=0.85)` → boolean; true when
        `total/maxContext >= threshold`.
      - `isWarning(total, maxContext, threshold=0.70)` → boolean; same shape at 0.70.
      - `computeFraction(total, maxContext)` → float in [0, Infinity); returns 0 if
        either input ≤ 0 (defensive).
      `.planning/phases/12-machinery/plans/12-03-SUMMARY.md` records:
      - D-11 Risk 1 decision: Option A (self-report) primary + Option B (context-gauge)
        opt-in helper shipped alongside
      - All 4 new checkpoint fields added to template (D-09 complete)
      - SKILL.md checkpoint_protocol updated (D-10 trigger + D-11 hard cap + D-11 emergency
        path)
      - Commit SHAs
      - Handoff to plan 12-04 (Wave 4: adversarial verifier)
    hypothesis: |
      Shipping the mechanical helper as OPT-IN (not required by the runtime) keeps the
      LITE-scope commitment from Risk 1 (self-report primary) while giving future
      orchestrator versions a zero-cost path to mechanical tracking. The 20-LOC arithmetic
      module has no failure modes beyond basic numeric validation — trivially testable.
    falsifier: |
      (a) Module missing or doesn't export `isEmergency`, `isWarning`, `computeFraction`.
      (b) `isEmergency(170000, 200000)` returns false (0.85 threshold) — arithmetic wrong.
      (c) `isEmergency(100000, 200000)` returns true (0.50 well below 0.85) — threshold wrong.
      (d) Module introduces runtime dep (fs, network, etc).
      (e) SUMMARY.md omits the Risk 1 decision record.
    stop_rule: |
      Module loads + three exports present; arithmetic smoke test passes at 0.85 boundary;
      SUMMARY.md records the Risk 1 decision.
    verification_cmd: |
      node -e "const g=require('./super-gsd/scripts/lib/context-gauge.cjs');if(typeof g.isEmergency!=='function'||typeof g.isWarning!=='function'||typeof g.computeFraction!=='function'){console.error('FAIL exports');process.exit(1);}if(g.isEmergency(170000,200000)!==true){console.error('FAIL emergency-at-85');process.exit(2);}if(g.isEmergency(100000,200000)!==false){console.error('FAIL emergency-below-85');process.exit(3);}if(g.isWarning(140000,200000)!==true){console.error('FAIL warning-at-70');process.exit(4);}if(g.computeFraction(0,200000)!==0){console.error('FAIL zero-defensive');process.exit(5);}console.log('PASS');" && test -f .planning/phases/12-machinery/plans/12-03-SUMMARY.md && grep -q "Risk 1" .planning/phases/12-machinery/plans/12-03-SUMMARY.md
    verification_gates:
      - "context-gauge exports typeof === function (all 3) → exit 0"
      - "isEmergency(170000, 200000) === true → exit 0 (0.85 threshold)"
      - "isEmergency(100000, 200000) === false → exit 0 (below threshold)"
      - "isWarning(140000, 200000) === true → exit 0 (0.70 threshold)"
      - "computeFraction(0, 200000) === 0 → exit 0 (defensive)"
      - "12-03-SUMMARY.md records Risk 1 decision → grep exit 0"
    depends_on: [12-03-02]

must_haves:
  truths:
    - "`super-gsd/templates/checkpoint.md` has 4 new frontmatter fields (emergency_halt, approaches_tried_and_abandoned, rules_learned_this_session, dispatches_summary); the 12 existing fields are preserved"
    - "`dispatches_summary` is nested with `by_agent.{executor,verifier,planner,researcher,classifier,code_reviewer}` and `by_outcome.{pass,fail,warn,blocker}` keys, all zero-initialized"
    - "SKILL.md checkpoint_protocol trigger reads `context >=85% OR ((phase_boundary OR plan_boundary) AND context >=70%) OR user says stop` (D-10)"
    - "SKILL.md contains greppable markers: `85%`, `emergency_halt`, `CHECKPOINT_EMERGENCY` (D-11 emergency halt path documented)"
    - "SKILL.md Step 1 READ STATE has self-assess instruction referencing 85% and 70% thresholds"
    - "`super-gsd/scripts/lib/context-gauge.cjs` exists with pure arithmetic exports `{isEmergency, isWarning, computeFraction}` — opt-in mechanical fallback per Risk 1 (Option B alongside Option A)"
    - "context-gauge smoke test: isEmergency(170000, 200000) === true; isEmergency(100000, 200000) === false; isWarning(140000, 200000) === true"
    - "verify.mjs gains invariants 6 (template 3 new fields) and 7 (SKILL.md 85% marker); exit 0 on green"
    - "12-03-SUMMARY.md records Risk 1 decision (Option A primary + Option B opt-in helper) and handoff to plan 12-04"
  artifacts:
    - path: "super-gsd/templates/checkpoint.md"
      provides: "Extended checkpoint schema — 4 new fields per D-09 + D-11"
      contains: "emergency_halt (bool default false), approaches_tried_and_abandoned ([]), rules_learned_this_session ([]), dispatches_summary with by_agent + by_outcome sub-objects"
    - path: "super-gsd/skills/sgsd-orchestrate/SKILL.md"
      provides: "Updated checkpoint_protocol — D-10 trigger + D-11 hard cap + emergency halt path + Step 1 self-assess instruction"
      contains: "greppable markers 85%, emergency_halt, CHECKPOINT_EMERGENCY"
    - path: "super-gsd/scripts/lib/context-gauge.cjs"
      provides: "Opt-in mechanical context-use gauge (Risk 1 Option B) — pure arithmetic, zero deps, ~20 LOC"
      contains: "isEmergency, isWarning, computeFraction; module.exports = { isEmergency, isWarning, computeFraction }"
    - path: ".planning/phases/12-machinery/verify.mjs"
      provides: "Invariants 6 + 7 — template new-fields grep + SKILL.md 85% marker grep"
      contains: "Invariant 6 (checkpoint template 3 D-09 fields), Invariant 7 (SKILL.md 85% hard-cap marker)"
    - path: ".planning/phases/12-machinery/plans/12-03-SUMMARY.md"
      provides: "Plan close: Risk 1 decision record + artefacts + commit SHAs + handoff to 12-04"
      contains: "sections Risk 1 Decision, Artifacts, Commit SHAs, Next"
  key_links:
    - from: "super-gsd/skills/sgsd-orchestrate/SKILL.md"
      to: "super-gsd/templates/checkpoint.md"
      via: "checkpoint_protocol section references the 4 new fields; emergency path writes emergency_halt: true"
      pattern: "emergency_halt"
    - from: ".planning/phases/12-machinery/verify.mjs"
      to: "super-gsd/templates/checkpoint.md"
      via: "Invariant 6 greps the template for 3 new field names"
      pattern: "approaches_tried_and_abandoned"
    - from: ".planning/phases/12-machinery/verify.mjs"
      to: "super-gsd/skills/sgsd-orchestrate/SKILL.md"
      via: "Invariant 7 greps SKILL.md for the 85% hard-cap marker"
      pattern: "85%"
---

# Plan 12-03: Checkpoint Schema + 85% Hard Cap (MACH-03)

## Objective

Expand the checkpoint frontmatter schema with 4 new fields (D-09 + D-11 emergency_halt
marker), update SKILL.md `<checkpoint_protocol>` to use the boundary-AND-70%-OR-85% trigger
(D-10/D-11), and ship an opt-in `context-gauge.cjs` helper so future orchestrator versions
have a mechanical fallback for Risk 1 (Option B). Self-report at 85% (Option A) remains the
primary trigger per research recommendation.

Purpose: Satisfies **MACH-03** per D-09..D-12. Wave 3 of phase 12 — serialized after 12-02
per D-23 (both edit SKILL.md; different sections but merge-safety).

Output: 2 code files (template extension + context-gauge) + 1 SKILL.md section edit +
1 verify.mjs append (Inv 6+7) + 1 SUMMARY. Wave 3 — depends on 12-02.

## Tasks

Task breakdown follows 12-VALIDATION.md (3 tasks: 12-03-01, 12-03-02, 12-03-03). All
contracts in frontmatter above.

### 12-03-01 — Extend `checkpoint.md` template (D-09) + verify.mjs Invariant 6

Append 4 new fields to `super-gsd/templates/checkpoint.md` after line 15 (before
`resume_instruction:`): `emergency_halt` (bool default false), `approaches_tried_and_abandoned`
(empty list), `rules_learned_this_session` (empty list), `dispatches_summary` (nested object
with `by_agent` + `by_outcome` sub-objects, all zero-initialized per D-09). Preserve all
12 existing fields verbatim. Append Invariant 6 to verify.mjs: grep template for all 3 D-09
field names (must return ≥3 matches).

### 12-03-02 — SKILL.md checkpoint_protocol + Step 1 self-assess + verify.mjs Invariant 7

Extend `<checkpoint_protocol>` prose at line 960 per D-10: `context >=85% OR ((phase_boundary
OR plan_boundary) AND context >=70%) OR user says stop`. Add "Emergency halt path" subsection
describing D-11 3-step sequence: (1) write checkpoint with `emergency_halt: true`, (2) log
DEVIATIONS `CHECKPOINT_EMERGENCY: context {N}% at task {id} of plan {id}`, (3) exit text-only.
Add self-assess instruction to Step 1 (READ STATE) referencing both thresholds. Append
Invariant 7 to verify.mjs: grep SKILL.md for `85%` (≥1 match).

### 12-03-03 — Risk 1 opt-in helper (`context-gauge.cjs`) + SUMMARY

Ship the ~20-LOC pure-arithmetic helper `super-gsd/scripts/lib/context-gauge.cjs` exporting
`{isEmergency, isWarning, computeFraction}`. Defaults: 0.85 for emergency, 0.70 for warning.
Zero deps. Future orchestrator versions can consume this for mechanical context tracking;
the runtime in v1.2 continues with self-report (Option A) per Risk 1 recommendation.
Produce 12-03-SUMMARY.md documenting:
- Risk 1 decision: Option A primary + Option B opt-in helper shipped alongside
- Artefacts (template edit, SKILL.md edit, context-gauge.cjs)
- Commit SHAs
- Handoff to 12-04 (Wave 4: adversarial verifier).

## Verification Gates (Wave close)

1. `grep -cE '(approaches_tried_and_abandoned|rules_learned_this_session|dispatches_summary)' super-gsd/templates/checkpoint.md` ≥ 3
2. `grep -q "emergency_halt" super-gsd/templates/checkpoint.md` → exit 0
3. `grep -q "by_agent:" super-gsd/templates/checkpoint.md` → exit 0
4. `grep -q "85%" super-gsd/skills/sgsd-orchestrate/SKILL.md` → exit 0
5. `grep -q "CHECKPOINT_EMERGENCY" super-gsd/skills/sgsd-orchestrate/SKILL.md` → exit 0
6. `grep -q "emergency_halt" super-gsd/skills/sgsd-orchestrate/SKILL.md` → exit 0
7. context-gauge smoke — isEmergency + isWarning + computeFraction all correct → exit 0
8. `test $(grep -cE 'Invariant [67]\b' verify.mjs) -ge 2` → exit 0
9. `node .planning/phases/12-machinery/verify.mjs` → exit 0 (invariants 1-7 green)
10. 12-03-SUMMARY.md records Risk 1 decision → exit 0

## Success Criteria

- Template gains 4 new fields without regressing existing 12 fields.
- SKILL.md checkpoint_protocol trigger matches D-10 shape; emergency halt path documented.
- context-gauge.cjs passes all 5 arithmetic assertions.
- verify.mjs invariants 1-7 all green.
- Plan close SUMMARY records Risk 1 decision with evidence.

## Output

`12-03-SUMMARY.md` with sections: Risk 1 Decision, Artifacts (5 entries), Commit SHAs,
Next. Handoff to 12-04 (adversarial verifier) — note that MACH-04's PASS-WITH-GAPS
verdict will increment `dispatches_summary.by_outcome.warn`, matching the schema shipped
in this plan (ordering rationale per research §Recommended Plan Decomposition).
