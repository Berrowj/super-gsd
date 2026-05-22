# SGSD Warp MCP Contract (v2.3 read-only)

This is the contract Phase 69-72 implements. Read-only state queries over MCP stdio. No write-capable tools in v2.3 — those land in v2.7+ behind a separate controlled-action contract with operator confirmation requirements.

**Schema version**: `1`
**Implementation target**: `super-gsd/tools/warp-mcp/server.cjs` (Phase 69)
**Fixtures**: `super-gsd/tools/warp-mcp/fixtures/{tool}/{scenario}.{input|expected}.json` (Phase 70/71)
**Status**: contract LOCKED at Phase 68 close; Phase 69 builds against this verbatim.

## Universal Tool Envelope

Every tool returns this shape:

```json
{
  "ok": true | false,
  "schema_version": 1,
  "ts": "<ISO 8601>",
  "tool": "<tool_name>",
  "data": { /* tool-specific payload */ },
  "_truncated": false,
  "_degraded": false,
  "_redactions_applied": [ "<category>" ]
}
```

When a source file is missing, unparseable, or the tool encounters an internal error:

```json
{
  "ok": false,
  "schema_version": 1,
  "ts": "<ISO 8601>",
  "tool": "<tool_name>",
  "data": null,
  "_truncated": false,
  "_degraded": true,
  "error_code": "<closed-vocab>",
  "error_message": "<short, no stack trace>"
}
```

**Lock-13 contract**: every tool's public surface is wrapped in try/catch and returns the degraded envelope rather than throwing across the MCP stdio boundary. Phase 69 enforces in the dispatcher; Phase 70/71 verify per-tool.

## Closed Error Codes

```
source_file_missing
source_file_unparseable
source_file_too_large
git_subprocess_failed
git_subprocess_timeout
fixture_loader_invalid
redaction_pass_failed
output_size_exceeded
unknown_tool_name
invalid_input_schema
internal_error_degraded
```

11-entry frozen vocab. Phase 69 implements `ERROR_CODES` constant; selfTest verifies frozen + len.

## Redaction Rules (Contract-Level)

Applied in Phase 72; called from Phase 70/71 per tool. Closed-vocab categories:

| # | Category | Pattern | Redaction |
|--:|---|---|---|
| 1 | env_secrets | `[A-Z_]+_(KEY|TOKEN|SECRET|PASSWORD|API_KEY)\s*=\s*\S+` | replace value with `<REDACTED:env>` |
| 2 | bearer_tokens | `Bearer\s+[A-Za-z0-9_.-]+` | replace token with `<REDACTED:bearer>` |
| 3 | redis_urls | `redis://[^@\s]+@[^/\s]+` | strip credentials: `redis://<REDACTED:creds>@host` |
| 4 | api_keys_inline | `(sk-[A-Za-z0-9]{20,}|AKIA[A-Z0-9]{16}|ghp_[A-Za-z0-9]{36})` | replace with `<REDACTED:apikey>` |
| 5 | private_kb_paths | paths under `$VTP_ROOT` or matching `.brv/private/*` | replace with `<REDACTED:private_kb>` |
| 6 | unc_paths | `\\\\[^\\]+\\.+` (Windows network shares) | replace with `<REDACTED:unc>` |
| 7 | onedrive_paths | paths containing `OneDrive - <ORG>` (org-specific identity leak) | replace org segment with `<REDACTED:onedrive_org>` |

7-entry frozen vocab `REDACTION_CATEGORIES`. Phase 72 implements; selfTest verifies application across fixtures.

Output `_redactions_applied` lists every category that triggered on this response (not the raw values). Operator can audit redaction coverage from JSONL logs without seeing the unredacted payload.

## Max Output Sizes

- **Default per-tool max**: 50 KB serialized JSON.
- **Tail-style tools** (token_spend, codex_status, gate_status, agent_roster): 25 rows max per response; emit `_truncated: true` + `next_cursor` token if more available.
- **Snapshot tools** (cockpit_snapshot): 100 KB allowed (composes multiple sources).
- Implementation: Phase 71 stringify → byte-length check → if over, switch to truncated envelope.

## Tool Catalogue (14 read-only tools)

### 1. `sgsd_current_state`

