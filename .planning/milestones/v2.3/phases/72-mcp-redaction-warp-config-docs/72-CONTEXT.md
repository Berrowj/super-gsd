---
phase: 72
phase_name: MCP Redaction + Warp Config + Setup Docs
milestone: v2.3
roadmap: warp-integration
created: 2026-04-29
operator: user
status: in-progress
deviation_from_standard: standard 10-step (mixed code+docs phase, FULL tier ATC)
---

# Phase 72 -- MCP Redaction + Warp Config + Setup Docs (CONTEXT)

## Goal

Wire redaction across 9 tools that pass through user content / paths /
commits; ship Warp MCP config snippet + SGSD-WARP-MCP-SETUP.md operator
docs; ship `SGSD: MCP Self-Test` workflow; upgrade Phase 67 warp-doctor
mcp_config_present probe from NOT-APPLICABLE placeholder to a real check.

After Phase 72 close: v2.3 milestone is 5/5 phases done; SGSD MCP
read-only bridge fully shipped.

## Locked Scope (D72.1-D72.6)

- **D72.1**: Implement `_applyRedactions(text)` helper and 7-category
  pattern set (REDACTION_CATEGORIES frozen len=7 per Phase 68 contract).
  Wire into tools 5, 7, 8, 9, 10, 11, 12, 13, 14 (the ones that pass
  through user content / paths / commits per contract per-tool
  Redactions: section).
- **D72.2**: `_redactions_applied` envelope field lists categories that
  triggered (not the redacted values). Audit-friendly without leaking.
- **D72.3**: Add ERROR_CODES `subprocess_failed` and `subprocess_timeout`
  to formalize Phase 71 D3 deviation; aliases now valid (ERROR_CODES
  goes from len=11 to len=13). Lock-13 frozen list extended.
- **D72.4**: Author SGSD-WARP-MCP-SETUP.md operator docs covering: how
  Warp finds the MCP server / config snippet to add / how to verify /
  troubleshooting / VTP-optional disclaimer / forward to v2.4 cockpit.
- **D72.5**: Author `.warp/workflows/sgsd-mcp-self-test.yaml` workflow
  that calls `node super-gsd/tools/warp-mcp/run-self-test.cjs --project ...`.
- **D72.6**: Upgrade Phase 67 warp-doctor probe 15 (mcp_config_present)
  from NOT-APPLICABLE placeholder to a real check: scans `~/.warp/`
  for an MCP config file containing the SGSD MCP server name/path.

## Inputs Consumed

- `super-gsd/docs/SGSD-WARP-MCP-CONTRACT.md` -- 7-category redaction vocab
- `super-gsd/tools/warp-mcp/server.cjs` -- substrate (all 14 tools real)
- `super-gsd/tools/warp-doctor/check.cjs` -- Phase 67 (probe 15 upgrade)
- Warp MCP setup docs (https://docs.warp.dev/agent-platform/capabilities/mcp) referenced in atlas
- existing `.warp/workflows/*.yaml` -- shape source for new workflow

## Outputs

- `super-gsd/tools/warp-mcp/server.cjs` (UPDATED -- redaction wired into 9 tools; ERROR_CODES extended; selfTest A31-A37 added)
- `super-gsd/tools/warp-mcp/fixtures/_redaction/{env-secrets,bearer-tokens,redis-urls,api-keys-inline,private-kb-paths,unc-paths,onedrive-paths}.{input,expected}.json` (NEW; 7 fixture pairs)
- `super-gsd/tools/warp-doctor/check.cjs` (UPDATED -- probe 15 upgraded; new selfTest assertion)
- `super-gsd/docs/SGSD-WARP-MCP-SETUP.md` (NEW)
- `.warp/workflows/sgsd-mcp-self-test.yaml` (NEW)
- 5 Phase 72 standard artifacts

## Acceptance

1. `node super-gsd/tools/warp-mcp/run-self-test.cjs` exits 0 with
   redaction fixtures included (37+ assertions PASS).
2. Each redaction category triggers correctly on its dedicated fixture.
3. `_redactions_applied` field lists the categories that fired (closed
   vocab per Phase 68 contract).
4. SGSD-WARP-MCP-SETUP.md exists with: server-launch path / Warp MCP
   config JSON snippet / verify-via-self-test instruction /
   troubleshooting (server doesn't start / tools not discoverable) /
   VTP-optional disclaimer.
5. `.warp/workflows/sgsd-mcp-self-test.yaml` validates via
   warp-workflow-lint (Phase 64).
6. warp-doctor probe 15 returns PASS when MCP config detected;
   MISSING when absent. Phase 67 selfTest extended.
7. ERROR_CODES extended to len=13 (frozen); tool 14 D3 deviation
   formally aliased to `subprocess_timeout`.
8. READ-ONLY invariant preserved across both tools.
9. ASCII-only.

## Forward References

- v2.4 Phase 76: cockpit-state adapter consumes redacted MCP outputs.
- v2.7 Phase 89-90: write-capable contract is SEPARATE; redaction
  rules from this phase carry forward.
