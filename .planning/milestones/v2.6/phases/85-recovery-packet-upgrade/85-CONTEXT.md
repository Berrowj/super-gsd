---
phase: 85
phase_name: Recovery Packet Upgrade
milestone: v2.6
created: 2026-04-29
status: in-progress
deviation_from_standard: code+docs (focused upgrade to existing tool)
---

# Phase 85 -- CONTEXT

Upgrade `_tool_sgsd_recovery_packet` (Phase 70) to be block-sized,
attachable to Warp Agent, and roadmap-complete-friendly. Current
output dumps full STATE.md frontmatter (~3000 chars per call) which
is too verbose for an attachable block.

## Locked Scope (D85.1-D85.4)

- D85.1: Trim `current_position.last_activity` and `milestone_status`
  to ~200 chars each (with ellipsis if truncated). Full text stays in
  STATE.md for operators who want it.
- D85.2: Add explicit `why_stopped` field derived from
  milestone_status (heuristic: extract clause after `—`).
- D85.3: Add `artifact_links` field listing the latest
  `{NN}-VERIFICATION.md` and `{NN}-ATC-REVIEW.md` paths.
- D85.4: Roadmap-complete state: when `current_phase === "complete"`
  AND no checkpoint, packet returns `why_stopped: "ROADMAP COMPLETE — nothing to resume"` + `resume_command: "/sgsd-orchestrate go"` (which itself will halt at the all-complete exit).

## Outputs

- super-gsd/tools/warp-mcp/server.cjs (UPDATED — _tool_sgsd_recovery_packet)
- super-gsd/tools/warp-mcp/fixtures/sgsd_recovery_packet/{checkpoint-present,no-checkpoint-state-fallback}.expected.json (UPDATED — new shape)
- 5 Phase 85 standard artifacts

## Acceptance

1. Total recovery packet response ≤ 4 KB (was ~6 KB).
2. why_stopped + artifact_links fields present.
3. Roadmap-complete state emits "nothing to resume" guidance.
4. warp-mcp self-test still PASS (regression guard).