**Purpose**: active milestone/phase/last_activity for cockpit + Warp Agent.

**Inputs**: `{}` (no args)

**Outputs**:
```json
{
  "data": {
    "milestone": "v2.2",
    "milestone_name": "...",
    "milestone_status": "...",
    "status": "...",
    "last_updated": "<ISO>",
    "last_activity": "<text>",
    "current_phase": "63" | "complete" | null,
    "current_phase_status": "PASS" | "PASS-WITH-DEFERRED-N" | null
  }
}
```

**Source files**: `.planning/STATE.md` (frontmatter only; offset 0 limit ~30).

**Failure modes**: STATE.md missing → `source_file_missing`. STATE.md unparseable → `source_file_unparseable`.

**Redactions**: none expected (STATE.md is operator-authored, no secrets).

### 2. `sgsd_current_phase`

**Purpose**: detailed view of the active phase.

**Inputs**: `{ phase?: string }` (optional override; default reads from STATE.md)

**Outputs**:
```json
{
  "data": {
    "phase": "63",
    "phase_name": "Warp Capability Smoke Test",
    "milestone": "v2.2",
    "status": "PASS-WITH-DEFERRED-5",
    "close_commit": "b5b46a8",
    "plans": [
      { "id": "63-01", "status": "complete" }
    ],
    "deferred_count": 5,
    "deferred_summary": "5 operator UI manual checks M1-M5"
  }
}
```

**Source files**: `.planning/STATE.md` + `.planning/milestones/{milestone}/phases/{NN-*}/`.

**Failure modes**: phase folder missing → `source_file_missing` (degraded with helpful message); STATE.md drift (current_phase points at non-existent phase) → degraded with `error_code: source_file_missing` and message naming the missing path.

**Redactions**: none expected.

### 3. `sgsd_milestone_status`

**Purpose**: per-milestone summary.

**Inputs**: `{ milestone: string }`

**Outputs**:
```json
{
  "data": {
    "milestone": "v2.2",
    "total_phases": 5,
    "completed_phases": 5,
    "percent": 100,
    "phase_summary": [
      { "phase": "63", "status": "PASS-WITH-DEFERRED-5" }
    ],
    "shipped_status": null
  }
}
```

**Source files**: `.planning/STATE.md` `progress.{milestone}` block + `.planning/STATE.md` `{milestone}_complete:` block (when present).

**Failure modes**: unknown milestone → `unknown_tool_name`-style error with `error_code: source_file_missing`.

**Redactions**: none.

### 4. `sgsd_watchdog_status`

**Purpose**: autopilot pulse + last activity age.

**Inputs**: `{}` or `{ tail_rows?: number }` (default 10, max 50).

**Outputs**:
```json
{
  "data": {
    "watchdog_state": "alive" | "stale" | "absent",
    "last_pulse_ts": "<ISO>",
    "last_pulse_age_seconds": 12,
    "recent_pulses": [
      { "ts": "...", "phase": 67, "iteration": 3, "step": "loop_entry" }
    ]
  }
}
```

**Source files**: `.planning/metrics/autopilot-watchdog.json` + `.planning/metrics/orchestrator-pulse.jsonl` (tail).

**Failure modes**: both files missing → `source_file_missing` with `watchdog_state: "absent"`. JSONL parse error per row → skip row + log internally; tool envelope still `ok: true`.

**Redactions**: none expected.

### 5. `sgsd_gate_status`

**Purpose**: latest gate verdicts.

**Inputs**: `{ gate?: string, tail_rows?: number }` (default 10, max 25).

**Outputs**:
```json
{
  "data": {
    "gates": [
      { "gate": "phase-level-ATC", "phase": 67, "verdict": "pass", "ts": "<ISO>", "provider": "claude-sonnet" }
    ],
    "latest_per_gate": { "phase-level-ATC": { /* row */ } }
  }
}
```

**Source files**: `.planning/metrics/gate-value-log.jsonl` + `.planning/metrics/review-ledger.jsonl` (tail).

**Failure modes**: both files missing → degraded with empty gates array (not error). Filter on unknown gate name → empty result, `ok: true`.

**Redactions**: provider names retained; user-content (commit messages) passed through redaction pass for env_secrets / bearer_tokens.

