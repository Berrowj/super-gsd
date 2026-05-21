---
schema_version: 2
status: PLAN-LOCKED
expected_ATC_tier: FULL
skip_gates: []
lessons_path: .planning/decisions/DLB-11-CHRONICLE-LAYER.md
plan_id: P119-01
phase_id: P119
milestone: v3.1
title: Milestone Chronicle + Roadmap Miner
context_path: .planning/milestones/v3.1/phases/119-milestone-chronicle-roadmap-miner/119-CONTEXT.md
semantic_acceptance_criteria:
  - id: SAC-119-001
    input: "Run the milestone chronicle context builder for milestone v3.1 with default flags."
    expected_outcome: "A milestone chronicle context JSON is produced with chronicle_type set to \"milestone\" and no v3.0 retrospective content included by default."
    verification_cmd: "node super-gsd/tools/chronicle/milestone-chronicle.cjs --milestone v3.1 --out .planning/milestones/v3.1/phases/119-milestone-chronicle-roadmap-miner/tmp/milestone-context.json && node super-gsd/tools/chronicle/validate-chronicle.cjs .planning/milestones/v3.1/phases/119-milestone-chronicle-roadmap-miner/tmp/milestone-context.json"
  - id: SAC-119-002
    input: "Run the milestone chronicle context builder for milestone v3.1 with --include-v3.0-retro."
    expected_outcome: "The milestone chronicle context includes the v3.0 retrospective section only when the opt-in flag is present."
    verification_cmd: "node super-gsd/tools/chronicle/milestone-chronicle.cjs --milestone v3.1 --include-v3.0-retro --out .planning/milestones/v3.1/phases/119-milestone-chronicle-roadmap-miner/tmp/milestone-context-with-retro.json"
  - id: SAC-119-003
    input: "Validate the checked-in sample-milestone-chronicle-context.json fixture."
    expected_outcome: "The golden milestone chronicle fixture validates against super-gsd/schemas/chronicle.schema.json through the existing P116 validator."
    verification_cmd: "node super-gsd/tools/chronicle/validate-chronicle.cjs super-gsd/tools/chronicle/fixtures/sample-milestone-chronicle-context.json"
  - id: SAC-119-004
    input: "Publish a validated milestone chronicle context through the existing publisher."
    expected_outcome: "P117 publish.cjs accepts the milestone chronicle payload and writes the same publication shape used by existing chronicle publishing without adding a P119-specific publisher."
    verification_cmd: "node super-gsd/tools/chronicle/publish.cjs --input super-gsd/tools/chronicle/fixtures/sample-milestone-chronicle-context.json --dry-run"
  - id: SAC-119-005
    input: "Run the roadmap miner against .planning/milestones/v3.1/ROADMAP.md."
    expected_outcome: "mine-roadmap.cjs emits JSON only, with no HTML, Markdown page synthesis, or publisher side effects."
    verification_cmd: "node super-gsd/tools/chronicle/mine-roadmap.cjs --roadmap .planning/milestones/v3.1/ROADMAP.md --out .planning/milestones/v3.1/phases/119-milestone-chronicle-roadmap-miner/tmp/roadmap-mine.json"
  - id: SAC-119-006
    input: "Inspect the roadmap miner output for phase, dependency, and capstone signals."
    expected_outcome: "The JSON output contains mined roadmap records sufficient for downstream chronicle synthesis while preserving source paths and line-level provenance where available."
    verification_cmd: "node super-gsd/tools/chronicle/mine-roadmap.cjs --roadmap .planning/milestones/v3.1/ROADMAP.md --out .planning/milestones/v3.1/phases/119-milestone-chronicle-roadmap-miner/tmp/roadmap-mine.json && node -e \"const fs=require('fs'); const x=JSON.parse(fs.readFileSync('.planning/milestones/v3.1/phases/119-milestone-chronicle-roadmap-miner/tmp/roadmap-mine.json','utf8')); if(!Array.isArray(x.records)||!x.records.length) process.exit(1);\""
  - id: SAC-119-007
    input: "Compare roadmap miner output against sample-roadmap-mine-output.json."
    expected_outcome: "The golden roadmap miner fixture remains deterministic for the checked-in sample input and captures JSON-only miner behavior."
    verification_cmd: "node super-gsd/tools/chronicle/run-self-test.cjs --fixture roadmap-miner"
  - id: SAC-119-008
    input: "Run the chronicle self-test suite after adding milestone and roadmap cases."
    expected_outcome: "run-self-test.cjs exercises existing chronicle tests plus the new milestone chronicle and roadmap miner golden fixtures."
    verification_cmd: "node super-gsd/tools/chronicle/run-self-test.cjs"
  - id: SAC-119-009
    input: "Run milestone chronicle and roadmap miner CLIs with missing or invalid input paths."
    expected_outcome: "Both CLIs fail closed with non-zero exit codes and actionable error messages; neither creates partial publisher output."
    verification_cmd: "node super-gsd/tools/chronicle/run-self-test.cjs --fixture invalid-inputs"
  - id: SAC-119-010
    input: "Run the final P119 implementation through schema, validator, publisher dry-run, and self-test checks."
    expected_outcome: "P119 composes the P116 validator and P117 publisher, keeps roadmap mining JSON-only, preserves retrospective opt-in behavior, and does not duplicate chronicle gates."
    verification_cmd: "node super-gsd/tools/chronicle/run-self-test.cjs && node super-gsd/tools/chronicle/validate-chronicle.cjs super-gsd/tools/chronicle/fixtures/sample-milestone-chronicle-context.json && node super-gsd/tools/chronicle/publish.cjs --input super-gsd/tools/chronicle/fixtures/sample-milestone-chronicle-context.json --dry-run"
