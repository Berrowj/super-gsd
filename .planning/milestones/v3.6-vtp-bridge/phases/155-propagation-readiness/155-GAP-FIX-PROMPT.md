# P155 phase-ATC gap fix — activation seam + deprecated-surface leftovers

Fresh context. Do NOT commit. Phase-level ATC found the deployed-but-unregistered
seam (12th recorded instance) plus leftovers. Fix exactly these:

1. CRITICAL activation: `super-gsd/config/settings-overlay.json:13` registers only
   `gsd-session-start.js` on SessionStart. Register the derived-state hook
   `~/.claude/hooks/gsd-session-state.sh` there too (same shape as sibling entries;
   it is the file install.sh now deploys). Extend
   `super-gsd/tests/propagation-readiness/assert-decision-state-consumers.cjs`
   installer case: after the real install into isolated HOME, parse the MERGED global
   settings fixture and assert the session-state hook is REGISTERED, then execute the
   hook via that registered command string — activation proven through settings,
   never by running the copied file directly.
2. WARNING leftovers: `super-gsd/CLAUDE-OVERLAY.md` still instructs raw STATE.md
   reads in its session-start/loop prose — align those directives to the
   decision-state CLI (managed comms block untouched). `super-gsd/scripts/sgsd-agent-dashboard.sh`
   still reads raw STATE + root ROADMAP — route its state line through
   `decision-state.cjs --render session` (keep its other panels).
3. The v3.6 ROADMAP.md now exists (orchestrator-authored). Add one consumer-test case
   asserting the live repo resolves v3.6-vtp-bridge with folder-tier confidence
   (>0.4) and that a stale STATE now yields a CONFLICT row naming both values.

CRIT-1 (vendored devcp trees / 42 stale worktrees) is deployment documentation, not
code — out of your scope.

Verify what the sandbox allows:
    node super-gsd/tests/propagation-readiness/assert-decision-state-consumers.cjs --consumer all

Report: FILES_CHANGED / VERIFICATION / DEVIATIONS / BLOCKERS / ONE_LINER, max 120 words.
