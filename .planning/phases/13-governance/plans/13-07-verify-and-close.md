---
phase: 13-governance
plan: 07
type: execute
wave: 6
depends_on:
  - 13-01
  - 13-02
  - 13-03
  - 13-04
  - 13-05
  - 13-06
files_modified:
  - .planning/phases/13-governance/verify.mjs
  - .planning/phases/13-governance/13-SUMMARY.md
  - .planning/phases/13-governance/plans/13-07-SUMMARY.md
autonomous: true
requirements:
  - GOV-01
  - GOV-02
  - GOV-03
  - GOV-04
  - GOV-05
  - GOV-06
  - GOV-07
  - D-16
  - D-18a
  - D-18b
  - D-21

schema_version: 2
expected_ATC_tier: FULL
skip_gates: []
tasks:
  - id: 13-07-01
    agent: gsd-executor
    model: sonnet
    files_touched:
      - .planning/phases/13-governance/verify.mjs
      - .planning/phases/13-governance/13-SUMMARY.md
    input_contract: |
      13-CONTEXT.md D-21 (Phase 13 ships own verify.mjs with >=10 invariants covering GOV-01..07 +
      new skill file + VTP call signature + retro rescore output).
      13-RESEARCH.md §Q9 — 16 enumerated invariants (expanded from floor of 10). All 16 must
      turn green given plans 13-01..13-06 have all committed:
        1. board-members.yaml parses as valid YAML
        2. board-members.yaml board_version == v2-runtime-resolved AND all board_members[].state == active
        3. escalation_policy.default_minimal_board (>=2) + escalate_add (>=1); each escalate_add.when
           parses via vote-predicate.cjs with sample {members, board} ctx
        4. board-registry.cjs exports {loadBoard, getMember, resolveRoster, resetCache}
        5. board-registry.resolveRoster(brief) with no round-1 returns default_minimal + always_present
        6. vote-synthesis.cjs synthesize() on fixture [{A,SUP,3},{B,OPP,2},{C,OPP,3},{D,SUP,4}]
           returns {decision:'SUPPORT', sum:+2, tiebreaker_applied:false}
        7. vote-synthesis.cjs on tie fixture returns {decision:'TIE', tiebreaker_applied:true}
        8. deliberation-schema.cjs validate() on 10-field fixture → valid:true;
           on missing-falsifier → valid:false with 'falsifier' in errors
        9. Each of 4 sgsd-board-*.md files contains all 10 required YAML field names
        10. decision-memo.md template contains ## Falsifier, ## Dead Ends, ## Post-Synthesis Reflection
        11. sgsd-complete-milestone/SKILL.md exists with frontmatter name: sgsd-complete-milestone
            and allowed-tools including mcp__vtp-kb__vtp_ingest_research
        12. sgsd-orchestrate/SKILL.md contains 'all milestone phases' OR 'Step 6.7' marker
        13. sgsd-complete-milestone/SKILL.md has tier-1/2/3 labels OR the 3 classification strings
            (grep for tier-1/tier-2/tier-3 OR classification:"Milestone" + "Milestone (SGSD v2)" + sgsd_type:milestone)
        14. All 6 DLB-0{1..6}-RESCORE.md files exist; each parses; each has frontmatter fields
            original_vote, original_decision, rescored.signed_sum, rescored.new_decision,
            diverges_from_original
        15. sgsd-deliberate/SKILL.md references all 3: board-registry + vote-synthesis + deliberation-schema
        16. sgsd-complete-milestone/SKILL.md contains all 8 step tags step_0_precondition..step_8_state_bump
      Mirror 10-verify.mjs + 12-verify.mjs patterns:
        - ESM script (.mjs), node builtin assert + child_process.execSync
        - createRequire for js-yaml via path.resolve to super-gsd/tools/plan-schema/node_modules/js-yaml
        - fail(n, msg) helper; exit code matches invariant number on first failure; exit 0 on all-PASS
      Full-suite close: verify Phase 09 + Phase 10 + Phase 12 + Phase 13 verify.mjs all exit 0
      (research §Q10 full-suite command).
      Also: write Phase 13 SUMMARY.md once verify.mjs is green.
    output_contract: |
      `.planning/phases/13-governance/verify.mjs` exists as an ESM script (~200 LOC).
      Imports: `createRequire`, `path`, `fs`, `assert`, `child_process.execSync`.
      Loads js-yaml via `require(path.resolve('super-gsd','tools','plan-schema','node_modules','js-yaml'))`.
      Implements all 16 invariants from §Q9 with exit code matching invariant number (1-16) on
      first failure. Each invariant preceded by a `// Invariant N: description` comment so
      `grep -c "Invariant [0-9]"` returns >= 16.
      `fail(n, msg)` helper: logs `FAIL inv${n}: ${msg}` to stderr and `process.exit(n)`.
      `console.log('PASS Phase 13 (16/16 invariants green)')` on success; process.exit(0).
      Additionally, `.planning/phases/13-governance/13-SUMMARY.md` is created with:
        - Frontmatter: phase, slug, status (complete), milestones_version, last_updated
        - ## Shipped — bullet list of 7 plans with one-liner each
        - ## Evidence — verify.mjs exit (0), invariants count (16/16), retro divergence_count
        - ## Files Created/Modified — master list
        - ## Dependencies Satisfied — GOV-01..07 + D-16/18a/18b mapped to plans
        - ## Milestone v1.2 Close Readiness — phase 13 final phase of v1.2; orchestrator auto-trigger armed
        - ## Next Steps — "After this phase closes, sgsd-orchestrate Step 6.7 auto-triggers sgsd-complete-milestone"
      Full-suite close command documented in SUMMARY.md: `for p in 09-atc-147-evidence
      10-gate-policy 12-machinery 13-governance; do node .planning/phases/$p/verify.mjs || exit $?; done`
      MUST exit 0 before SUMMARY is committed.
    hypothesis: |
      Single consolidated task because verify.mjs is composed of 16 invariants that all need
      the prior 6 plans' artefacts to exist — this task runs LAST, reads every artifact built
      in the phase, and produces the definitive phase-done signal. SUMMARY.md authoring is
      coupled to verify.mjs green (authoring-before-green risks a SUMMARY.md that claims
      completion when an invariant still fails).
      Consolidated-task approach matches the 13-VALIDATION.md structure (task 13-07-01 is
      "consolidate verify.mjs with all 16 invariants + full-suite green check + Phase 13 SUMMARY").
    falsifier: |
      (a) `grep -c "Invariant [0-9]" verify.mjs` < 16.
      (b) verify.mjs exits 0 while ANY of 16 invariants is actually red (false-positive pass).
      (c) verify.mjs uses bare `require('js-yaml')` instead of createRequire pattern.
      (d) Full-suite command (09+10+12+13) does NOT all exit 0 after this task commits.
      (e) SUMMARY.md claims completion while verify.mjs exit != 0.
      (f) Invariant 14 (6 RESCORE files) implementation doesn't call into the committed
      RESCORE files (e.g., hardcodes PASS).
      (g) Exit-code scheme doesn't match invariant numbers (invariant-5 failure exits 3, etc.).
    stop_rule: |
      verify.mjs exists; `grep -c "Invariant [0-9]" verify.mjs` >= 16;
      `node .planning/phases/13-governance/verify.mjs` exits 0;
      full-suite loop `for p in 09-atc-147-evidence 10-gate-policy 12-machinery 13-governance;
      do node .planning/phases/$p/verify.mjs || exit $?; done` exits 0;
      13-SUMMARY.md exists with status: complete frontmatter; all 16 invariants logged as green
      in SUMMARY.md.
    verification_cmd: |
      test -f .planning/phases/13-governance/verify.mjs && \
      test "$(grep -cE 'Invariant [0-9]' .planning/phases/13-governance/verify.mjs)" -ge 16 && \
      node .planning/phases/13-governance/verify.mjs && \
      for p in 09-atc-147-evidence 10-gate-policy 12-machinery 13-governance; do node .planning/phases/$p/verify.mjs || exit $?; done && \
      test -f .planning/phases/13-governance/13-SUMMARY.md && \
      grep -q "status: complete" .planning/phases/13-governance/13-SUMMARY.md
    verification_gates:
      - "verify.mjs file exists → exit 0"
      - "16 invariant markers present → exit 0"
      - "Phase 13 verify.mjs → exit 0"
      - "Full suite (09+10+12+13) all exit 0"
      - "13-SUMMARY.md exists with status: complete → exit 0"

