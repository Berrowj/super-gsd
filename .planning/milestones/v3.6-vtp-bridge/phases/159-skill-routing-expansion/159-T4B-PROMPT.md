# P159-T4B — finish the interrupted T4 (wrapper killed Codex mid-edit)

You are the implementer. Fresh context. Edits-first; the sandbox denies spawns —
do NOT run suites, do NOT stop on spawnSync EPERM; verify statically. Do NOT
commit. Same six files as task P159-T4 (159-01-PLAN-LOCKED.md rev 2).

The prior T4 run was killed at the wrapper timeout with the work partially
complete. Orchestrator ran the suites unsandboxed; CURRENT failures to fix:

1. --case vtp-tool-family-unavailable-origin-gate (17/19):
   a. "vtp-implementation-pack-meeting-export unavailable is silent with one
      fixed row only" — the unregistered path currently writes the
      mcp_server_unregistered evidence row PLUS a kb-shadow row
      (would_route_vtp_query_triage). Unavailable must be EXACTLY one text-free
      row and nothing else — suppress the shadow emission for that turn.
   b. "human-quoted task notification remains routable" — the assertion's
      expected evidence for a HUMAN turn quoting notification text is not
      produced (evidence array empty while shadow rows fire). Align emission with
      the assertion: a human quoted-notification turn must remain fully routable
      through the same evidence surface as any human turn.
2. --case availability-guard regression (50/53), T1 class broken by your changes:
   "installed non-sgsd stdin target exits zero" (currently status=1),
   "...emits through production stdin" (empty), "...records one matched decision"
   (none). Installed non-sgsd slash targets must keep T1 behaviour exactly.

Everything else is green (registered case, erp family 37/37, ledger 16/16,
registry 18/18, classifier 25/25) — do not regress those.

Report: FILES_CHANGED / VERIFICATION (static, name checks) / DEVIATIONS /
BLOCKERS / ONE_LINER, max 150 words.
