# P167 Substrate Invocation Witness

Seeded 2026-08-22 from P166's DEFERRED-1. Not yet discussed, not yet planned.

## Why this exists

P166 made every Node-path substrate call fail closed at a validating gateway.
It could not do the same for four markdown-agent prompt surfaces, because their
runtime cannot inject an MCP transport callback into Node `callVtp`, so they
keep the raw `mcp__vtp-kb__vtp_search_substrate` tool.

P166's mitigation is gateway evidence: every prompt-recorded call must carry a
schema version, intent family, and payload digest matching a composer-prepared
envelope, and `acceptPromptSubstrateCallRecord` rejects anything else, including
on `ok:false`. That catches an agent that drifts, forgets, or reports a bad
record.

It does not catch an agent that calls unfiltered and then reports a clean
record, because nothing witnesses the actual invocation. The unfiltered response
also reaches the agent's own context before any truncation can apply, so F1 is
only closed on the mediated paths.

The phase verifier returned GOAL_MET: NO on exactly this. An independent
adjudication returned DECISION C: the bypass is real and closable, but the
closure is new infrastructure outside P166's locked eleven-file plan.

## The proposed closure, not yet validated

A `PreToolUse` hook that reads the actual `tool_name` and `tool_input`, denies a
call whose payload is not a valid v2 substrate payload, and records a witness
(session id, tool-use id, payload digest) that prompt acceptance can then
correlate against the self-reported record. Paired with a `PostToolUse` step
that caps the response before it enters agent context, which is the only place
F1 can be closed for raw transports.

This project already ships session governance hooks (P146,
`super-gsd/hooks/`) and a commit-seam gate (P147), so the surface exists. What
was absent from P166's reviewed design, and what this phase must settle:

- Hook registration and lifecycle: where it is installed, how it survives
  propagation to installed agents, what happens when it is absent.
- Trust: a hook that can be disabled is a hook an agent can route around. What
  makes its presence tamper-evident, in the way P147 made activation
  tamper-evident.
- Correlation: how a witness row is matched to a prompt-reported record without
  creating a new self-reporting seam one level up.
- Output rewriting: whether `PostToolUse` can actually alter what reaches agent
  context in this runtime, or only observe it. If it can only observe, F1 stays
  open for raw transports and this phase must say so rather than claim closure.
- Real-runtime proof: a test that exercises the actual hook path, not a
  simulation of it. P166's whole lesson is that validating in a test proves
  nothing about production.

## Constraints inherited from P166

- Do not weaken the gateway, the caller inventory, the per-hit cap, or prompt
  record acceptance. This phase adds a witness; it does not replace the evidence
  binding.
- Do not touch VTP-host files. `wiki/LINT-REPORT.md` remains the VTP
  repository's lane.
- `vtp-mcp-input-schemas.v1.json` and the P154 real MCP evidence stay frozen.

## Open question for the operator

If `PostToolUse` cannot rewrite a response before it enters agent context, the
honest options narrow to: remove the raw tool from these four prompts entirely
and accept that they lose substrate access, or accept a permanently bounded
residual and record it as a known limit. That is a scope decision, not a
technical one.
