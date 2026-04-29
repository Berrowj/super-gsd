# SGSD Warp Controlled Action Contract (v2.7 write-capable)

This is the contract Phase 90 implements. Write-capable MCP tools requiring
operator confirmation. SEPARATE from the v2.3 read-only contract — does NOT
extend it; it has its own permission tiers, audit log, and denial reasons.

**Schema version**: `1`
**Implementation target**: `super-gsd/tools/warp-mcp-actions/server.cjs` (Phase 90; new sibling of v2.3 server)
**Status**: contract LOCKED at Phase 89 close; Phase 90 builds against this verbatim.

## Permission Tiers (closed-vocab, frozen len=4)

```
TIER_OBSERVE        # read-only; never modifies; no operator approval needed
TIER_PREPARE        # writes to draft locations only (.planning/analyses/, /tmp/); operator approval REQUIRED via prompt
TIER_OPERATOR       # writes to .planning/metrics/* (audit logs, draft state); operator approval REQUIRED + audit row written
TIER_ESCALATED      # writes outside .planning/ — runs SGSD commands like preflight; operator approval REQUIRED + audit row + dry-run preview
```

**TIER_OBSERVE actions don't appear here** — they're already in the v2.3
read-only contract.

## 5 Candidate Actions (Phase 89 lockdown)

### 1. `sgsd_run_preflight` (TIER_ESCALATED)

**Purpose**: invoke `sgsd -NoOpen` preflight from MCP. Read-only at filesystem level (probes only) but RUNS A COMMAND.

**Inputs**: `{ project_dir?: string }`

**Outputs**:
```json
{ "data": { "exit_code": N, "stdout": "...", "stderr": "...", "duration_ms": N } }
```

**Operator confirmation**: prompt-and-wait. Default: deny.

**Audit log row**:
```json
{ "ts":"...", "tool":"sgsd_run_preflight", "tier":"TIER_ESCALATED", "approved":bool, "approval_source":"<operator|denied>", "exit_code":N }
```

### 2. `sgsd_generate_recovery_packet` (TIER_OBSERVE — already covered)

**Note**: Already in v2.3 contract as `sgsd_recovery_packet`. Listed here
for completeness but does NOT need v2.7 implementation. Tier downgraded
from candidate-write to existing-read.

### 3. `sgsd_run_token_summary` (TIER_OPERATOR)

**Purpose**: invoke `node super-gsd/tools/token-attribution/collect.cjs --write --all --agent-spend --summary --current` — collects + writes token summary.

**Writes**: `.planning/metrics/agent-token-spend.jsonl` (append-only ledger; existing pattern; not destructive).

**Operator confirmation**: prompt-and-wait. Default: deny. Approval auto-cached for 30 min after first approve in a session.

**Audit log row**: kind `controlled_action_token_summary`.

### 4. `sgsd_open_artifact_index` (TIER_OBSERVE — already covered)

**Note**: Already in v2.3 contract as `sgsd_artifact_links`. Listed here
for completeness; no v2.7 implementation needed.

### 5. `sgsd_prepare_phase_scaffold` (TIER_PREPARE)

**Purpose**: wraps Phase 80 warp-plan-converter to scaffold a draft phase under `.planning/analyses/`.

**Inputs**: `{ source_path: string, milestone: string, phase_number?: int }`

**Writes**: `.planning/analyses/<ISO>-warp-plan-import/<milestone>/phases/<NN>-<slug>/...` (DRAFT only; never touches active milestone or STATE.md per Phase 80 contract).

**Operator confirmation**: prompt-and-wait. Default: deny. Per-call approval (no caching — phase scaffolding is rare).

**Audit log row**: kind `controlled_action_phase_scaffold`.

## Initially BLOCKED Actions (closed-vocab, frozen len=5)

These will NOT be implemented in v2.7. Listed for clarity:

```
DENIED_FOREVER:
  sgsd_go                     # auto-mode start; too dangerous to enable from MCP
  sgsd_destructive_cleanup    # rm-rf class operations
  sgsd_git_reset              # git reset --hard or similar
  sgsd_credential_write       # any write to settings.json env block
  sgsd_milestone_close        # bypassing operator-led close
```

Adding any of these to v2.7 implementation requires:
1. Explicit roadmap addition phase.
2. Operator deliberation per /sgsd-deliberate skill.
3. New permission tier definition.

## Denial Reasons (closed-vocab, frozen len=8)

```
operator_denied
operator_timeout
default_deny
tier_too_high
denied_forever_action
audit_log_write_failed
project_dir_invalid
input_schema_violation
```

## Approval Flow

```
1. Caller invokes write-capable MCP tool with args.
2. Server dispatcher checks tool exists in CONTROLLED_ACTIONS map.
3. Server emits a prompt-for-approval JSON-RPC notification:
     { "method": "ui/approval_required",
       "params": { "tool": "...", "tier": "TIER_*", "args": {...},
                   "preview": "<dry-run output>", "default": "deny" } }
4. Server reads JSON-RPC response from stdin (or 60s timeout):
     { "approval": "approve" | "deny", "reason": "..." }
5. Approve: execute action; emit audit log row; return result envelope.
   Deny / timeout: return degraded envelope with denial_reason.
```

## Audit Log Schema

`.planning/metrics/controlled-actions-log.jsonl` (NEW; append-only):

```json
{
  "ts": "<ISO>",
  "tool": "<tool name>",
  "tier": "TIER_*",
  "approved": true|false,
  "approval_source": "operator" | "denied" | "timeout" | "default_deny",
  "args_hash": "<sha256 of args>",
  "exit_code": N | null,
  "denial_reason": "<closed-vocab>" | null,
  "duration_ms": N | null
}
```

Operators audit via `Get-Content .planning/metrics/controlled-actions-log.jsonl -Tail 50`.

## Forward references

- Phase 90 ships server.cjs + 3 tool implementations (1, 3, 5) — Tools 2 + 4 are already in v2.3 read-only contract.
- Phase 91 (cloud-safe SGSD skills) defines what subset can run in Oz/cloud (likely none of the controlled actions; ESCALATED tier requires local operator).
- Phase 92 (Oz environment spec) defines env requirements; controlled actions explicitly excluded from cloud envs.
- Phase 93 (scheduled audit design) defines what schedules are safe; controlled actions excluded.
- Phase 94+ (v2.8 ACP) maps controlled-actions to ACP permission events.

## Why this contract is SEPARATE from v2.3

v2.3 read-only contract is the trust foundation. Mixing write-capable tools
into that namespace would muddy the boundary. v2.7 ships a SEPARATE MCP
server (`super-gsd/tools/warp-mcp-actions/`) that operators add as a
distinct MCP server in Warp config — explicitly opt-in.

## Implementation order (Phase 90-93)

| Phase | Work |
|---|---|
| 90 | server.cjs + 3 tool stubs + approval flow + audit log + selfTest |
| 91 | Cloud-safe SGSD skills enumeration (controlled actions excluded) |
| 92 | Oz environment spec (controlled actions excluded) |
| 93 | Scheduled audit design (controlled actions excluded) |

The exclusions in 91-93 are LOAD-BEARING: cloud schedules must NOT acquire write capability.
