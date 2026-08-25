# P167-T5 executor — build the live-capture harness (you do NOT run it)

You are the implementer for ONE task: P167-T5, and only the buildable half.

## Authority

`.planning/milestones/v3.9-substrate-hygiene/phases/167-substrate-invocation-witness/167-01-PLAN-LOCKED.md`
revision 3, task `P167-T5`. Its `input_contract` is your specification. Read
`falsifier`, `stop_rule` and `known_deadends` first. T1 to T4 are committed.

## Division of labour for THIS task, read carefully

T5's contract requires launching real Claude Code processes in
bypass-permissions mode across three disposable projects. You cannot do that:
your sandbox returns `EPERM` on process spawn, and you are forbidden from
invoking `claude` under any circumstances.

So build the harness; the orchestrator runs it.

**You write these two files only:**

```
super-gsd/tests/substrate-invocation-witness/fixture-vtp-mcp-server.cjs
super-gsd/tests/substrate-invocation-witness/capture-live-runtime.cjs
```

**You do NOT write** `167-REAL-MCP-HOOK-EVIDENCE.json`. That is produced by
running the harness. Do not fabricate it, do not stub it, do not write a
placeholder. An invented evidence file would be the single worst possible
outcome of this phase, because the entire point of T5 is that the proof is real.

## The fixture

A deterministic stdio MCP server named `vtp-kb` that declares only
`vtp_search_substrate`. It must:

- validate the expected payload per scenario;
- append a redacted row to a caller-supplied append-only log for every
  `tools/call` received;
- return one ordinary hit plus one hit of exactly 16001 JavaScript characters,
  carrying unique raw-response and discarded-tail markers;
- keep `initialize` and `tools/list` traffic distinguishable from `tools/call`,
  so listing can never be counted as an invocation;
- never contact VTP, never read a private corpus, never write outside its
  supplied temporary directory.

## The capture harness

`capture-live-runtime.cjs` with separate `--capture` and `--verify` modes,
covering the three scenarios the plan specifies:

1. **Active path.** Disposable project and profile, real install and merge,
   isolated witness key, fixture as the broker's private upstream, broker as the
   only Claude-visible `vtp-kb`, a grant-bearing test agent, then a fresh
   bypass-permissions Claude process. Exactly two canonical MCP attempts: an
   invalid payload missing P166 policy fields, then a valid composer-prepared
   planning payload. Capture FAILS unless the transcript shows a real tool-use
   event per attempt, the invalid one is denied, the fixture log contains only
   the valid call, and the valid result in the transcript is the PostToolUse
   replacement rather than the fixture's raw result.
2. **Absent guard.** Fresh project, same real install, then delete both hook
   registrations and the hook source without repairing. Fresh Claude process
   through the still-configured broker, explicitly requesting the raw tool.
   Require discovery to succeed with `vtp_search_substrate` absent, plus a
   direct stale `tools/call` outside the model as race falsification. FAILS
   unless the fixture log has zero `tools/call` rows, the stale call receives
   only a bounded `substrate_witness_unavailable`, the transcript has no
   substrate tool result, and neither raw marker appears in model-visible
   content.
3. **Same-user bypass characterisation.** Fresh project, same install, then act
   with the same user's Bash and Write authority: read the private manifest, add
   an alternate `vtp-kb-bypass` server pointing at the fixture, and have a fresh
   Claude process send one non-v2 call through it; then start the upstream
   directly and send a second non-v2 call over stdio. Unique markers separate
   the two. This is PASS only when **both calls succeed**, the log holds exactly
   one row each, and before/after snapshots show no matching witness row. A
   denied, failed, inferred or skipped attempt does NOT satisfy it.

Scenario 3 is deliberately a positive characterisation of the residual the
operator accepted. It must assert the bypass WORKS. Do not "fix" it.

`--verify` re-checks a previously written evidence file against the same
assertions without re-running Claude.

## Evidence shape

Write the schema and atomic-write logic so that a later `--capture` run emits
`167-REAL-MCP-HOOK-EVIDENCE.json` containing everything the plan lists: schema
version, capture time, Claude Code version, bypass mode, hook IDs and
source/registration hashes, broker source/config/manifest hashes, fixture source
hash, prepared and actual payload digests, redacted session and tool-use hashes,
denial reason, invocation count and payload, original and retained character
counts, degradation reason, discarded-marker absence, witness state sequence,
acceptance consumption result, and the separate `absent_guard` object.

## Constraints

Two files. Do not weaken T1 (34/34), T2 (13/13), T3 (4/4), T4's propagation and
guard cases, or any P166 regression.

Frozen byte-unchanged: `super-gsd/schemas/vtp-mcp-input-schemas.v1.json`,
`.planning/milestones/v3.6-vtp-bridge/phases/154-mcp-arg-contract/154-REAL-MCP-EVIDENCE.json`.

No new package. No network. Never invoke `claude`. Do not commit.
No emoji, no em dashes.

## Verification reality

`node --check` and module load checks only. Say plainly that the live capture is
orchestrator-owned and unrun by you. Do not claim any scenario passed.

Emit `PROGRESS: <line>` per unit.

## Report

```
FILES_CHANGED: path (created)
VERIFICATION: `cmd` -> exit N (only what you actually ran)
DEVIATIONS: description | none
BLOCKERS: description | none
ONE_LINER: what the harness does, and the exact command the orchestrator should run to capture
```
