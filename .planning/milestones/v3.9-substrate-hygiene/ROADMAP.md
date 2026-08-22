# v3.9-substrate-hygiene — Roadmap (seeded 2026-08-21)

Seeded from the Clarity instance's VTP report (F1/F2, 2026-08-21). Not active;
awaits operator go.

## Phases

| Phase | Slug | Status | Depends on |
|-------|------|--------|------------|
| 166 | substrate-call-filters | [x] PASS-WITH-DEFERRED-1 @ ed86dee | — |
| 167 | substrate-invocation-witness | [ ] seeded | 166 |

## Success criteria

1. No super-gsd caller of vtp_search_substrate can issue an unfiltered call.
2. A LINT-REPORT-class megachunk cannot fail an enrichment artifact.

## Success criteria status after P166

1. **PARTIAL.** True for every Node caller: the composer gateway v2-validates
   each payload immediately before `mcpInvoke`, and an unfiltered or limit-6
   payload never reaches transport. Not fully true for the four markdown-agent
   prompt surfaces, which keep the raw MCP tool because their runtime cannot
   inject a transport callback into Node `callVtp`. Their gateway evidence is
   self-reported, so an agent that ignores its instructions can still call
   unfiltered and then report a clean record. P167 carries the invocation
   witness that would close this.

2. **MET on the mediated paths.** A 900,001-character hit is bounded to exactly
   16,000 characters and the enrichment artifact is written successfully with a
   Degraded Retrieval note naming the document. The same note propagates through
   direct triage and the Phase-48 bridge. It is NOT met for a raw prompt
   transport, where the oversized response reaches agent context before any
   truncation can apply; that half also depends on P167.
