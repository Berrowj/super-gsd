ORIGIN: harness_prompt
EVIDENCE: `capture-live-runtime.cjs:1123-1127` embeds `JSON.stringify(prepared.payload)` in prose, requiring model reconstruction. The fixture advertises no field types: `fixture-vtp-mcp-server.cjs:160-165` uses only `{type:"object", additionalProperties:true}`. By contrast, T1 passes `prepared.payload` directly as `tool_input` (`assert-hook-contract.cjs:163-173`), with array/number types created at `vtp-context-composer.cjs:433-437`. Frozen P154 records verbatim live MCP args retaining arrays (`154-REAL-MCP-EVIDENCE.json:6,13-24`), while the live-descriptor mirror declares `limit` integer and `source_types` array (`vtp-mcp-input-schemas.v1.json:59-69`).
PRODUCTION_IMPACT: none
RECOMMENDED_FIX: Change `fixture-vtp-mcp-server.cjs` to advertise the real typed `vtp_search_substrate` input schema, and clarify `capture-live-runtime.cjs` so the prompt explicitly requires `source_types` as a JSON array and `limit` as a JSON integer. Retain exact typed comparison. Do not weaken the production hook or add coercion.
COERCION_RISK: No coercion should be added. Accepting encoded strings would weaken strict type validation and admit ambiguous or double-encoded values requiring reparsing before enum/range enforcement.
ONE_LINER: An untyped JSON-in-prose harness caused model reserialization; the repository's real MCP evidence preserves structured types.

<!-- Read-only analysis at HEAD. Salvaged from codex-live-output.txt after the
     wrapper reported a contract violation and dumped combined output. -->
