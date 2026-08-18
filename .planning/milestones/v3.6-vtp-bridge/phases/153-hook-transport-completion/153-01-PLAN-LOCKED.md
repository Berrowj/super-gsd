---
schema_version: 2
phase: "153"
slug: "hook-transport-completion"
milestone: "v3.6-vtp-bridge"
status: "PLANNED"
depends_on: ["149", "151", "152"]
intent: "Bind SGSD governance policy to the Claude Code event surface it was written for. The classifier driving P149/P151/P152 is registered to no hook event and never executes live (seam instance #7). Fix the runtime-to-MCP arg contract (instance #8), register UserPromptSubmit with a two-directional live falsifier, and add the one enforcement kind the stack lacks: a block."
execution_mode: "serial-codex"
expected_ATC_tier: "FULL"
skip_gates: []
lessons_path: null
prior_errors_lookup: true
semantic_acceptance_criteria:
  - input: "The vtp-plan stage of sgsd-triage-runtime.cjs run against a real staged query file, emitting args for vtp_route_and_retrieve."
    expected_outcome: "The emitted args object validates against the real vtp_route_and_retrieve JSON schema: context.recent_turns is an array of objects each carrying a text string, not an array of bare strings."
    verification_cmd: "node super-gsd/tests/hook-transport/assert-mcp-arg-contract.cjs --tool vtp_route_and_retrieve"
  - input: "The vtp-consume fallback stage emitting args for vtp_search_substrate."
    expected_outcome: "The emitted args contain only keys the vtp_search_substrate schema accepts (query plus optional typed filters); raw_query, context and fallback_reason are absent from the emitted MCP args."
    verification_cmd: "node super-gsd/tests/hook-transport/assert-mcp-arg-contract.cjs --tool vtp_search_substrate"
  - input: "The live Claude Code settings file after merge-settings.js has installed the repo overlay."
    expected_outcome: "A UserPromptSubmit event is registered and its command resolves to sgsd-intent-classifier.cjs; the assertion reads the real settings file and never inspects the env block."
    verification_cmd: "node super-gsd/tests/hook-transport/assert-registration.cjs"
  - input: "A planning-shaped prompt (how should we architect the retry layer) delivered to the registered UserPromptSubmit hook with a real session id."
    expected_outcome: "A route-decision row is appended naming the matched route (planning-triage) and carrying that session id."
    verification_cmd: "node super-gsd/tests/hook-transport/assert-live-route-decision.cjs --direction positive"
  - input: "An execution-shaped prompt (fix the failing test in parser.cjs) delivered to the same registered hook with a real session id."
    expected_outcome: "A row is appended that explicitly records no match for that session id. An absent row fails the assertion, because absence is indistinguishable from the hook never running."
    verification_cmd: "node super-gsd/tests/hook-transport/assert-live-route-decision.cjs --direction negative"
  - input: "A prompt containing a credential pattern such as an API_KEY assignment, delivered to the Claude Code UserPromptSubmit surface."
    expected_outcome: "The process exits with code 2 and writes an operator-facing reason to stderr naming the matched trigger. The assertion reads the real exit code of a spawned process, not a mocked return value."
    verification_cmd: "node super-gsd/tests/hook-transport/assert-block-kind.cjs --case secret"
  - input: "A benign prompt with no credential pattern delivered to the same surface."
    expected_outcome: "The process exits 0 and writes no block reason; the prompt is not suppressed."
    verification_cmd: "node super-gsd/tests/hook-transport/assert-block-kind.cjs --case benign"
  - input: "A session-governance registry route declaring kind block with an empty or missing reason."
    expected_outcome: "Registry validation rejects the route so a block can never fire mute; the classifier refuses to load it rather than blocking silently."
    verification_cmd: "node super-gsd/tests/hook-transport/assert-block-kind.cjs --case mute-rejected"
  - input: "The existing P152 kb-lookup-triage shadow route after this phase changes."
    expected_outcome: "It remains enforcement kind shadow, injects nothing, and its text-free ledger contract is unchanged; the 28-day metric is not pre-empted."
    verification_cmd: "node super-gsd/tests/kb-triage-shadow/assert-shadow.cjs"
