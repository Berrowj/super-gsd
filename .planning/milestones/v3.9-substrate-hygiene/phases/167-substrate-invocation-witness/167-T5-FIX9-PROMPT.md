# P167 — the real PostToolUse response shape, measured. Fix the parser.

Your instrumentation delivered it in one run.

## The measured shape

```
PROGRESS: actual_post_tool_response_shape=
{"type":"array","length":1,
 "items":[{"type":"object","keys":["text","type"],
           "fields":{"text":{"type":"string"},"type":{"type":"string"}}}]}
```

`tool_response` IS the content array. Not `{content:[...]}`. The array itself,
holding one `{type:"text", text:"..."}` block.

## Why the hook rejected it

`sgsd-substrate-invocation-witness.cjs:60-63`, first check in `parseMcpDomain`:

```js
if (!toolResponse || typeof toolResponse !== 'object' || Array.isArray(toolResponse)) {
  throw new Error('malformed_response');
}
```

It rejects arrays outright, then looks for `toolResponse.content`. Production
sends exactly what that line throws on. Every valid substrate search would have
had its results replaced with an error. That is the defect, and it is confirmed
rather than inferred.

## Required

1. Accept BOTH shapes: the bare content array the runtime sends, and the
   `{content:[...]}` envelope the fixtures and the spec describe. Normalize to
   one internal form, then parse the substrate JSON from the text block.
2. Do not assume exactly one block. Find the text block carrying the substrate
   JSON rather than trusting index 0 or a length of 1.
3. **Fail SAFE on this path.** If the response genuinely cannot be parsed, pass
   the ORIGINAL result through untouched and record the condition. Do not replace
   it with an error. A PreToolUse denial protects the user; a PostToolUse rewrite
   failure destroys a legitimate result. Losing the cap on one odd response is a
   far smaller harm than breaking every search, and the staged byte ceiling still
   applies underneath. State in your report which behaviour you implemented.
4. Add hook-contract cases for BOTH shapes, including the bare-array form, so the
   fixtures stop testing a shape production never sends. That gap is why 34
   assertions passed while production was broken.

## Do not

- Do not weaken PreToolUse. Its denial path is proven correct against a live
  runtime and must stay byte-for-byte in behaviour.
- Do not change the 16,000 character cap, the composer, the broker, or the v2
  schema.
- Do not fabricate the evidence file.

## After your change

The pinned digest in `super-gsd/config/repo-settings-overlay.json` must be
refreshed to match the new hook source, or the capture fails with
`overlay_pre_source_hash_drift`. There are two occurrences. Update them, and note
in your report that a hook edit silently invalidates that pin with nothing to
regenerate it automatically.

## Scope

`sgsd-substrate-invocation-witness.cjs`, `assert-hook-contract.cjs`,
`repo-settings-overlay.json`.

T1's suite must stay green plus your new cases, and the orchestrator re-runs
every P166 and P167 suite.

Do not commit. No emoji, no em dashes. Never invoke `claude` yourself. Verify
through PowerShell.

Emit `PROGRESS: <line>` per unit.

## Report

```
FILES_CHANGED: path (modified)
VERIFICATION: `cmd` -> exit N (only what you actually ran)
DEVIATIONS: description | none
BLOCKERS: description | none
ONE_LINER: which shapes are accepted now, and what an unparseable response does
```