must_haves:
  truths:
    - "`.planning/phases/13-governance/verify.mjs` exists as ESM script with 16 invariants"
    - "verify.mjs exit code matches invariant number on failure (1-16); exit 0 on all-PASS"
    - "verify.mjs uses js-yaml via Phase 10 createRequire pattern (no bare require)"
    - "`node .planning/phases/13-governance/verify.mjs` exits 0"
    - "Full-suite check: Phase 09, 10, 12, 13 verify.mjs all exit 0"
    - "`.planning/phases/13-governance/13-SUMMARY.md` exists with status: complete"
    - "13-SUMMARY.md documents GOV-01..07 + D-16/18a/18b → plan mapping"
    - "13-SUMMARY.md notes milestone v1.2 orchestrator auto-trigger armed per D-18a"
    - "All 16 invariants from 13-RESEARCH.md §Q9 green post-commit"
  artifacts:
    - path: ".planning/phases/13-governance/verify.mjs"
      provides: "Phase 13 mechanical verifier — 16 invariants covering GOV-01..07 + D-16/18a/18b + retro rescore"
      contains: "Invariant 1..16 markers; fail(n, msg) helper; createRequire js-yaml; exit code == invariant number on failure"
      min_lines: 150
    - path: ".planning/phases/13-governance/13-SUMMARY.md"
      provides: "Phase 13 closure summary with dependency trace and milestone readiness"
      contains: "status: complete frontmatter; ## Shipped (7 plans); ## Evidence (16/16 invariants); GOV-01..07 trace; D-16/18a/18b trace; auto-trigger readiness note"
  key_links:
    - from: ".planning/phases/13-governance/verify.mjs"
      to: "super-gsd/registry/board-members.yaml"
      via: "invariants 1-3: yaml.load + state/escalation checks"
      pattern: "registry/board-members\\.yaml"
    - from: ".planning/phases/13-governance/verify.mjs"
      to: "super-gsd/scripts/lib/vote-predicate.cjs"
      via: "invariant 3: require + evalVotePredicate on each escalate_add.when"
      pattern: "vote-predicate\\.cjs"
    - from: ".planning/phases/13-governance/verify.mjs"
      to: "super-gsd/scripts/lib/board-registry.cjs"
      via: "invariants 4-5: require + fn-export + resolveRoster fixture"
      pattern: "board-registry\\.cjs"
    - from: ".planning/phases/13-governance/verify.mjs"
      to: "super-gsd/scripts/lib/vote-synthesis.cjs"
      via: "invariants 6-7: require + synthesize fixture + tie fixture"
      pattern: "vote-synthesis\\.cjs"
    - from: ".planning/phases/13-governance/verify.mjs"
      to: "super-gsd/scripts/lib/deliberation-schema.cjs"
      via: "invariant 8: require + validate on good/bad fixtures"
      pattern: "deliberation-schema\\.cjs"
    - from: ".planning/phases/13-governance/verify.mjs"
      to: "super-gsd/agents/sgsd-board-*.md"
      via: "invariant 9: grep all 10 field names in each of 4 files"
      pattern: "sgsd-board-"
    - from: ".planning/phases/13-governance/verify.mjs"
      to: "super-gsd/templates/decision-memo.md"
      via: "invariant 10: grep 3 section headers"
      pattern: "decision-memo\\.md"
    - from: ".planning/phases/13-governance/verify.mjs"
      to: "super-gsd/skills/sgsd-complete-milestone/SKILL.md"
      via: "invariants 11, 13, 16: frontmatter + tier labels + step tags"
      pattern: "sgsd-complete-milestone"
    - from: ".planning/phases/13-governance/verify.mjs"
      to: "super-gsd/skills/sgsd-orchestrate/SKILL.md"
      via: "invariant 12: grep Step 6.7 marker"
      pattern: "sgsd-orchestrate"
    - from: ".planning/phases/13-governance/verify.mjs"
      to: ".planning/decisions/DLB-01..06-RESCORE.md"
      via: "invariant 14: loop read 6 files, check frontmatter fields"
      pattern: "DLB-0[1-6]-RESCORE"
    - from: ".planning/phases/13-governance/verify.mjs"
      to: "super-gsd/skills/sgsd-deliberate/SKILL.md"
      via: "invariant 15: grep all 3 module references"
      pattern: "sgsd-deliberate"
