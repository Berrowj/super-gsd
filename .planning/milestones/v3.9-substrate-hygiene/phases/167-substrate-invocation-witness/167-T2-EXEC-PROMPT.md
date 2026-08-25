# P167-T2 executor — witness-correlated prompt acceptance

You are the implementer for ONE task: P167-T2. T1 is complete and committed at
`9ea0bac`. Do not start T3 through T5.

## Authority

`.planning/milestones/v3.9-substrate-hygiene/phases/167-substrate-invocation-witness/167-01-PLAN-LOCKED.md`
revision 3, reviewed GO 6/6. Read the `P167-T2` block in full:
`input_contract`, `falsifier`, `stop_rule`. Read `known_deadends` first.

## What T2 is for

P166 made prompt acceptance reject a record that is missing, direct,
digest-mismatched, unfiltered, or limit-6. But the record is written by the
agent, so an agent that called unfiltered can still hand over a clean record.

T1 built the witness: the hook records what actually happened, keyed on
`session_id` plus a digest the hook computes itself.

T2 joins them. Acceptance must now require a matching witness row, so a record
with no corresponding real invocation is refused.

**The correlation must never accept an identifier the agent supplies.** If any
path takes a digest, tool-use id, or session id from the record rather than from
the runtime and the store, that recreates P166's defect one level up. This is
the single most important property of this task.

## What T1 gives you

- `super-gsd/scripts/lib/substrate-invocation-witness-store.cjs` is the store,
  with a producer API. Seed it only through that API, never by writing rows by
  hand, or your test proves nothing about the real shape.
- `substratePayloadDigest` in the composer computes the digest. Reuse it.
- `acceptPromptSubstrateCallRecord` in the composer is the P166 acceptance seam
  you are extending. Extend it; do not fork it.

## Method, red first

The plan enumerates the cases: a rewritten row, pre-only row, missing row,
expired row, HMAC-edited row, wrong session, wrong project, wrong digest, two
identical sequential calls, replay after consumption, and the rest of its list.
Get them failing against current acceptance before you change it.

Use an isolated key, isolated project, HOME and USERPROFILE. Never touch the
real ones.

Two identical sequential calls and replay-after-consumption deserve care: they
are the cases where a naive correlation either rejects a legitimate second call
or accepts a replayed one. Say in your report which way you resolved each and
why.

## Constraints

- Three files only, per `files_touched`. A fourth fails the task.
- Do not weaken P166: the gateway, the eight-site caller inventory, the 16,000
  character cap, and the existing acceptance rejections must all still work.
  `caller-coverage`, `prompt-record-acceptance`, `megachunk-degraded-artifact`,
  `cap-shapes`, `repair-safe-t2` and `executable-emitters` must stay green.
- Do not weaken T1: `assert-hook-contract.cjs` must stay at 34/34.
- Frozen byte-unchanged: `super-gsd/schemas/vtp-mcp-input-schemas.v1.json`,
  `.planning/milestones/v3.6-vtp-bridge/phases/154-mcp-arg-contract/154-REAL-MCP-EVIDENCE.json`.
- The plan under-claims deliberately per an operator ruling: this does not
  defeat an actor with arbitrary same-user Bash and Write. Do not write a
  comment or error string implying stronger protection.
- No new package. No network. Never invoke `claude`. Do not commit.
- No emoji. No em dashes, including in comments.

## Learn from T1's review

Its spec review found a test passing through a non-production branch, because it
omitted an argument the installed CLI always supplies. Make sure every new case
drives the real path. If a test can pass without exercising production, it is
worthless.

## Division of labour

You WRITE files. The orchestrator RUNS the suites unsandboxed. Your sandbox
returns `EPERM` at fixture `mkdtemp` and cannot spawn nested Node processes. Do
not claim a command you did not run; name it in BLOCKERS.

## Progress contract

Emit `PROGRESS: <what just landed>` on each meaningful unit. A poller is
watching.

## Report

```
FILES_CHANGED: path (created|modified)
VERIFICATION: `cmd` -> exit N (only commands you actually ran)
DEVIATIONS: [plan rule] description | none
BLOCKERS: description | none
ONE_LINER: substantive summary, including how you resolved duplicate calls and replay
```

Max 300 words.
