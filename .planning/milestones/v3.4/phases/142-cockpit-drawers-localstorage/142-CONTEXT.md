---
phase: 142
phase_name: Alarm Drawer + Rationale Drawer + localStorage Collapse Persistence
milestone: v3.4
ws: core
status: PENDING
created_at: 2026-05-25
predecessor: v3.4/P141 (Memory + Evidence)
successor: v3.4/P143 (close milestone)
---

# Phase 142 — Drawers + localStorage — CONTEXT

## Goal

Three deliverables for the bottom drawer + persistence layer:
1. **Alarm drawer** rendered in `<aside class="bottom-drawer">` placeholder.
   Pulls from `snapshot.alarms[]` with threshold/cause/consequence/action
   fields. Collapsible; default collapsed.
2. **Rationale drawer** rendered below alarm drawer. Five sections from
   `snapshot.rationale`: why_this_phase / what_changed / what_could_go_wrong /
   what_evidence_supports / what_happens_next.
3. **localStorage collapse persistence** per-section using key
   `sgsd-sec-{section_id}` (e.g. `sgsd-sec-architecture`).

## Scope

**In:**
- attachAlarms: derive from snapshot.warnings + fog_score breakdown.
- attachRationale (extend existing): already populates 5 fields from CONTEXT
  cascade; no change needed.
- client.js renderBottomDrawer (alarm + rationale).
- client.js applyCollapsePersistence: restore localStorage state on load,
  save on toggle.
- CSS for .bottom-drawer + .alarm-row + .rationale-card + collapsible.
- 4 SACs.

**Out:**
- 5-sec test mechanical conformance gate (deferred to P143 or v3.5).
- Alarm clearing / dismiss UI (P143+).
