# SGSD Warp Asset Index

Single discoverable index of all SGSD-Warp surfaces shipped across v2.2-v2.5.
Validated by `super-gsd/tools/warp-asset-validator/check.cjs` — every cited
path is verified to exist on disk; any missing entry fails the validation.

## Workflows (`.warp/workflows/*.yaml`) — 14 total

Phase 64 ships 13; Phase 72 ships 1 more (sgsd-mcp-self-test). Listed alphabetically:

- `.warp/workflows/sgsd-auto.yaml` — `SGSD: Auto Mode`
- `.warp/workflows/sgsd-cockpit.yaml` — `SGSD: Cockpit Only`
- `.warp/workflows/sgsd-codex-status.yaml` — `SGSD: Codex Status`
- `.warp/workflows/sgsd-current-phase-artifacts.yaml` — `SGSD: Current Phase Artifacts`
- `.warp/workflows/sgsd-gate-status.yaml` — `SGSD: Gate Status`
- `.warp/workflows/sgsd-mcp-self-test.yaml` — `SGSD: MCP Self-Test`
- `.warp/workflows/sgsd-preflight.yaml` — `SGSD: Full Preflight`
- `.warp/workflows/sgsd-recovery-packet.yaml` — `SGSD: Recovery Packet`
- `.warp/workflows/sgsd-remote-monitor-packet.yaml` — `SGSD: Remote Monitor Packet`
- `.warp/workflows/sgsd-start.yaml` — `SGSD: Start`
- `.warp/workflows/sgsd-status.yaml` — `SGSD: Status`
- `.warp/workflows/sgsd-token-current.yaml` — `SGSD: Token Summary`
- `.warp/workflows/sgsd-warp-doctor.yaml` — `SGSD: Warp Doctor`
- `.warp/workflows/sgsd-watchdog-status.yaml` — `SGSD: Watchdog Status`

## Skills (`.agents/skills/*/SKILL.md`) — 7 total

Phase 79 deliverables:

- `.agents/skills/sgsd-warp-operator/SKILL.md`
- `.agents/skills/sgsd-status-brief/SKILL.md`
- `.agents/skills/sgsd-gate-triage/SKILL.md`
- `.agents/skills/sgsd-token-triage/SKILL.md`
- `.agents/skills/sgsd-roadmap-planner/SKILL.md`
- `.agents/skills/sgsd-cockpit-review/SKILL.md`
- `.agents/skills/sgsd-release-check/SKILL.md`

## Prompts (`super-gsd/docs/SGSD-WARP-PROMPTS.md`) — 7 total

Phase 82 deliverable. All 7 prompts in a single document:

- P1: Current Status Explainer
- P2: Gate Triage
- P3: Token Waste Triage
- P4: Phase Plan Critic
- P5: Cockpit UX Critic
- P6: Remote Monitoring Summary
- P7: Release Readiness Explainer

File: `super-gsd/docs/SGSD-WARP-PROMPTS.md`

## Notebook

Phase 81 deliverable — 10 runnable PowerShell command blocks:

- `super-gsd/docs/SGSD-WARP-NOTEBOOK.md`

## MCP Tools — 14 total

Phase 68 contract / Phase 69-72 implementation:

- `sgsd_current_state`
- `sgsd_current_phase`
- `sgsd_milestone_status`
- `sgsd_watchdog_status`
- `sgsd_gate_status`
- `sgsd_agent_roster`
- `sgsd_codex_status`
- `sgsd_token_spend`
- `sgsd_context_bench_status`
- `sgsd_latest_commits`
- `sgsd_recovery_packet`
- `sgsd_cockpit_snapshot`
- `sgsd_artifact_links`
- `sgsd_warp_doctor`

Server: `super-gsd/tools/warp-mcp/server.cjs`
Contract: `super-gsd/docs/SGSD-WARP-MCP-CONTRACT.md`
Setup: `super-gsd/docs/SGSD-WARP-MCP-SETUP.md`
Self-test: `super-gsd/tools/warp-mcp/run-self-test.cjs`

## Launch Configs (`super-gsd/docs/templates/warp-launch-configs/`) — 2 total

Phase 78 deliverables:

- `super-gsd/docs/templates/warp-launch-configs/sgsd-operator-workspace.yaml`
- `super-gsd/docs/templates/warp-launch-configs/sgsd-cockpit-only.yaml`
- `super-gsd/docs/templates/warp-launch-configs/README.md` (install + caveats)

Install destination: `~/.warp/launch_configurations/`

## Tools (`super-gsd/tools/*`)

Read-only diagnostic + utility tools shipped across v2.2-v2.5:

- `super-gsd/tools/warp-doctor/check.cjs` — Phase 67 (16 setup health probes)
- `super-gsd/tools/warp-workflow-lint/lint.cjs` — Phase 64 (workflow YAML structural lint)
- `super-gsd/tools/warp-mcp/server.cjs` — Phase 69-72 (MCP server with 14 tools + 7-category redaction)
- `super-gsd/tools/warp-plan-converter/convert.cjs` — Phase 80 (Warp Plan → SGSD Phase scaffold; READ-ONLY on active state)
- `super-gsd/tools/cockpit-state/adapter.cjs` — Phase 76 (10-section snapshot composer)
- `super-gsd/scripts/lib/orchestrator-live-writer.cjs` — Phase 74 (event stream writer)
- `super-gsd/scripts/lib/orchestrator-live-reader.cjs` — Phase 75 (event stream reader)
- `super-gsd/scripts/lib/render-cockpit-snapshot.ps1` — Phase 77 (Warp PowerShell renderer)

## Operator-facing Docs (`super-gsd/docs/*`)

- `super-gsd/docs/SGSD-WARP-OPERATOR-GUIDE.md` — Phase 66 (full daily-life guide)
- `super-gsd/docs/SGSD-WARP-WORKFLOWS.md` — Phase 64 (13-row workflow catalogue + 3 routines)
- `super-gsd/docs/SGSD-WARP-MCP-CONTRACT.md` — Phase 68 (14 MCP tool contracts)
- `super-gsd/docs/SGSD-WARP-MCP-SETUP.md` — Phase 72 (Warp MCP config + verify)
- `super-gsd/docs/SGSD-WARP-NOTEBOOK.md` — Phase 81 (10 runnable blocks)
- `super-gsd/docs/SGSD-WARP-PROMPTS.md` — Phase 82 (7 prompt templates)
- `super-gsd/docs/SGSD-WARP-ASSET-INDEX.md` — Phase 83 (this file)
- `super-gsd/docs/OPERATOR-QUESTION-MODEL.md` — Phase 73 (12 questions → MCP tools mapping)
- `super-gsd/docs/ORCHESTRATOR-LIVE-EVENTS.md` — Phase 74 (16 event types contract)

## Repo-root rules

- `WARP.md` — Warp-specific operator instructions; takes priority in Warp.
- `AGENTS.md` — tool-neutral all-agent contract (5 hard rules).
- `CLAUDE.md` — Claude Code orchestrator contract.

## Validate

```bash
node super-gsd/tools/warp-asset-validator/check.cjs --project C:\Users\jack.berrow\GSDedits
```

Validates every cited path exists. Exit 0 = clean; exit 1 = missing path.

## Related

- Phase 63 `WARP-SMOKE.md` + `MANUAL-CHECKS.md` — Phase 63 evidence + operator UI checks.
- Phase 78 launch config templates README — install instructions.
