---
phase: 13-governance
plan: 02
type: execute
wave: 3
depends_on:
  - 13-01
files_modified:
  - super-gsd/scripts/lib/vote-synthesis.cjs
  - super-gsd/skills/sgsd-deliberate/SKILL.md
  - .planning/phases/13-governance/plans/13-02-SUMMARY.md
autonomous: true
requirements:
  - GOV-02

schema_version: 2
expected_ATC_tier: LITE
skip_gates: []
tasks:
  - id: 13-02-01
    agent: gsd-executor
    model: sonnet
    files_touched:
      - super-gsd/scripts/lib/vote-synthesis.cjs
    input_contract: |
      13-CONTEXT.md D-03, D-04 (signed-sum formula: SUPPORT=+conf, OPPOSE=-conf, ABSTAIN=0;
      sum>0 → SUPPORT, sum<0 → OPPOSE, sum==0 → TIE with tiebreaker_applied: true).
      D-04: `super-gsd/scripts/lib/vote-synthesis.cjs` exposes pure function `synthesize(members)`
      → `{decision, sum, tiebreaker_applied, raw_votes}`. ~40 LOC. No deps.
      13-RESEARCH.md §Q3 reference implementation (inline in research — clone verbatim):
        ```
        function synthesize(members) {
          const raw_votes = members.map(m => ({role: m.role, position: m.position, confidence: m.confidence}));
          let sum = 0;
          for (const m of members) {
            if (m.position === 'SUPPORT') sum += m.confidence;
            else if (m.position === 'OPPOSE') sum -= m.confidence;
            // ABSTAIN contributes 0
          }
          let decision, tiebreaker_applied = false;
          if (sum > 0) decision = 'SUPPORT';
          else if (sum < 0) decision = 'OPPOSE';
          else { decision = 'TIE'; tiebreaker_applied = true; }
          return { decision, sum, tiebreaker_applied, raw_votes };
        }
        ```
      Invariants 6 and 7 from 13-RESEARCH.md §Q9:
        6. fixture `[{role:'Architect',position:SUPPORT,confidence:3},{role:'Contrarian',position:OPPOSE,confidence:2},{role:'Moonshot',position:OPPOSE,confidence:3},{role:'Pragmatist',position:SUPPORT,confidence:4}]`
           → `{decision:'SUPPORT', sum:+2, tiebreaker_applied:false}` (+3+4-2-3 = +2)
        7. tie fixture (sum==0) → `{decision:'TIE', tiebreaker_applied:true}`
    output_contract: |
      `super-gsd/scripts/lib/vote-synthesis.cjs` exists as a CJS module (~40-50 LOC with JSDoc).
      Exports exactly `{ synthesize }`. Zero runtime deps.
      Returns object shape `{decision: 'SUPPORT'|'OPPOSE'|'TIE', sum: number,
                              tiebreaker_applied: boolean, raw_votes: array}`.
      Pure function — stateless, idempotent, no I/O.
      Accepts `members` as array of `{role, position, confidence}` (extra fields tolerated
      but not required).
      Unknown `position` values (not in SUPPORT|OPPOSE|ABSTAIN) silently contribute 0 to sum
      AND still appear in raw_votes (tolerance chosen because schema validation happens at
      deliberation-schema.cjs layer in plan 13-03, not here).
    hypothesis: |
      Pure-function shape from research §Q3 is directly transcribable and verifiable by one-line
      node -e checks. 40 LOC is the right size for a unit that needs to be trivially auditable
      — the ATC gate on a 40-LOC pure function is a sanity check, not a review burden.
      Tolerance on unknown position values keeps this module orthogonal to deliberation-schema.cjs
      validation (13-03) — each module has a single responsibility per Phase 10 D-10c principles.
    falsifier: |
      (a) ABSTAIN contributes non-zero to sum (D-03 says 0).
      (b) sum==0 returns decision other than 'TIE' or tiebreaker_applied != true (D-03 + D-03a).
      (c) Module has any `require(...)` runtime dep.
      (d) raw_votes missing from return object (D-04 contract violation).
      (e) Mutates its input `members` array (pure-function violation).
      (f) Returns a sum that differs from the arithmetic sum on any test fixture.
    stop_rule: |
      File exists; `synthesize([{role:'A',position:'SUPPORT',confidence:3},
      {role:'B',position:'OPPOSE',confidence:2},{role:'C',position:'OPPOSE',confidence:3},
      {role:'D',position:'SUPPORT',confidence:4}])` returns `{decision:'SUPPORT', sum:2,
      tiebreaker_applied:false, raw_votes: [array of 4]}`; tie-fixture returns
      `{decision:'TIE', tiebreaker_applied:true}`.
    verification_cmd: |
      node -e "const v=require('./super-gsd/scripts/lib/vote-synthesis.cjs');const r=v.synthesize([{role:'A',position:'SUPPORT',confidence:3},{role:'B',position:'OPPOSE',confidence:2},{role:'C',position:'OPPOSE',confidence:3},{role:'D',position:'SUPPORT',confidence:4}]);if(r.decision!=='SUPPORT'||r.sum!==2||r.tiebreaker_applied!==false){console.error('FAIL inv6',JSON.stringify(r));process.exit(1);}if(!Array.isArray(r.raw_votes)||r.raw_votes.length!==4){console.error('FAIL raw_votes');process.exit(2);}const abstain=v.synthesize([{role:'X',position:'ABSTAIN',confidence:5}]);if(abstain.sum!==0){console.error('FAIL abstain');process.exit(3);}console.log('PASS');"
    verification_gates:
      - "invariant 6 fixture → SUPPORT sum=+2 tiebreaker=false → exit 0"
      - "raw_votes array of 4 → exit 0"
      - "ABSTAIN contributes 0 → exit 0"

  - id: 13-02-02
    agent: gsd-executor
    model: sonnet
    files_touched:
      - super-gsd/scripts/lib/vote-synthesis.cjs
    input_contract: |
      13-CONTEXT.md D-03a (ties noted as VOTE_TIE in memo header; tiebreaker_applied logged
      separately from raw tally). This task adds a 2-line test fixture EXERCISE to the module
      — NOT a code change. Specifically: add a commented `// @example` JSDoc block demonstrating
      the tie edge case so the module's own source documents the invariant-7 contract.
      Alternative: if module already has full JSDoc from 13-02-01, this task's falsifier-level
      verification is simply running the tie-fixture through the deployed function.
      Net goal of 13-02-02 per 13-VALIDATION.md: prove invariant 7 (sum==0 → TIE,
      tiebreaker_applied:true) holds with a FRESH tie fixture that the previous task's
      verification_cmd did not exercise.
      Invariant 7 fixture (from 13-RESEARCH.md §Q9): `[{position:'SUPPORT',confidence:3},
      {position:'OPPOSE',confidence:3}]` → sum=0, decision='TIE', tiebreaker_applied: true.
    output_contract: |
      `super-gsd/scripts/lib/vote-synthesis.cjs` JSDoc block near the `synthesize` function
      includes at least one `@example` line showing the tie case (input + expected output).
      No function-body changes from 13-02-01.
      If 13-02-01 already shipped the full JSDoc with @example, this task is a no-op code-wise
      but still runs its verification_cmd to prove invariant 7 holds on the committed module.
      (Executor may choose to commit a trivial doc-only edit such as adding `// Tie path
      documented in @example above` comment — the commit is intentional to keep the task
      atomic even when its code delta is zero.)
    hypothesis: |
      Splitting tie-case proof from main-case proof prevents both fixtures getting merged into
      a single monolithic test + lets invariant 7 go green independently of invariant 6. The
      edge case is where formula calibration concern (D-05b) lives — isolating it as its own
      task creates a clean anchor for future operator debug.
    falsifier: |
      (a) Tie-fixture `[{position:SUPPORT,confidence:3},{position:OPPOSE,confidence:3}]`
      does NOT return `{decision:'TIE', tiebreaker_applied:true}`.
      (b) `synthesize([])` (empty members array) throws instead of returning
      `{decision:'TIE',sum:0,tiebreaker_applied:true,raw_votes:[]}` (empty = tie by default).
      (c) JSDoc @example missing — minor falsifier; invariant 7 grep is behavior-only so (a)/(b)
      dominate.
    stop_rule: |
      Fresh tie fixture returns TIE + tiebreaker_applied=true. Empty-array input returns
      TIE with sum=0 (edge case for "no members voted").
    verification_cmd: |
      node -e "const v=require('./super-gsd/scripts/lib/vote-synthesis.cjs');const tie=v.synthesize([{role:'A',position:'SUPPORT',confidence:3},{role:'B',position:'OPPOSE',confidence:3}]);if(tie.decision!=='TIE'||tie.tiebreaker_applied!==true||tie.sum!==0){console.error('FAIL tie',JSON.stringify(tie));process.exit(1);}const empty=v.synthesize([]);if(empty.decision!=='TIE'||empty.sum!==0){console.error('FAIL empty',JSON.stringify(empty));process.exit(2);}const allOppose=v.synthesize([{role:'A',position:'OPPOSE',confidence:5},{role:'B',position:'OPPOSE',confidence:4}]);if(allOppose.decision!=='OPPOSE'||allOppose.sum!==-9){console.error('FAIL oppose',JSON.stringify(allOppose));process.exit(3);}console.log('PASS');"
    verification_gates:
      - "tie fixture → TIE + tiebreaker_applied=true → exit 0"
      - "empty members array → TIE sum=0 → exit 0"
      - "all OPPOSE → OPPOSE negative sum → exit 0"
    depends_on: [13-02-01]

  - id: 13-02-03
    agent: gsd-executor
    model: sonnet
    files_touched:
      - super-gsd/skills/sgsd-deliberate/SKILL.md
    input_contract: |
      13-CONTEXT.md D-04 (CEO synthesis in sgsd-deliberate SKILL.md integrates the helper).
      13-RESEARCH.md §Q3 integration point: at the TOP of `<step_5_synthesize>` block
      (currently line 157-189 in pre-13-01 SKILL.md, but 13-01 added Step 2.5 so line numbers
      shift — the step tag is the stable anchor).
      Add before the existing memo-write block:
        ```
        const voteSynth = require('super-gsd/scripts/lib/vote-synthesis.cjs');
        const { decision, sum, tiebreaker_applied, raw_votes } = voteSynth.synthesize(round2Results);
        ```
      And update the memo frontmatter YAML block within Step 5 to include:
        `signed_sum: {sum}`
        `tiebreaker_applied: {bool}`
        `raw_votes: {raw_votes}`
        Keep existing `vote:` prose field but REFORMAT to include signed sum: e.g.,
        `vote: "{sum:+}/{maxPossible} — {decision}"   # e.g. "+7/20 — SUPPORT"`
      When `tiebreaker_applied === true`, the memo MUST include a "Tiebreak Rationale" section
      (new) between Board Stances and Unresolved Tensions — add that as an if-block instruction
      in the prose of Step 5.
      Invariant 15 from 13-RESEARCH.md §Q9: SKILL.md references `vote-synthesis`.
    output_contract: |
      `super-gsd/skills/sgsd-deliberate/SKILL.md` `<step_5_synthesize>` block updated:
      - Top of block has a code example showing `const voteSynth = require('super-gsd/scripts/lib/vote-synthesis.cjs');`
        and the destructured call returning {decision, sum, tiebreaker_applied, raw_votes}.
      - Frontmatter YAML block within Step 5 lists the 4 new fields (vote reformatted,
        signed_sum, tiebreaker_applied, raw_votes). When `tiebreaker_applied === true`,
        the `vote:` field includes the literal string `VOTE_TIE`.
      - Prose includes conditional: "When tiebreaker_applied === true, write a `## Tiebreak
        Rationale` section explaining CEO's tie-breaking reasoning per D-03a."
      - Literal string `vote-synthesis` appears in the file (invariant 15 anchor).
      No other steps modified. Preserve all 13-01's edits (Step 2.5, Step 3 loop, Step 4
      resolveRoster 2-arg).
    hypothesis: |
      Mechanical edit at a single XML anchor (<step_5_synthesize>). No runtime risk because
      SKILL.md prose is descriptive — the require() line appears as a code example, not
      executable from the SKILL.md itself. The frontmatter schema extension (signed_sum,
      tiebreaker_applied, raw_votes) is additive; existing consumer (the memo-gen inside
      CEO's synthesis) honours the added fields. Tiebreak rationale section is conditional
      — only fires when sum==0, preserving existing 4-vote decisive-outcome memos unchanged.
    falsifier: |
      (a) File missing `vote-synthesis` string (invariant 15 fails).
      (b) Step 5 block missing `signed_sum:` frontmatter field instruction.
      (c) Tiebreak Rationale prose missing — CEO won't emit the section on tie outcomes,
      D-03a violated.
      (d) Step 5's existing `vote:` field replaced (must keep, just reformatted to include
      signed sum).
      (e) Plan 13-01's Step 2.5 / Step 3 / Step 4 edits removed (regression).
    stop_rule: |
      `grep -q "vote-synthesis" SKILL.md` succeeds; `grep -q "signed_sum" SKILL.md` succeeds;
      `grep -q "tiebreaker_applied" SKILL.md` succeeds; `grep -q "Tiebreak Rationale" SKILL.md`
      succeeds; `<step_2_5_roster>` and `resolveRoster(brief, round1Results)` still present
      (13-01 edits preserved).
    verification_cmd: |
      grep -q "vote-synthesis" super-gsd/skills/sgsd-deliberate/SKILL.md && \
      grep -q "signed_sum" super-gsd/skills/sgsd-deliberate/SKILL.md && \
      grep -q "tiebreaker_applied" super-gsd/skills/sgsd-deliberate/SKILL.md && \
      grep -q "VOTE_TIE" super-gsd/skills/sgsd-deliberate/SKILL.md && \
      grep -q "Tiebreak Rationale" super-gsd/skills/sgsd-deliberate/SKILL.md && \
      grep -q "<step_2_5_roster>" super-gsd/skills/sgsd-deliberate/SKILL.md && \
      grep -q "resolveRoster(brief, round1Results)" super-gsd/skills/sgsd-deliberate/SKILL.md
    verification_gates:
      - "'vote-synthesis' anchor (invariant 15) → exit 0"
      - "signed_sum frontmatter field → exit 0"
      - "tiebreaker_applied field → exit 0"
      - "Tiebreak Rationale conditional section → exit 0"
      - "13-01 <step_2_5_roster> preserved → exit 0"
      - "13-01 2-arg resolveRoster preserved → exit 0"
    depends_on: [13-02-01]

must_haves:
  truths:
    - "`vote-synthesis.cjs` exports pure `synthesize(members)` returning {decision, sum, tiebreaker_applied, raw_votes}"
    - "SUPPORT contributes +confidence, OPPOSE contributes -confidence, ABSTAIN contributes 0 (D-03)"
    - "sum > 0 → decision 'SUPPORT'; sum < 0 → 'OPPOSE'; sum == 0 → 'TIE' with tiebreaker_applied: true (D-03, D-03a)"
    - "Module is pure (zero deps, idempotent, no I/O, no input mutation)"
    - "Empty members array returns `{decision:'TIE', sum:0, tiebreaker_applied:true, raw_votes:[]}` (graceful edge)"
    - "sgsd-deliberate SKILL.md Step 5 references `vote-synthesis` (invariant 15 anchor)"
    - "sgsd-deliberate SKILL.md Step 5 frontmatter block includes signed_sum, tiebreaker_applied, raw_votes"
    - "sgsd-deliberate SKILL.md Step 5 conditionally instructs 'Tiebreak Rationale' section when tie"
    - "Plan 13-01's SKILL.md edits preserved (<step_2_5_roster>, 2-arg resolveRoster)"
  artifacts:
    - path: "super-gsd/scripts/lib/vote-synthesis.cjs"
      provides: "Pure signed-sum synthesis function per D-03/D-04"
      contains: "synthesize(members) → {decision, sum, tiebreaker_applied, raw_votes}; module.exports = { synthesize }"
      min_lines: 40
    - path: "super-gsd/skills/sgsd-deliberate/SKILL.md"
      provides: "Updated Step 5 with vote-synthesis integration + tiebreak rationale"
      contains: "vote-synthesis require; signed_sum/tiebreaker_applied/raw_votes frontmatter; Tiebreak Rationale conditional"
  key_links:
    - from: "super-gsd/skills/sgsd-deliberate/SKILL.md"
      to: "super-gsd/scripts/lib/vote-synthesis.cjs"
      via: "Step 5 code example: require('super-gsd/scripts/lib/vote-synthesis.cjs')"
      pattern: "vote-synthesis"
---

# Plan 13-02: Signed-Sum Vote Synthesis + SKILL.md Step 5 Integration

## Objective

Ship `vote-synthesis.cjs` — a pure ~40-LOC function implementing the D-03 signed-sum formula
(SUPPORT=+conf, OPPOSE=-conf, ABSTAIN=0; decision by sign with D-03a tie-breaker rationale)
— and wire it into `sgsd-deliberate/SKILL.md` Step 5 so CEO synthesis produces
confidence-weighted decisions with numeric auditability instead of prose vote summaries.

Purpose: Satisfies **GOV-02** (confidence-weighted vote synthesis per D-03, D-03a, D-04).
Retroactive rescore validation (D-05) ships in plan 13-06; this plan delivers the formula
the rescore consumes.

Output: 2 files — `super-gsd/scripts/lib/vote-synthesis.cjs` (new, ~40-50 LOC), and
`sgsd-deliberate/SKILL.md` Step 5 edits (code example + 3 new frontmatter fields + Tiebreak
Rationale conditional).

Wave 3 — serial after Wave 2 {13-01}. SKILL.md overlap: 13-01 edited Steps 2.5/3/4;
13-02 edits Step 5. Both share the file so waves serialize per the 6-wave split-13-04 model.
13-02 must preserve all 13-01 edits intact.

## Tasks

Task breakdown follows 13-VALIDATION.md tasks 13-02-01 through 13-02-03. All contracts,
hypotheses, falsifiers, stop rules live in the frontmatter above — canonical executor contract.

### 13-02-01 — `vote-synthesis.cjs`

Pure function per research §Q3 reference implementation. ~40-50 LOC including JSDoc. Zero
deps. SUPPORT +=confidence, OPPOSE -=confidence, ABSTAIN += 0. Decision by sum sign;
tie → `{decision: 'TIE', tiebreaker_applied: true}`. raw_votes mirrors input as
`{role, position, confidence}` projection.

### 13-02-02 — Tie-case edge proof

Prove invariant 7 (sum==0 → TIE, tiebreaker_applied: true) holds on a fresh tie fixture
that 13-02-01's verification_cmd didn't exercise. Also verifies empty-members array
(graceful TIE sum=0) and all-OPPOSE case (negative sum → OPPOSE). Documentation-level
work (@example JSDoc); code-delta may be zero if 13-02-01 already shipped full JSDoc
— the task still commits intentionally to keep task atomicity.

### 13-02-03 — SKILL.md Step 5 Integration

Add `require('super-gsd/scripts/lib/vote-synthesis.cjs')` + destructured synthesize call
at the TOP of `<step_5_synthesize>` block. Extend the in-step frontmatter YAML example
with `signed_sum`, `tiebreaker_applied`, `raw_votes` fields. Reformat existing `vote:`
prose field to include the signed sum (e.g., `"+7/20 — SUPPORT"`). Add conditional prose
instruction: when `tiebreaker_applied === true`, CEO writes `## Tiebreak Rationale`
section between Board Stances and Unresolved Tensions per D-03a. All 13-01 edits
(`<step_2_5_roster>`, Step 3 loop, Step 4 2-arg resolveRoster) preserved.

## Verification Gates (Wave close)

Run in sequence:

1. invariant-6 fixture synthesize returns SUPPORT sum=+2 tiebreaker=false → exit 0
2. invariant-7 tie fixture returns TIE tiebreaker=true → exit 0
3. Empty members array returns TIE sum=0 → exit 0
4. SKILL.md grep anchors: `vote-synthesis`, `signed_sum`, `tiebreaker_applied`, `Tiebreak Rationale` → all exit 0
5. SKILL.md 13-01 preservation: `<step_2_5_roster>` + `resolveRoster(brief, round1Results)` → all exit 0

## Success Criteria

- Both files exist at declared paths.
- All 3 task verification_cmds exit 0.
- Invariants 6, 7, 15 in Phase 13 verify.mjs go GREEN after this plan's commits land.
- Plan 13-01's SKILL.md edits are preserved byte-for-byte (no regression).

## Output

After completion, create `.planning/phases/13-governance/plans/13-02-SUMMARY.md` summarising:
- 2 files modified (vote-synthesis.cjs ~45 LOC, SKILL.md +~25 lines at Step 5)
- Confirmation of 13-01 edit preservation
- Which invariants (6, 7, 15) turn green
- 3 commit SHAs
