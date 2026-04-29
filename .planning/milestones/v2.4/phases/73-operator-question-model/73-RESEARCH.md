---
phase: 73
artifact: research
created: 2026-04-29
authored_by: orchestrator (Opus, in-session)
---

# Phase 73 -- Research

## Source inputs

- Operator brief 12 questions (this session, verbatim)
- v1.6 Phase 26 (8-question precursor — operator-question-contract)
- Phase 50 (Cockpit Research Dashboard) — pane mapping precedent
- Phase 68 SGSD-WARP-MCP-CONTRACT.md — 14 tools just shipped
- Existing `.planning/metrics/*.jsonl` ledger shapes
- Convergence audit § "Shared Vocabulary" — event type list precedent

## Key decisions

### D1 -- 12-question model supersedes Phase 26's 8-question

Phase 26 operator-question-contract had 8 questions. Operator brief in
this session expanded to 12 (adds: what does this unlock / what should
I read / what command resumes safely / where are tokens going). Phase 73
locks the 12 as the canonical set; Phase 26's 8 are a subset.

### D2 -- MCP tool primacy

Each of the 12 questions has a primary MCP tool (just shipped in v2.3).
The cockpit pane is now a UI projection over the MCP tool's envelope,
not a parallel data source. Phase 76 cockpit-state adapter enforces this
unification.

### D3 -- 16 event types match convergence audit

Audit § "Recommended event vocabulary" listed event types; Phase 73
selects the 16 the cockpit + MCP need. Phase 74 freezes the contract.

### D4 -- 7 missing fields/gaps -> Phase 74-76 owners

Documented in OPERATOR-QUESTION-MODEL.md "Gaps to address" section.
Each gap has explicit phase ownership.

## Forward references

Phase 74: implements 16 event types in ORCHESTRATOR-LIVE.jsonl contract.
Phase 75: wires event writes into orchestrator dispatch.
Phase 76: cockpit-state adapter unifies MCP + legacy ledger reads.
Phase 77: Warp-native cockpit consumes adapter output.
