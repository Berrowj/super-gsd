---
brief: cross-pollination-engine (SGSD side)
date: 2026-08-11
source: 2026-08-11-cross-pollination-handover.md (VTP-authored, BOARD-MEMO 3 SUPPORT/1 OPPOSE)
analyst: SGSD orchestrator
status: FOR SGSD BOARD REVIEW
---

# Analysis — SGSD↔VTP Cross-Pollination Handover

## What it asks SGSD to build
A bidirectional bridge to VTP's new communication surfaces, as four skills:
1. sgsd-triage-first (Phase 0, buildable now) — wrap the EXISTING enrichment
   gate (Step 6.b.5) so every research/planning/blocker question first calls
   vtp_triage, treats the route as advisory, records accept/modify/reject via
   vtp_triage_feedback + a route-decisions.jsonl row.
2. sgsd-taste-feedback (Phase 0, buildable now) — at phase close, log which
   VTP-injected context was actually USED in shipped work (accepted/modified/
   unused + reason), keyed by artefact ID. This ledger is the defensible asset.
3. sgsd-cross-pollinate-plan (GATED on VTP Phase A) — cluster-informed planner
   injection with citations.
4. sgsd-problem-match (GATED on VTP Phase B) — blocker-brief precedent lookup +
   resolved-blocker back-fill of the problem ledger.

## Strategic fit (strong)
- The bridge is mutually load-bearing: SGSD's dispatch volume IS the organic
  demand evidence VTP's Phase-0 gate requires (20+ inadequate-path queries in
  4 weeks). We already produce dozens of KB questions/day.
- Skills 1-2 extend existing SGSD machinery (enrichment gate, phase close),
  not new parallel gates — aligns with the always-on-runtime direction v3.5
  just shipped, and with the anti-slop 'extend, don't duplicate' rule.
- The taste ledger (skill 2) is genuinely the compounding asset: labelled
  preference data VTP cannot buy. Machine-cadence, human-auditable.

## THE load-bearing risk (must resolve before any build)
- vtp_triage and vtp_triage_feedback are declared LIVE, but they DO NOT appear
  in this session's vtp-kb MCP toolset (only the older route/plan/idea tools
  resolve). VTP server is healthy (91 books/90 research/88 meetings) — so the
  most likely cause is a STALE MCP CHILD predating vtp-triage-v2, not a missing
  ship. This is the exact harness-vs-production seam that recurred 6x this
  milestone. PRECONDITION: restart the session/MCP child, confirm vtp_triage +
  vtp_triage_feedback resolve and honour their contracts (execution.performed=
  false, zero writes, reason required on reject), BEFORE writing skill code.

## Secondary risks
- Write-path safety: skill 4 back-fills a problem ledger and skill involves
  stage-then-merge; direct writes to idea-developments.json are a named clobber
  hazard. All Phase-0 work is advisory/zero-write, so this is deferred with
  Phase B — but the skill contracts must bake in the human gate now.
- Demand-evidence honesty: the 4-week 20-query falsifier only means something
  if 'existing path inadequate' is recorded truthfully, not rubber-stamped.
  sgsd-triage-first must make the override reason a required, closed-vocab field.
- Scope creep: only skills 1-2 are in scope now. 3-4 are gated on VTP Phase A/B
  which are NOT built. Board must hold the line: build 1-2, stub the contracts
  for 3-4, do not pre-build against unbuilt surfaces.

## Recommended SGSD position (for the board to accept/amend/reject)
BUILD Phase 0 (skills 1-2) as one small milestone, GATED on the MCP-surface
precondition above, with: (a) skill 1 as an extension of Step 6.b.5 not a new
gate; (b) closed-vocab override reasons; (c) skill 2's ledger schema v1 now,
v2-ready; (d) skills 3-4 contract-stubbed only. Falsifiers per handover adopted
verbatim (4-week demand test; 90-day check; gold-set human approval stays open).
