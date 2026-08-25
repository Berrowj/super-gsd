# v3.9-substrate-hygiene — Roadmap (seeded 2026-08-21)

Seeded from the Clarity instance's VTP report (F1/F2, 2026-08-21). Not active;
awaits operator go.

## Phases

| Phase | Slug | Status | Depends on |
|-------|------|--------|------------|
| 166 | substrate-call-filters | [x] PASS-WITH-DEFERRED-1 @ ed86dee | — |
| 167 | substrate-invocation-witness | [x] PASS @ 7b201fc | 166 |

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

## Success criteria status after P167 (milestone close)

1. **MET on the mediated paths, WITNESSED on the prompt surfaces.** The composer
   gateway still v2-validates every Node caller before `mcpInvoke`. The four
   markdown-agent prompt surfaces keep the raw MCP tool, but their self-reported
   gateway evidence is no longer trusted: `acceptPromptSubstrateCallRecord` now
   requires a fresh `rewritten` witness row written by the installed hook, bound to
   the runtime session and the payload SHA-256, HMAC-signed and consumed exactly
   once. An agent that ignores its instructions and calls unfiltered is denied at
   PreToolUse inside the runtime, and a clean record it invents has no witness to
   match. Replay, cross-session reuse, HMAC edits and agent-supplied identifiers are
   rejected.

2. **MET.** A raw prompt transport can no longer deliver an oversized response to
   agent context. The installed PostToolUse hook replaces the tool output through
   the single composer-owned `capSubstrateResponse` and `updatedMCPToolOutput`, so
   the transcript the model sees is capped at 16,000 characters and carries the
   degradation note. When the rewrite fails, the hook returns a bounded
   `substrate_witness_rewrite_failed` object rather than the raw payload.

## Known limit carried forward

P167 governs one hook of seventeen. Four hooks (`sgsd-intent-classifier.cjs`,
`sgsd-commit-gate.cjs`, `sgsd-quality-gate.js`, `sgsd-session-start.js`) require
sibling modules and nothing verifies those dependencies travel during propagation.
Phase 168 carries the install contract that closes it.