known_deadends:
  - "Porting disler/claude-code-hooks-mastery Python/uv hooks. hooks.yaml sets timeout_sec 2 and uv cold-start on Windows exceeds that on every tool call. That repo also has NO LICENSE file (all-rights-reserved); only the Claude Code event taxonomy and exit-code semantics are used, which are facts about the platform rather than his code."
  - "Asserting the negative direction by checking that no telemetry row exists. Absence is indistinguishable from the hook never running. This is the exact defect that made P150 trust probe report a false negative (seam instance #6)."
  - "Binding all eight unbound hook events for coverage. Five have no policy consumer today; deferred to a follow-up phase gated on a real consumer existing."
tasks:
  - id: "P153-T0"
    type: "seam-fix"
    agent: codex
    model: codex
    depends_on: []
    files_touched:
      - "super-gsd/scripts/sgsd-triage-runtime.cjs"
      - "super-gsd/tests/hook-transport/assert-mcp-arg-contract.cjs"
    input_contract: >
      sgsd-triage-runtime.cjs emits MCP call args that the real MCP tools reject. Reproduced
      this session: for vtp_route_and_retrieve it emits context.recent_turns as an array of
      bare strings, but the tool schema requires an array of objects each with a text string,
      producing a hard MCP -32602 InputValidationError. For vtp_search_substrate it emits
      raw_query, context and fallback_reason, but that tool accepts only query plus optional
      typed filters. Introduce a per-tool arg-shaper at the emission seam so every emitted
      call is schema-valid for its target tool, and add a conformance test that validates
      emitted args against each tool real schema. Do not change routing logic, predicates,
      or which tool is chosen. Only the shape of the emitted args changes.
    output_contract: >
      sgsd-triage-runtime.cjs emits schema-valid args for both tools.
      super-gsd/tests/hook-transport/assert-mcp-arg-contract.cjs validates the emitted args
      of the vtp-plan stage and the vtp-consume fallback stage against the respective tool
      schemas and exits non-zero on any mismatch. The test fails against the pre-fix runtime
      and passes after.
    hypothesis: "The staged protocol fails only at the arg-shaping seam; normalising emitted args per target tool makes the documented execute-verbatim contract actually executable without touching route selection."
    falsifier: >
      The conformance test passes against the unfixed runtime, proving it does not actually
      exercise the defect; or route selection and predicate behaviour change; or a real
      vtp-plan run still produces args rejected by the MCP tool.
    stop_rule: >
      Stop when both emitted arg shapes validate against the real tool schemas and the
      conformance test demonstrably fails on the pre-fix code path. Do not extend to other
      tools not currently emitted.
    verification:
      commands:
        - "node super-gsd/tests/hook-transport/assert-mcp-arg-contract.cjs --tool vtp_route_and_retrieve"
        - "node super-gsd/tests/hook-transport/assert-mcp-arg-contract.cjs --tool vtp_search_substrate"
  - id: "P153-T1"
    type: "hook-registration"
    agent: codex
    model: codex
    depends_on: []
    files_touched:
      - "super-gsd/config/repo-settings-overlay.json"
      - "super-gsd/scripts/merge-settings.js"
      - "super-gsd/registry/hooks.yaml"
      - "super-gsd/hooks/sgsd-intent-classifier.cjs"
      - "super-gsd/tests/hook-transport/assert-registration.cjs"
      - "super-gsd/tests/hook-transport/assert-live-route-decision.cjs"
    input_contract: >
      sgsd-intent-classifier.cjs self-declares as a UserPromptSubmit hook but no
      UserPromptSubmit event is registered in the live settings file, so it never executes.
      repo-settings-overlay.json already declares the wiring and merge-settings.js exists to
      install it. Register the hook through the existing merge path, add the corresponding
      UserPromptSubmit row to hooks.yaml, and build a two-directional live falsifier. If the
      classifier does not already append an explicit no-match row, adding that row is part of
      this task. CRITICAL: never read, print or echo the contents of the settings env block.
      Assertions must inspect only the hooks section by key.
    output_contract: >
      UserPromptSubmit mapped to sgsd-intent-classifier.cjs is registered and reflected in
      hooks.yaml. assert-registration.cjs confirms registration by reading the real settings
      file hooks section only. assert-live-route-decision.cjs proves both directions against
      a real session id: a planning-shaped prompt appends a row naming the matched route, and
      an execution-shaped prompt appends a row explicitly recording no match. Absence of a row
      is treated as failure in the negative direction.
    hypothesis: "The mechanism is complete and only unregistered; installing the declared overlay through the existing merge path makes P149/P151/P152 routing execute live, and an explicit no-match row makes the negative direction observable rather than inferred."
    falsifier: >
      The negative-direction assertion passes when the hook is deliberately unregistered,
      proving it asserts on absence rather than on written negative evidence; or registration
      succeeds but no route-decision row appears for a planning-shaped prompt; or any
      assertion reads the settings env block.
    stop_rule: >
      Stop when registration is confirmed against the real settings file and both directions
      of the falsifier pass, including a deliberate-unregistration control run that must fail.
      Do not bind any other hook event.
    verification:
      commands:
        - "node super-gsd/tests/hook-transport/assert-registration.cjs"
        - "node super-gsd/tests/hook-transport/assert-live-route-decision.cjs --direction positive"
        - "node super-gsd/tests/hook-transport/assert-live-route-decision.cjs --direction negative"
        - "node super-gsd/hooks/sgsd-intent-classifier.cjs --self-test"
  - id: "P153-T2"
    type: "enforcement-kind"
    agent: codex
    model: codex
    depends_on: ["P153-T1"]
    files_touched:
      - "super-gsd/hooks/sgsd-intent-classifier.cjs"
      - "super-gsd/registry/session-governance-hooks.yaml"
      - "super-gsd/tools/codex-hooks/block-secret-leak.cjs"
      - "super-gsd/tests/hook-transport/assert-block-kind.cjs"
    input_contract: >
      The classifier supports four enforcement kinds (directive, suggestion, report_only,
      shadow) and none can block; it has no exit-2 path. Add a fifth kind block whose contract
      is: a matched blocking route produces an operator-facing reason on stderr naming the
      trigger, then exit code 2. Registry validation must reject kind block carrying an empty
      or missing reason so a block can never fire mute. The first consumer is
      block-secret-leak.cjs, which already reads UserPromptSubmit JSON from stdin and blocks
      credential-bearing prompts but is wired only to the Codex hook surface. Promote it to
      dual-surface with one implementation and two callers: the existing Codex .codex/hooks.json
      caller plus the Claude Code surface. Extend, do not duplicate. HARD CONSTRAINT: the P152
      kb-lookup-triage route stays kind shadow. Do not flip it; its 28-day promote-or-kill
      metric has not unlocked. Never print a matched secret value into stderr, logs or
      telemetry; the reason names the trigger, never the captured credential.
    output_contract: >
      A fifth enforcement kind block exists end to end. A credential-bearing prompt on the
      Claude Code surface exits 2 with a stderr reason naming the trigger and no secret
      material; a benign prompt exits 0 unblocked; a registry route declaring block with an
      empty reason is rejected at load. block-secret-leak.cjs serves both surfaces from a
      single implementation. P152 remains shadow and its assert-shadow.cjs still passes.
    hypothesis: "Warning-only enforcement does not change agent behaviour, per the AHE paper where correct middleware warnings were appended to tool output and ignored on the next model turn while hard-block at the shell layer produced the run largest score jump. A real exit-2 blocking kind with a named reason is therefore the missing primitive, and the existing secret-leak guard is a genuine consumer rather than speculative scaffolding."
    falsifier: >
      A credential-bearing prompt is not blocked, or is blocked without a stderr reason naming
      the trigger, or the reason leaks the matched secret; a benign prompt is blocked; a block
      route with an empty reason loads successfully; block-secret-leak.cjs is duplicated rather
      than shared across surfaces; or the P152 shadow route changes behaviour.
    stop_rule: >
      Stop when the block kind fires correctly in both directions on real spawned processes,
      mute blocks are rejected at load, and assert-shadow.cjs still passes. Do not flip P152 to
      blocking and do not add further blocking routes.
    verification:
      commands:
        - "node super-gsd/tests/hook-transport/assert-block-kind.cjs --case secret"
        - "node super-gsd/tests/hook-transport/assert-block-kind.cjs --case benign"
        - "node super-gsd/tests/hook-transport/assert-block-kind.cjs --case mute-rejected"
        - "node super-gsd/tests/kb-triage-shadow/assert-shadow.cjs"
        - "node super-gsd/hooks/sgsd-intent-classifier.cjs --self-test"
