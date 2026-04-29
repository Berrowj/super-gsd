# SGSD ACP Mapping Spec (v2.8 Phase 94)

Maps SGSD execution concepts to Agent Client Protocol (ACP) primitives so
SGSD can become a first-class native local agent in Warp once ACP client
support ships.

**Tracking**: Warp issue #7326 (https://github.com/warpdotdev/warp/issues/7326).
ACP is on Warp's May-June 2026 roadmap (issue #9233) but not yet shipped
as of 2026-04-29. This spec is preparation; Phase 95 spike is contingent
on upstream availability.

## ACP -> SGSD Concept Map

| ACP concept | SGSD analog | Notes |
|---|---|---|
| ACP session | SGSD milestone/phase run | One ACP session = one auto-mode loop OR one phase dispatch |
| ACP plan | SGSD phase plan | `{NN}-01-…-PLAN.md` content, structured |
| ACP tool call | SGSD command/gate action | `Bash` invocations + MCP tool calls + warp-mcp-actions controlled actions |
| ACP progress event | ORCHESTRATOR-LIVE.jsonl event | Phase 74's 16 event types map directly |
| ACP permission request | SGSD hard stop / operator approval | CLAUDE.md exit condition 2 + Phase 90 controlled-action approval |
| ACP artifact | SGSD phase/milestone file link | sgsd_artifact_links MCP tool |
| ACP session_resume | SGSD checkpoint resume | ORCHESTRATOR-CHECKPOINT.md + state-resolver |

## ACP Concept Details

### Session

ACP session = one operator-initiated SGSD run.

```json
{
  "session_id": "sgsd-<milestone>-<phase>-<ISO>",
  "session_type": "phase_dispatch" | "auto_mode_loop",
  "started_at": "<ISO>",
  "milestone": "v2.8",
  "phase": "94"
}
```

ACP `session_resume` reads ORCHESTRATOR-CHECKPOINT.md (when present) +
state-resolver effective state.

### Plan

ACP plan = the phase's primary plan file (`{NN}-01-...-PLAN.md`).

```json
{
  "plan_id": "94-01",
  "title": "ACP Mapping Spec authoring",
  "tasks": [
    { "id": "94-01-T01", "description": "Author SGSD-ACP-MAPPING-SPEC.md", "acceptance": "..." }
  ],
  "expected_atc_tier": "lite"
}
```

### Tool Call

ACP tool call = either:

1. **Bash command** (e.g., `node super-gsd/tools/.../check.cjs`).
2. **MCP read-only tool** (Phase 70+71; sgsd_current_state etc.).
3. **Warp-mcp-actions controlled action** (Phase 90; requires approval).

ACP tool call params include:
- `tool_name`: closed vocab from SGSD.
- `arguments`: structured per tool contract.
- `requires_approval`: from Phase 89 tier (TIER_OBSERVE = no; others = yes).

### Progress Event

ACP progress events map 1:1 with the 16 ORCHESTRATOR-LIVE.jsonl event types
from Phase 74:

| ACP event | SGSD event |
|---|---|
| `session_started` | `run_started` |
| `phase_entered` | `phase_started` |
| `plan_chosen` | `plan_selected` |
| `tool_call_started` | `agent_dispatched` / `codex_started` |
| `tool_call_progress` | `agent_progress` |
| `tool_call_completed` | `agent_completed` / `codex_completed` |
| `gate_evaluated` | `gate_started` / `gate_passed` / `gate_warned` / `gate_failed` |
| `threshold_alert` | `token_threshold_crossed` |
| `checkpoint_emitted` | `checkpoint_written` |
| `permission_required` | `operator_attention_required` |
| `session_completed` | `run_completed` |

### Permission Request

ACP `permission_required` = SGSD's existing operator-approval flows:

- CLAUDE.md exit condition 2 (hard blocker requiring human input).
- Phase 90 controlled-action approval (TIER_PREPARE / TIER_OPERATOR / TIER_ESCALATED).
- Phase 33 repair_command safety predicates.

When ACP fires `permission_required`, SGSD writes a checkpoint AND emits
`operator_attention_required` event AND surfaces in cockpit with reason
from Phase 86's 7-reason vocab.

### Artifact

ACP artifacts = phase/milestone file links surfaced by `sgsd_artifact_links`
MCP tool (Phase 71). Includes:
- `{NN}-CONTEXT.md`
- `{NN}-01-...-PLAN.md`
- `{NN}-RESEARCH.md`
- `{NN}-VERIFICATION.md`
- `{NN}-ATC-REVIEW.md`
- `{NN}-WASTE.md` (when MUDA fired)

### Session Resume

ACP session_resume reads:
1. ORCHESTRATOR-CHECKPOINT.md (priority 1; if present + recent).
2. state-resolver effective state (priority 2; for active phase truth).
3. STATE.md frontmatter (priority 3; legacy projection).

This mirrors Phase 90-02 state-resolver priority order.

## What SGSD Would Expose As An ACP Agent

If/when Warp ships ACP client support, SGSD would expose:

- **Sessions**: 1 active session per `/sgsd-orchestrate go`.
- **Plans**: rendered from `{NN}-01-...-PLAN.md` task tables.
- **Tool calls**: 14 v2.3 read-only tools + 3 v2.7 controlled actions = 17 tools total.
- **Progress events**: 16 ORCHESTRATOR-LIVE.jsonl event types streamed live.
- **Permission requests**: 7-reason vocab from Phase 86 + Phase 90 approval flow.
- **Artifacts**: per-phase folder enumeration via Phase 71 sgsd_artifact_links.

## Phase 95 Precondition

Phase 95 (ACP Adapter Spike) requires ACP client support to be testable
on this machine. As of 2026-04-29:

- Warp issue #7326 (ACP) is OPEN; not yet shipped.
- May-June 2026 roadmap (issue #9233) lists ACP support as future work.

**Phase 95 will record SKIPPED-WAITING-FOR-UPSTREAM** until either:
1. Warp ships ACP client support, OR
2. A standalone ACP test fixture becomes available.

When that happens, Phase 95 spike implements a minimal read-only ACP
adapter exposing only sessions + plans + read-only tool calls (no write).

## Hard Boundary

Per operator brief Rule 8 ("Do not patch Warp source until local
integration proves an upstream need"): Phase 94 mapping spec is
preparation, not commitment. SGSD does NOT depend on ACP for any
v2.2-v2.7 functionality. ACP becomes optional v2.8+ enhancement when
upstream surfaces are ready.

## Forward References

- Phase 95 — ACP Adapter Spike (precondition: ACP client ready).
- Phase 96 — Warp Upstream Issue/Spec Pack files generalizable specs (e.g., wrapper-command detection, local agent telemetry) that are SGSD-aligned candidates.
- Phase 97 — Release gate verifies v2.2-v2.7 ship + records v2.8 ACP status.

## What This Spec Doesn't Do

- Doesn't implement an ACP server.
- Doesn't fork Warp.
- Doesn't depend on ACP for v2.2-v2.7 correctness.
- Doesn't commit to a specific ACP version (mapping is per-concept; specifics adapt at spike).
