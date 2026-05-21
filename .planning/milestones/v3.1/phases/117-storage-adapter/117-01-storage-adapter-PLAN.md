---
schema_version: 2
status: PLAN-LOCKED
expected_ATC_tier: FULL
skip_gates: []
lessons_path: .planning/decisions/DLB-11-CHRONICLE-LAYER.md
plan_id: P117-01
phase_id: P117
milestone: v3.1
title: Storage Adapter
context_path: .planning/milestones/v3.1/phases/117-storage-adapter/117-CONTEXT.md
semantic_acceptance_criteria:
  - id: SAC-P117-01
    input: A grounded chronicle publication bundle is sent to the local storage adapter.
    expected_outcome: The adapter writes the chronicle body and manifest beneath .planning/chronicles using a content-addressed path derived from the canonical content_hash.
    verification_cmd: "node super-gsd/tools/chronicle/run-self-test.cjs --sac SAC-P117-01"
  - id: SAC-P117-02
    input: A local storage write is interrupted or fails before finalization.
    expected_outcome: No partially-written chronicle or manifest is exposed at the final destination because local writes use the tmp+rename atomic write pattern.
    verification_cmd: "node super-gsd/tools/chronicle/run-self-test.cjs --sac SAC-P117-02"
  - id: SAC-P117-03
    input: Two equivalent chronicle bundles differ only by object key order.
    expected_outcome: Both bundles produce the same SHA-256 content_hash because hashing uses canonical JSON with sorted keys and excludes body timestamps.
    verification_cmd: "node super-gsd/tools/chronicle/run-self-test.cjs --sac SAC-P117-03"
  - id: SAC-P117-04
    input: Multiple grounded chronicle bundles are published locally in sequence.
    expected_outcome: .planning/chronicles/INDEX.jsonl is append-only and receives one ledger row per publication without rewriting earlier rows.
    verification_cmd: "node super-gsd/tools/chronicle/run-self-test.cjs --sac SAC-P117-04"
  - id: SAC-P117-05
    input: A bundle with validator_verdict other than REPORT_GROUNDED is published without --force.
    expected_outcome: publish.cjs refuses the publication, exits non-zero, and does not write chronicle artifacts or append an index row.
    verification_cmd: "node super-gsd/tools/chronicle/run-self-test.cjs --sac SAC-P117-05"
  - id: SAC-P117-06
    input: A bundle with validator_verdict other than REPORT_GROUNDED is published with --force.
    expected_outcome: publish.cjs permits the publication and records the forced publication state and validator_verdict in the resulting manifest/index evidence.
    verification_cmd: "node super-gsd/tools/chronicle/run-self-test.cjs --sac SAC-P117-06"
  - id: SAC-P117-07
    input: A grounded bundle is published through publish.cjs.
    expected_outcome: The written chronicle body validates against super-gsd/schemas/chronicle.schema.json and the manifest validates against super-gsd/schemas/chronicle-manifest.schema.json.
    verification_cmd: "node super-gsd/tools/chronicle/run-self-test.cjs --sac SAC-P117-07"
  - id: SAC-P117-08
    input: The VTP storage adapter probe runs with SGSD_VTP_MCP_URL unset.
    expected_outcome: "The probe returns {available: false, reason: 'vtp_mcp_routing_not_yet_wired'} and performs no real VTP-MCP write."
    verification_cmd: "node super-gsd/tools/chronicle/run-self-test.cjs --sac SAC-P117-08"
  - id: SAC-P117-09
    input: publish.cjs is asked to route a publication to the VTP backend during P117.
    expected_outcome: The orchestrator uses the VTP stub/probe contract, degrades gracefully when unavailable, and does not pretend real VTP-MCP routing exists.
    verification_cmd: "node super-gsd/tools/chronicle/run-self-test.cjs --sac SAC-P117-09"
  - id: SAC-P117-10
    input: super-gsd/tools/chronicle/sample-publish-bundle.json is published with default local routing.
    expected_outcome: The sample fixture publishes successfully, writes schema-valid artifacts, and appends exactly one INDEX.jsonl row for that publication.
    verification_cmd: "node super-gsd/tools/chronicle/run-self-test.cjs --sac SAC-P117-10"
  - id: SAC-P117-11
    input: The chronicle self-test runner is invoked for the P117 suite and STRUCT checks.
    expected_outcome: run-self-test.cjs exposes SAC-P117-01 through SAC-P117-11 plus STRUCT, and the full suite verifies the storage adapter, publisher, schemas, and fixture paths.
    verification_cmd: "node super-gsd/tools/chronicle/run-self-test.cjs --sac SAC-P117-11 --sac STRUCT"
