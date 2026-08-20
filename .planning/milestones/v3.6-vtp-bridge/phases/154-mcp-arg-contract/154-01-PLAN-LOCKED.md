---
schema_version: 2
phase: 154
slug: mcp-arg-contract
milestone: v3.6-vtp-bridge
status: PLANNED
revision: 1
depends_on: []
intent: >
  Make every triage-runtime emission for vtp_route_and_retrieve and
  vtp_search_substrate conform to the target tool's versioned live-schema mirror,
  prove the current defect with a red-before-fix staged-CLI test, and close the
  server boundary with successful post-fix calls to both real MCP tools.
execution_mode: serial-codex
expected_ATC_tier: GATE
skip_gates: []
lessons_path: null
prior_errors_lookup: true
semantic_acceptance_criteria:
  - input: >
      A versioned JSON Schema file containing the two MCP input schemas, with
      provenance stating that they mirror the live vtp-kb tool descriptors, plus
      actual invocation packets emitted by the production triage runtime through
      vtp-plan and the reflection-null vtp-consume fallback path.
    expected_outcome: >
      The test loads and compiles the versioned schemas rather than restating them
      inline. The vtp-plan packet validates for vtp_route_and_retrieve, every
      context.recent_turns item is an object with non-empty text and at most the
      optional role, and the fallback packet validates for vtp_search_substrate with
      query plus only supported typed filters. The pre-fix run is captured before
      implementation and exits non-zero on the real emitted packets: route rejects
      a string recent_turn and search rejects raw_query, context, and fallback_reason.
    verification_cmd: 'node super-gsd/tests/triage-runtime/assert-mcp-arg-contract.cjs --case emitted-args'
  - input: >
      Existing staged healthy-route and reflection-null fallback fixtures run after
      the per-tool shaper is installed at every payload-construction seam.
    expected_outcome: >
      Tool choice, fallback predicates, degradation policy, response-file protocol,
      routing rows, and evidence behavior are unchanged; only the external MCP arg
      shapes differ.
    verification_cmd: >
      node super-gsd/tests/triage-runtime/assert-real-triage-runtime.cjs --scenario staged-vtp-healthy &&
      node super-gsd/tests/triage-runtime/assert-real-triage-runtime.cjs --scenario staged-vtp-null-reflection-fallback
  - input: >
      The orchestrator-owned P154 real-call evidence record containing the exact
      post-fix vtp-plan invocation packet and the raw response returned by the live
      mcp__vtp-kb__vtp_route_and_retrieve tool.
    expected_outcome: >
      The recorded tool and args exactly match a freshly regenerated production
      emission, the args pass the pinned route schema, the live result is a non-empty
      structured response, and the record carries no MCP error or isError result.
    verification_cmd: >
      node super-gsd/tests/triage-runtime/assert-mcp-arg-contract.cjs --case real-evidence
      --evidence-file .planning/milestones/v3.6-vtp-bridge/phases/154-mcp-arg-contract/154-REAL-MCP-EVIDENCE.json
  - input: >
      The same orchestrator-owned evidence record containing the exact post-fix
      reflection-null vtp-consume fallback packet and the raw response returned by
      the live mcp__vtp-kb__vtp_search_substrate tool.
    expected_outcome: >
      The recorded tool and args exactly match a freshly regenerated production
      fallback emission, the args pass the pinned search schema and contain no
      unsupported context or diagnostic fields, the live result is a non-empty
      structured response, and the record carries no MCP error or isError result.
    verification_cmd: >
      node super-gsd/tests/triage-runtime/assert-mcp-arg-contract.cjs --case real-evidence
      --evidence-file .planning/milestones/v3.6-vtp-bridge/phases/154-mcp-arg-contract/154-REAL-MCP-EVIDENCE.json
known_deadends:
  - Hand-copying property assertions into the test; the test must compile the one versioned schema source that mirrors the live MCP tool descriptors.
  - Treating local schema conformance as proof of live acceptance; both post-fix emitted packets must also succeed against the real MCP tools.
  - Letting Codex fabricate or simulate the live-call result; its executor sandbox cannot call MCP, so the orchestrator owns both real calls and the evidence write.
  - Passing triage diagnostics through vtp_search_substrate; raw_query, context, and fallback_reason are not accepted search arguments.
  - Changing compose(), route selection, fallbackPredicate(), degradation policy, or the staged response-file protocol to solve an emission-shape defect.