---

# Plan 13-07: Phase 13 verify.mjs + Full-Suite Close + SUMMARY

## Objective

Author `.planning/phases/13-governance/verify.mjs` with all 16 invariants from
13-RESEARCH.md §Q9 (expanded from D-21's >=10 floor), run the full-suite close command
across Phase 09, 10, 12, 13 verifiers, and write Phase 13 SUMMARY.md. Every invariant
maps to a specific plan's artefact; all 16 must exit 0 for the phase to be considered
complete.

Purpose: Satisfies **D-21** (verify.mjs ≥10 invariants — exceeded at 16) and closes Phase 13
with the full-suite exit-0 check. This phase is the FINAL phase of milestone v1.2; once
this plan commits and verify.mjs + full-suite both exit 0, sgsd-orchestrate Step 6.7
(shipped in plan 13-05) will auto-detect "all milestone phases [x]" and auto-dispatch
sgsd-complete-milestone per D-18a — the final demonstration of the governance loop closing
on itself.

Output: 2 files — `verify.mjs` (~150-200 LOC with 16 numbered invariants) and `13-SUMMARY.md`
(phase closure document).

Wave 6 — serial after ALL prior waves. Depends on 13-01, 13-02, 13-03, 13-04, 13-05, 13-06
because each invariant reads artefacts from those plans.

## Tasks

Single consolidated task per 13-VALIDATION.md 13-07-01 ("consolidate verify.mjs with all 16
invariants + full-suite green check + Phase 13 SUMMARY"). All contracts, hypotheses,
falsifiers, stop rules live in the frontmatter above — canonical executor contract.

### 13-07-01 — Author verify.mjs + Full-Suite Check + SUMMARY.md

Single task, three sub-deliverables:

**Deliverable A: `verify.mjs`** — ESM script, ~150-200 LOC. Mirror of Phase 10's
`.planning/phases/10-gate-policy/verify.mjs` pattern:
- `import { createRequire } from 'node:module';` + createRequire path-resolve js-yaml
- `import { execSync } from 'node:child_process'`, `import fs from 'node:fs'`
- `function fail(n, msg) { console.error(`FAIL inv${n}: ${msg}`); process.exit(n); }`
- 16 numbered invariants in order (`// Invariant 1: ...` through `// Invariant 16: ...`)
- First-failure exit-code-matches-invariant-number; all-PASS exits 0 with success log

Invariant implementation details per research §Q9:
- Invariants 1-5: YAML parse + board_version/state flags + escalate_add.when parse via
  vote-predicate; board-registry.cjs require + fn-export check + resolveRoster minimal fixture
- Invariants 6-7: synthesize fixture (SUPPORT +2) + tie fixture
- Invariant 8: deliberation-schema.validate on good/bad YAML
- Invariant 9: loop 4 agent files, grep 10 field names × 4 files
- Invariant 10: grep 3 section headers in decision-memo.md
- Invariants 11-13, 16: grep SKILL.md files (sgsd-complete-milestone, sgsd-orchestrate)
- Invariant 14: loop DLB-01..06-RESCORE.md, parse frontmatter, check fields
- Invariant 15: grep sgsd-deliberate/SKILL.md for 3 module names

**Deliverable B: Full-suite check** — execute inline during task verification:
`for p in 09-atc-147-evidence 10-gate-policy 12-machinery 13-governance; do
 node .planning/phases/$p/verify.mjs || exit $?; done` — must exit 0.

**Deliverable C: `13-SUMMARY.md`** — phase closure document. Only authored AFTER verify.mjs
exits 0. Sections: Shipped (7 plans one-liners), Evidence (16/16 invariants green +
divergence_count from 13-06), Files Created/Modified master list, Dependencies Satisfied
(GOV-01..07 + D-16/18a/18b → plan mapping), Milestone v1.2 Close Readiness (auto-trigger
armed per D-18a), Next Steps (orchestrator auto-trigger fires).

## Verification Gates (Wave close)

Run in sequence:

1. `test -f .planning/phases/13-governance/verify.mjs` → exit 0
2. `grep -cE "Invariant [0-9]" verify.mjs >= 16` → exit 0
3. `node .planning/phases/13-governance/verify.mjs` → exit 0 (all 16 invariants green)
4. Full-suite loop (09+10+12+13) → all exit 0
5. `test -f .planning/phases/13-governance/13-SUMMARY.md` → exit 0
6. `grep -q "status: complete" 13-SUMMARY.md` → exit 0

## Success Criteria

- verify.mjs exists with 16 numbered invariants.
- Phase 13 verify.mjs exits 0.
- Full suite (09+10+12+13) all exit 0.
- 13-SUMMARY.md exists with status: complete frontmatter.
- GOV-01 through GOV-07 + D-16/18a/18b are mapped in SUMMARY.md to their implementing plans.
- ROADMAP.md Phase 13 row can be marked [x] after this plan's commit (orchestrator will do
  this in its Step 6.6.i; this plan does NOT modify ROADMAP.md to avoid racing the orchestrator).

## Output

After completion, create `.planning/phases/13-governance/plans/13-07-SUMMARY.md` summarising:
- verify.mjs LOC + invariant count (16)
- Full-suite results (09/10/12/13 all green)
- 13-SUMMARY.md size + section list
- Divergence count from 13-06 propagated into SUMMARY
- 1 commit SHA
- NOTE: upon next orchestrator loop iteration, Step 6.6.i marks Phase 13 [x]; Step 6.7
  then detects all milestone phases [x] and auto-dispatches sgsd-complete-milestone v1.2
  per D-18a. This plan's exit IS the milestone auto-trigger fire condition.
