# P166-T2 executor — per-hit cap and degraded artifact

You are the implementer for ONE task: P166-T2. T1 is complete and committed.

## Authority

`.planning/milestones/v3.9-substrate-hygiene/phases/166-substrate-call-filters/166-01-PLAN-LOCKED.md`,
task `P166-T2`. Its `input_contract` is your specification, `falsifier` lists
what makes this fail, `stop_rule` says when to stop. Read `known_deadends`
first. The plan wins over this prompt.

## What T2 is for

A single VTP hit came back with more than 900,000 characters and blew the token
cap, turning a recoverable retrieval into a failed phase artifact. T2 bounds
each hit at 16,000 characters and turns that loss into a named warning that
still names the document, so the phase continues with usable evidence instead
of dying.

The real document is `wiki/LINT-REPORT.md`, doc id `doc:lint-report`, on the VTP
host. Do not touch it. Ingest repair is the VTP repository's lane, not ours.

## Division of labour

You WRITE files. The orchestrator RUNS the spawn-bound suites unsandboxed.
`executable-emitters` cannot run in your sandbox (`spawnSync EPERM`). Do not
claim any command you did not actually run.

## Method, red first

Start from `megachunk-degraded-artifact`. Generate the fixture IN the test
process: a first hit of at least 900,001 text characters with doc_id
`doc:lint-report`, chunk_id `chunk:lint-report`, rel_path
`wiki/LINT-REPORT.md`, plus a small second hit. Deep-freeze and hash it, then
pass it through the real `callVtp` with an injected `mcpInvoke` and on through
the production enrichment result and artifact path in an isolated temporary
phase directory.

Unchanged code must fail because there is no named degradation note. Read this
carefully: merely omitting hit text from the existing Markdown table is NOT a
valid red. If your red passes for that reason, the test is wrong.

## What T1 established, do not break it

T1 landed after three fix rounds and two independent CRITICALs. All of this is
now mechanical and must stay mechanical:

- The composer gateway builds and v2-validates every substrate payload
  immediately before `mcpInvoke`.
- `acceptPromptSubstrateCallRecord` is required for EVERY injected enrichment
  result including `ok:false`. A recordless or invalid-record error must keep
  throwing `vtp_prompt_substrate_contract_invalid` and write no artifact.
- `caller-coverage` classifies each occurrence exactly once and fails closed on
  a rogue call in a known file, in a new file, and on a duplicated
  legitimate-looking line.

Your cap must not become a route around any of it. In particular a capped call
still returns `ok:true` and still carries its gateway evidence.

## Key constraints from the plan

- `SUBSTRATE_HIT_MAX_CHARS` is 16000 JavaScript characters, not bytes.
- `capSubstrateResponse(response)` is PURE. Never mutate the input. Clone only
  affected containers and hits, preserve order and non-text fields.
- Handle both top-level `hits` and `evidence.hits`.
- Each note carries reason_code `vtp_substrate_hit_truncated`, zero-based
  `hit_index`, doc_id, rel_path, chunk_id, original_chars, retained_chars.
  Identity fallback order: doc_id, rel_path, chunk_id, `hit-<one-based-index>`.
- Never include discarded text in a note, a log, or on disk.
- A capped call stays `ok:true` with `degradation_notes` beside `response`.
- The enrichment gate is the defensive boundary because injected results bypass
  `callVtp`. Re-run the pure cap there, merge and de-duplicate notes, render a
  Degraded Retrieval section naming doc_id and rel_path with
  original -> retained counts.
- Do NOT apply the cap to the staged raw response reader.
  `staged-vtp-oversized-response` must still REJECT above
  `VTP_RESPONSE_MAX_BYTES`. Do not raise or bypass that ceiling.
- Truncation is never an api_error, never empty_hit, never a thrown exception,
  never a missing artifact.

## Scope, nine files

```
super-gsd/scripts/lib/vtp-context-composer.cjs
super-gsd/scripts/lib/vtp-enrichment-gate.cjs
super-gsd/scripts/sgsd-triage-runtime.cjs
super-gsd/agents/sgsd-vtp-enrichment.md
super-gsd/agents/sgsd-board-researcher.md
super-gsd/tools/feature-propagation/audit.cjs
super-gsd/tools/vtp-bridge/classify.cjs
super-gsd/tests/vtp-substrate-policy/assert-vtp-substrate-policy.cjs
super-gsd/tests/triage-runtime/assert-real-triage-runtime.cjs
```

Frozen byte-unchanged: `super-gsd/schemas/vtp-mcp-input-schemas.v1.json`,
`.planning/milestones/v3.6-vtp-bridge/phases/154-mcp-arg-contract/154-REAL-MCP-EVIDENCE.json`.

## ATC, learn from T1

T1's ATC found dead residue, a malformed prompt literal, and a test that scanned
`node_modules`. Do not repeat those. Every function you add gets a caller. No
speculative parameters. Do not copy the production tree in a test. Check any
prompt block you edit actually parses as the format it claims.

## Hard rules

No new package. No network. No live VTP. Never invoke `claude`. Tests use an
isolated USERPROFILE/HOME. Do not commit. No emoji. No em dashes.

Emit `PROGRESS: <line>` per meaningful unit.

## Report

```
FILES_CHANGED: path (created|modified)
VERIFICATION: `cmd` -> exit N (only commands you actually ran)
DEVIATIONS: [plan rule] description | none
BLOCKERS: description | none
ONE_LINER: substantive summary
```