---

# P153 — Hook Transport Completion

## Goal

Three phases of governance mechanism (P149 skill-routing, P151 demand baseline, P152
KB-triage shadow) are driven by `sgsd-intent-classifier.cjs`, which self-declares as a
UserPromptSubmit hook. No UserPromptSubmit event is registered in the live settings file,
so none of it executes in a live session. This phase makes the transport real, proves it
with written negative evidence, and adds the one enforcement kind the stack lacks.

Scope was operator-locked on 2026-08-18 to T0 + T1 + T2. Binding the remaining unbound
events is explicitly deferred.

## Context

Full verified evidence is in `CONTEXT.md` (commit 2c76b5d). What was measured this session
rather than assumed:

- The live settings file registers exactly four events; UserPromptSubmit is not among them.
- `repo-settings-overlay.json` already declares the wiring; it was never merged here.
- The triage runtime emits MCP args that the tools hard-reject (`-32602`), so the staged
  "runtime decides, Claude transports" protocol cannot be executed verbatim as its own
  skill specifies. This was discovered by running that protocol during this phase's triage.
- Enforcement kinds today number four, none blocking; the classifier has no exit-2 path.
- `block-secret-leak.cjs` already implements credential blocking, but only on the Codex surface.

These are seam instances #7 and #8 of `harness-production-seam-four-layers`.

