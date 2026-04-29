# SGSD Warp Integration -- Roadmap Summary (v2.2-v2.8)

> Phases 63-97 retrospective. Authored: 2026-04-29 (Phase 97 release gate).
> Roadmap status: ALL-PHASES-CLOSED, READY-WITH-DEFERRED.

## Mission Recap

Goal: make Warp the premium operator control room for SGSD while preserving:

- SGSD remains source of truth and execution engine.
- MCP is the bridge.
- Plain PowerShell fallback works everywhere.
- No upstream Warp patching until proven needed.

## Phase Roll-Up

### v2.2 -- Foundations (Phases 63-67)
- 63: Warp ecosystem audit + integration boundary contract.
- 64: First 5 .warp/workflows shipped.
- 65: AGENTS.md (tool-neutral skill rules).
- 66: WARP.md authored (rule hierarchy + asset index).
- 67: warp-doctor 18 probes (env detection, drift, freshness).

### v2.3 -- MCP Bridge Read-Only (Phases 68-72)
- 68: 14 read-only MCP tool contract designed.
- 69: warp-mcp server.cjs JSON-RPC 2.0 stdio.
- 70-71: 14 tools implemented + 47/47 assertion suite.
- 72: 5 more workflows + operator setup guide.

### v2.4 -- Telemetry Spine (Phases 73-78)
- 73: ORCHESTRATOR-LIVE event taxonomy (16 types).
- 74: writer with appendEvent.
- 75: read-only reader/parser.
- 76: cockpit-state adapter (10/11-section snapshot).
- 77: operator question model (12 questions / 7 attention reasons).
- 78: cockpit fixtures + matcher.

### v2.5 -- Operator Surfaces (Phases 79-84)
- 79: 7 .agents/skills (sgsd-cockpit, sgsd-recover, sgsd-doctor, sgsd-handoff, sgsd-bench, sgsd-route, sgsd-stop).
- 80: monitor packet.
- 81: recovery packet.
- 82: notebook + prompts.
- 83: operator drill scenarios.
- 84: 4 more workflows (controlled action probes).

### v2.6 -- Hardening (Phases 85-88)
- 85: token-waste detection.
- 86: hard 500k do_not_continue:true gate; v2.6 close gate refusing SHIPPED-clean while debt rows open.
- 87: orchestrator-hooks.cjs wire-in (token-waste + context-packet hooks).
- 88: scheduled-audit design.

### v2.7 -- Controlled Actions (Phases 89-93)
- 89: 4 permission tiers + 5 BLOCKED + 8 denial reasons + 3 controlled actions.
- 90: warp-mcp-actions/server.cjs + state-resolver/resolve.cjs (priority truth).
- 91-93: redaction expansion (7 categories), code-review guide, cloud-safe skills.

### v2.8 -- Forward Surface (Phases 94-97)
- 94: SGSD-ACP-MAPPING-SPEC.md (7 concepts + 11 events).
- 95: ACP adapter spike SKIPPED-WAITING-FOR-UPSTREAM (#7326 open).
- 96: Warp upstream proposal pack (telemetry-panel target, draft-only).
- 97: this gate.

## Self-Test Snapshot (Phase 97 run)

| Surface | Assertions | Status |
|---|--:|---|
| warp-doctor | 17/17 | PASS |
| warp-mcp (read tools) | 47/47 | PASS |
| warp-mcp-actions | 21/21 | PASS |
| cockpit-state | 19/19 | PASS |
| sgsd-complete-milestone | 8/8 | PASS |
| double-agent-executor | 15/15 | PASS |
| .warp/workflows yaml | 15/15 | PASS |
| .agents/skills index | 7/7 | PASS |
| **Total** | **149/149** | **PASS** |

## Release Readiness Score

| Dimension | Score (1-5) |
|---|--:|
| Operator UX | 4 |
| Backwards compatibility | 5 |
| Telemetry & observability | 4 |
| Safety (permissions + redaction + READ-ONLY) | 5 |
| Documentation | 4 |
| **Weighted total** | **22/25 (88%)** |

Verdict: **READY-WITH-DEFERRED**.

## Critical Gaps (Operator Handoff)

1. **STATE.md re-sync to v2.7+** -- resolver flags drift; cockpit reads through
   resolver so non-blocking. Operator runs canonical re-sync at convenience.
2. **v2.6 SHIPPED-clean decision** -- debt rows resolved/accepted; operator
   triggers `sgsd-complete-milestone` for v2.6 when ready.
3. **v1.9 CONTEXT-BENCH full-mode rerun** -- deferred since Phase 87.
4. **M1-M5 manual UI checks** -- operator-led, not automatable.
5. **Phase 95 ACP spike re-entry** -- triggers when Warp ships #7326.
6. **SGSD-WARP-UPSTREAM-PROPOSAL.md submission** -- operator chooses forum
   (issue / RFC / private contact).

## Plain PowerShell Fallback (Preserved)

Verified: no core SGSD path depends on .warp/* or .agents/* surfaces. SGSD
runs identically on a PowerShell + node host without Warp installed. This was
the v2.2 contract; it holds at v2.8 close.

Evidence:
- warp-doctor uses PSParser::Tokenize on win32 with node-only fallback.
- MCP servers run via node, not PS-specific.
- Workflows / skills are additive UX, never required.
- All self-tests pass without Warp present.

## What "Premium Operator Control Room" Means Now

Before v2.2 (the pre-integration baseline):
- Operator reads STATE.md by hand.
- No structured telemetry (just commit log).
- No MCP bridge.
- No live cockpit.
- No upstream-pack thinking.

After v2.8:
- Cockpit composes 11-section snapshot through state-resolver (drift-tolerant).
- 14 read-only MCP tools + 3 controlled actions cover query + bounded-write.
- 16 event types stream through ORCHESTRATOR-LIVE.jsonl.
- 7-category redaction guards every operator-visible surface.
- 4-tier permission model + 5 BLOCKED reasons + 8 denial reasons enforce safety.
- 15 .warp/workflows + 7 skills + 16+ operator docs ship.
- Upstream proposal packet ready for operator-chosen submission.

## Closing Note

This roadmap shipped 35 phases across 7 milestones (v2.2 through v2.8).
Every phase carries its own ATC-REVIEW.md verdict; every plan committed
atomically; every executor dispatch hit the orchestrator-hooks wire.
Self-tests are the durable correctness contract -- 149/149 assertions
green at gate.

The operator now owns the deferred items listed above. SGSD continues to
run autonomously when invoked; Warp is now its premium UX layer.

-- end --
