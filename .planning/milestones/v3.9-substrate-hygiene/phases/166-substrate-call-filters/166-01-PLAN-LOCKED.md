---
schema_version: 2
phase: 166
slug: substrate-call-filters
milestone: v3.9-substrate-hygiene
status: PLANNED
revision: 2
governing_decision: .planning/milestones/v3.9-substrate-hygiene/phases/166-substrate-call-filters/CONTEXT.md
depends_on: []
intent: >
  Put every SGSD vtp_search_substrate emission behind one intent-family,
  v2-schema-validating gateway in the executable call path, make raw unfiltered
  calls fail current conformance, and turn a pathological single hit into a
  named degraded artifact rather than a token-cap failure.
execution_mode: serial-codex
expected_ATC_tier: GATE
skip_gates: []
lessons_path: null
prior_errors_lookup: true
semantic_acceptance_criteria:
  - input: >
      The closed production inventory, enumerated by file and branch: the tool
      2/5 enrichment call in super-gsd/agents/sgsd-vtp-enrichment.md; the board
      research call in super-gsd/agents/sgsd-board-researcher.md; the installed
      gsd-phase-researcher.md branch and installed gsd-planner.md branch both
      owned by super-gsd/tools/feature-propagation/audit.cjs; the substrate
      fallback in super-gsd/scripts/sgsd-triage-runtime.cjs; the separate
      architecture_challenge and book_lookup Phase-48 branches in
      super-gsd/tools/vtp-bridge/classify.cjs; and the substrate branch of
      callVtp in super-gsd/scripts/lib/vtp-context-composer.cjs.
    expected_outcome: >
      caller-coverage classifies each named site or branch separately, greps
      every production surface at test time, and fails on any occurrence not in
      that closed caller inventory or the explicit declaration/observation
      allowlist. Each caller selects one named intent and receives gateway-built
      args with non-empty approved source_types and limit no greater than 5;
      no caller owns either policy field.
    verification_cmd: >
      node super-gsd/tests/vtp-substrate-policy/assert-vtp-substrate-policy.cjs --case caller-coverage &&
      node super-gsd/tests/vtp-substrate-policy/assert-vtp-substrate-policy.cjs --case executable-emitters
  - input: >
      Captured invocations from all eight enumerated sites/branches, plus forged
      prepared-call envelopes whose payload is missing source_types, missing
      limit, uses an empty source_types array, or uses limit 6, passed to the
      real callVtp with an injected transport spy.
    expected_outcome: >
      The composer gateway builds and validates every substrate payload against
      v2 immediately before transport. callVtp rejects every invalid candidate,
      records substrate_payload_invalid, and never invokes the transport spy.
      Prompt-retained raw MCP transport is accepted only with matching composer
      gateway evidence; missing, mismatched, or unfiltered recorded calls fail
      conformance. P154 v1 evidence remains immutable; the book branch sends no
      unsupported property and filters returned hits to wiki/books/ client-side.
    verification_cmd: >
      node super-gsd/tests/vtp-substrate-policy/assert-vtp-substrate-policy.cjs --case executable-emitters &&
      node super-gsd/tests/triage-runtime/assert-mcp-arg-contract.cjs --case substrate-policy-required &&
      node super-gsd/tests/triage-runtime/assert-mcp-arg-contract.cjs --case emitted-args &&
      node super-gsd/tests/triage-runtime/assert-real-triage-runtime.cjs --scenario staged-vtp-null-reflection-fallback &&
      node super-gsd/tests/triage-runtime/assert-real-triage-runtime.cjs --scenario vtp-fallback-contained-degradation &&
      node super-gsd/tools/vtp-bridge/classify.cjs --self-test
  - input: >
      A deterministic VTP-shaped response whose first hit names doc:lint-report
      and wiki/LINT-REPORT.md and contains more than 900,000 characters in its
      text field, followed by a normal second hit, passed through the production
      composer and enrichment artifact writer.
    expected_outcome: >
      The first hit is truncated to 16,000 characters without mutating the
      fixture, the second hit is byte-preserved, the call remains ok, and the
      phase artifact has vtp_status success plus a Degraded Retrieval note that
      names doc:lint-report and wiki/LINT-REPORT.md with original and retained
      character counts. No API Error or failed artifact is produced and the
      oversized text is absent from disk.
    verification_cmd: 'node super-gsd/tests/vtp-substrate-policy/assert-vtp-substrate-policy.cjs --case megachunk-degraded-artifact'
  - input: >
      The existing P152 shadow-classifier proof, P154 recorded real MCP evidence,
      staged oversized-response refusal, and the full composer and enrichment
      gate self-tests after both P166 commits.
    expected_outcome: >
      P152 remains text-free and shadow-only; the P154 evidence still validates
      against its frozen v1 live-schema mirror; the current emitter validates
      against P166 v2; the staged 128 KiB response-file refusal is not raised or
      bypassed; and existing VTP disabled, empty-hit, api-error, routing-log, and
      graceful-degradation behavior remains green.
    verification_cmd: >
      node super-gsd/tests/kb-triage-shadow/assert-shadow.cjs &&
      node super-gsd/tests/triage-runtime/assert-mcp-arg-contract.cjs --case real-evidence
      --evidence-file .planning/milestones/v3.6-vtp-bridge/phases/154-mcp-arg-contract/154-REAL-MCP-EVIDENCE.json &&
      node super-gsd/tests/triage-runtime/assert-real-triage-runtime.cjs --scenario staged-vtp-oversized-response &&
      node super-gsd/scripts/lib/vtp-context-composer.cjs --self-test &&
      node super-gsd/scripts/lib/vtp-enrichment-gate.cjs --self-test
