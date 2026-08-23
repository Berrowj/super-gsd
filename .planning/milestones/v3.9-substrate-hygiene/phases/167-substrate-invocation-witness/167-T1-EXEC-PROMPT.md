# P167-T1 executor — witness hook, capability broker, witness store

You are the implementer for ONE task: P167-T1. Do not start T2 through T5.

## Authority

`.planning/milestones/v3.9-substrate-hygiene/phases/167-substrate-invocation-witness/167-01-PLAN-LOCKED.md`
is PLAN-LOCKED at revision 3 and reviewed GO 6/6. Read it in full, then read its
`P167-T1` block. `input_contract` is your specification, `falsifier` lists what
makes this fail, `stop_rule` says when to stop. Read `known_deadends` before
writing anything; each entry is a decision already made.

Read CONTEXT.md and RESEARCH.md beside the plan. RESEARCH gives you the hook
contract facts with file and line citations; treat them as established and do
not re-derive them.

## What this is for, so you can make good judgement calls

P166 closed every substrate call made from Node code. Four markdown-agent
prompts kept the raw MCP tool because their runtime cannot inject a transport
callback, so their compliance is self-reported and nothing sees the real call.

T1 builds the thing that sees it: a `PreToolUse` hook that validates the actual
`tool_input` and denies a non-v2 payload before transport, a `PostToolUse` step
that caps the result before the model reads it, an authenticated witness store,
and a capability broker that withdraws the tool entirely when the guard is
absent.

Read the intent carefully. This phase does NOT claim to defeat an actor with
arbitrary same-user Bash and Write; the operator ruled on 2026-08-22 to accept
that bound. Do not write code or comments implying stronger protection than the
plan claims. Under-claiming is fine, overclaiming is a defect.

## Division of labour

You WRITE files. The orchestrator RUNS the suites unsandboxed and reports exit
codes back.

Your sandbox returns `spawnSync EPERM` for nested Node processes and sometimes
refuses temp-directory creation. Anything spawning a process, including the fake
upstream stdio server, may be unrunnable for you. Do not claim a command you did
not run. Name it in BLOCKERS and let the orchestrator run it. Every P166
dispatch that did this reported honestly; the one that did not was cut off and
reported nothing.

## Method, red first

Build `assert-hook-contract.cjs` and get the cases failing against absent
production first. A test that passes before the code exists proves nothing.

The plan enumerates the cases: valid v2 input, missing `source_types`, missing
`limit`, empty `source_types`, limit 6, malformed stdin, missing session or
tool-use IDs, missing key, duplicate Pre, missing Pre at Post, exact 16,000
boundary, 16,001-character hits, discarded-tail marker, and the broker cases
including deletion of both registrations plus hook source, a stale forced
substrate `tools/call`, a non-substrate `tools/call`, upstream exit, malformed
upstream JSON, and `list_changed` after readiness loss.

Use an isolated project, HOME and USERPROFILE. Never touch the real ones.

## Reuse, do not reimplement

- `capSubstrateResponse` from P166 does the capping. Do not write a second cap.
- `substratePayloadDigest` at `vtp-context-composer.cjs:375` computes the digest.
  The plan permits adding only a public export for it plus the one addition its
  `input_contract` names. Do not restructure the composer.
- The v2 schema is `super-gsd/schemas/vtp-mcp-input-schemas.v2.json`. Do not fork
  it, do not edit it.

## Hard constraints

- Frozen byte-unchanged: `super-gsd/schemas/vtp-mcp-input-schemas.v1.json` and
  `.planning/milestones/v3.6-vtp-bridge/phases/154-mcp-arg-contract/154-REAL-MCP-EVIDENCE.json`.
- Do not weaken P166: the gateway, the eight-site caller inventory, the 16,000
  character cap, and `acceptPromptSubstrateCallRecord` all keep working.
- Do not raise or bypass `VTP_RESPONSE_MAX_BYTES`.
- Five files only, per `files_touched`. A sixth fails the task.
- No new package. No network. Never invoke `claude`. Do not commit.
- No emoji. No em dashes, including in code comments.

## ATC, learn from P166

Its ATC rounds found dead residue, a malformed prompt literal, and a test that
copied the production tree and scanned `node_modules`. Every function you add
gets a caller. No speculative parameters. Do not copy the production tree in a
test. Any comment you write must describe what the code actually does.

## Progress contract

Emit `PROGRESS: <what just landed>` on stdout whenever you finish a meaningful
unit. A poller is watching; long silence reads as a hang.

## Report

```
FILES_CHANGED: path (created|modified)
VERIFICATION: `cmd` -> exit N (only commands you actually ran)
DEVIATIONS: [plan rule] description | none
BLOCKERS: description | none
ONE_LINER: substantive summary
```

Max 300 words.
