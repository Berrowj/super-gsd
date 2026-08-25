---
milestone: v3.9-substrate-hygiene
status: COMPLETE
opened: 2026-08-21
closed: 2026-08-25
phases: 2
phases_closed: 2
head: 7b201fc
---

# v3.9 Substrate Hygiene

## What the milestone set out to guarantee

1. No super-gsd caller of `vtp_search_substrate` can issue an unfiltered call.
2. A LINT-REPORT-class megachunk cannot fail an enrichment artifact.

Both are now met, by two different mechanisms for two different kinds of caller.

## Phase 166, Substrate Call Filters — PASS-WITH-DEFERRED-1 @ ed86dee

One composer-owned `SUBSTRATE_CALL_POLICY` builds and v2-validates every substrate
payload immediately before `mcpInvoke`, so an unfiltered call cannot reach transport.
Eight production sites are enumerated and individually classified, with grep coverage
that fails closed on a rogue occurrence. `capSubstrateResponse` bounds each hit at
16,000 characters with a named degradation note that propagates through enrichment,
triage and the Phase-48 bridge. The v1 schema and P154 evidence are byte-unchanged.

It could not cover four markdown-agent prompt surfaces, whose runtime cannot take a
transport callback into Node `callVtp`. Those kept the raw MCP tool and reported their
own compliance, which is not evidence. That gap was the DEFERRED-1 and became P167.

## Phase 167, Substrate Invocation Witness — PASS @ 7b201fc

Self-reporting is no longer accepted. The installed PreToolUse hook denies a
non-conforming substrate call inside the real Claude runtime, and the denial holds under
bypass-permissions because the decision is taken in the hook rather than in the agent.
The PostToolUse hook rewrites the result through the same single `capSubstrateResponse`
and `updatedMCPToolOutput`, and when the rewrite fails it returns a bounded
`substrate_witness_rewrite_failed` object rather than the raw payload. Each call leaves
an HMAC-signed witness row bound to the runtime session and payload digest, consumed
exactly once, accepted only in the `rewritten` state, so a claim about a call can be
checked instead of believed. The capability broker withdraws the tool from `tools/list`
when the guard is absent and rechecks readiness before forwarding.

Proven against a real runtime, not a staged response: Claude Code 2.1.243, transport
`real_stdio_mcp`, one fixture-owned `tools/call`, a transcript-observed 16,000-character
replacement with the discarded-tail marker absent.

## What this milestone cost, stated plainly

Two production defects escaped into committed code and were repaired in-phase:

1. `parseMcpDomain` rejected the bare-array `tool_response` shape the live runtime
   actually sends, which would have replaced every valid substrate search with an
   error. No offline test caught it; only the live capture did.
2. The installer provisioned a witness key, copied runtime files, merged
   `.claude/settings.json` and wrote broker grants before refusing an install it had
   already decided to fail. Phase ATC caught it.

Five installer-registration-guard cases regressed at the start of P167 and stayed red
until phase close, because nothing ran that suite between P161 and the close. That is
the same install machinery reported as failing in other repositories.

MUDA returned WARN on all eight wastes, judging twelve of fourteen T5 rework rounds
avoidable.

## Adopted process change

Make the complete twelve-case installer guard suite a required unsandboxed,
path-triggered commit check whenever installer, hook manifest or overlay, merge, audit,
or guard files change, so the first offending commit is rejected rather than the phase
close.

## Known limit carried forward

P167 governs one hook of seventeen. Four hooks (`sgsd-intent-classifier.cjs`,
`sgsd-commit-gate.cjs`, `sgsd-quality-gate.js`, `sgsd-session-start.js`) require sibling
modules and nothing verifies those dependencies travel during propagation. Phase 168
carries the install contract.
