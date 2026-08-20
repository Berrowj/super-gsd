---
phase: "165"
slug: fleet-event-emission
milestone: v3.8-fleet-cockpit
status: GATED
depends_on: ["163"]
gate: operator go required
---

# P165 Context (gated seed) — Event emission everywhere

Handover step 4. The live-event stream reaches 4 of 60 worktrees; wiring the
existing hooks into every lane upgrades the page from refreshing snapshot to
live feed and lights the gates/tokens tiles. Worth doing, explicitly not worth
blocking on (the snapshot works with an empty stream). P161's distribution fix
is the substrate; this phase is the fleet-wide rollout + verification.