tasks:
  - id: t1
    title: Implement local and VTP storage backends
    agent: codex-executor
    model: codex
    depends_on: []
    files_touched:
      - super-gsd/tools/chronicle/storage-local.cjs
      - super-gsd/tools/chronicle/storage-vtp.cjs
    input_contract: |
      Read 117-CONTEXT.md, DLB-11 Chronicle Layer R5 invariants, chronicle.schema.json, chronicle-manifest.schema.json, validate-chronicle.cjs, execution-receipt.cjs, and cmb-hash.cjs before editing.
      Implement the two backend modules only: local durable storage and the P117 VTP-MCP stub/probe. Preserve P117 scope by keeping real VTP-MCP wiring out of this task.
    output_contract: |
      storage-local.cjs provides content-addressed local writes beneath .planning/chronicles, writes chronicle body and manifest with tmp+rename atomicity, computes SHA-256 content_hash over canonical sorted-key JSON with no generated body timestamps, and appends exactly one INDEX.jsonl row per successful publication.
      storage-vtp.cjs provides the stub probe contract: without SGSD_VTP_MCP_URL it returns {available: false, reason: 'vtp_mcp_routing_not_yet_wired'}; with the env var set it may report the configured target but must not implement real VTP-MCP publication in P117.
    hypothesis: |
      A narrow backend split keeps storage mechanics testable without coupling the publisher CLI to filesystem and VTP probe details.
    falsifier: |
      This task is false if local writes can leave partial final artifacts, if INDEX.jsonl is rewritten instead of appended, if content_hash changes with JSON key order, or if the VTP backend attempts real routing during P117.
    stop_rule: |
      Stop after backend modules satisfy SAC-P117-01, SAC-P117-02, SAC-P117-03, SAC-P117-04, SAC-P117-08, and STRUCT-level module import checks. Do not edit publish.cjs or run-self-test.cjs in this task.
    verification_cmd: "node super-gsd/tools/chronicle/run-self-test.cjs --sac SAC-P117-01 --sac SAC-P117-02 --sac SAC-P117-03 --sac SAC-P117-04 --sac SAC-P117-08 --sac STRUCT"
  - id: t2
    title: Implement publisher routing and sample bundle fixture
    agent: codex-executor
    model: codex
    depends_on:
      - t1
    files_touched:
      - super-gsd/tools/chronicle/publish.cjs
      - super-gsd/tools/chronicle/sample-publish-bundle.json
    input_contract: |
      Use the t1 backend API, 117-CONTEXT.md, P116 validate-chronicle.cjs behavior, chronicle schemas, and the R5 invariants from DLB-11. Treat REPORT_GROUNDED as the only default publishable validator verdict.
    output_contract: |
      publish.cjs routes to local storage by default, supports explicit backend selection, refuses validator_verdict values other than REPORT_GROUNDED unless --force is passed, and records enough manifest/index evidence to audit forced publications.
      sample-publish-bundle.json is a minimal grounded fixture that exercises the default local route and validates through the P116 chronicle validator before storage.
    hypothesis: |
      Keeping verdict enforcement in the publisher creates one visible gate before any backend can persist ungrounded chronicle evidence.
    falsifier: |
      This task is false if ungrounded bundles publish without --force, if --force publications are not auditable in stored evidence, if VTP routing claims real wiring, or if the sample fixture cannot publish through the default local route.
    stop_rule: |
      Stop after publish.cjs and the sample fixture satisfy SAC-P117-05, SAC-P117-06, SAC-P117-07, SAC-P117-09, and SAC-P117-10. Do not expand the VTP stub beyond the P117 contract.
    verification_cmd: "node super-gsd/tools/chronicle/run-self-test.cjs --sac SAC-P117-05 --sac SAC-P117-06 --sac SAC-P117-07 --sac SAC-P117-09 --sac SAC-P117-10"
  - id: t3
    title: Extend chronicle self-tests for P117 storage adapter
    agent: codex-executor
    model: codex
    depends_on:
      - t1
      - t2
    files_touched:
      - super-gsd/tools/chronicle/run-self-test.cjs
    input_contract: |
      Read the existing run-self-test.cjs style and extend it rather than replacing it. Add SAC-P117-01 through SAC-P117-11 and STRUCT coverage for the storage adapter, publisher, sample fixture, schema validation, and VTP stub behavior.
    output_contract: |
      run-self-test.cjs can execute every P117 semantic acceptance criterion individually and as part of the full suite, including STRUCT checks for expected files, module imports, CLI affordances, and schema-bound outputs.
    hypothesis: |
      A self-test extension gives the ATC gate deterministic evidence for the new storage adapter without duplicating SGSD gates or creating a parallel validator.
    falsifier: |
      This task is false if any SAC-P117 test is missing, if STRUCT does not detect missing files/imports, if tests mutate persistent planning evidence without isolation, or if the suite depends on real VTP-MCP availability.
    stop_rule: |
      Stop when SAC-P117-01 through SAC-P117-11 plus STRUCT pass from run-self-test.cjs and the plan remains PLAN-LOCKED. Do not alter the plan file during execution unless the operator explicitly opens a plan revision.
    verification_cmd: "node super-gsd/tools/chronicle/run-self-test.cjs --sac SAC-P117-01 --sac SAC-P117-02 --sac SAC-P117-03 --sac SAC-P117-04 --sac SAC-P117-05 --sac SAC-P117-06 --sac SAC-P117-07 --sac SAC-P117-08 --sac SAC-P117-09 --sac SAC-P117-10 --sac SAC-P117-11 --sac STRUCT"
---
