# P167-T5 — the live capture found a real type mismatch. Decide what it means.

Read only. Do not change code yet. Answer one question with evidence.

## What the live run produced

The capture reached a real Claude runtime and the model issued the substrate
call. The payload it actually sent differs from the composer-prepared payload
by TYPE, not by content:

```
prepared: {"query":"p167 deterministic live planning fixture",
           "source_types":["research_paper","wiki_page"],
           "limit":5}

actual:   {"query":"p167 deterministic live planning fixture",
           "source_types":"[\"research_paper\",\"wiki_page\"]",
           "limit":"5"}
```

Key order is identical. Values are identical as text. But `source_types` arrived
as a STRING containing JSON, and `limit` arrived as the STRING "5" instead of the
number 5.

## Why this matters more than a test failure

P166's v2 schema requires `source_types` to be an array with `minItems: 1` and
`items` restricted to two enum values, and `limit` to be an integer between 1
and 5. A JSON-encoded string fails both.

So if this type coercion happens in normal production use, then the PreToolUse
hook denies a correctly-prepared, fully-compliant call as `invalid_v2_payload`,
and a legitimate agent is blocked from searching. That would be a production
defect introduced by this phase, discovered only because T5 used a real runtime.

If instead it is an artefact of how THIS harness instructed the model to make the
call, it is a harness bug and production is unaffected.

Those two readings need opposite fixes. Do not guess between them.

## The question

**Does the stringification originate in the harness's own prompt, or in the
runtime's handling of MCP tool inputs?**

Investigate:

- How does `capture-live-runtime.cjs` instruct the model to issue the call? If it
  embeds the payload in prose or as a JSON blob the model must retype, the model
  re-serializing nested values is expected and the harness is at fault.
- Do the T1 fixtures and `assert-hook-contract.cjs` feed `tool_input` with real
  array and number types? If yes, production-shaped input is typed correctly and
  only the live path differs.
- Is there any evidence in this repository, for example P154's frozen
  `154-REAL-MCP-EVIDENCE.json`, showing how real recorded MCP arguments were
  typed? That file is a captured live descriptor and may settle it directly.
  It is FROZEN: read it, never modify it.

## Output

```
ORIGIN: harness_prompt | runtime_behaviour | unresolved
EVIDENCE: <the specific file, line, or recorded payload that decides it>
PRODUCTION_IMPACT: none | legitimate_calls_denied | <describe>
RECOMMENDED_FIX: <one paragraph, naming which file changes and why>
COERCION_RISK: <if the fix is to accept string-encoded arrays and numbers, state
                plainly what validation strength is lost>
ONE_LINER: <summary>
```

Max 250 words after the contract lines. Do not modify any file.
