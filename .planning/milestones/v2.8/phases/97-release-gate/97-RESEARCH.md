---
phase: 97
artifact: research
authored_by: orchestrator (Opus)
---

# Phase 97 -- Research

## Sources
- All 35 phase folders v2.2-v2.8 (.planning/milestones/{v2.2..v2.8}/phases/)
- super-gsd/tools/{warp-doctor,warp-mcp,warp-mcp-actions,cockpit-state,state-resolver,double-agent-executor}/
- super-gsd/scripts/lib/sgsd-complete-milestone-self-test.cjs
- .warp/workflows/*.yaml (15 files)
- .agents/skills/*/SKILL.md (7 files)
- super-gsd/docs/SGSD-WARP-* operator-facing docs (8 files)

## Key decisions

### D1 -- Self-test totals (verified 2026-04-29)
- warp-doctor: 17/17
- warp-mcp: 47/47
- warp-mcp-actions: 21/21
- cockpit-state: 19/19
- sgsd-complete-milestone: 8/8
- double-agent-executor: 15/15
- workflows yaml: 15/15
- skills SKILL.md: 7/7
Total: 149/149 assertions across 8 surfaces.

### D2 -- Release readiness scoring (5 dim, 1-5 scale)
| Dim | Score | Rationale |
|---|--:|---|
| Operator UX | 4 | Cockpit + 14 MCP read tools + 3 controlled actions ship; M1-M5 manual checks deferred to operator |
| Backwards compat | 5 | Plain PS fallback preserved everywhere; SGSD runs without Warp |
| Telemetry & observability | 4 | 16 event types + pulse + activity log + state resolver; dashboard panel pending upstream |
| Safety | 5 | 4-tier permissions + 7-cat redaction + READ-ONLY invariants enforced via banned-token tricks |
| Documentation | 4 | 16+ operator-facing docs ship; 1 future-spike (ACP) deferred |
**Weighted total: 22/25 (88%) -- READY-WITH-DEFERRED.**

### D3 -- Critical gaps for operator handoff
1. STATE.md re-sync to v2.7+ (resolver detects drift; non-blocking via projection priority).
2. v2.6 SHIPPED-clean decision (debt rows resolved/accepted-environmental, but operator must call shipping).
3. v1.9 CONTEXT-BENCH full-mode rerun (deferred since Phase 87).
4. M1-M5 manual UI checks (operator-led, cannot be automated).
5. Phase 95 ACP spike re-entry (when Warp ships #7326).
6. SGSD-WARP-UPSTREAM-PROPOSAL.md submission timing (operator decides forum).

### D4 -- PS-compat preservation evidence
- warp-doctor probes work cross-platform (PSParser::Tokenize on win32; node-only fallback elsewhere).
- MCP servers run via node, not PowerShell-specific.
- Workflows .warp/workflows/*.yaml are Warp-only; SGSD core does not depend on them.
- Skills .agents/skills are tool-neutral (Phase 65 AGENTS.md).
- No core SGSD path imports .warp/* or .agents/* surfaces.

### D5 -- Roadmap close trigger
v2.8 closing means the entire SGSD Warp Integration roadmap (35 phases, 63-97) is done.
SUMMARY.md is the durable retrospective; STATE.md drift is operator-corrected post-close.
