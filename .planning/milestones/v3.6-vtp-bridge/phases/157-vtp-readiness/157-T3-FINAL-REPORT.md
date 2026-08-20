# P157-T3 combined report (two dispatches + orchestrator division of labour)

- Dispatch 1 (157-T3-REPORT.md): test case authored; executor STOPPED honestly at the
  sandbox EPERM boundary rather than fake a red without the real installer.
- Orchestrator RED (unsandboxed, .planning/tmp/157-t3-red.log): exit 1, real
  install.sh executed, HOOK_NOT_REGISTERED, merged VTP registrations 0.
- Dispatch 2 (157-T3B-REPORT.md): hook + overlay registration implemented; test,
  install.sh, merge-settings.js untouched.
- Orchestrator GREEN (unsandboxed, .planning/tmp/157-t3-green.log): 28/28 assertions,
  exit 0 — exact depth line, silent fail-open cases, byte preservation, idempotent
  re-install, unrelated-hook preservation.
