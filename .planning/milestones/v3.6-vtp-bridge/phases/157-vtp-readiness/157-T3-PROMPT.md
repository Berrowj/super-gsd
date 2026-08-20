# P157-T3 — SessionStart pending-ledger depth hook, red-then-green

You are the implementer for ONE task. Fresh context. Node works; no `claude`
spawning (EPERM). Sandbox-denied spawns fail loud naming the error, NEVER
self-fulfil; the orchestrator re-runs unsandboxed. Do NOT commit.

## Read first

- Task P157-T3 in `157-01-PLAN-LOCKED.md` (same dir, revision 2) — VERBATIM
  contract: exact stdout `VTP pending-ledger depth: N` + newline; silent exit 0 for
  missing ledger / malformed input / non-VTP homes; NO net/http/https/dns/fetch/
  child_process/MCP/shell/service-env imports; count-only, never parse or retain
  ledger text.
- The P155 activation-test pattern under `super-gsd/tests/propagation-readiness/`
  (isolated fake HOME, real `install.sh --init-project --install-global
  --skip-cockpit-deps`, parse merged settings, execute the merged command with
  genuine SessionStart JSON, idempotent re-install). REUSE it exactly.
- `super-gsd/config/settings-overlay.json` + existing JS hook install loop in
  install.sh + `merge-settings.js` — register `node ~/.claude/hooks/sgsd-vtp-pending.js`;
  do NOT edit install.sh or merge-settings.js.

## Order of work — the red run is contractual

1. Extend `super-gsd/tests/vtp-readiness/assert-vtp-readiness.cjs` with the
   session-start-depth case per the contract (three opaque sentinel rows, scrubbed
   env, byte hashes, stale-hook replacement, unrelated-hook preservation, single
   registration).
2. RUN it red: merged global settings have no VTP command yet. Record command +
   output.
3. Write `super-gsd/hooks/sgsd-vtp-pending.js` and add the settings-overlay
   registration.
4. Re-run to green; also run the P155 propagation-readiness regression case that
   covers overlay activation.

## Verify before reporting

    node super-gsd/tests/vtp-readiness/assert-vtp-readiness.cjs --case session-start-depth
    node super-gsd/tests/vtp-readiness/assert-vtp-readiness.cjs --case all

Report: FILES_CHANGED / VERIFICATION (RED preserved) / DEVIATIONS / BLOCKERS /
SCRIPTS_CREATED / ONE_LINER, max 200 words.
