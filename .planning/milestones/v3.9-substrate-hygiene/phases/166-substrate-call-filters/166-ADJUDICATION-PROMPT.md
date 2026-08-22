# P166 adjudication — is the residual prompt bypass in-phase work, deferred, or a new phase?

You are a fresh reviewer. Do not defer to the verifier or to the executor. Read
only. Decide one question and justify it.

## The situation

P166 put every substrate call behind a composer gateway that v2-validates the
payload immediately before `mcpInvoke`. For Node call paths that is fail-closed
and independently proven: invalid payloads never reach a transport spy.

Four surfaces are markdown-agent prompts, not Node code: `sgsd-vtp-enrichment`,
`sgsd-board-researcher`, and the installed `gsd-phase-researcher` and
`gsd-planner` patches in `feature-propagation/audit.cjs`. They hold the raw
`mcp__vtp-kb__vtp_search_substrate` tool because their runtime cannot inject an
MCP transport callback into Node `callVtp`. P166 requires each such use to carry
composer gateway evidence (schema version, intent family, payload digest), and
`acceptPromptSubstrateCallRecord` rejects a record that is missing, direct,
digest-mismatched, unfiltered, or limit-6, including on `ok:false`.

The phase verifier returned GOAL_MET: NO, VERDICT: FAIL, on this basis:

> Prompt acceptance receives only prepared and self-reported records; it has no
> transport transcript or invocation witness. An agent can call unfiltered, then
> submit the prepared record.

It also noted a dynamically constructed tool name would evade the grep-based
caller inventory, and that a megachunk reaches agent context through a raw
prompt transport before any truncation can apply.

## What you must decide

Choose exactly one:

- **A, in-phase fix.** There is a mechanical closure available now, within the
  eleven-file scope, that materially reduces this. Name it concretely.
- **B, deferred item.** The residual is inherent to a markdown agent holding a
  raw MCP tool, the evidence binding is the best available in-scope mitigation,
  and the phase should close PASS-WITH-DEFERRED with this recorded.
- **C, new phase.** A real closure exists but needs a new mechanism outside this
  phase's scope and plan.

## Consider specifically

This repository already ships session governance hooks (Phase 146,
`super-gsd/hooks/`, live in the repo) and a commit-seam gate (Phase 147). A
`PreToolUse` hook can observe or block a named MCP tool call in the agent
runtime, which is exactly the invocation witness the verifier says is missing.
Establish whether that is actually true here by reading the hook surface, then
judge whether it belongs in P166 or after it.

Weigh honestly: is requiring evidence without a witness worth anything at all,
or is it security theatre? An agent that ignores its instructions and calls
unfiltered must still produce a matching prepared envelope to be accepted, and
the unfiltered response still reaches its own context. Say plainly what the
evidence binding does and does not buy.

Also judge the dynamic-tool-name evasion: is that a realistic bypass for an
agent prompt surface, or a theoretical one not worth code?

## Constraints on your answer

The plan is PLAN-LOCKED and was reviewed GO on exactly this design. Reopening it
is expensive. Recommend A only if the closure is real, bounded, and does not
require replanning.

## Output

```
DECISION: A | B | C
CLOSURE_AVAILABLE: none | <concrete mechanism>
HOOK_VIABLE: YES | NO | PARTIAL, with one line of evidence from the hook surface
EVIDENCE_BINDING_WORTH: <what it buys, what it does not>
DYNAMIC_NAME_RISK: real | theoretical, one line
RECOMMENDED_VERDICT: PASS | PASS-WITH-DEFERRED-<n> | FAIL
ONE_LINER: <summary>
```

Max 300 words after the contract lines.
