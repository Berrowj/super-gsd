FINDINGS: 2
CRITICAL: 2
WARNINGS: 0
PASS_RATE: 9/12
ONE_LINER: Prompt transports bypass mechanical validation, while caller coverage remains fail-open inside known files.
VERDICT: FAIL
REQUIRED_CHANGES:

1. Mediate prompt MCP calls through validated transport, or mechanically reject
   missing, mismatched, unfiltered, and limit-6 call records before acceptance.
2. Replace file-wide classifications and wildcard/unanchored allowlists with
   exact occurrence/branch classifications; test rogue occurrences inside known
   files.

Falsifiers 3, 4, and 7 are true.

The enrichment, board, installed researcher, and installed planner callers
retain direct raw MCP tools. Their constraints are prose only; no production
code validates `substrate_call_record`. `assertPromptContracts()` merely
searches prompt text, while its transport captures call `callVtp`
synthetically, bypassing the actual prompt path. Consequently an unfiltered or
limit-6 prompt call can reach transport.

Coverage classifies every occurrence in several known files as an existing site
and permits whole files through `/.*/` or unanchored patterns. Its negative test
injects only a new file, so it misses this defect.

The two fix-round `classify.cjs` entries themselves are exact and anchored.
Items 1-2 and 5-6, 8-12 pass; frozen hashes match, both Phase-48 branches remain
distinct/tested, and T1 is one 11-file commit.

<!-- VERDICT/REQUIRED_CHANGES/body salvaged from codex-live-output.txt after
     codex-exec truncated the written report to 181 B. Reviewed commit 11cea52.
     codex-review exit=0 duration=446s, 193,634 tokens. -->