known_deadends:
  - Do not remove, split, re-ingest, quarantine, or mutate wiki/LINT-REPORT.md or any VTP-host corpus; ingest repair belongs to the VTP repository and operator lane.
  - Do not copy source_types arrays and limit literals into each executable caller. Prompts may name an intent family, but the composer policy is the only mapping from intent to actual arguments.
  - Do not treat schema validation in a test as enforcement. The composer gateway validates the final substrate payload in callVtp before mcpInvoke; invalid payloads never reach transport.
  - Do not permit a prompt-recorded raw substrate call without matching gateway evidence. Retain raw MCP transport only where the agent runtime cannot inject MCP into callVtp, and remove it from every other prompt tool list.
  - Do not mutate vtp-mcp-input-schemas.v1.json or rewrite 154-REAL-MCP-EVIDENCE.json to make a new policy look historical. P154 remains a frozen live-descriptor proof.
  - Do not make source_types or limit optional in P166, accept an empty source_types array, permit limit above 5, default an unknown intent, or let callers override policy-owned fields.
  - Do not classify demand-baseline-ledger.cjs, route-ledger.cjs, registry labels, docs, tests, schemas, or tool-name constants as callers merely because they contain the tool name.
  - Do not delete Phase-48 book subtype behavior. Replace its unsupported resource_subtype_filter emission with accepted args and an explicit client-side wiki/books/ result filter.
  - Do not raise, bypass, or weaken sgsd-triage-runtime.cjs VTP_RESPONSE_MAX_BYTES. The staged transport refusal remains defense in depth beside the per-hit cap.
  - Do not convert an oversized hit into api_error, empty_hit, a thrown exception, or a missing artifact. Truncation is a warning with usable evidence.
  - Do not mutate the raw response, truncate identity fields, echo discarded text into a log, or use byte count where the contract declares JavaScript character count.
  - Do not add a package, contact live VTP, invoke claude, write real HOME/USERPROFILE, duplicate a gate, or change P152 enforcement, P154 route shaping, fallback predicates, or failure semantics.
