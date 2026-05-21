---
schema_version: 2
status: PLAN-LOCKED
expected_ATC_tier: FULL
skip_gates: []
lessons_path: .planning/decisions/DLB-11-CHRONICLE-LAYER.md
plan_id: P113-01
phase_id: P113
phase: 113-chronicle-schema-manifest
milestone: v3.1
title: Chronicle Schema + Manifest
locked_by: codex-planner
lock_reason: Schema-only executor plan derived from 113-CONTEXT.md and DLB-11 R1-R6.
context_path: .planning/milestones/v3.1/phases/113-chronicle-schema-manifest/113-CONTEXT.md
semantic_acceptance_criteria:
  - id: SAC-P113-01
    input: super-gsd/schemas/fixtures/chronicle/good-phase-chronicle.json
    expected_outcome: Validates against super-gsd/schemas/chronicle.schema.json.
    verification_cmd: npx ajv validate -c ajv-errors -s super-gsd/schemas/chronicle.schema.json -d super-gsd/schemas/fixtures/chronicle/good-phase-chronicle.json
  - id: SAC-P113-02
    input: super-gsd/schemas/fixtures/chronicle/good-milestone-chronicle.json
    expected_outcome: Validates against super-gsd/schemas/chronicle.schema.json.
    verification_cmd: npx ajv validate -c ajv-errors -s super-gsd/schemas/chronicle.schema.json -d super-gsd/schemas/fixtures/chronicle/good-milestone-chronicle.json
  - id: SAC-P113-03
    input: super-gsd/schemas/fixtures/chronicle/good-manifest.json
    expected_outcome: Validates against super-gsd/schemas/chronicle-manifest.schema.json.
    verification_cmd: npx ajv validate -c ajv-errors -s super-gsd/schemas/chronicle-manifest.schema.json -d super-gsd/schemas/fixtures/chronicle/good-manifest.json
  - id: SAC-P113-04
    input: super-gsd/schemas/fixtures/chronicle/good-with-denominator-populated.json
    expected_outcome: Validates against super-gsd/schemas/chronicle.schema.json with populated denominator arrays.
    verification_cmd: npx ajv validate -c ajv-errors -s super-gsd/schemas/chronicle.schema.json -d super-gsd/schemas/fixtures/chronicle/good-with-denominator-populated.json
  - id: SAC-P113-05
    input: super-gsd/schemas/fixtures/chronicle/good-with-denominators-empty-reason.json
    expected_outcome: Validates against super-gsd/schemas/chronicle.schema.json because empty denominator arrays are accompanied by denominators_empty_reason.
    verification_cmd: npx ajv validate -c ajv-errors -s super-gsd/schemas/chronicle.schema.json -d super-gsd/schemas/fixtures/chronicle/good-with-denominators-empty-reason.json
  - id: SAC-P113-06
    input: super-gsd/schemas/fixtures/chronicle/good-with-puml-source.json
    expected_outcome: Validates against super-gsd/schemas/chronicle.schema.json with puml_source, rendered_svg, repo_path_labels, and arrow_intent_labels present.
    verification_cmd: npx ajv validate -c ajv-errors -s super-gsd/schemas/chronicle.schema.json -d super-gsd/schemas/fixtures/chronicle/good-with-puml-source.json
  - id: SAC-P113-07
    input: super-gsd/schemas/fixtures/chronicle/good-with-reference-citations.json
    expected_outcome: Validates against super-gsd/schemas/chronicle.schema.json with by-reference string citations only.
    verification_cmd: npx ajv validate -c ajv-errors -s super-gsd/schemas/chronicle.schema.json -d super-gsd/schemas/fixtures/chronicle/good-with-reference-citations.json
  - id: SAC-P113-08
    input: super-gsd/schemas/fixtures/chronicle/bad-claim-without-citation.json
    expected_outcome: Fails validation with CHRONICLE-01.
    verification_cmd: npx ajv validate -c ajv-errors -s super-gsd/schemas/chronicle.schema.json -d super-gsd/schemas/fixtures/chronicle/bad-claim-without-citation.json 2>&1 | grep CHRONICLE-01
  - id: SAC-P113-09
    input: super-gsd/schemas/fixtures/chronicle/bad-synthesis-without-citation.json
    expected_outcome: Fails validation with CHRONICLE-02.
    verification_cmd: npx ajv validate -c ajv-errors -s super-gsd/schemas/chronicle.schema.json -d super-gsd/schemas/fixtures/chronicle/bad-synthesis-without-citation.json 2>&1 | grep CHRONICLE-02
  - id: SAC-P113-10
    input: super-gsd/schemas/fixtures/chronicle/bad-section-signifier-class.json
    expected_outcome: Fails validation with CHRONICLE-03.
    verification_cmd: npx ajv validate -c ajv-errors -s super-gsd/schemas/chronicle.schema.json -d super-gsd/schemas/fixtures/chronicle/bad-section-signifier-class.json 2>&1 | grep CHRONICLE-03
  - id: SAC-P113-11
    input: super-gsd/schemas/fixtures/chronicle/bad-external-asset-url.json
    expected_outcome: Fails validation with CHRONICLE-04.
    verification_cmd: npx ajv validate -c ajv-errors -s super-gsd/schemas/chronicle.schema.json -d super-gsd/schemas/fixtures/chronicle/bad-external-asset-url.json 2>&1 | grep CHRONICLE-04
  - id: SAC-P113-12
    input: super-gsd/schemas/fixtures/chronicle/bad-diagram-remote-include.json
    expected_outcome: Fails validation with CHRONICLE-05.
    verification_cmd: npx ajv validate -c ajv-errors -s super-gsd/schemas/chronicle.schema.json -d super-gsd/schemas/fixtures/chronicle/bad-diagram-remote-include.json 2>&1 | grep CHRONICLE-05
  - id: SAC-P113-13
    input: super-gsd/schemas/fixtures/chronicle/bad-denominator-contract.json
    expected_outcome: Fails validation with CHRONICLE-06 or CHRONICLE-07 when denominators are missing or empty without denominators_empty_reason.
    verification_cmd: npx ajv validate -c ajv-errors -s super-gsd/schemas/chronicle.schema.json -d super-gsd/schemas/fixtures/chronicle/bad-denominator-contract.json 2>&1 | grep -E 'CHRONICLE-06|CHRONICLE-07'
  - id: SAC-P113-14
    input: super-gsd/schemas/fixtures/chronicle/bad-manifest-missing-hash.json
    expected_outcome: Fails validation with CHRONICLE-MANIFEST-01.
    verification_cmd: npx ajv validate -c ajv-errors -s super-gsd/schemas/chronicle-manifest.schema.json -d super-gsd/schemas/fixtures/chronicle/bad-manifest-missing-hash.json 2>&1 | grep CHRONICLE-MANIFEST-01