### 6. `sgsd_agent_roster`

**Purpose**: agents dispatched in the current (or specified) phase.

**Inputs**: `{ phase?: string }` (default = current phase from STATE.md).

**Outputs**:
```json
{
  "data": {
    "phase": "67",
    "agents": [
      { "ts": "<ISO>", "agent": "gsd-executor", "model": "sonnet", "task_id": "...", "outcome": "pass" }
    ],
    "by_agent": { "gsd-executor": 4, "gsd-verifier": 1 }
  }
}
```

**Source files**: `.planning/metrics/activity-log.jsonl` filtered by `phase`.

**Failure modes**: activity-log missing → degraded with empty array. Phase filter no-match → empty array, `ok: true`.

**Redactions**: agent task_id strings pass through; no expected secret leakage.

### 7. `sgsd_codex_status`

**Purpose**: Codex CLI activity.

**Inputs**: `{ tail_rows?: number }` (default 10, max 25).

**Outputs**:
```json
{
  "data": {
    "live_state": "running" | "idle" | "stale" | "absent" | "complete",
    "last_run": { "ts": "<ISO>", "phase": 67, "verdict": "..." },
    "recent_runs": [ /* tail rows */ ],
    "freshness": { "live_json_age_seconds": 142, "stale_threshold_seconds": 3600 }
  }
}
```

**Source files**: `.planning/metrics/codex-live.json` + `.planning/metrics/codex-log.jsonl`.

**Failure modes**: codex-live.json missing or older than 1h → `live_state: "stale"`. Both files absent → `live_state: "absent"`, `ok: true`.

**Redactions**: bearer_tokens / api_keys_inline pass over codex prompt content (Codex uses OAuth but prompts may include user-pasted credentials).

### 8. `sgsd_token_spend`

**Purpose**: token attribution summary.

**Inputs**: `{ scope?: "current" | "milestone" | "all", group_by?: "role" | "phase" | "provider" }`

**Outputs**:
```json
{
  "data": {
    "scope": "current",
    "group_by": "role",
    "totals": { "input": 12345, "output": 6789, "total": 19134 },
    "rows": [
      { "key": "executor", "input": 8000, "output": 4000, "total": 12000 }
    ]
  }
}
```

**Source files**: `.planning/metrics/token-attribution.jsonl` + `.planning/metrics/agent-token-spend.jsonl`.

**Failure modes**: both files missing → `source_file_missing` (degraded, totals=0). Output exceeds max → `_truncated: true` with `next_cursor`.

**Redactions**: none expected (rows are aggregates, no secrets in numeric data).

### 9. `sgsd_context_bench_status`

**Purpose**: latest Phase 51 context-bench run summary.

**Inputs**: `{ scenario?: string }`

**Outputs**:
```json
{
  "data": {
    "latest_run": { "run_id": "bench-...", "ts": "<ISO>", "verdict": "PASS" },
    "scenarios": [ { "id": "S1", "verdict": "PASS", "tokens_pre": 150000, "tokens_post": 60000 } ]
  }
}
```

**Source files**: `.planning/metrics/context-bench-log.jsonl` (Phase 51 output).

**Failure modes**: log missing → degraded; latest-run filter no-match → empty.

**Redactions**: scenario content may contain user-prompt fragments → run env_secrets / bearer_tokens / api_keys_inline pass.

### 10. `sgsd_latest_commits`

**Purpose**: recent git history.

**Inputs**: `{ count?: number }` (default 10, max 50).

**Outputs**:
```json
{
  "data": {
    "commits": [
      { "hash": "8dbb9cb", "ts": "<ISO>", "author": "the operator", "subject": "...", "files_changed": 5 }
    ]
  }
}
```

**Source files**: git via `spawnSync('git', ['log', '--pretty=...', `-${count}`])`.

**Failure modes**: git subprocess failed → `git_subprocess_failed`. Timeout (5s) → `git_subprocess_timeout`.

**Redactions**: commit messages may contain pasted secrets → run env_secrets / bearer_tokens / api_keys_inline pass.

### 11. `sgsd_recovery_packet`

**Purpose**: 4-block recovery packet matching the SGSD: Recovery Packet workflow.

