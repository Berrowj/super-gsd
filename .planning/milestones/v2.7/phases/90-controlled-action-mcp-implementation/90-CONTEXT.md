---
phase: 90
phase_name: Controlled Action MCP Implementation
milestone: v2.7
created: 2026-04-29
status: in-progress
deviation_from_standard: code phase (FULL tier; new MCP server)
---

# Phase 90 -- CONTEXT

Implement the controlled-action MCP server per Phase 89 contract. Ships as
a SEPARATE MCP server (not extending v2.3 read-only). Implements 3 net-new
write-capable tools + approval flow + audit log + dry-run mode + denial path.

Operator carry-forward from Phase 87/89 check: the read-side state source
is still stale. Before controlled actions can safely write or scaffold
anything, MCP/cockpit/recovery must stop trusting raw `STATE.md roadmap_run`
as the live truth.

## Locked Scope (D90.0-D90.6)

- D90.0: Implement the dynamic effective-state resolver that Phase 87
  required but Phase 89 did not ship:
  - New read-only CLI/module at `super-gsd/tools/state-resolver/resolve.cjs`.
  - Inputs in priority order: active checkpoint, latest
    `orchestrator-pulse.jsonl`, latest `activity-log.jsonl`, newest phase
    folders/artifacts, git phase-close commits, top-level `STATE.md`, then
    nested `STATE.md roadmap_run` only as legacy projection.
  - Output includes `milestone`, `phase`, `phase_name`, `phase_status`,
    `confidence`, `source`, `projection_stale`, `stale_sources`,
    `conflicts`, and `recommended_repair`.
  - Live acceptance: on this repo, resolver must NOT return stale
    `phase=complete` from v2.2 while latest pulse/artifacts show v2.7
    active work.

- D90.1: New server at `super-gsd/tools/warp-mcp-actions/server.cjs`
  alongside (not replacing) `super-gsd/tools/warp-mcp/server.cjs`.
- D90.2: 3 net-new tools per Phase 89 contract:
  - `sgsd_run_preflight` (TIER_ESCALATED)
  - `sgsd_run_token_summary` (TIER_OPERATOR)
  - `sgsd_prepare_phase_scaffold` (TIER_PREPARE)
- D90.3: Approval flow per contract — JSON-RPC `ui/approval_required`
  notification; 60s timeout default-deny.
- D90.4: Audit log writes to `.planning/metrics/controlled-actions-log.jsonl`.
- D90.5: Self-test covers ALLOW + DENY + TIMEOUT + DENIED_FOREVER paths
  (>=15 assertions). Tests prove sgsd_go and other DENIED_FOREVER actions
  cannot be invoked even with explicit approval.
- D90.6: Wire the resolver into the existing read-side MCP/cockpit paths
  before shipping the action server:
  - `sgsd_current_phase`, `sgsd_current_state`, and recovery packet use
    effective state and expose stale/conflict metadata.
  - Cockpit objective/artifact state uses effective state, not raw
    `STATE.md roadmap_run`.
  - If a projection writer is added, it is optional repair only;
    correctness must not depend on it.

## Outputs

- super-gsd/tools/warp-mcp-actions/server.cjs (NEW)
- super-gsd/tools/warp-mcp-actions/run-self-test.cjs (NEW)
- super-gsd/tools/warp-mcp-actions/fixtures/ (NEW)
- super-gsd/tools/state-resolver/resolve.cjs (NEW)
- super-gsd/tools/warp-mcp/server.cjs (UPDATED read-side status tools)
- super-gsd/tools/cockpit-state/adapter.cjs (UPDATED effective state input)
- 5 Phase 90 standard artifacts

## Acceptance

Mandatory resolver acceptance before the controlled-action acceptance list:

1. `node super-gsd/tools/state-resolver/resolve.cjs --json` returns the
   effective active v2.7 state from fresh evidence, and marks stale
   `STATE.md roadmap_run` as projection drift instead of trusting it.
2. `sgsd_current_phase` no longer returns stale v2.2 / `complete` on this
   repo while latest pulse/artifacts show v2.7 active work.
3. Cockpit snapshot no longer uses stale `STATE.md roadmap_run` to mark
   the roadmap complete while fresher live evidence exists.

Controlled-action acceptance:

1. Server starts over stdio (separate from v2.3 server).
2. 3 tools registered + DENIED_FOREVER list enforced.
3. Approval flow works: approve → execute; deny → degraded; timeout → degraded.
4. Audit log appended on every dispatch (regardless of approval outcome).
5. Self-test 15+/15+ PASS.
6. v2.3 server NOT modified (Lock-4 verified).
