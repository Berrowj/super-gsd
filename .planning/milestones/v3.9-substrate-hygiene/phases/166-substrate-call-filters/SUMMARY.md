---
phase: "166"
slug: substrate-call-filters
milestone: v3.9-substrate-hygiene
status: PASS-WITH-DEFERRED-1
closed: 2026-08-22
commits:
  - 11cea52
  - d63a6e6
  - e216712
  - ec02369
  - dc8e40e
  - 2e40c95
  - ed86dee
gates:
  plan_review: GO (round 2, 0 findings)
  t1_spec_compliance: PASS 11/11 (round 3)
  t1_per_dispatch_atc: PASS after fix (32 lines removed)
  t2_spec_compliance: PASS 12/12 (round 2)
  t2_per_dispatch_atc: PASS 10/10 (round 2)
  phase_verifier: FAIL, GOAL_MET NO, deferred to P167
  phase_atc: PASS after fix (121 lines removed)
  muda: PASS except narrative staleness
  self_test_total: 17/17
  falsification_probes: 4/4 bite
  deferred_count: 1
---
# P166 Substrate Call Filters — PASS-WITH-DEFERRED-1

Closed 2026-08-22 at `ed86dee`. Milestone v3.9-substrate-hygiene.

## What shipped

Every substrate call made from Node code is now built and validated by one
gateway before it can reach transport. `SUBSTRATE_CALL_POLICY` in
`vtp-context-composer.cjs` is the single production owner of the mapping from
intent family to actual arguments; no caller owns `source_types` or `limit`.
`callVtp` compiles the new v2 schema and revalidates the exact payload
immediately before `mcpInvoke`, so an unfiltered, malformed, or limit-6 payload
records `substrate_payload_invalid` and never reaches the transport.

A single oversized hit no longer kills a phase. `capSubstrateResponse` bounds
each hit at 16,000 characters, purely, and emits a note naming the document,
its identity fields, and the original and retained character counts. The
enrichment gate, direct triage, and the Phase-48 bridge each propagate that note
into their normal successful output. The phase artifact survives with usable
evidence instead of failing on a token cap.

Eight production call sites are enumerated and classified individually. The
coverage check greps the production surfaces at test time, consumes each exact
occurrence once, and fails closed on any occurrence that is neither one of the
eight nor an exact declaration allowlist entry.

`vtp-mcp-input-schemas.v1.json` and the P154 real MCP evidence are
byte-unchanged. P152 shadow behaviour is unchanged.

## Verification

17 suites, all exit 0, run unsandboxed by the orchestrator at close. The Codex
sandbox cannot run `executable-emitters` or `staged-vtp-oversized-response`
(`spawnSync EPERM`); the executor reported that limitation rather than claiming
a pass, and the orchestrator ran both.

Four falsification probes, each run before and after every fix round:

| Probe | Result |
|---|---|
| Rogue substrate call appended to `sgsd-triage-runtime.cjs` | caller-coverage fails |
| Rogue substrate call in a new file | caller-coverage fails |
| `gate.run` with `{ok:false}` and no record | throws, writes no artifact |
| 900,001-character hit | exactly 16,000 retained, no leaked tail, input unmutated |

## Gates

| Gate | Result |
|---|---|
| Plan review round 1 | NOGO, 1 CRITICAL |
| Plan review round 2 | GO, 0 findings |
| T1 spec compliance | FAIL 9/12, FAIL 10/11, then PASS 11/11 |
| T1 per-dispatch ATC | FAIL 7/10, fixed, 32 lines removed |
| T2 spec compliance | FAIL 11/12, then PASS 12/12 |
| T2 per-dispatch ATC | FAIL 7/10, then PASS 10/10 |
| Phase verifier | FAIL, GOAL_MET NO, see deferred |
| Phase ATC | FAIL 7/10, fixed, 121 lines removed |
| MUDA | PASS except narrative staleness, see WASTE.md |

Six fix rounds. Every one was triggered by an independent reviewer finding a
real defect, and three of them closed a path by which an unfiltered call or an
uncosted payload could still get through.

## DEFERRED-1: prompt transport has no invocation witness

The phase verifier returned GOAL_MET: NO and it is right.

Four surfaces are markdown-agent prompts, not Node code: `sgsd-vtp-enrichment`,
`sgsd-board-researcher`, and the installed `gsd-phase-researcher` and
`gsd-planner` patches. They hold the raw `mcp__vtp-kb__vtp_search_substrate`
tool because their runtime cannot inject an MCP transport callback into Node
`callVtp`. P166 requires each such use to carry composer gateway evidence, and
`acceptPromptSubstrateCallRecord` rejects a record that is missing, direct,
digest-mismatched, unfiltered, or limit-6, including on `ok:false`.

But that record is self-reported. Nothing witnesses the actual invocation. An
agent can call unfiltered, receive the megachunk into its own context, and then
submit a clean prepared record. As the adjudicator put it: the evidence binding
"prevents acceptance of missing, drifted, or invalid records and catches normal
agent nonconformance; it does not attest the invocation, block raw calls, or
keep their responses out of context."

This is not an implementation gap. It is the limit of the design the plan locked
and the plan review passed as GO. An independent adjudication returned DECISION
C, new phase: the closure is a `PreToolUse` hook validating the actual
`tool_input`, denying invalid calls, and recording session and tool-use
witnesses, paired with `PostToolUse` response capping before the response enters
agent context. The hook surface is viable here (this project already ships
session governance hooks from P146), but registration, lifecycle, trust,
correlation, and real-runtime proof were all absent from the reviewed design and
need planning.

Seeded as phase 167.

The dynamic-tool-name evasion the verifier also raised was adjudicated
theoretical: agent tools resolve to a canonical name at runtime, which a
`PreToolUse` hook observes regardless of how source text constructed it.

## Revertability

The plan promised two commits; the phase shipped six code commits because of the
fix rounds. Rather than rewrite history, the contract is restated as ranges and
proven mechanically in `166-REVERT-PROOF.md`: reverting T2's two commits leaves
T1's gateway and filters working, and reverting T1's four then returns the tree
byte-identical to the pre-phase baseline.

## Not done, deliberately

No VTP-host file was touched. `wiki/LINT-REPORT.md` is still oversized on the
VTP side; ingest repair belongs to the VTP repository and the operator lane.