tasks:
  - id: P166-T1
    type: shared-substrate-call-policy-and-conformance
    agent: codex
    model: codex
    depends_on: []
    files_touched:
      - super-gsd/scripts/lib/vtp-context-composer.cjs
      - super-gsd/scripts/lib/vtp-enrichment-gate.cjs
      - super-gsd/scripts/sgsd-triage-runtime.cjs
      - super-gsd/schemas/vtp-mcp-input-schemas.v2.json
      - super-gsd/agents/sgsd-vtp-enrichment.md
      - super-gsd/agents/sgsd-board-researcher.md
      - super-gsd/tools/feature-propagation/audit.cjs
      - super-gsd/tools/vtp-bridge/classify.cjs
      - super-gsd/tests/vtp-substrate-policy/assert-vtp-substrate-policy.cjs
      - super-gsd/tests/triage-runtime/assert-mcp-arg-contract.cjs
      - super-gsd/tests/triage-runtime/assert-real-triage-runtime.cjs
    input_contract: >
      Work red-first from the eight-site inventory locked in the first SAC.
      Create the selectable Node runner and record caller-coverage,
      executable-emitters, and substrate-policy-required failing against
      unchanged production. Give every site a stable classification keyed by
      file plus branch: enrichment agent; board-researcher; audit.cjs installed
      phase-researcher patch; audit.cjs installed planner patch; triage fallback;
      classify.cjs architecture_challenge; classify.cjs book_lookup; and composer
      callVtp substrate seam. Grep super-gsd/agents, super-gsd/skills,
      super-gsd/scripts, and super-gsd/tools at test time. Maintain an explicit
      allowlist for declarations and observations such as schemas, registry
      labels, ledgers, tests, and tool-list descriptors. Fail on every match that
      is neither one of the eight classifications nor an exact allowlist entry;
      a newly added or moved occurrence must therefore fail closed.

      In vtp-context-composer.cjs export one immutable SUBSTRATE_CALL_POLICY,
      buildSubstrateArgs(intentFamily,input), and prepareSubstrateCall for the
      executable gateway. Use live values already recorded in P154 evidence.
      Lock: triage -> [research_paper,wiki_page], limit 3;
      phase_research, planning, enrichment, board_research ->
      [research_paper,wiki_page], limit 5; architecture_challenge ->
      [research_paper,wiki_page], limit 3; book_lookup -> [wiki_page], limit 5.
      Require query length at least 3, reject unknown families, return fresh
      arrays, and admit only entity_types, project_ids, speaker_ids, topics, and
      meeting_ids as secondary live filters. Reject caller-supplied source_types
      or limit instead of merging or silently capping them. prepareSubstrateCall
      builds the payload, compiles the v2 search_substrate inputSchema with the
      repository's existing Ajv, validates it, and returns exactly
      {tool,payload,gateway_evidence}. gateway_evidence contains schema_version
      vtp-mcp-input-schemas.v2, intent_family, and payload_sha256 over the UTF-8
      JSON.stringify(payload) bytes. No evidence field enters MCP args. Add a
      prompt-usable composer CLI mode
      --prepare-substrate-call --intent <family> --input-file <json-path> that
      reads a contained {query,...secondaryFilters} object and writes only that
      JSON envelope to stdout; malformed, uncontained, or policy-owning input
      exits nonzero without an envelope.

      Make callVtp recognize the short and fully-qualified substrate tool names
      and accept only args.substrateCall from prepareSubstrateCall; reject an
      args.payload substrate bypass. Immediately before mcpInvoke, verify the
      evidence schema version and payload digest, then revalidate the exact
      substrateCall.payload to be transported against v2. On failure, write the
      normal routing row with failure_reason substrate_payload_invalid, return
      ok:false, and prove mcpInvoke was never entered. Include the same gateway
      evidence on the successful wrapper result. Keep generic non-substrate
      callVtp payload forwarding and routing-log behavior unchanged.

      Create vtp-mcp-input-schemas.v2.json rather than editing v1. Copy the full
      two-tool live descriptor shapes, keep route_and_retrieve unchanged, and
      state that v2 is the 2026-08-18 live descriptor plus the local P166
      current-emission policy. For search_substrate require query, source_types,
      and limit; retain additionalProperties false; require source_types
      minItems 1 and uniqueItems true with items restricted to research_paper or
      wiki_page; and narrow limit to integer 1 through 5. Update
      assert-mcp-arg-contract so current emitted-args compiles v2 and
      substrate-policy-required calls the real callVtp seam with an injected
      spy, proving missing source_types, missing limit, an empty array, limit 6,
      a digest mismatch, and a raw args.payload bypass are rejected before
      transport. Keep v1 and real P154 evidence byte-unchanged. Make real-evidence
      use its frozen v1 validator/replay while current emissions use v2,
      preserving both proofs.

      Replace the triage search branch's local optional-filter copying with the
      triage gateway intent after P154 shapes away internal diagnostics. Route
      staged consume/finalize emission validation and direct mcpInvoke through
      the same prepared result; a staged record carries the out-of-band gateway
      evidence needed to prove its later MCP transport used the exact validated
      payload. Update only exact fallback-args assertions; retain recent-turn
      shaping, route args, predicates, response-file protocol, evidence rows,
      and P152/P154 reason codes.

      Have composeSubAgentSpec include a prepared enrichment substrate envelope.
      The enrichment prompt passes its payload verbatim for tool 2/5 and returns
      its gateway evidence beside the recorded call. The board prompt prepares
      board_research the same way; add Bash access for the composer command.
      These markdown-agent runtimes cannot inject their MCP transport function
      into Node callVtp, so their raw substrate tool remains transport-only and
      every use requires matching gateway evidence. Remove the raw tool from a
      prompt tool list if its runtime exposes a callable mediated transport;
      conformance rejects direct, missing-evidence, digest-mismatched, or
      unfiltered prompt call records in either case.

      In feature-propagation/audit.cjs add a versioned P166 marker and body for
      the separately classified installed researcher and planner contracts,
      teach repair-safe to add it when the old P16 marker already exists, and
      make audit report it missing. Give each installed prompt Bash access to
      prepare its phase_research or planning envelope; as with the canonical
      agents, retain raw MCP transport only because callVtp injection is absent,
      require gateway evidence for every recorded use, and own no arrays or
      limits. Test repair and recorded-call rejection under isolated USERPROFILE
      only.

      In the optional Phase-48 bridge, classify and exercise the two branches
      separately, replacing both duplicated substrate templates with
      architecture_challenge/book_lookup prepared calls passed through callVtp,
      with the existing dispatch shim injected as mcpInvoke. Remove unsupported
      resource_subtype_filter from MCP args and retain only returned hits whose
      normalized rel_path starts wiki/books/ for book lookup. Update its self-test
      to assert v2 validation occurs before its dispatch shim,
      source_types, limit, no unsupported property, client-side book filtering,
      and no shim call for an invalid prepared payload. Preserve whitelist,
      health, timeout, evidence packet cap, failure ledger, and zero-hit
      semantics.
    output_contract: >
      One composer gateway generates and v2-validates every executable substrate
      argument object before transport, while each caller selects only an
      intent. Raw prompt transport is mechanically tied to gateway evidence and
      unfiltered recorded calls fail without rewriting P154 history. All eight
      sites share one selectable contract suite and existing regressions.
    hypothesis: >
      Centralizing source selection, result count, and executable v2 validation
      at the final SGSD emission seam removes F2 and prevents drift, while a
      closed grep inventory exposes any future bypass as a failing test.
    falsifier: >
      Any executable caller owns source_types or limit; callVtp invokes transport
      before validating v2; a prompt call lacks matching gateway evidence; an
      unfiltered or limit-6 candidate reaches a transport spy; v1/evidence
      changes; triage remains query-only; grep finds an unclassified occurrence;
      either Phase-48 branch is collapsed or untested; book lookup sends an
      unsupported field or admits a non-book result; P152/P154 behavior changes;
      a test touches real USERPROFILE; or T1 is not one revertible commit.
    stop_rule: >
      Stop after the three red cases are green, every enumerated branch has a
      captured validated invocation, invalid callVtp payloads cannot reach the
      spy, prompt raw-call records without matching gateway evidence fail,
      caller-coverage fails on an injected unclassified grep occurrence, P154
      real-evidence stays green under unchanged v1 evidence, both triage
      regressions and bridge self-test pass, the diff is limited to the eleven
      listed files, and T1 is one independently revertable commit.
    verification_cmd: >
      node super-gsd/tests/vtp-substrate-policy/assert-vtp-substrate-policy.cjs --case caller-coverage &&
      node super-gsd/tests/vtp-substrate-policy/assert-vtp-substrate-policy.cjs --case executable-emitters &&
      node super-gsd/tests/triage-runtime/assert-mcp-arg-contract.cjs --case substrate-policy-required &&
      node super-gsd/tests/triage-runtime/assert-mcp-arg-contract.cjs --case emitted-args &&
      node super-gsd/tests/triage-runtime/assert-mcp-arg-contract.cjs --case real-evidence
      --evidence-file .planning/milestones/v3.6-vtp-bridge/phases/154-mcp-arg-contract/154-REAL-MCP-EVIDENCE.json &&
      node super-gsd/tests/triage-runtime/assert-real-triage-runtime.cjs --scenario staged-vtp-null-reflection-fallback &&
      node super-gsd/tests/triage-runtime/assert-real-triage-runtime.cjs --scenario vtp-fallback-contained-degradation &&
      node super-gsd/tools/vtp-bridge/classify.cjs --self-test
    expected_ATC_tier: GATE
  - id: P166-T2
    type: per-hit-cap-and-degraded-artifact
    agent: codex
    model: codex
    depends_on: ['P166-T1']
    files_touched:
      - super-gsd/scripts/lib/vtp-context-composer.cjs
      - super-gsd/scripts/lib/vtp-enrichment-gate.cjs
      - super-gsd/scripts/sgsd-triage-runtime.cjs
      - super-gsd/agents/sgsd-vtp-enrichment.md
      - super-gsd/agents/sgsd-board-researcher.md
      - super-gsd/tools/feature-propagation/audit.cjs
      - super-gsd/tools/vtp-bridge/classify.cjs
      - super-gsd/tests/vtp-substrate-policy/assert-vtp-substrate-policy.cjs
      - super-gsd/tests/triage-runtime/assert-real-triage-runtime.cjs
    input_contract: >
      Work red-first from megachunk-degraded-artifact. Generate in the test
      process a first hit with at least 900,001 text characters, doc_id
      doc:lint-report, chunk_id chunk:lint-report, rel_path
      wiki/LINT-REPORT.md, plus a small second hit. Deep-freeze and hash it.
      Pass it through real callVtp with injected mcpInvoke, then through the
      production enrichment result and artifact path in an isolated temporary
      phase. Unchanged code must fail for no named degradation note; merely
      omitting hit text from the existing Markdown table is not a valid red.

      Add pure capSubstrateResponse(response) beside T1's policy. Lock
      SUBSTRATE_HIT_MAX_CHARS to 16000, keeping five maximum text fields under
      the existing 128 KiB staged ceiling before metadata. Recognize top-level
      hits and evidence.hits; clone only affected containers/hits, preserve
      order and non-text fields, and never mutate input. For each string
      hit.text over the ceiling, retain exactly its first 16000 JavaScript
      characters and return a note with reason_code
      vtp_substrate_hit_truncated, zero-based hit_index, doc_id, rel_path,
      chunk_id, original_chars, and retained_chars. Identity fallback order is
      doc_id, rel_path, chunk_id, hit-<one-based-index>. Never include discarded
      text. Apply it in callVtp only for short or fully qualified
      vtp_search_substrate before logging and return. A capped call remains
      ok:true with degradation_notes beside response; other calls retain shape.

      Treat vtp-enrichment-gate.cjs as the defensive artifact boundary because
      enrichmentResult injection can bypass callVtp. Re-run the pure cap over
      injected hits, merge/de-duplicate notes by reason, index, and identity,
      and render Degraded Retrieval for non-empty notes. Each line names doc_id
      and rel_path when present and reports original_chars -> retained_chars.
      Preserve total_hits, status selection, table, gaps, framings, filename,
      and the rule that only an API failure writes API Error. Assert bounded
      artifact size, no discarded suffix, and readEnrichmentArtifact success.

      Update enrichment, board, and installed researcher/planner prompt policy
      blocks to carry degradation_notes into normal output, never retry
      unfiltered, and never convert truncation to failure. The enrichment result
      uses a degradation_notes array; other artifacts name the document visibly.
      No prompt pastes discarded text.

      In direct triage, translate notes through the existing
      triage_vtp_degraded evidence mechanism with the same reason code and a
      next_action containing only identity/counts; add Degraded Retrieval to
      VTP-EVIDENCE.md while exitCode remains 0. In the Phase-48 bridge, cap the
      raw response before packet construction and add its existing
      evidence_packet_size_capped signal plus the named P166 note without
      weakening its total packet cap. Do not apply this path to the staged raw
      response reader: staged-vtp-oversized-response must still reject above
      VTP_RESPONSE_MAX_BYTES.

      Extend composer and gate self-tests for both hit shapes, exact-boundary and
      non-string controls, no mutation, stable note order, and duplicate-note
      collapse. Re-run all T1 cases.
    output_contract: >
      Every SGSD-controlled substrate response is bounded to 16,000 characters
      per hit before artifact synthesis. Oversized evidence remains usable,
      keeps identity/provenance, and creates a small deterministic warning. The
      enrichment artifact, triage evidence, prompts, and optional bridge
      continue while P152/P154 boundaries remain intact.
    hypothesis: >
      A non-mutating cap at both the shared response wrapper and enrichment
      injection boundary contains F1 when filtering misses, while explicit
      provenance notes expose loss without failing a recoverable phase artifact.
    falsifier: >
      The 900k fixture passes only because text is omitted; retained text is not
      exactly 16000; input or normal hit changes; the note omits identity/counts;
      discarded content reaches disk/logs; status becomes failure/empty; either
      response shape bypasses; staged ceiling rises; bridge cap weakens; a prompt
      retries unfiltered; T1/P152/P154 regresses; or T2 is not independently revertible.
    stop_rule: >
      Stop when megachunk-degraded-artifact is red then green, cap/no-mutation
      controls pass, the artifact is successful and bounded with the exact
      warning, T1 and listed P152/P154 regressions stay green, the post-T1 diff
      is limited to nine files, and T2 is one independently revertable commit.
    verification_cmd: >
      node super-gsd/tests/vtp-substrate-policy/assert-vtp-substrate-policy.cjs --case megachunk-degraded-artifact &&
      node super-gsd/tests/vtp-substrate-policy/assert-vtp-substrate-policy.cjs --case cap-shapes &&
      node super-gsd/tests/vtp-substrate-policy/assert-vtp-substrate-policy.cjs --case caller-coverage &&
      node super-gsd/tests/vtp-substrate-policy/assert-vtp-substrate-policy.cjs --case executable-emitters &&
      node super-gsd/tests/triage-runtime/assert-mcp-arg-contract.cjs --case substrate-policy-required &&
      node super-gsd/tests/triage-runtime/assert-mcp-arg-contract.cjs --case emitted-args &&
      node super-gsd/tests/triage-runtime/assert-real-triage-runtime.cjs --scenario staged-vtp-oversized-response &&
      node super-gsd/tests/triage-runtime/assert-real-triage-runtime.cjs --scenario vtp-fallback-contained-degradation &&
      node super-gsd/scripts/lib/vtp-context-composer.cjs --self-test &&
      node super-gsd/scripts/lib/vtp-enrichment-gate.cjs --self-test &&
      node super-gsd/tools/vtp-bridge/classify.cjs --self-test
    expected_ATC_tier: GATE
