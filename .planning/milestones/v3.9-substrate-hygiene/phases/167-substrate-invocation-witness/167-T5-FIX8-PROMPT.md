# P167 — the live capture found a PRODUCTION defect in the PostToolUse rewrite

Stop and read this before touching anything. The finding is reading 3 from your
last prompt: **the production hook is at fault**, not the harness.

## The evidence, from a real Claude runtime

The fixture RECEIVED and ACCEPTED the valid call:

```json
{"accepted":true,"expectation":"active-valid",
 "payload_keys":["limit","query","source_types"],
 "payload_sha256":"b297b14b6880532f9b1ed5fe1fc880c4f78fbc190b5f2373b8cd9157fac8e555",
 "tool_name":"vtp_search_substrate","traffic_class":"invocation"}
```

That digest is the composer-prepared payload. The policy path worked end to end.

Then PostToolUse replaced the result with an error:

```json
{"hookSpecificOutput":{"hookEventName":"PostToolUse",
 "updatedMCPToolOutput":{"content":[{"type":"text",
   "text":"{\"ok\":false,\"reason\":\"substrate_witness_rewrite_failed:malformed_response\"}"}],
 "isError":true}}}
```

And the model received:

```
e.reduce is not a function.
(In 'e.reduce((t,r)=>t+(r.type==="text"?r.text.length:0),0)', 'e.reduce' is undefined)
```

## What this means in production

A valid, policy-compliant, gateway-prepared substrate call reaches the upstream,
succeeds, and then the agent gets an error instead of its search results. Every
legitimate search would fail this way. This is the exact class of defect the
phase was meant to prevent, introduced by the phase itself, and no fixture test
caught it because the fixtures feed the hook a shape the real runtime does not
send.

## The likely cause

`sgsd-substrate-invocation-witness.cjs:60-79`, `parseMcpDomain`:

```js
if (!Array.isArray(toolResponse.content) || toolResponse.content.length !== 1) {
  throw new Error('malformed_response');
}
```

It demands `content` be an array of EXACTLY ONE text block. Real MCP tool
responses are not constrained that way, and the runtime evidently hands
PostToolUse something whose `content` is absent or shaped differently, hence
both the hook's `malformed_response` and the downstream `e.reduce is undefined`.

## Required

1. Determine the ACTUAL `tool_response` shape PostToolUse receives from this
   runtime. Instrument the hook to dump the received shape, keys and types, with
   values redacted, and let the orchestrator run the capture to get it. Do not
   guess the shape from the MCP specification.
2. Make `parseMcpDomain` accept what the runtime really sends, including more
   than one content block and non-text blocks, extracting the substrate JSON from
   the appropriate block rather than assuming index 0 of a length-1 array.
3. **Fail SAFE, not closed, on this path.** A PreToolUse denial protects the
   user. A PostToolUse rewrite failure destroys a legitimate result. If the
   response genuinely cannot be parsed, the hook must pass the ORIGINAL result
   through unchanged rather than replacing it with an error, and record the
   condition. Losing the cap on an unparseable response is a smaller harm than
   breaking every valid search, and the staged byte ceiling still applies.
   Say explicitly in your report which behaviour you chose and why.
4. Add a hook-contract case that feeds the REAL runtime shape, so the fixtures
   stop testing a shape production never sends.

## Do not

- Do not weaken PreToolUse. The denial path is proven correct and live.
- Do not add type coercion to payload validation.
- Do not fabricate the evidence file.
- Do not change the cap size, the composer, the broker, or the v2 schema.

## Scope

`sgsd-substrate-invocation-witness.cjs`, `assert-hook-contract.cjs`, and
`capture-live-runtime.cjs` for instrumentation.

This changes a production file, so T1's suite must stay at 34/34 plus your new
case, and the orchestrator will re-run every P166 and P167 suite.

Do not commit. No emoji, no em dashes. Never invoke `claude` yourself. Verify
through PowerShell.

Emit `PROGRESS: <line>` per unit.

## Report

```
FILES_CHANGED: path (modified)
VERIFICATION: `cmd` -> exit N (only what you actually ran)
DEVIATIONS: description | none
BLOCKERS: description | none
ONE_LINER: the real response shape, and whether an unparseable response now passes through or errors
```
