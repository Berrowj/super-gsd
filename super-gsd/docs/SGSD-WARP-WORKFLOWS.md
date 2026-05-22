# SGSD Warp Workflows

Repository workflows for the SGSD operator. Search them in Warp Command Search by typing `SGSD:` or any of the search terms in their description.

All workflows live in `.warp/workflows/*.yaml`. Validation tool: `super-gsd/tools/warp-workflow-lint/lint.cjs`.

## Workflow Index (13 total)

| Workflow | YAML | Purpose | Search terms (selected) |
|---|---|---|---|
| `SGSD: Start` | `sgsd-start.yaml` | Boot cockpit + greet Claude in current Warp tab | start, claude, cockpit |
| `SGSD: Auto Mode` | `sgsd-auto.yaml` | Boot cockpit + send `go` to Claude (autonomous) | auto, claude, sgsd |
| `SGSD: Cockpit Only` | `sgsd-cockpit.yaml` | Open the 3 cockpit panes without starting Claude | cockpit, dashboard |
| `SGSD: Full Preflight` | `sgsd-preflight.yaml` | Run full preflight then start | preflight, startup |
| `SGSD: Token Summary` | `sgsd-token-current.yaml` | Refresh + print current milestone/phase token spend | tokens, status, attribution, spend |
| `SGSD: Status` | `sgsd-status.yaml` | Print active milestone/phase from STATE.md frontmatter | status, where, current |
| `SGSD: Recovery Packet` | `sgsd-recovery-packet.yaml` | Print recovery packet (checkpoint or current STATE) | recovery, resume, blocked, stuck |
| `SGSD: Gate Status` | `sgsd-gate-status.yaml` | Latest gate verdicts + review-ledger tail | gates, atc, verifier, review |
| `SGSD: Watchdog Status` | `sgsd-watchdog-status.yaml` | Autopilot watchdog + orchestrator-pulse tail | watchdog, autopilot, attention, alive |
| `SGSD: Codex Status` | `sgsd-codex-status.yaml` | Codex live state + last 10 dispatches | codex, review, openai, provider |
| `SGSD: Current Phase Artifacts` | `sgsd-current-phase-artifacts.yaml` | List files in active phase folder | phase, artifacts, files |
| `SGSD: Warp Doctor` | `sgsd-warp-doctor.yaml` | Read-only Warp + SGSD setup diagnostic (16 probes) | doctor, diagnose, warp, setup, health |
| `SGSD: Remote Monitor Packet` | `sgsd-remote-monitor-packet.yaml` | Concise off-machine packet for share-and-walk-away | remote, monitor, share, away, phone |

## Operator Daily Routine

```
SGSD: Start              -> begin a session
SGSD: Status             -> "where are we?"
SGSD: Watchdog Status    -> "is it alive?"
SGSD: Token Summary      -> "where are tokens going?"
SGSD: Recovery Packet    -> "what command resumes safely?"
```

## Operator Triage Routine (when something feels off)

```
SGSD: Warp Doctor        -> read-only setup health (16 probes)
SGSD: Gate Status        -> recent verdicts
SGSD: Codex Status       -> is Codex stale or active?
SGSD: Current Phase Artifacts -> what does the active phase look like?
SGSD: Recovery Packet    -> resume guidance
```

## Operator Off-Machine Routine

```
SGSD: Remote Monitor Packet  -> capture this block before sharing the Warp
                                session; verify nothing private before
                                forwarding.
```

## Validation

```bash
node super-gsd/tools/warp-workflow-lint/lint.cjs --project C:\Users\user\GSDedits
# Acceptance:
#   13/13 valid
#   all 10 search terms covered (start, auto, cockpit, token, recovery,
#   gates, watchdog, codex, blocked, status)
#   exit 0
node super-gsd/tools/warp-workflow-lint/lint.cjs --self-test
# Acceptance: 7/7 PASS
```

## Adding A New Workflow

1. Create `.warp/workflows/sgsd-<name>.yaml` with the standard shape:
   ```yaml
   name: "SGSD: <Operator-Facing Name>"
   description: <one sentence>. Search terms include <comma-separated>.
   command: 'cd "{{project_dir}}"; <command>'
   tags:
     - sgsd
     - <category>
   arguments:
     - name: project_dir
       description: Project root containing .planning and super-gsd.
       default_value: 'C:\Users\user\GSDedits'
   ```
2. Run `node super-gsd/tools/warp-workflow-lint/lint.cjs --project ...` and confirm exit 0.
3. Re-index Warp's command palette (typically auto-detected; if not, restart Warp).
4. Update this doc's Workflow Index table.
5. Commit `feat(...) : add SGSD: <name> workflow` atomically.

## Constraints

- Workflows must call STABLE SGSD commands. No ad-hoc inline logic that drifts from the canonical surfaces.
- Workflows must include `arguments:` with a `project_dir` default (cross-project portability).
- Workflows must include the `sgsd` tag (Command Search filter).
- Description must include search-term keywords so operators can find by intent, not by name.

## Related

- `WARP.md` -- Warp-specific operator instructions (this file is its workflow detail).
- `AGENTS.md` -- Tool-neutral all-agent rules.
- `super-gsd/tools/warp-doctor/check.cjs` -- 16-probe setup health check (called by `SGSD: Warp Doctor`).
- `.planning/milestones/v2.2/WARP-SMOKE.md` -- Phase 63 evidence matrix (Warp behaviour proven from terminal).
- `.planning/milestones/v2.2/MANUAL-CHECKS.md` -- 5 UI-bound checks the operator performs in Warp.
