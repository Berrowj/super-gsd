---
status: PASS-WITH-DEFERRED-1
verdict: PASS-WITH-DEFERRED-1
phase: "166"
slug: substrate-call-filters
milestone: v3.9-substrate-hygiene
closed: 2026-08-22
closed_at: ed86dee
deferred: 1
source: recorded close status
---

# P166 close status

This file records the phase's recorded close status so the state resolver can read it
from `<token>-VERIFICATION.md` frontmatter, which is where it looks. It is not a new
verifier run. The verifier transcript is in `VERIFICATION.md` in this directory, and it
captures the round that returned FAIL before the gaps were closed; the phase closed
PASS-WITH-DEFERRED-1 at ed86dee after those fixes, as recorded in
`.planning/STATE.md` and the milestone ROADMAP.

## What closed

One composer-owned `SUBSTRATE_CALL_POLICY` builds and v2-validates every substrate
payload immediately before `mcpInvoke`, so an unfiltered call cannot reach transport.
Eight production sites are enumerated and individually classified with fail-closed grep
coverage. `capSubstrateResponse` bounds each hit at 16,000 characters with named
degradation notes propagated through enrichment, triage and the Phase-48 bridge. The v1
schema and P154 evidence are byte-unchanged.

17/17 suites green unsandboxed plus four falsification probes, across six fix rounds and
five review gates.

## DEFERRED-1

Four markdown-agent prompt surfaces keep the raw MCP tool and their gateway evidence was
self-reported, so nothing witnessed the actual invocation. Adjudicated DECISION C and
seeded as phase 167, which closed PASS on 2026-08-25 and now requires a hook-authored
witness for those surfaces.
