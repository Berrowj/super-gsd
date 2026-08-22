DECISION: C
CLOSURE_AVAILABLE: New-phase `PreToolUse` guard validating actual `tool_input`, denying invalid calls, and recording `session_id`/`tool_use_id`/digest witnesses; pair with `PostToolUse` response capping before agent context.
HOOK_VIABLE: YES ,  the wildcard hook reads `tool_name` and `tool_input`, and the live ledger contains canonical substrate calls; Claude’s hook contract supports pre-execution denial. [Hook surface](https://code.claude.com/docs/en/hooks)
EVIDENCE_BINDING_WORTH: It prevents acceptance of missing, drifted, or invalid records and catches normal agent nonconformance; it does not attest the invocation, block raw calls, or keep their responses out of context.
DYNAMIC_NAME_RISK: theoretical ,  agent tools are runtime-resolved to a canonical name, which `PreToolUse` observes regardless of how source text constructed it.
RECOMMENDED_VERDICT: FAIL
ONE_LINER: The bypass is real and closable, but the required invocation-witness and pre-context response-control protocol is new, unplanned infrastructure.

The existing activity logger is observational, truncates arguments, and silently allows failures. P166’s eleven-file plan contains no hook registration or witness protocol. Agent-frontmatter hooks could reduce file expansion, but their lifecycle, trust, correlation, output rewriting, and real-runtime proof were absent from the GO-reviewed design; that requires replanning. Phase 147’s commit seam cannot prevent an MCP response entering agent context.


<!-- Adjudication of the phase verifier's REMAINING_BYPASS finding, run
     as an independent Codex instance at HEAD. The codex-exec wrapper
     reported a contract violation and dumped combined output; this is
     the codex stdout section extracted verbatim. -->
