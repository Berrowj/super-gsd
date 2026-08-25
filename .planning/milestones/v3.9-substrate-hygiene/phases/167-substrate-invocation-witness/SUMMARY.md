---
phase: "167"
slug: substrate-invocation-witness
milestone: v3.9-substrate-hygiene
status: PASS
closed: 2026-08-25
commits:
  - 6aa2f01
  - 9ea0bac
  - f939314
  - 5ec8f1c
  - be6cfa1
  - 386d027
  - a5e1f97
  - e85d396
  - c822dd4
  - e78847f
  - eab7715
  - 99a8790
  - ca43513
  - 879aa4c
  - cc6a3d7
  - 70f92cd
  - 2c237ef
  - 86b6d1f
gates:
  plan_review: GO (round 3, 6/6)
  phase_verifier: PASS, GOAL_MET YES, 6/6 criteria MET
  phase_atc: PASS 9/10 (round 3), 0 CRITICAL, 0 MAJOR, 1 MINOR
  muda: WARN (8/8 wastes)
  installer_registration_guard: 12/12
  t1_hook_contract: 38/38
  t2_witness_correlation: 13/13
  t3_prompt_contracts: 4/4
  t4_propagation: PASS
  t5_live_capture: PASS + independent verify PASS
  feature_propagation_self_test: 15/15
  p166_regression: 6/6
  p154_frozen_evidence: PASS
---

# P167 Substrate Invocation Witness

## What changed for anyone using SGSD

A substrate search that does not conform to P166 policy is now refused by the installed
PreToolUse hook inside the real Claude runtime, and the refusal holds under
bypass-permissions. A conforming search reaches the MCP server exactly once, and the
transcript the model sees is the capped, note-bearing rewrite, never the raw result. If
the rewrite cannot be produced, the model gets a bounded
`substrate_witness_rewrite_failed` object, not the raw payload.

An agent can no longer claim it made a substrate call. The claim is checked against a
witness the hook wrote, bound to the runtime session and the payload digest, HMAC-signed,
and consumed exactly once. Replay, cross-session reuse, an edited row, a missing witness,
and an agent-supplied identifier are all rejected.

The installer refuses before it writes. An install that is going to fail no longer
provisions a witness key, copies runtime files, merges `.claude/settings.json` or writes
broker grants first.

## How the guarantee is enforced

If a substrate tool call is made and the payload does not satisfy the P166 v2 schema,
then PreToolUse returns a deny decision before the call leaves the runtime,
and because the decision is taken in the hook rather than in the agent,
bypass-permissions cannot override it.

If the call is conforming, then it reaches the MCP server once,
and PostToolUse replaces the result through `updatedMCPToolOutput` using the single
composer-owned `capSubstrateResponse`,
and because the hook writes a signed witness row keyed by session and payload digest,
a later claim about that call can be checked rather than believed.

If the rewrite throws, then the hook returns a bounded failure object,
and because it never falls back to the original result, a failed rewrite cannot leak an
uncapped payload into the transcript.

If the capability guard is absent, then the broker withdraws the tool from `tools/list`
and rechecks readiness before forwarding any call,
so a stale discovery cannot be used to reach the server.

## Scope, stated honestly

P167 governs one hook. Four other hooks (`sgsd-intent-classifier.cjs`,
`sgsd-commit-gate.cjs`, `sgsd-quality-gate.js`, `sgsd-session-start.js`) require sibling
modules and nothing verifies those dependencies travel during propagation. That gap is
the subject of phase 168.

## Cost

Two production defects escaped into committed code and were repaired in-phase: the
`parseMcpDomain` array-shape rejection, found only by live capture, and the deferred
installer refusal, found by phase ATC. Five installer guard cases regressed at the start
of the phase and stayed red until close because nothing ran that suite in between.
MUDA returned WARN on all eight wastes; fourteen T5 rework rounds, of which it judges
twelve avoidable.

See AUDIT.md for the full gate table and the adopted process change.
