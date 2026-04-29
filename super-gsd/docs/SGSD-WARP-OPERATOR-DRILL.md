# SGSD Warp Operator Drill (v2.6 Phase 88)

End-to-end drill validating that v2.2-v2.6 deliverables work together as
the operator daily flow. 11 steps. Some are automatable (terminal-derivable
evidence); others require operator UI participation. Drill produces a
PASS/FAIL/MANUAL-CHECK row per step.

## Run

```powershell
& super-gsd/scripts/lib/run-operator-drill.ps1 -ProjectDir 'C:\Users\jack.berrow\GSDedits'
```

The script runs the automatable steps; manual UI steps are listed at the
end with explicit operator instructions. After running, capture the output
in `.planning/milestones/v2.6/phases/88-end-to-end-warp-operator-drill/88-DRILL-RESULT.md`
(template provided).

## 11-Step Drill

| # | Step | Mode | Success criterion |
|--:|---|---|---|
| 1 | Open Warp | manual | Operator confirms Warp window open in repo dir |
| 2 | Run `SGSD: Warp Doctor` | automatable | warp-doctor exit code (0 clean / 1 actionable); 18 probes returned |
| 3 | Run `SGSD: Status` | automatable | STATE.md frontmatter readable; 30 lines emitted |
| 4 | Ask Warp Agent for status through MCP | manual | Operator types prompt P1 (Current Status Explainer) into Warp Agent; verifies response cites real MCP data |
| 5 | Start SGSD (`sg`) | automatable | sg shortcut resolves; profile defines `function sg` |
| 6 | Open cockpit | manual | Operator confirms cockpit windows opened separately from Claude tab |
| 7 | Generate or use fixture gate warning | automatable | inject synthetic crit-backlog row; verify gate-status workflow surfaces it |
| 8 | Run gate triage skill | automatable | invoke .agents/skills/sgsd-gate-triage/SKILL.md procedure; verify output cites the synthetic row |
| 9 | Open Code Review | manual | Operator opens Warp Code Review panel; verifies recent diff visible |
| 10 | Generate recovery packet | automatable | sgsd_recovery_packet MCP call; envelope ≤ 4KB; _state_staleness present |
| 11 | Generate remote monitor packet | automatable | SGSD: Remote Monitor Packet workflow; 4-block output |

## Acceptance

- All 11 steps recorded with PASS / FAIL / MANUAL-CHECK in drill result.
- Automatable steps (2-3, 5, 7-8, 10-11) PASS without operator intervention.
- Manual steps (1, 4, 6, 9) PASS with documented operator confirmation.
- Drill output captured in 88-DRILL-RESULT.md.
- Any FAIL row triggers a v2.6 close-blocker via CRIT-BACKLOG entry.

## After running

If all 11 PASS / MANUAL-CHECK with operator confirmation:
- v2.6 milestone is eligible for SHIPPED-clean (or SHIPPED-WITH-DEBT-1 if `codex_unavailable` row remains open).
- Run `node super-gsd/scripts/sgsd-complete-milestone.cjs --milestone v2.6` to close.

If any FAIL:
- File a v2_6_debt CRIT-BACKLOG row.
- Decide: in-loop fix (re-dispatch executor) or accept-with-debt (SHIPPED-WITH-DEBT-N).

## Related

- `super-gsd/docs/SGSD-WARP-OPERATOR-GUIDE.md` (full daily-life guide)
- `super-gsd/docs/SGSD-WARP-WORKFLOWS.md` (13 workflows)
- `super-gsd/docs/SGSD-WARP-MCP-CONTRACT.md` (14 MCP tools)
- `.agents/skills/sgsd-*` (7 skills)