**Inputs**: `{}` or `{ include_checkpoint_body?: boolean }` (default true).

**Outputs** (Phase 85 upgrade — block-sized, ≤4 KB serialized, attachable):
```json
{
  "data": {
    "current_position": {
      "milestone": "v2.2",
      "phase": "complete | <NN>",
      "phase_status": "ALL-PHASES-CLOSED | in-progress | ...",
      "last_activity_summary": "<200-char trim of STATE.md last_activity, ... if longer>",
      "milestone_status_summary": "<200-char trim of STATE.md milestone_status>"
    },
    "watchdog_state": { /* output of sgsd_watchdog_status (tail_rows=3 for budget) */ },
    "why_stopped": "ROADMAP COMPLETE -- nothing to resume | <heuristic 1-line>",
    "next_unlock": { "from": "checkpoint" | "state", "text": "..." },
    "artifact_links": {
      "latest_verification": ".planning/milestones/.../<NN>-VERIFICATION.md | null",
      "latest_atc_review": ".planning/milestones/.../<NN>-ATC-REVIEW.md | null",
      "checkpoint": ".planning/ORCHESTRATOR-CHECKPOINT.md | null"
    },
    "resume_command": "/sgsd-orchestrate go"
  }
}
```

Footnote (Phase 85): pre-upgrade shape returned the FULL `sgsd_current_state` envelope as `current_position` (~6 KB total). Post-upgrade the packet is trimmed to a 5-field summary view; full STATE.md remains reachable via `sgsd_current_state` directly. `why_stopped` heuristic order: roadmap-complete -> milestone-all-phases-closed -> clause after em-dash/`--` -> generic fallback. `artifact_links.latest_verification` points to the highest-numbered phase folder when `current_phase === "complete"` (most recently closed).

Phase 86 update (operator-override re-scope): the `data` envelope gains two peer fields alongside `current_position` / `watchdog_state` / etc.:

- `_state_staleness`: `{ stale: bool|null, state_md_age_minutes: N, latest_pulse_age_minutes: N|null, drift_minutes: N|null, threshold_minutes: 30, reason?: string }` -- compares `STATE.md` mtime vs `.planning/metrics/orchestrator-pulse.jsonl` mtime; `stale: true` when drift > 30 minutes. `reason` populated for sentinel cases (`state_md_missing`, `pulse_log_absent`, `compute_failed`).
- `_context_warning`: `{ level: 'ok'|'soft_200k'|'hard_500k', estimated_root_tokens: N, recommendation?: string, measured_at?: string }` -- reads the tail of `.planning/metrics/token-attribution.jsonl` to find the most recent root orchestrator turn (role=orchestrator, is_sidechain=false) and uses its `usage.context_tokens` as the running estimate. Thresholds: `< 200000` -> `ok`, `200000..499999` -> `soft_200k`, `>= 500000` -> `hard_500k`. When level is non-`ok`, the standard `resume_command` is augmented with a fresh-session recommendation prefixed by `  # CONTEXT WARNING: ` so the next operator paste is self-explanatory.

Both fields are Lock-13 wrapped at the helper boundary (`_computeStateStaleness` + `_deriveContextWarning`); failures degrade to safe sentinels rather than throwing across the tool envelope. Self-test additions: A45 (band computation correctness via boundary sweep + ledger-absent fallback) and A46 (live recovery_packet emits both fields and the resume_command augmentation matches the level).

**Source files**: `.planning/ORCHESTRATOR-CHECKPOINT.md` (if present) + `.planning/STATE.md` (fallback) + filesystem walk of `.planning/milestones/{milestone}/phases/` for artifact paths.

**Failure modes**: no checkpoint AND no STATE → `source_file_missing` (degraded). Checkpoint body unparseable → degrade to STATE-only. Phases dir missing → `artifact_links` fields are null but envelope is `ok: true`.

**Redactions**: checkpoint body may include user-pasted env / paths → full redaction-rules pass.

### 12. `sgsd_cockpit_snapshot`

**Purpose**: one-shot snapshot Warp Agent can render.

**Inputs**: `{}`

**Outputs**: composes 1+2+4+5+6+7+8 outputs into a single envelope. ~100 KB allowed.

