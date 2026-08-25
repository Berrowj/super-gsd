STATUS: FIX APPLIED — UNSANDBOXED VERIFICATION REQUIRED

CHANGED:
- [hook-registration-preflight.cjs](<HOME>/AppData/Roaming/warp/Warp/data/worktrees/GSDedits/luminaria-hogback/super-gsd/scripts/lib/hook-registration-preflight.cjs)
  - Records byte-level smoke-output truncation.
  - Clipped output cannot qualify as a clean policy decision.
  - Preserves the 8192-byte limit and shared classifier.
- [assert-installer-registration-guard.cjs](<HOME>/AppData/Roaming/warp/Warp/data/worktrees/GSDedits/luminaria-hogback/super-gsd/tests/installer-registration-guard/assert-installer-registration-guard.cjs)
  - Adds the limit-derived truncation/load-error case.
  - Retains the short-stack case.
  - Adds split-UTF-8 boundary coverage.

VERIFICATION:
- PASS — `node --check` both files.
- PASS — `smoke-static`, including new boundary cases.
- PASS — `git diff --check`; exactly two allowlisted files changed.
- PASS — independent re-review: no Critical/Important findings.
- DENIED — guard `--all`: sandbox blocked nested `bash` after 3 passing cases.
- DENIED — install-contract: blocked after 1 passing case.
- DENIED — standalone real install: sandbox policy blocked execution.

Orchestrator must rerun the three DENIED checks unsandboxed.
