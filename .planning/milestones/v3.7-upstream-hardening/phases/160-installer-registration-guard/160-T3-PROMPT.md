# P160-T3 — installed-hook dependency smoke wired into install.sh (edits-first)

You are the implementer for ONE task. Fresh context. No spawns in YOUR
verification; do NOT stop on spawnSync EPERM; static checks only; the
orchestrator runs the spawn-bound suite and the real installer case. Do NOT
commit.

Task P160-T3 in `160-01-PLAN-LOCKED.md` (same dir) is your VERBATIM contract.
Files: super-gsd/install.sh, hook-registration-preflight.cjs (extend, do not
fork), and the guard test.

Essentials:
- After hooks deploy and registrations pass T1's preflight, install.sh runs each
  deployed hook once with a benign payload (SessionStart-shaped or
  UserPromptSubmit-shaped JSON on stdin as appropriate); non-zero exit or load
  error => install fails LOUD naming the hook. This catches D3 (entry deploys
  but a sibling dependency does not resolve from the installed location).
- The smoke lives as a function in the preflight lib (one implementation, two
  callers: installer + test), honouring hook timeout budgets.
- Test case: a deployed hook whose sibling lib is missing must fail the smoke
  with the hook named; a healthy 16-hook deploy passes.

Report: FILES_CHANGED / VERIFICATION (static) / DEVIATIONS / BLOCKERS /
ONE_LINER, max 150 words.
