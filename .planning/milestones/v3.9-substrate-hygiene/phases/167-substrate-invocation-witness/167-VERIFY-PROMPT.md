# Phase verifier — P167 Substrate Invocation Witness

Goal-backward verification. Read-only. Do not edit files. Do not re-run test suites.

Read the locked plan:
.planning/milestones/v3.9-substrate-hygiene/phases/167-substrate-invocation-witness/167-01-PLAN-LOCKED.md

Judge each of its six `semantic_acceptance_criteria` as MET or NOT MET against the code
as it stands at HEAD, citing file:line for each judgement. Do not accept a task report or
a commit message as evidence; cite the implementation.

## Given results, do not re-measure

guard 12/12 unsandboxed, T1 hook-contract 38/38, T2 witness-correlation 13/13,
T3 prompt-contracts 4/4, T4 propagation pass, feature-propagation self-test 15/15,
P166 policy 6/6, P154 real-evidence pass, T5 live capture PASS and independent verify
PASS (active_invocations 1, absent_invocations 0, same_user_bypass_invocations 2),
bash -n install.sh clean, node --check clean.

Phase ATC round 3 returned PASS 9/10 with no CRITICAL and no MAJOR.
MUDA returned WARN on all eight wastes, with 2 production-code defect escapes.

## What the phase claimed to deliver

An installed PreToolUse hook that denies a non-conforming substrate call in a real
Claude runtime under bypass-permissions; an installed PostToolUse hook that rewrites the
tool output through capSubstrateResponse and updatedMCPToolOutput, never passing the raw
result through; a witness store whose rows are HMAC-signed, session- and digest-bound,
consumed exactly once, and accepted only in the `rewritten` state; a capability broker
that withdraws the tool when the guard is absent; and propagation so the registration
travels to other repositories.

## Questions the verdict must answer

1. Is each acceptance criterion MET, with a citation?
2. The first criterion forbids direct hook invocation or a staged response as evidence.
   Confirm from 167-REAL-MCP-HOOK-EVIDENCE.json that the recorded run went through a real
   installed runtime and a real local MCP server, and say what in the evidence proves it.
3. Any regression in P166 or earlier behaviour?
4. Is there any acceptance criterion that passes structurally but not semantically, in
   the sense of DLB-07: green because a test asserts a shape, not because real data
   flowed through the real path?

End with `GOAL_MET: YES` or `GOAL_MET: NO`, then a line that is exactly
`VERDICT: PASS` or `VERDICT: FAIL`. Bound yourself to about 15 shell commands and emit
the verdict even if your investigation is incomplete. Max 600 words.
