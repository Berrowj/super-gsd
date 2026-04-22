---
phase: 13-governance
plan: 06
type: execute
wave: 5
depends_on:
  - 13-02
  - 13-03
files_modified:
  - .planning/decisions/DLB-01-RESCORE.md
  - .planning/decisions/DLB-02-RESCORE.md
  - .planning/decisions/DLB-03-RESCORE.md
  - .planning/decisions/DLB-04-RESCORE.md
  - .planning/decisions/DLB-05-RESCORE.md
  - .planning/decisions/DLB-06-RESCORE.md
  - .planning/phases/13-governance/13-05b-calibration-concern.md
  - .planning/phases/13-governance/plans/13-06-SUMMARY.md
autonomous: true
requirements:
  - GOV-02
  - D-05
  - D-05a
  - D-05b

schema_version: 2
expected_ATC_tier: FULL
skip_gates: []
tasks:
  - id: 13-06-01
    agent: gsd-executor
    model: sonnet
    files_touched:
      - .planning/decisions/DLB-01-RESCORE.md
    input_contract: |
      13-CONTEXT.md D-05 (re-dispatch each board agent on ORIGINAL brief of DLB with new rubric)
      + D-05a (rescore YAML schema locked).
      DLB-01 brief per research §Q8: `.planning/briefs/2026-04-19-memory-topology.md` (50+ lines,
      full Situation/Stakes/Constraints/Key Questions).
      Per-DLB task pattern (research §Q8 Option B — 6 serial tasks × 4 parallel agents each,
      leveraging Phase 12 PARALLEL_CONFIRMED):
        1. Read `.planning/decisions/DLB-01-memory-topology.md` frontmatter for brief path
           + original vote/decision fields
        2. Read `.planning/briefs/2026-04-19-memory-topology.md` (original brief)
        3. Fan out 4 parallel Agent() dispatches with run_in_background: true:
           - Agent(subagent_type: sgsd-board-architect, model: sonnet,
                   prompt: "BRIEF: {full brief}\\nEmit the 10-field YAML response per your
                            updated Output Format. Self-rate 1-5 confidence per D-03.")
           - Agent(subagent_type: sgsd-board-contrarian, ...)
           - Agent(subagent_type: sgsd-board-pragmatist, ...)
           - Agent(subagent_type: sgsd-board-moonshot, ...)
        4. Await all 4; parse each YAML via deliberation-schema.cjs validate()
        5. Call vote-synthesis.cjs synthesize(parsedResponses) → {decision, sum, tiebreaker_applied, raw_votes}
        6. Write DLB-01-RESCORE.md per D-05a schema (below)
      D-05a schema:
        ```yaml
        ---
        type: deliberation-rescore
        dlb_id: DLB-01
        original_brief: .planning/briefs/2026-04-19-memory-topology.md
        original_vote: "{from DLB-01 frontmatter.vote}"
        original_decision: "{from DLB-01 frontmatter.decision}"
        rescored:
          members:
            - {role, position, confidence, rationale_summary}
          signed_sum: N
          new_decision: SUPPORT | OPPOSE | TIE
          diverges_from_original: bool
          notes: "CEO one-liner explaining convergence/divergence"
        ---
        ```
      Body of rescore file: aggregate the 4 members' `risks_raised`, `falsifier`,
      `known_deadends` into sections for future auditing.
      Budget: ~8k tokens (4 agents × 2k response).
    output_contract: |
      `.planning/decisions/DLB-01-RESCORE.md` exists with valid YAML frontmatter matching
      D-05a schema EXACTLY:
      - type: deliberation-rescore
      - dlb_id: DLB-01
      - original_brief, original_vote, original_decision populated from DLB-01 frontmatter
      - rescored.members: array of 4 (one per archetype), each with role + position + confidence + rationale_summary
      - rescored.signed_sum: integer matching synthesize() output
      - rescored.new_decision: string ∈ {SUPPORT, OPPOSE, TIE}
      - rescored.diverges_from_original: bool (true iff new_decision differs from original_decision)
      - rescored.notes: non-empty prose (CEO one-liner)
      Body sections (prose, after frontmatter):
      - ## Brief Re-Read (1-2 sentence summary of original brief situation)
      - ## Member Positions (table: role | position | confidence | key argument)
      - ## Aggregated Fields (risks_raised unique across members; known_deadends unique; falsifier union)
      - ## Divergence Analysis (why the formula converged with or diverged from original)
      Full file ~60-80 lines.
    hypothesis: |
      Serial-per-DLB + parallel-within-DLB matches research §Q8 Option B (context-safe,
      ~8k tokens per task, wall-time optimal given PARALLEL_CONFIRMED). Using deliberation-schema
      validate() means malformed agent responses trigger retry-once; using vote-synthesis
      gives empirically-grounded signed_sum rather than heuristic reading.
    falsifier: |
      (a) File missing any of the 7 frontmatter keys (type, dlb_id, original_brief, original_vote,
      original_decision, rescored, etc.).
      (b) rescored.members has fewer or more than 4 entries.
      (c) rescored.signed_sum is not equal to the sum computed by vote-synthesis.cjs on the
      parsed responses.
      (d) rescored.new_decision is not in {SUPPORT, OPPOSE, TIE}.
      (e) rescored.diverges_from_original is not a boolean.
      (f) Agent dispatches use wrong subagent_type names (must match exactly:
      sgsd-board-architect, sgsd-board-contrarian, sgsd-board-pragmatist, sgsd-board-moonshot).
      (g) Agents dispatched serially instead of parallel (wall-time blows up, but not
      correctness — minor falsifier).
    stop_rule: |
      `.planning/decisions/DLB-01-RESCORE.md` parses as YAML at the frontmatter; rescored
      frontmatter block has all 6 required keys (members, signed_sum, new_decision,
      diverges_from_original, notes, and the top-level original_*); `members` has 4 entries;
      `new_decision ∈ {SUPPORT, OPPOSE, TIE}`.
    verification_cmd: |
      node -e "const y=require('./super-gsd/tools/plan-schema/node_modules/js-yaml');const fs=require('fs');const p='.planning/decisions/DLB-01-RESCORE.md';const c=fs.readFileSync(p,'utf8');const fm=c.match(/^---\\n([\\s\\S]*?)\\n---/);if(!fm){console.error('FAIL no fm');process.exit(1);}const d=y.load(fm[1]);if(!d.dlb_id||d.dlb_id!=='DLB-01'){console.error('FAIL id',d.dlb_id);process.exit(2);}if(!d.original_vote||!d.original_decision||!d.original_brief){console.error('FAIL orig');process.exit(3);}if(!d.rescored||!Array.isArray(d.rescored.members)||d.rescored.members.length!==4){console.error('FAIL members',d.rescored?.members?.length);process.exit(4);}if(!['SUPPORT','OPPOSE','TIE'].includes(d.rescored.new_decision)){console.error('FAIL decision',d.rescored.new_decision);process.exit(5);}if(typeof d.rescored.diverges_from_original!=='boolean'){console.error('FAIL diverges type');process.exit(6);}if(typeof d.rescored.signed_sum!=='number'){console.error('FAIL sum type');process.exit(7);}console.log('PASS DLB-01');"
    verification_gates:
      - "DLB-01-RESCORE.md frontmatter parses → exit 0"
      - "rescored.members array length == 4 → exit 0"
      - "rescored.new_decision in SUPPORT|OPPOSE|TIE → exit 0"
      - "rescored.diverges_from_original is boolean → exit 0"

  - id: 13-06-02
    agent: gsd-executor
    model: sonnet
    files_touched:
      - .planning/decisions/DLB-02-RESCORE.md
    input_contract: |
      Same pattern as 13-06-01 but for DLB-02. Brief:
      `.planning/briefs/2026-04-19-muda-learning-loop.md`.
      4 parallel agents × structured YAML × synthesize → RESCORE.md per D-05a.
    output_contract: |
      `.planning/decisions/DLB-02-RESCORE.md` exists with D-05a-compliant frontmatter and body.
    hypothesis: |
      Same Option-B batching pattern. Each DLB's task is independent of others (6 tasks
      are serial in wave 5 but no intra-wave file conflict).
    falsifier: |
      Same falsifier set as 13-06-01 with dlb_id: DLB-02 substituted.
    stop_rule: |
      File parses, members.length==4, new_decision valid, diverges boolean, signed_sum numeric.
    verification_cmd: |
      node -e "const y=require('./super-gsd/tools/plan-schema/node_modules/js-yaml');const fs=require('fs');const c=fs.readFileSync('.planning/decisions/DLB-02-RESCORE.md','utf8');const fm=c.match(/^---\\n([\\s\\S]*?)\\n---/);const d=y.load(fm[1]);if(d.dlb_id!=='DLB-02'||!d.rescored||d.rescored.members.length!==4||!['SUPPORT','OPPOSE','TIE'].includes(d.rescored.new_decision)){console.error('FAIL DLB-02');process.exit(1);}console.log('PASS DLB-02');"
    verification_gates:
      - "DLB-02-RESCORE.md frontmatter + members + new_decision valid → exit 0"
    depends_on: [13-06-01]

  - id: 13-06-03
    agent: gsd-executor
    model: sonnet
    files_touched:
      - .planning/decisions/DLB-03-RESCORE.md
    input_contract: |
      Same pattern for DLB-03. Brief: `.planning/briefs/2026-04-19-intent-continuity.md`.
    output_contract: |
      `.planning/decisions/DLB-03-RESCORE.md` exists with D-05a-compliant frontmatter and body.
    hypothesis: |
      Same Option-B batching pattern.
    falsifier: |
      Same falsifier set with dlb_id: DLB-03.
    stop_rule: |
      File parses, members.length==4, new_decision valid, diverges boolean.
    verification_cmd: |
      node -e "const y=require('./super-gsd/tools/plan-schema/node_modules/js-yaml');const fs=require('fs');const c=fs.readFileSync('.planning/decisions/DLB-03-RESCORE.md','utf8');const fm=c.match(/^---\\n([\\s\\S]*?)\\n---/);const d=y.load(fm[1]);if(d.dlb_id!=='DLB-03'||!d.rescored||d.rescored.members.length!==4||!['SUPPORT','OPPOSE','TIE'].includes(d.rescored.new_decision)){console.error('FAIL DLB-03');process.exit(1);}console.log('PASS DLB-03');"
    verification_gates:
      - "DLB-03-RESCORE.md frontmatter + members + new_decision valid → exit 0"
    depends_on: [13-06-02]

  - id: 13-06-04
    agent: gsd-executor
    model: sonnet
    files_touched:
      - .planning/decisions/DLB-04-RESCORE.md
    input_contract: |
      Same pattern for DLB-04. Brief:
      `.planning/briefs/2026-04-19-self-evolving-resource-substrate.md`.
    output_contract: |
      `.planning/decisions/DLB-04-RESCORE.md` exists with D-05a-compliant frontmatter and body.
    hypothesis: |
      Same Option-B batching pattern.
    falsifier: |
      Same falsifier set with dlb_id: DLB-04.
    stop_rule: |
      File parses, members.length==4, new_decision valid.
    verification_cmd: |
      node -e "const y=require('./super-gsd/tools/plan-schema/node_modules/js-yaml');const fs=require('fs');const c=fs.readFileSync('.planning/decisions/DLB-04-RESCORE.md','utf8');const fm=c.match(/^---\\n([\\s\\S]*?)\\n---/);const d=y.load(fm[1]);if(d.dlb_id!=='DLB-04'||!d.rescored||d.rescored.members.length!==4||!['SUPPORT','OPPOSE','TIE'].includes(d.rescored.new_decision)){console.error('FAIL DLB-04');process.exit(1);}console.log('PASS DLB-04');"
    verification_gates:
      - "DLB-04-RESCORE.md frontmatter + members + new_decision valid → exit 0"
    depends_on: [13-06-03]

  - id: 13-06-05
    agent: gsd-executor
    model: sonnet
    files_touched:
      - .planning/decisions/DLB-05-RESCORE.md
    input_contract: |
      Same pattern for DLB-05. Brief: `.planning/briefs/2026-04-20-vtp-audit-sharpening.md`.
    output_contract: |
      `.planning/decisions/DLB-05-RESCORE.md` exists with D-05a-compliant frontmatter and body.
    hypothesis: |
      Same Option-B batching pattern.
    falsifier: |
      Same falsifier set with dlb_id: DLB-05.
    stop_rule: |
      File parses, members.length==4, new_decision valid.
    verification_cmd: |
      node -e "const y=require('./super-gsd/tools/plan-schema/node_modules/js-yaml');const fs=require('fs');const c=fs.readFileSync('.planning/decisions/DLB-05-RESCORE.md','utf8');const fm=c.match(/^---\\n([\\s\\S]*?)\\n---/);const d=y.load(fm[1]);if(d.dlb_id!=='DLB-05'||!d.rescored||d.rescored.members.length!==4||!['SUPPORT','OPPOSE','TIE'].includes(d.rescored.new_decision)){console.error('FAIL DLB-05');process.exit(1);}console.log('PASS DLB-05');"
    verification_gates:
      - "DLB-05-RESCORE.md frontmatter + members + new_decision valid → exit 0"
    depends_on: [13-06-04]

  - id: 13-06-06
    agent: gsd-executor
    model: sonnet
    files_touched:
      - .planning/decisions/DLB-06-RESCORE.md
    input_contract: |
      Same pattern for DLB-06. Brief: `.planning/briefs/2026-04-20-central-distribution.md`.
    output_contract: |
      `.planning/decisions/DLB-06-RESCORE.md` exists with D-05a-compliant frontmatter and body.
    hypothesis: |
      Same Option-B batching pattern.
    falsifier: |
      Same falsifier set with dlb_id: DLB-06.
    stop_rule: |
      File parses, members.length==4, new_decision valid.
    verification_cmd: |
      node -e "const y=require('./super-gsd/tools/plan-schema/node_modules/js-yaml');const fs=require('fs');const c=fs.readFileSync('.planning/decisions/DLB-06-RESCORE.md','utf8');const fm=c.match(/^---\\n([\\s\\S]*?)\\n---/);const d=y.load(fm[1]);if(d.dlb_id!=='DLB-06'||!d.rescored||d.rescored.members.length!==4||!['SUPPORT','OPPOSE','TIE'].includes(d.rescored.new_decision)){console.error('FAIL DLB-06');process.exit(1);}console.log('PASS DLB-06');"
    verification_gates:
      - "DLB-06-RESCORE.md frontmatter + members + new_decision valid → exit 0"
    depends_on: [13-06-05]

  - id: 13-06-07
    agent: gsd-executor
    model: sonnet
    files_touched:
      - .planning/phases/13-governance/13-05b-calibration-concern.md
    input_contract: |
      13-CONTEXT.md D-05b ("If ≥2 of 6 DLBs diverge, flag as formula calibration concern —
      operator reviews whether signed-sum is the right shape or needs tuning").
      After 13-06-01..13-06-06 all land, read all 6 DLB-NN-RESCORE.md files, count
      `diverges_from_original: true` entries.
      Write `.planning/phases/13-governance/13-05b-calibration-concern.md` with:
      - A summary table (DLB | original_decision | new_decision | diverges | confidence-weighted sum)
      - Counts: `divergence_count`, `convergence_count`, `tie_count` (ties are neither converge nor diverge)
      - IF divergence_count >= 2: section `## Calibration Concern Triggered` with operator-review instructions
      - IF divergence_count < 2: section `## No Calibration Concern` stating the formula holds
      - Research §Q8 acknowledgment: sample size n=6 is small; 2 divergences = ~33% rate; operator
        review is qualitative, not hypothesis-test
    output_contract: |
      `.planning/phases/13-governance/13-05b-calibration-concern.md` exists with:
      - Frontmatter: `divergence_count`, `convergence_count`, `tie_count` (numeric fields)
      - Summary table with one row per DLB-01..06
      - Appropriate conclusion section (## Calibration Concern Triggered OR ## No Calibration Concern)
      - File size ~30-50 lines
    hypothesis: |
      Divergence-count analysis is mechanical once the 6 RESCORE.md files are committed.
      Separating this from the per-DLB tasks lets each RESCORE task commit independently
      and the summary wait until all 6 are committed. Keeps per-task context small.
    falsifier: |
      (a) File missing divergence_count frontmatter field.
      (b) Summary table has fewer than 6 rows (one RESCORE file missed in the scan).
      (c) Conclusion section contradicts divergence_count (e.g., count==3 but "No Calibration
      Concern" written).
      (d) File references `diverges_from_original` values that don't match the committed
      RESCORE.md files (read-wrong bug).
    stop_rule: |
      File exists; frontmatter has `divergence_count` integer; table has 6 rows; conclusion
      section matches: divergence_count >= 2 → `## Calibration Concern Triggered`; else
      `## No Calibration Concern`.
    verification_cmd: |
      node -e "const y=require('./super-gsd/tools/plan-schema/node_modules/js-yaml');const fs=require('fs');const p='.planning/phases/13-governance/13-05b-calibration-concern.md';const c=fs.readFileSync(p,'utf8');const fm=c.match(/^---\\n([\\s\\S]*?)\\n---/);if(!fm){console.error('FAIL no fm');process.exit(1);}const d=y.load(fm[1]);if(typeof d.divergence_count!=='number'){console.error('FAIL dc');process.exit(2);}let scan=0;for(let i=1;i<=6;i++){const p2='.planning/decisions/DLB-0'+i+'-RESCORE.md';const c2=fs.readFileSync(p2,'utf8');const fm2=c2.match(/^---\\n([\\s\\S]*?)\\n---/);const d2=y.load(fm2[1]);if(d2.rescored.diverges_from_original===true)scan++;}if(scan!==d.divergence_count){console.error('FAIL count mismatch real='+scan+' file='+d.divergence_count);process.exit(3);}if(d.divergence_count>=2&&!/Calibration Concern Triggered/.test(c)){console.error('FAIL concern missing');process.exit(4);}if(d.divergence_count<2&&!/No Calibration Concern/.test(c)){console.error('FAIL no-concern missing');process.exit(5);}console.log('PASS divergence='+d.divergence_count);"
    verification_gates:
      - "calibration-concern.md frontmatter divergence_count numeric → exit 0"
      - "divergence_count matches actual count across 6 RESCORE files → exit 0"
      - "conclusion section matches divergence_count threshold → exit 0"
    depends_on: [13-06-01, 13-06-02, 13-06-03, 13-06-04, 13-06-05, 13-06-06]

must_haves:
  truths:
    - "All 6 `.planning/decisions/DLB-0{1..6}-RESCORE.md` files exist"
    - "Each RESCORE file parses as YAML at the frontmatter"
    - "Each RESCORE file's `rescored.members` array has exactly 4 entries (one per archetype)"
    - "Each RESCORE file's `rescored.new_decision` ∈ {SUPPORT, OPPOSE, TIE}"
    - "Each RESCORE file's `rescored.diverges_from_original` is a boolean"
    - "Each RESCORE file's `rescored.signed_sum` is a number matching vote-synthesis output"
    - "Agent dispatches used correct subagent_type names (sgsd-board-architect/contrarian/pragmatist/moonshot)"
    - "Member responses validated via deliberation-schema.cjs before synthesize() call"
    - "`.planning/phases/13-governance/13-05b-calibration-concern.md` exists with divergence_count"
    - "divergence_count in 13-05b file matches the actual count across the 6 RESCORE files"
    - "If divergence_count >= 2: file has `## Calibration Concern Triggered` section (D-05b)"
  artifacts:
    - path: ".planning/decisions/DLB-01-RESCORE.md"
      provides: "DLB-01 retro rescore with signed-sum formula on original brief"
      contains: "type: deliberation-rescore, dlb_id: DLB-01, original_brief/vote/decision, rescored.{members×4, signed_sum, new_decision, diverges_from_original, notes}"
    - path: ".planning/decisions/DLB-02-RESCORE.md"
      provides: "DLB-02 retro rescore"
      contains: "dlb_id: DLB-02 + D-05a schema"
    - path: ".planning/decisions/DLB-03-RESCORE.md"
      provides: "DLB-03 retro rescore"
      contains: "dlb_id: DLB-03 + D-05a schema"
    - path: ".planning/decisions/DLB-04-RESCORE.md"
      provides: "DLB-04 retro rescore"
      contains: "dlb_id: DLB-04 + D-05a schema"
    - path: ".planning/decisions/DLB-05-RESCORE.md"
      provides: "DLB-05 retro rescore"
      contains: "dlb_id: DLB-05 + D-05a schema"
    - path: ".planning/decisions/DLB-06-RESCORE.md"
      provides: "DLB-06 retro rescore"
      contains: "dlb_id: DLB-06 + D-05a schema"
    - path: ".planning/phases/13-governance/13-05b-calibration-concern.md"
      provides: "Divergence summary + calibration verdict per D-05b"
      contains: "frontmatter divergence_count; 6-row summary table; conclusion section"
  key_links:
    - from: ".planning/decisions/DLB-0N-RESCORE.md"
      to: "super-gsd/scripts/lib/vote-synthesis.cjs"
      via: "rescored.signed_sum computed by synthesize(parsedResponses)"
      pattern: "signed_sum"
    - from: ".planning/decisions/DLB-0N-RESCORE.md"
      to: "super-gsd/scripts/lib/deliberation-schema.cjs"
      via: "agent responses validated before synthesize"
      pattern: "position|confidence|falsifier"
    - from: ".planning/phases/13-governance/13-05b-calibration-concern.md"
      to: ".planning/decisions/DLB-01..06-RESCORE.md"
      via: "scans all 6 files for rescored.diverges_from_original"
      pattern: "diverges_from_original"
---

# Plan 13-06: Retroactive DLB-01..06 Rescore

## Objective

Re-dispatch all 4 board agents on the ORIGINAL brief of each DLB-01..06 with the new
10-field YAML rubric + confidence 1-5 self-rating, parse each response via
deliberation-schema.cjs, synthesize via vote-synthesis.cjs, and write 6 DLB-NN-RESCORE.md
files per the D-05a schema. Then audit divergences: if >=2 of 6 diverge from original,
write the D-05b calibration-concern memo.

Purpose: Satisfies **GOV-02 retro validation** (D-05, D-05a, D-05b) — empirically validate
that the signed-sum formula produces reasonable decisions on real historical briefs rather
than trusting the math in isolation.

Output: 7 files — 6 `DLB-0N-RESCORE.md` files (~60-80 lines each) + 1 calibration-concern
summary (~30-50 lines).

Wave 5 — serial after Wave 4 {13-03}. Hard dependencies:
- 13-02 shipped vote-synthesis.cjs (synthesize call)
- 13-03 shipped deliberation-schema.cjs (validate call) + structured agent responses
- 13-01 shipped board-registry.cjs (roster resolution, though retro uses fixed 4-agent
  fan-out rather than resolveRoster)

Intra-wave: tasks 13-06-01 through 13-06-06 serialized per research §Q8 Option B (one DLB
per task, 4 agents in parallel within each task). Task 13-06-07 depends on all 6 rescore
tasks completing.

## Tasks

Task breakdown follows 13-VALIDATION.md tasks 13-06-01 through 13-06-07. All contracts,
hypotheses, falsifiers, stop rules live in the frontmatter above — canonical executor contract.

### 13-06-01 — DLB-01 rescore

Brief: `.planning/briefs/2026-04-19-memory-topology.md`. Fan out 4 parallel
Agent(subagent_type: sgsd-board-{architect,contrarian,pragmatist,moonshot},
model: sonnet, run_in_background: true) with prompts containing the original brief +
"emit the 10-field YAML per your updated Output Format; self-rate 1-5 confidence per D-03."
Await all 4; validate each via deliberation-schema.cjs; call vote-synthesis.cjs
synthesize(parsedResponses); write DLB-01-RESCORE.md per D-05a schema.

### 13-06-02 — DLB-02 rescore

Brief: `.planning/briefs/2026-04-19-muda-learning-loop.md`. Same pattern as 13-06-01.

### 13-06-03 — DLB-03 rescore

Brief: `.planning/briefs/2026-04-19-intent-continuity.md`. Same pattern.

### 13-06-04 — DLB-04 rescore

Brief: `.planning/briefs/2026-04-19-self-evolving-resource-substrate.md`. Same pattern.

### 13-06-05 — DLB-05 rescore

Brief: `.planning/briefs/2026-04-20-vtp-audit-sharpening.md`. Same pattern.

### 13-06-06 — DLB-06 rescore

Brief: `.planning/briefs/2026-04-20-central-distribution.md`. Same pattern.

### 13-06-07 — Divergence Summary (D-05b)

After all 6 RESCORE files land, read each file's `rescored.diverges_from_original` field,
count true values, write `.planning/phases/13-governance/13-05b-calibration-concern.md`
with a 6-row summary table and appropriate conclusion section. If divergence_count >= 2:
`## Calibration Concern Triggered` with operator-review guidance; else `## No Calibration
Concern` stating the formula holds on this sample.

## Verification Gates (Wave close)

Run in sequence:

1. All 6 RESCORE files parse frontmatter YAML with D-05a schema → each `node -e` check exit 0
2. Each RESCORE has `rescored.members.length == 4` → grep/parse check exit 0
3. Each RESCORE `rescored.new_decision` ∈ {SUPPORT, OPPOSE, TIE} → check exit 0
4. 13-05b calibration-concern.md divergence_count matches actual count across 6 files → exit 0
5. Conclusion section matches divergence_count threshold → exit 0

## Success Criteria

- All 7 files exist.
- All 7 task verification_cmds exit 0.
- Invariant 14 in Phase 13 verify.mjs goes GREEN after this plan's commits land.
- Token budget target: ~50k total (per research §Q8 estimate: 6 DLBs × 4 agents × ~2k response + orchestrator overhead).

## Output

After completion, create `.planning/phases/13-governance/plans/13-06-SUMMARY.md` summarising:
- 7 files created
- Per-DLB: original_decision vs new_decision; diverges bool
- Final divergence_count; calibration verdict (triggered or not)
- Token spent vs budget
- 7 commit SHAs (one per task; D-05 wave §Q8 notes `docs(13-06): rescore DLB-NN — ...` message format)