tasks:
  - id: t1
    title: Milestone chronicle CLI and golden context fixture
    agent: codex-executor
    model: codex
    depends_on: []
    files_touched:
      - super-gsd/tools/chronicle/milestone-chronicle.cjs
      - super-gsd/tools/chronicle/fixtures/sample-milestone-chronicle-context.json
    input_contract: |
      Read 119-CONTEXT.md, DLB-11-CHRONICLE-LAYER.md (R7 binding contract),
      chronicle.schema.json, build-context-pack.cjs (pattern reference),
      validate-chronicle.cjs (composed downstream), publish.cjs (composed
      downstream). Author milestone-chronicle.cjs as a deterministic
      Node.js builder that consumes existing phase chronicle artefacts
      (chronicle-context.json files under .planning/chronicles/<milestone>/P*/
      OR on-the-fly from phase folders if not yet published) and rolls them
      up into a single milestone chronicle context with chronicle_type:
      "milestone". Default behavior excludes v3.0 retrospective material;
      --include-v3.0-retro is the only opt-in. Output must validate against
      chronicle.schema.json with chronicle_type set to "milestone".
    output_contract: |
      super-gsd/tools/chronicle/milestone-chronicle.cjs exists, parses
      as Node.js, and emits a milestone chronicle context JSON to --out
      that validates against chronicle.schema.json. The sample golden
      fixture super-gsd/tools/chronicle/fixtures/sample-milestone-chronicle-context.json
      exists and validates against the same schema. The CLI composes the
      existing validate-chronicle.cjs and publish.cjs flows rather than
      introducing parallel validation or publishing paths.
    hypothesis: |
      A deterministic milestone roll-up CLI can compose existing phase
      chronicle context artefacts into a schema-valid milestone-level
      chronicle without introducing parallel validation or publication
      surfaces.
    falsifier: |
      Success is falsified if the milestone chronicle output fails
      schema validation, mutates source phase artefacts, fabricates
      observations or claims not present in source CMBs, re-implements
      validation or publication logic, or includes v3.0 retrospective
      content without --include-v3.0-retro.
    stop_rule: |
      Stop once milestone-chronicle.cjs emits schema-valid milestone
      chronicle context and sample-milestone-chronicle-context.json
      validates against chronicle.schema.json with chronicle_type set
      to "milestone".
    verification_cmd: "node -e \"JSON.parse(require('fs').readFileSync('super-gsd/tools/chronicle/fixtures/sample-milestone-chronicle-context.json'))\""

  - id: t2
    title: Roadmap miner, golden output fixture, self-test coverage
    agent: codex-executor
    model: codex
    depends_on:
      - t1
    files_touched:
      - super-gsd/tools/chronicle/mine-roadmap.cjs
      - super-gsd/tools/chronicle/fixtures/sample-roadmap-mine-output.json
      - super-gsd/tools/chronicle/run-self-test.cjs
    input_contract: |
      Read 119-CONTEXT.md, DLB-11-CHRONICLE-LAYER.md, milestone-chronicle.cjs
      from t1, existing run-self-test.cjs (preserve all 83 prior assertions),
      and existing chronicle INDEX.jsonl / validator-log / executor-log /
      token-attribution log shapes. Author mine-roadmap.cjs to walk
      .planning/milestones/*/SUMMARY.md plus the four metric streams,
      computing per-milestone phase counts, chronicle verdict distribution,
      dispatch counts, token spend, patch-round distribution, fog score
      average, and recurring drift class patterns. Emit JSON only — no
      HTML synthesis. Author sample-roadmap-mine-output.json golden
      fixture. Extend run-self-test.cjs with SAC-P119-01..10 plus STRUCT
      assertions covering milestone chronicle + miner + invalid-input
      behavior.
    output_contract: |
      super-gsd/tools/chronicle/mine-roadmap.cjs exists, parses as
      Node.js, and emits roadmap mine JSON to --out conforming to the
      shape declared in 119-CONTEXT.md. sample-roadmap-mine-output.json
      validates as JSON and is deterministic across runs. run-self-test.cjs
      contains the SAC-P119-01..10 assertions (10 SAC) plus STRUCT
      assertions, and preserves all 83 prior assertions; running
      run-self-test.cjs exits 0 with 93+ PASS.
    hypothesis: |
      A roadmap miner can summarise SUMMARY.md plus four metric streams
      into structured JSON that surfaces cross-milestone patterns
      (recurring drift, gate hot spots, token spend distribution)
      without requiring HTML rendering or any new schema.
    falsifier: |
      Success is falsified if mine-roadmap.cjs emits HTML, runs slower
      than 5 seconds on the sample tree, produces non-deterministic
      output for identical inputs, mutates any source ledger, or the
      self-test extension regresses any of the 83 prior assertions.
    stop_rule: |
      Stop once mine-roadmap.cjs emits schema-valid JSON, the golden
      fixture matches the miner output byte-by-byte, run-self-test.cjs
      shows 93+ PASS, and zero prior assertions regress.
    verification_cmd: "node super-gsd/tools/chronicle/run-self-test.cjs"
---

# P119-01 Plan

This phase closes v3.1 by adding the milestone-level chronicle builder and a JSON-only roadmap miner. The implementation composes the existing chronicle layer: P116 remains the validator path, P117 remains the publisher path, and P119 only supplies milestone context construction plus roadmap mining inputs.

The work is intentionally split into two independent tasks so the milestone chronicle CLI and roadmap miner can be implemented and verified without overlapping write ownership.
