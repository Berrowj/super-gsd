---
name: self-reported-evidence-is-not-a-witness
description: Requiring an agent to report proof of compliance does not constrain an agent that does not comply
metadata:
  type: anti-pattern
---

# Self-reported evidence is not a witness

P166 (2026-08-22) built a gateway that validates every substrate payload before
transport. For Node call paths this is fail-closed and was proven by showing an
invalid payload never reaches a transport spy.

Four markdown-agent prompts could not be routed through it, because their
runtime cannot inject an MCP transport callback into Node code. The mitigation
was to require each prompt-recorded call to carry gateway evidence (schema
version, intent family, payload digest) and to reject any record that was
missing, direct, digest-mismatched, or unfiltered.

Three independent reviewers passed this design. The phase verifier then failed
it in one sentence: the record is self-reported, so an agent can call
unfiltered, receive the response into its own context, and afterwards submit a
clean prepared record.

**The distinction that matters:** evidence binding catches an agent that drifts,
forgets, or reports honestly-but-wrongly. It cannot catch an agent that does the
wrong thing and then reports the right thing. Only something observing the
actual invocation can do that.

**How to tell them apart:** ask who produces the artifact you are checking. If
the entity being constrained also authors the proof, you have a conformance aid,
not an enforcement mechanism. Say which one you built.

This is the same shape as [[silent-success-reports-health]]: an exit code that
the failing component itself chooses. It is also why
[[harness-production-seam-four-layers]] keeps recurring, since the seam is
exactly where self-report replaces observation.

Closure, where the runtime allows it, is a pre-invocation hook that reads the
real tool input and can deny. Seeded as P167.