## Tasks

**T0** normalises emitted MCP args per target tool and adds a conformance test that fails
on the pre-fix code path. Route selection is untouched.

**T1** registers the hook through the existing merge path and builds the two-directional
falsifier. The negative direction requires a written no-match row; if the classifier does
not emit one today, adding it is part of T1. A deliberate-unregistration control run must
fail, or the falsifier is not falsifying.

**T2** adds the `block` kind (stderr reason naming the trigger, then exit 2), rejects mute
blocks at registry load, and promotes the existing secret-leak guard to dual-surface from a
single implementation. P152 stays shadow.

## Orchestrator-owned (not a Codex task)

`STATE.md` frontmatter `current_phase` is stale at "150" while v3.6 has P151/P152 closed.
This mis-targeted a runtime-derived evidence path during this phase's own triage. State
files are orchestrator-owned per the commit-discipline rules, so this is corrected by the
orchestrator at phase close rather than dispatched to Codex.

## Verification

Each task carries its own commands. Phase-level verification is the nine
`semantic_acceptance_criteria` above, every one of which runs against real data: a real
staged query, the real settings file, real spawned processes and their real exit codes.
No structural greps stand in for behaviour.

## Success Criteria

- Emitted MCP args validate against both real tool schemas; the conformance test fails on
  pre-fix code.
- UserPromptSubmit is registered; a planning-shaped prompt writes a row naming the matched
  route and an execution-shaped prompt writes an explicit no-match row.
- The deliberate-unregistration control run fails the negative assertion.
- A credential-bearing prompt exits 2 with a trigger-naming reason containing no secret
  material; a benign prompt exits 0.
- A `block` route with an empty reason is rejected at load.
- P152 remains shadow and `assert-shadow.cjs` still passes.
- No source copied from the reference repo; no Python added.
