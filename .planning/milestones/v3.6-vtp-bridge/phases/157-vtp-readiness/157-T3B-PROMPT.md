# P157-T3B — implement the pending-depth hook + overlay registration (red already run)

You are the implementer. Fresh context. Node works; no `claude` spawning. Do NOT
commit. Scope: create `super-gsd/hooks/sgsd-vtp-pending.js` and register it in
`super-gsd/config/settings-overlay.json`. Do NOT edit the test, install.sh, or
merge-settings.js.

The contractual red ALREADY RAN unsandboxed by the orchestrator:
`assert-vtp-readiness.cjs --case session-start-depth` exit 1 with the real installer
executed and `HOOK_NOT_REGISTERED` (log: .planning/tmp/157-t3-red.log). Your prior
run stopped honestly at the sandbox EPERM boundary (157-T3-REPORT.md); this dispatch
is the implementation half.

Contract (task P157-T3 in 157-01-PLAN-LOCKED.md rev 2, verbatim):
- Hook validates SessionStart JSON on stdin, resolves ONLY ~/.vtp/pending-ledger.jsonl,
  counts non-empty records without parsing or retaining text, emits exactly
  `VTP pending-ledger depth: N` + newline.
- Missing/unreadable ledger, malformed/non-SessionStart input, non-VTP homes: exit 0
  silently.
- NO imports/invocations of net, http, https, dns, fetch, child_process, MCP, shell,
  or service envs.
- Overlay registration: `node ~/.claude/hooks/sgsd-vtp-pending.js` in the SessionStart
  block of settings-overlay.json, matching the existing hook-registration style so the
  existing install.sh JS hook copy loop deploys it unchanged.
- Read the test's session-start-depth case FIRST and satisfy its exact assertions
  (exact stdout, empty stderr, byte preservation, idempotent re-install, unrelated-hook
  preservation).

Verify what the sandbox allows: `node --check super-gsd/hooks/sgsd-vtp-pending.js`,
JSON-parse the overlay, and any non-spawning assertions. The full installer-backed
green run is the orchestrator's step; do not fake it.

Report: FILES_CHANGED / VERIFICATION / DEVIATIONS / BLOCKERS / ONE_LINER, max 150 words.
