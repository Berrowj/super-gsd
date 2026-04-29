# active fixture

Synthetic `.planning/` tree where v2.4 phase 76 is in-flight with an active
agent_progress event chain.

Layout:

- `_pseudo_root/.planning/` -- the synthetic planning directory the adapter
  reads from. Adapter is invoked with `projectDir: _pseudo_root` so its
  internal `_resolvePlanningDir` walks to `_pseudo_root/.planning`.
- `expected.json` -- adapter envelope shape the snapshot must match (uses
  the runMatcher engine from warp-mcp/server.cjs: `<contains>SUB</contains>`,
  `<exists>true</exists>`, `<regex>PAT</regex>`, or literal `===`).

Scenario assertions:
- `now.action` contains `writing adapter.cjs` (from `agent_progress` event)
- `objective.phase === "76"` and `phase_name` contains `cockpit-state-adapter`
- `unlock.unlocks` contains `Phase 77` (read from 76-CONTEXT.md frontmatter)
- `blockers.count === 0`
- `agents.count === 1` (one dispatched + matching nothing-yet completed)
- `resume_command.command === "/sgsd-orchestrate go"`
