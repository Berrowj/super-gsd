---
phase: "159"
slug: skill-routing-expansion
milestone: v3.6-vtp-bridge
status: PASS-WITH-DEFERRED-3
closed: 2026-08-20
commits: ["fb55224", "1a4034e", "d81d4d2", "6a136da", "26edb1f"]
gates: {plan_review: "GO-WITH-CHANGES, AMENDMENT-1 applied", close_review: "PASS-WITH-DEFERRED, 0 CRIT, 3 WARN", verifier: "guard 53/53 + erp 37/37 + lint 9/9 + vtp 26/26+19/19 + shadow contract green + classifier 25/25"}
---

# P159 Summary — Skill-Routing Expansion

## What shipped

1. `1a4034e` T1 — availability guard: matched routes emit only for locally resolved
   skills; unavailable = silent + one text-free skill_unavailable row.
2. `d81d4d2` T2 — seven availability-guarded anchored-lexical ERP/VTP routes
   (/create-quote, /erp-resolve, /clarity-engines, /vtp-implementation-pack,
   /jcl-procurement-report, explainer-vs-diagram boundary), suggestion-tier
   low-risk, shadow-tier elsewhere, strong-positive-beats-verb tiering.
3. `6a136da` T3 — SKILL-DESCRIPTION-STANDARD.md + read-only lint (stable reason
   codes, exit 0/1/2); production skills scan clean; overlay pointer for
   devcp-local skills.
4. `26edb1f` T4 — VTP MCP tool-family triage: the recorded layer-routing rule
   encoded verbatim (substrate / wiki_search / route_and_retrieve /
   implementation-pack / triage advisory), shadow-tier tool routes,
   registration-not-liveness MCP availability, demand rows per fired route,
   automated turns excluded by the P158 origin gate.

## Deferred (close-review WARNs, recorded)

1. ERP export exclusion ineffective: strong matches bypass start-verb exclusions.
2. Routed-demand write failures are silently ignored (evidence-gap risk).
3. Demand dedup scans the full ledger and rewrites denominator state per fire
   (linear prompt-path cost; revisit at ledger growth).

## Dispatch-reliability record (environment, not code)

T2 required four dispatches and T4 three; every failure artifact is committed.
Sandbox write refusals, wrapper-timeout kills, and unappliable patches are
tonight's recurring environment class; the edits-first division (Codex writes,
orchestrator runs spawn-bound suites) is the stable pattern.

## Downstream contract

The classifier now covers the ERP and VTP families availability-guarded and
shadow-first; demand accrues to the Phase-0 ledger for every fired route, giving
P152-style promote-or-kill evidence for each new family.
