---
phase: 72
artifact: research
created: 2026-04-29
operator: user
authored_by: orchestrator (Opus); code authored by gsd-executor (Sonnet) agentId a5d834664df3ca56f
---

# Phase 72 -- Research

## Pattern source

- Phase 68 SGSD-WARP-MCP-CONTRACT.md -- 7-category REDACTION_CATEGORIES vocab + per-tool Redactions: column.
- Phase 69 server.cjs Lock-13 + frozen-vocab patterns.
- Phase 67 warp-doctor _probe_mcp_config (placeholder being upgraded).
- Phase 64 warp-workflow-lint shape -- new mcp-self-test workflow validates against this.

## Key design decisions

### D1 -- Wire redaction into ALL 14 tools via finalizer

Per Phase 68 contract, redaction applies to 9 tools (those with user content / paths / commits). Executor took the simpler approach: run `_finalizeEnvelope` on every tool. Cost is negligible (regex over <50KB strings); noise floor is zero (no matches → empty `_redactions_applied`); future-proofs against any tool inadvertently leaking.

### D2 -- ERROR_CODES extended len 11 → 13

Closes Phase 71 D3 deviation (tool 14 timeout was using `internal_error_degraded`). Now formally aliased to `subprocess_failed` and `subprocess_timeout`. ERROR_CODES re-frozen at len=13.

### D3 -- Fixture matcher fall-back to `input.tool`

Executor encountered a real loader issue: `fixtures/_redaction/` is not a tool name. Fixed by adding fallback: when fixture folder name is not a TOOL_NAMES entry but `input.tool` IS, dispatch using `input.tool`. Lets `_redaction` fixtures exercise real tools (sgsd_recovery_packet) without polluting per-tool fixture folders. Surgical and correct.

### D4 -- Warp-doctor fixture update

Live warp-doctor output legitimately fires `onedrive_paths` redaction on this machine (PowerShell profile path includes "OneDrive - John Cullen Lighting"). Executor updated `fixtures/sgsd_warp_doctor/happy.expected.json` to use `<exists>true</exists>` matcher on `_redactions_applied` to accept whatever real-state array comes out. Per-category redaction fires get explicit assertions via A33-A39 + 7 `_redaction` fixtures.

### D5 -- env_secrets contract pattern

Executor flagged: contract pattern is `[A-Z_]+_(KEY|TOKEN|SECRET|PASSWORD|API_KEY)\s*=\s*\S+`; the example AWS_ACCESS_KEY_ID does NOT match (ends in `_ID`). Used `OPENAI_API_KEY=value` in selfTest A33 + env-secrets fixture so the test exercises the contract pattern faithfully. The contract is unit-of-truth.

### D6 -- warp-doctor probe 15 upgrade

Real check now: scan `~/.warp/mcp_servers.json` / `~/.warp/mcp.json` / `~/.warp/mcp_config.json` / `~/AppData/Roaming/Warp/mcp_servers.json`. PASS if file contains `super-gsd` or `warp-mcp/server.cjs`. MISSING with actionable evidence pointing at SGSD-WARP-MCP-SETUP.md if absent. Live: probe 15 = MISSING (operator hasn't yet added MCP config — that's Thread B work post-v2.3 ship).

## Live test results captured

```
warp-mcp run-self-test.cjs    42/42 PASS  (was 30; +12 new from Phase 72)
warp-doctor run-self-test.cjs 15/15 PASS  (A13 upgraded for probe 15)
warp-workflow-lint live       14/14 valid + 10/10 search terms (was 13)
warp-doctor live              probe 15 = MISSING with actionable evidence
recovery_packet live stdio    ok:true _redactions_applied:[] (clean STATE)
warp_doctor tool live stdio   16 probes + onedrive_paths redaction firing
git status before/after       byte-identical (READ-ONLY preserved)
```

## Forward references

- v2.4 Phase 76: cockpit-state adapter consumes redacted MCP outputs.
- Operator: add MCP config snippet to `~/.warp/mcp_servers.json` per
  SGSD-WARP-MCP-SETUP.md to upgrade probe 15 from MISSING to PASS.
