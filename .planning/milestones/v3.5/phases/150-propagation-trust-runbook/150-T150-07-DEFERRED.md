# T150-07 devcp Propagation — DEFERRED

date: 2026-08-10
verdict: DEFERRED (operator decision — devcp actively in use)

## Why deferred
Preflight (read-only) found devcp running substantial live SGSD/Clarity work at ceremony time:
- codex session with cwd = ~/.claude/super-gsd/source (the exact update target)
- second codex in /opt/clarity/project-clarity-erp; 11 claude + 2 tmux sessions (main, rag-edits)
- operator confirmed: plenty of SGSD items still running on devcp
The guarded update fail-closes on a dirty source anyway (see local patch below); restart-evidence would bounce MCP/cockpit/tmux under live work. Forcing a runtime switch under active sessions is exactly what the ceremony's safety rails prevent.

## devcp state captured (for the follow-up run)
- Canonical source ~/.claude/super-gsd/source: HEAD 7fb47eb, origin git@github.com:Berrowj/super-gsd.git (correct), 1 behind after today's publish.
- LOCAL PATCH on source (must be preserved before update): M super-gsd/tools/cockpit-sidecar/serve.cjs (1-line devcp bridge tweak) + backup serve.cjs.devcp-bridge.20260529T162057Z. A host-specific customization — branch-preserve before --ff-only, then reconcile per DEVCP-RECONCILIATION.md.
- Fork safety verified: ~/GSDedits (883 PII commits) is a SEPARATE dir from the update target; never touched.

## Follow-up (run when devcp is quiet)
1. Quiesce or coordinate the devcp SGSD sessions.
2. On devcp: cd ~/.claude/super-gsd/source; git branch wip/devcp-serve-patch; git stash (or commit the serve.cjs patch).
3. Run the PROPAGATION.md T150-07 block: guarded update (accepts check status 0|10), then sgsd-devcp-restart-evidence.sh.
4. Interactive trust grant on devcp (codex -C, approve hooks) + forbidden-write probe — operator-only, no bypass.
5. Capture evidence to ~/.claude/super-gsd/reconciliation/p150-devcp-restart-evidence.json; append AC-150d result.

Substrate now fully supports this: devcp update = /sgsd-update once its session is free. This is a clean documented follow-up, not open risk.
