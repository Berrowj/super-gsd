# P167-T3 executor — four-surface fail-closed prompt contract

You are the implementer for ONE task: P167-T3. T1 and T2 are complete and
committed at `be6cfa1`. Do not start T4 or T5.

## Source of truth

`.planning/milestones/v3.9-substrate-hygiene/phases/167-substrate-invocation-witness/167-01-PLAN-LOCKED.md`
revision 3, task `P167-T3`. Its `input_contract` is your specification. Read
`falsifier`, `stop_rule` and `known_deadends` before writing.

## What T3 does

The two canonical agent prompts lose the raw substrate tool from their
frontmatter entirely. Their bodies keep a conditional raw-call contract, because
T4 later derives installed copies that do carry the grant, but only after the
broker is the sole vtp-kb definition and both hooks are verified.

The contract each surface must follow:

- Before any raw substrate transport, run the production witness readiness
  command for the current project and session.
- If readiness is missing, stale, duplicated, keyless, or cannot prove both
  project registrations, do not call the raw tool. Emit VTP_STATUS
  `unavailable_or_bypassed` with reason `substrate_witness_unavailable` and
  continue through the existing graceful-degradation path.
- After the raw tool returns, write the exact P166 call record and run the
  existing `--accept-substrate-call-record` command, which now consumes T2's
  rewritten witness. If it exits nonzero, discard all substrate-derived content:
  do not summarise it, quote it, persist it, or retry it. Emit the same explicit
  degradation reason.
- Do not instruct the model to cap response text itself. T1's PostToolUse is the
  only pre-model cap for raw prompt calls and it reuses `capSubstrateResponse`.
- When acceptance succeeds, carry hook-authored `degradation_notes` through the
  existing normal output path.

## Classify four surfaces, not two

The test must classify enrichment, board-researcher, installed
gsd-phase-researcher and installed gsd-planner separately, and model the
installed marker contract that T4 will propagate. T3 does NOT modify
`audit.cjs`; T4 owns the derived grants as a separately revertible unit.

For each surface assert: it keeps its P166 intent family and composer-prepared
payload; it carries no `source_types` or `limit` literal of its own; it does not
ask for `tool_use_id`; and it cannot accept a response until readiness and
post-call acceptance both succeed.

Also assert both canonical frontmatter tool lists are raw-substrate-free.

## Method

Red first. Get the assertions failing against the current prompts before you
change them.

## What must not change

Every other P166 tool, query preparation, gateway evidence, intent family,
artifact behaviour and optional-VTP semantic stays exactly as it is.

Do not weaken T1 (34/34), T2 (13/13), or any P166 regression:
`caller-coverage`, `prompt-record-acceptance`, `executable-emitters`,
`megachunk-degraded-artifact`, `cap-shapes`, `repair-safe-t2`.

Frozen byte-unchanged: `super-gsd/schemas/vtp-mcp-input-schemas.v1.json`,
`.planning/milestones/v3.6-vtp-bridge/phases/154-mcp-arg-contract/154-REAL-MCP-EVIDENCE.json`.

Three files only. No new package, no network, never invoke `claude`.
Do not commit. No emoji, no em dashes.

## Honesty bound

The plan under-claims deliberately per an operator ruling: this closes
forgetfulness, shortcuts and prompt drift in generated SGSD surfaces, and does
NOT stop a same-user actor with Bash and Write from writing a different prompt,
registration, or direct upstream call. Do not write prompt or comment wording
implying otherwise.

## Two hard-won lessons from this phase

1. A test that omits an argument production always supplies passes through a
   branch production never takes, and proves nothing. Drive the real path.
2. Your sandbox cannot run these suites (`EPERM` at `mkdtemp`). Four fix rounds
   were burned earlier on a confident root cause that measurement disproved. If
   something fails and you cannot execute it, say what you would measure rather
   than asserting why it failed.

## Speed

Wrappers have been killed repeatedly around the twenty minute mark. Apply edits
early, emit `PROGRESS: <line>` per unit starting with the first edit, and keep
verification to `node --check`. The orchestrator runs the suites.

## Report

```
FILES_CHANGED: path (created|modified)
VERIFICATION: `cmd` -> exit N (only what you actually ran)
DEVIATIONS: [plan rule] description | none
BLOCKERS: description | none
ONE_LINER: substantive summary
```