---

# P166 - Substrate Call Filters

> Revision 2 (2026-08-21) incorporates NOGO round 1 from
> `166-PLANREVIEW-REPORT.md`: executable v2 validation now lives in the
> composer/callVtp gateway, raw prompt calls require matching gateway evidence,
> and the SAC closes over eight explicitly enumerated production branches. T2,
> cap semantics, preservation constraints, and MUDA sizing are unchanged.

Two serial, independently revertable commits close Clarity F1/F2 without
touching VTP ingestion. T1 makes the composer the argument-policy and executable
validation authority, blocks unvalidated transport, updates every active emitter
or installed prompt contract, and adds a strict v2 current-emission schema while
preserving P154 v1 evidence. T2 caps a single hit at 16,000 characters and
propagates a named warning through normal artifacts.

## Caller and ownership map

- `super-gsd/scripts/lib/vtp-context-composer.cjs`: callVtp substrate branch;
  owns intent-to-args policy, v2 validation, gateway evidence, and response cap.
- `super-gsd/agents/sgsd-vtp-enrichment.md`: enrichment tool 2/5 branch;
  consumes the prepared enrichment envelope.
- `super-gsd/agents/sgsd-board-researcher.md`: board_research branch; prepares
  and records the board envelope before its MCP transport.
- `super-gsd/tools/feature-propagation/audit.cjs`: installed
  `gsd-phase-researcher.md` phase_research branch.