tasks:
  - id: t1
    title: Chronicle and manifest schemas
    agent: codex-executor
    model: codex
    depends_on: []
    files_touched:
      - super-gsd/schemas/chronicle.schema.json
      - super-gsd/schemas/chronicle-manifest.schema.json
    input_contract: |
      Read 113-CONTEXT.md, DLB-11-CHRONICLE-LAYER.md (esp Refinements R1-R6),
      plan-schema-v2.json, plan-locked.schema.json, and cmb.schema.json. Author
      ONLY the two JSON schemas listed in files_touched. P113 is schema-only:
      no executable tools, scripts, CLIs, or runtime integrations. Follow the
      JSON Schema style already used by super-gsd/schemas/cmb.schema.json. Use
      ajv-errors errorMessage wiring so every failing fixture emits the SAC
      grep code. Encode DLB-11 R1-R6 exactly: PUML source retention with
      repo_path_labels + arrow_intent_labels, denominator root contract with
      empty-reason gate, by-reference string citations, and section signifier
      roles enum.
    output_contract: |
      super-gsd/schemas/chronicle.schema.json and
      super-gsd/schemas/chronicle-manifest.schema.json exist, parse as JSON,
      and encode: claim+synthesis citations required (CHRONICLE-01,
      CHRONICLE-02), section signifier role enum (CHRONICLE-03), no external
      CDN/URL assets (CHRONICLE-04), diagrams require puml_source +
      rendered_svg + repo_path_labels + arrow_intent_labels with no
      !include http(s):// remote PUML includes (CHRONICLE-05), denominators
      object with five sub-arrays required (CHRONICLE-06), empty denominators
      gated by denominators_empty_reason (CHRONICLE-07), citations are
      by-reference strings only (CHRONICLE-08), and manifest source_file_paths
      include hashes (CHRONICLE-MANIFEST-01).
    hypothesis: |
      Two JSON Schema files can encode the locked DLB-11 R1-R6 chronicle and
      manifest contract with stable ajv-errors codes so P114+ tooling can rely
      on a durable schema boundary without runtime behavior bleeding into P113.
    falsifier: |
      Either schema fails JSON parsing, omits any of the nine error codes,
      misses a DLB-11 R1-R6 invariant, allows agent-authored chronicles to
      ship without citations, or extends scope into executable tools, CLIs,
      or runtime integrations outside the two schema files.
    stop_rule: |
      Stop once both schemas parse, encode every DLB-11 R1-R6 invariant, and
      every CHRONICLE-XX / CHRONICLE-MANIFEST-01 error code is wired through
      ajv-errors errorMessage.
    verification_cmd: "node -e \"JSON.parse(require('fs').readFileSync('super-gsd/schemas/chronicle.schema.json')); JSON.parse(require('fs').readFileSync('super-gsd/schemas/chronicle-manifest.schema.json'))\""

  - id: t2
    title: Valid chronicle and manifest fixtures
    agent: codex-executor
    model: codex
    depends_on:
      - t1
    files_touched:
      - super-gsd/schemas/fixtures/chronicle/good-phase-chronicle.json
      - super-gsd/schemas/fixtures/chronicle/good-milestone-chronicle.json
      - super-gsd/schemas/fixtures/chronicle/good-manifest.json
      - super-gsd/schemas/fixtures/chronicle/good-with-denominator-populated.json
      - super-gsd/schemas/fixtures/chronicle/good-with-denominators-empty-reason.json
      - super-gsd/schemas/fixtures/chronicle/good-with-puml-source.json
      - super-gsd/schemas/fixtures/chronicle/good-with-reference-citations.json
    input_contract: |
      Use the locked schemas from t1 and the positive fixture list from
      113-CONTEXT.md. Create one positive static fixture per allowed shape:
      phase-level chronicle, milestone-level chronicle, manifest, populated
      denominators, empty denominators with reason, retained PUML source with
      repo_path_labels + arrow_intent_labels, and by-reference citations.
      Fixtures are repo test data for P114+ tooling; not runtime chronicle
      records.
    output_contract: |
      Seven good fixture JSON files exist under
      super-gsd/schemas/fixtures/chronicle/, parse as JSON, and validate
      against chronicle.schema.json (or chronicle-manifest.schema.json for
      good-manifest.json). The positive fixture set exercises every DLB-11
      R1-R6 allowed shape including both denominator modes (populated and
      empty-with-reason) and retained PUML source.
    hypothesis: |
      The chronicle schemas from t1 are concrete enough to express one valid
      fixture per allowed shape without introducing renderer or validator
      tooling.
    falsifier: |
      Any good fixture fails JSON parsing or schema validation, lacks required
      DLB-11 R1-R6 fields, embeds a full CMB body inside a citation entry,
      duplicates another fixture's allowed shape, or writes runtime chronicle
      records under .planning/chronicles/.
    stop_rule: |
      Stop once all seven good fixtures parse and validate, with each fixture
      mapped one-to-one to the seven allowed positive shapes from the CONTEXT
      fixture table.
    verification_cmd: "node -e \"for (const f of ['good-phase-chronicle','good-milestone-chronicle','good-manifest','good-with-denominator-populated','good-with-denominators-empty-reason','good-with-puml-source','good-with-reference-citations']) JSON.parse(require('fs').readFileSync('super-gsd/schemas/fixtures/chronicle/'+f+'.json'))\""

  - id: t3
    title: Invalid chronicle and manifest fixtures
    agent: codex-executor
    model: codex
    depends_on:
      - t1
    files_touched:
      - super-gsd/schemas/fixtures/chronicle/bad-claim-without-citation.json
      - super-gsd/schemas/fixtures/chronicle/bad-synthesis-without-citation.json
      - super-gsd/schemas/fixtures/chronicle/bad-section-signifier-class.json
      - super-gsd/schemas/fixtures/chronicle/bad-external-asset-url.json
      - super-gsd/schemas/fixtures/chronicle/bad-diagram-remote-include.json
      - super-gsd/schemas/fixtures/chronicle/bad-denominator-contract.json
      - super-gsd/schemas/fixtures/chronicle/bad-manifest-missing-hash.json
    input_contract: |
      Use the locked schemas from t1 and the negative fixture list from
      113-CONTEXT.md. Each negative fixture isolates ONE error code so the
      SAC grep pattern can match cleanly. The denominator-contract fixture
      may match either CHRONICLE-06 (missing field) or CHRONICLE-07 (empty
      without reason) — the SAC grep uses alternation. Fixtures are repo
      test data for P114+ tooling.
    output_contract: |
      Seven bad fixture JSON files exist under
      super-gsd/schemas/fixtures/chronicle/, parse as JSON, and each one
      fails schema validation with the expected ajv-errors code:
      CHRONICLE-01 (claim no citation), CHRONICLE-02 (synthesis no citation),
      CHRONICLE-03 (wrong section signifier), CHRONICLE-04 (external asset
      URL), CHRONICLE-05 (remote PUML include), CHRONICLE-06|07 (denominator
      contract), CHRONICLE-MANIFEST-01 (manifest missing hash).
    hypothesis: |
      Each negative fixture can make ONE DLB-11 R1-R6 anti-shape testable
      against the t1 schemas without relying on runtime behavior or P114+
      validation tooling.
    falsifier: |
      Any bad fixture fails JSON parsing, any required negative fixture is
      missing, a negative fixture passes validation when it should fail, a
      fixture matches the wrong error code, or the task adds executable
      tools / CLIs / runtime integrations outside the seven fixture files.
    stop_rule: |
      Stop once all seven bad fixtures parse, each fails validation with its
      expected ajv-errors code, and no P114+ tooling files have been added or
      modified.
    verification_cmd: "node -e \"for (const f of ['bad-claim-without-citation','bad-synthesis-without-citation','bad-section-signifier-class','bad-external-asset-url','bad-diagram-remote-include','bad-denominator-contract','bad-manifest-missing-hash']) JSON.parse(require('fs').readFileSync('super-gsd/schemas/fixtures/chronicle/'+f+'.json'))\""
---

# P113-01 Chronicle Schema + Manifest PLAN

This PLAN-LOCKED phase is schema-only. It creates the chronicle schema, the chronicle manifest schema, and the fixed positive/negative fixture set needed for ATC validation. No executable tools are in scope.
