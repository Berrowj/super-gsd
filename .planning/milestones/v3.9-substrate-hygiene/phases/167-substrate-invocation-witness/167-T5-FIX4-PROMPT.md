# P167-T5 fix round 4 — the type mismatch is the harness's fault, fix it there

The analysis is settled and you do not need to re-derive it.

## Verdict

```
ORIGIN: harness_prompt
PRODUCTION_IMPACT: none
```

The live model sent `source_types` as a JSON-encoded string and `limit` as a
string because the harness gave it no better option:

- `capture-live-runtime.cjs:1123-1127` embeds `JSON.stringify(prepared.payload)`
  in prose, so the model has to retype the payload by hand.
- `fixture-vtp-mcp-server.cjs:160-165` advertises
  `{type:"object", additionalProperties:true}`, so the tool declares no field
  types for the model to follow.

Production is unaffected, and the repository's own frozen P154 evidence proves
it: real recorded live MCP arguments preserve array types
(`154-REAL-MCP-EVIDENCE.json:6,13-24`), and the live-descriptor mirror declares
`limit` as integer and `source_types` as array
(`vtp-mcp-input-schemas.v1.json:59-69`). T1 passes the payload directly with
real types.

## Required

1. Make the fixture advertise the REAL typed input schema for
   `vtp_search_substrate`, matching the live descriptor: `query` string,
   `source_types` array of the two permitted enum values with `minItems: 1`,
   `limit` integer 1 to 5. A tool that declares its types gives the model the
   shape to send.
2. Make the capture prompt explicit that `source_types` must be a JSON array and
   `limit` a JSON integer, rather than handing the model a stringified blob to
   reconstruct.
3. **Keep the exact typed comparison.** Do not relax it to semantic equality now
   that the cause is known. The assertion was right; the harness was wrong.

## Explicitly forbidden

Do NOT add type coercion anywhere in the production path. Accepting
string-encoded arrays or numbers would weaken validation and admit ambiguous or
double-encoded values that need reparsing before enum and range checks can mean
anything. The hook's strictness is the product of this phase; do not spend it to
make a test pass.

Do not touch the production hook, the composer, the broker, or the v2 schema.

## Scope

Two files: `capture-live-runtime.cjs` and `fixture-vtp-mcp-server.cjs`.

Do not commit. No emoji, no em dashes. Never invoke `claude` yourself.

## Verification note

Run what you can: `node --check`, module load, and the no-token capture case,
which must still print `PROGRESS: harness_entry START` then
`P167_T5_CAPTURE FAIL claude_auth_environment_missing` and exit 1. Invoke it
through PowerShell; a Git Bash invocation of this harness loses stdio on this
machine, which is an environment artefact and not a code defect.

The orchestrator runs the real capture.

Emit `PROGRESS: <line>` per unit.

## Report

```
FILES_CHANGED: path (modified)
VERIFICATION: `cmd` -> exit N (only what you actually ran)
DEVIATIONS: description | none
BLOCKERS: description | none
ONE_LINER: what the fixture now declares, and how the prompt now specifies types
```