tasks:
  - id: P154-T1
    type: mcp-emission-contract
    agent: codex
    model: codex
    depends_on: []
    files_touched:
      - super-gsd/tests/triage-runtime/assert-real-triage-runtime.cjs
      - super-gsd/schemas/vtp-mcp-input-schemas.v1.json
      - super-gsd/scripts/sgsd-triage-runtime.cjs
      - super-gsd/tests/triage-runtime/assert-mcp-arg-contract.cjs
    input_contract: >
      Declare the exact inputSchema for vtp_route_and_retrieve and
      vtp_search_substrate once in vtp-mcp-input-schemas.v1.json. Include a stable
      schema/version identifier, both fully qualified tool names, and provenance
      saying the declarations mirror the live vtp-kb MCP tool descriptors reproduced
      on 2026-08-18. Preserve the live additionalProperties, required, enum, array,
      item, and nullable constraints; a reduced schema that checks only the known bad
      keys is insufficient. The test must load this file and compile the selected
      tool schema with the repo's Ajv dependency; it must not contain a second inline
      copy of either schema.

      Before editing sgsd-triage-runtime.cjs, create the conformance test and run
      --case emitted-args against the unchanged production staged CLI in an isolated
      temporary SGSD fixture. The command MUST exit non-zero and identify both real
      defects: context.recent_turns[0] is a string for the vtp-plan route packet, and
      raw_query/context/fallback_reason are additional properties on the
      reflection-null vtp-consume search packet. Preserve that red-run command and
      output in the executor task report; do not accept a test that is green before
      the runtime edit.

      Then add one per-tool shaper at the final emission boundary and route every
      route/search payload construction through it, including staged plan/consume,
      staged metadata defaults, and the direct mcpInvoke compatibility path. For the
      route tool, retain raw_query and context but convert each string recent turn to
      {text: <string>}; preserve already-valid {text, role?} items without admitting
      extra keys. For the search tool, emit query and only explicitly supplied live
      typed filters: limit, source_types, entity_types, project_ids, speaker_ids,
      topics, and meeting_ids. The current fallback supplies none, so its exact args
      are {query: rawQuery}. Reject an unknown tool in the shaper rather than using a
      permissive default. Do not alter buildContext/compose's internal string-array
      contract, which tool is chosen, any predicate, or degradation behavior.
    output_contract: >
      One versioned schema authority is consumed directly by a dedicated staged-CLI
      conformance test. The test has a recorded red-before-fix run and is green only
      after the shared shaper makes both actual emitted packets schema-valid. Existing
      staged route/fallback regressions remain green. The task is one reversible
      commit limited to the three named files and has no dependency on P153 or P155
      code.
    hypothesis: >
      Adapting the internal triage context once at the external tool boundary and
      whitelisting search arguments per target schema removes both -32602 failures
      without perturbing the routing mechanism that produced them.
    falsifier: >
      The conformance test passes before the runtime edit, embeds its own schema copy,
      validates a fabricated payload instead of staged CLI output, either emitted
      packet fails its live-mirror schema, a payload-construction path bypasses the
      shaper, existing staged behavior changes, or files outside the three named paths
      are required.
    stop_rule: >
      Stop only after the pre-fix command has demonstrably failed for both defects,
      the post-fix emitted-args command passes for vtp-plan and reflection-null
      vtp-consume, and both named existing staged scenarios pass unchanged. Commit
      only the schema, runtime, and conformance-test files so the task can be reverted
      atomically.
    verification_cmd: >
      node super-gsd/tests/triage-runtime/assert-mcp-arg-contract.cjs --case emitted-args &&
      node super-gsd/tests/triage-runtime/assert-real-triage-runtime.cjs --scenario staged-vtp-healthy &&
      node super-gsd/tests/triage-runtime/assert-real-triage-runtime.cjs --scenario staged-vtp-null-reflection-fallback
    expected_ATC_tier: GATE
  - id: P154-T2
    type: real-mcp-acceptance-evidence
    agent: codex
    model: codex
    depends_on: [P154-T1]
    files_touched:
      - .planning/milestones/v3.6-vtp-bridge/phases/154-mcp-arg-contract/154-REAL-MCP-EVIDENCE.json
    input_contract: >
      This task has an explicit split of labour. The Codex executor MUST NOT attempt,
      simulate, or proxy an MCP call; its sandbox cannot call MCP tools. After T1 is
      committed, the ORCHESTRATOR generates a vtp-plan packet from the production
      runtime with a fixed non-sensitive query, calls the packet's fully qualified
      vtp_route_and_retrieve tool with its args VERBATIM, and records the exact packet
      plus raw structured result. It then drives the production vtp-consume path with
      a deterministic reflection-null route fixture, calls the emitted fully
      qualified vtp_search_substrate tool with those args VERBATIM, and records that
      exact packet plus raw structured result in the same JSON file. No manual arg
      repair is allowed between emission and call.

      The evidence file is versioned and records the runtime commit, capture time,
      fixed query, stage, fallback predicate where applicable, short and fully
      qualified tool names, exact args, raw result, and explicit error/isError state
      for exactly two calls. The Node verifier from T1 owns the executor-safe work: it
      regenerates both packets through the production CLI, deep-compares tool and
      args to the record, validates args from the versioned schema file, and rejects
      missing/duplicate calls, a true isError, any error value, an empty/non-object
      response, or an MCP validation-error response. This verification command
      validates recorded real-call evidence; it does not make either call itself.
    output_contract: >
      154-REAL-MCP-EVIDENCE.json proves that the exact post-fix packets emitted for
      both affected tools were accepted by the live MCP server and returned
      structured non-error responses. The evidence-only commit is independently
      revertible and contains no runtime, routing, predicate, tool-wiring, or policy
      change.
    hypothesis: >
      If the pinned schema mirror and the live MCP server agree, both byte-for-byte
      emitted arg objects will pass local conformance and return non-error live
      responses without orchestrator interpretation.
    falsifier: >
      Either real call returns -32602 or any other MCP error, an evidence arg differs
      from freshly regenerated production output, a response is empty or malformed,
      the orchestrator edits args before calling, the executor claims to have made
      the call, or completing this task requires a source change.
    stop_rule: >
      Stop only when the orchestrator has recorded exactly one successful verbatim
      live call per affected tool and the executor-safe real-evidence verifier exits
      zero. Commit only the JSON evidence file; revert it independently if the live
      proof must be withdrawn.
    verification_cmd: >
      node super-gsd/tests/triage-runtime/assert-mcp-arg-contract.cjs --case real-evidence
      --evidence-file .planning/milestones/v3.6-vtp-bridge/phases/154-mcp-arg-contract/154-REAL-MCP-EVIDENCE.json
    expected_ATC_tier: GATE