- `super-gsd/tools/feature-propagation/audit.cjs`: installed `gsd-planner.md`
  planning branch, classified independently from the researcher branch.
- `super-gsd/scripts/sgsd-triage-runtime.cjs`: reflection-null substrate fallback;
  retains the P154 shaper but obtains and validates policy fields at the gateway.
- `super-gsd/tools/vtp-bridge/classify.cjs`: Phase-48
  architecture_challenge branch.
- `super-gsd/tools/vtp-bridge/classify.cjs`: Phase-48 book_lookup branch,
  separately tested because it applies client-side `wiki/books/` filtering.
- `super-gsd/scripts/lib/vtp-enrichment-gate.cjs` owns the enrichment dispatch
  spec but does not itself transport a substrate call.
- Tool-name rows in ledgers, tests, schemas, registry, and docs are declarations
  or observations, not callers. Every such grep occurrence is exact-allowlisted;
  a new unclassified occurrence fails caller-coverage.

Markdown agents retain the raw MCP tool only where their runtime cannot inject
an MCP transport callback into Node `callVtp`. In that exceptional path the raw
tool is transport-only: the prompt must use the composer-prepared payload
verbatim and return matching schema/intent/digest gateway evidence. A prompt
with a callable mediated transport loses the raw tool from its frontmatter.

Tracked custom-gsd-extract files are historical Genesis reference dumps, not
the current super-gsd installation surface. P166 updates their live SGSD prompt
contracts at feature propagation and does not revive that stale path.

## Order and revertability

P166-T1 is one policy/schema/caller commit. P166-T2 depends on it and is one
response-cap/artifact commit. Reverting T2 restores untruncated responses
without removing filters; reverting T1 removes the policy as a unit. Neither
changes a VTP-host file, frozen P154 v1 schema/evidence, or a gate definition.
Every verification command is Node-only and none invokes claude.