**Source files**: same as above tools, called internally.

**Failure modes**: per-source file missing → that section is `_degraded` but snapshot envelope is `ok: true` (partial-data OK by design).

**Redactions**: aggregate of all sub-tool redactions; `_redactions_applied` enumerates the union.

### 13. `sgsd_artifact_links`

**Purpose**: latest ATC-REVIEW.md / VERIFICATION.md / WASTE.md per phase in active milestone.

**Inputs**: `{ milestone?: string, phase?: string }` (defaults from STATE.md).

**Outputs**:
```json
{
  "data": {
    "milestone": "v2.2",
    "phases": [
      {
        "phase": "67",
        "atc_review": ".planning/milestones/v2.2/phases/67-warp-doctor-probe-design/67-ATC-REVIEW.md",
        "verification": ".planning/milestones/v2.2/phases/67-warp-doctor-probe-design/67-VERIFICATION.md",
        "waste": null,
        "context": ".planning/milestones/v2.2/phases/67-warp-doctor-probe-design/67-CONTEXT.md"
      }
    ]
  }
}
```

**Source files**: filesystem enumeration under `.planning/milestones/{milestone}/phases/`.

**Failure modes**: milestone dir missing → degraded with empty phases array. Per-phase file missing → that field is `null`, `ok: true`.

**Redactions**: paths only — onedrive_paths / unc_paths pass.

### 14. `sgsd_warp_doctor`

**Purpose**: shells out to Phase 67 warp-doctor and returns its envelope inline.

**Inputs**: `{ project_dir?: string }` (default = `process.cwd()`).

**Outputs**:
```json
{
  "data": {
    /* full warp-doctor envelope: schema_version, ts, project_dir, probes[], summary */
  }
}
```

**Source files**: shells out via `spawnSync('node', ['super-gsd/tools/warp-doctor/check.cjs', '--project', projectDir, '--json'])`.

**Failure modes**: subprocess failed → `git_subprocess_failed`-pattern (rename to `subprocess_failed` since it's not git). Subprocess timeout (10s) → `subprocess_timeout`.

**Redactions**: doctor output may include profile path → onedrive_paths / unc_paths pass.

## Implementation Order (Phase 69-72)

| Phase | Work | Tools |
|---|---|---|
| 69 | Server skeleton, dispatcher, fixture loader, error envelope, --self-test | none yet (skeleton only) |
| 70 | Status tool suite | 1, 2, 3, 4, 11 |
| 71 | Operational tools + tail readers + paging | 5, 6, 7, 8, 9, 10, 12, 13, 14 |
| 72 | Redaction implementation, Warp config snippet, MCP self-test workflow | wires redaction into 5, 7, 8, 9, 10, 11, 12, 13, 14 |

## Why Read-Only In v2.3

- Build trust before write power. Operator must see SGSD answer correctly before authorizing write actions.
- Redaction is easier to verify on read paths (single response vs side-effect chains).
- Future v2.7 controlled-action contract is a separate phase; not folded in to keep scope tight.
- "If only one milestone ships, ship the read-only SGSD MCP bridge" (operator brief).

## Forward References

- Phase 89-90 (v2.7) ship the controlled-action contract (write-capable MCP). It MUST NOT extend this contract; it has its own permission tiers, audit log, and operator confirmation gates.
- Phase 94-97 (v2.8) ACP mapping reuses tool 1-4 schemas as ACP session/plan/progress/tool-call shapes.
- Phase 76 cockpit-state adapter reuses `sgsd_cockpit_snapshot` (tool 12) as its underlying composer.

## Acceptance Mechanically Enforced By Phase 69

Phase 69 ships a contract-conformance test:

```bash
node super-gsd/tools/warp-mcp/run-self-test.cjs
# Must verify:
#   - 14 tool names match this contract verbatim
#   - schema_version === 1
#   - ERROR_CODES len === 11 (frozen)
#   - REDACTION_CATEGORIES len === 7 (frozen)
#   - every tool's degraded path returns proper envelope (no throws)
#   - max output size enforcement triggers correctly on fixture > 50KB
```

If Phase 69's self-test fails any of these, Phase 69 cannot close. Contract is the unit-of-truth.