---

AMENDMENT-1 (orchestrator, 2026-08-20 overnight, recorded per contract rule 3):
assert-real-triage-runtime.cjs added to T1 files_touched. Its lines 1436-1438 assert
the DEFECTIVE emission shape (args.raw_query / args.fallback_reason on the substrate
fallback), so the fix necessarily updates those assertions to the corrected {query}
shape. Executor correctly refused to exceed its allowlist and blocked. No other scope
change.

# P154 - Triage Runtime MCP Arg Contract

## Goal

Repair only the argument-shape seam between the triage runtime and the two MCP tools.
Internal triage context, routing, predicates, degradation, tool selection, and the
staged transport protocol remain unchanged.

## Execution ownership

P154-T1 is executor-owned and uses Node-only fixtures. It establishes the pinned
schema source, demonstrates the current production failure before changing the
runtime, installs the shaper, and runs local regressions. P154-T2 crosses a boundary
the executor cannot reach: the orchestrator performs both live MCP calls and writes
their results; Codex only validates the evidence offline.

## Order and revertability

P154-T1 must complete before P154-T2 so live evidence can only describe the fixed
emitter. T1 is one three-file source/test commit. T2 is one evidence-only commit.
Neither task consumes P153 or P155 code, and either commit can be reverted without
partially reverting the other.

## Success criteria

- The staged route packet contains typed recent-turn objects and passes the pinned
  vtp_route_and_retrieve input schema.
- The staged fallback packet contains only query (and any future explicitly supplied
  typed filters) and passes the pinned vtp_search_substrate input schema.
- The conformance test is observed failing against the unchanged pre-fix runtime.
- Existing staged route and fallback behavior remains green.
- Both exact post-fix packets are accepted by their real MCP tools and return
  structured non-error responses recorded in the phase evidence file.
