STATUS: DENIED — fix applied; Bash verification sandbox-blocked.

CHANGE:
- Exported `isCleanPolicyDecision` from [hook-registration-preflight.cjs](<HOME>/AppData/Roaming/warp/Warp/data/worktrees/GSDedits/luminaria-hogback/super-gsd/scripts/lib/hook-registration-preflight.cjs:778).
- Imported and reused it in `finalHookExecutions` in [assert-install-contract.cjs](<HOME>/AppData/Roaming/warp/Warp/data/worktrees/GSDedits/luminaria-hogback/super-gsd/tests/install-contract/assert-install-contract.cjs:334).
- No delivery code or hook-name list changed.

CLASSIFIER:
After bounded single-line normalization, it accepts output matching a bracketed hook identifier followed by `blocked`, `denied`, or `refused`, a colon, and a non-empty reason.

VERIFICATION:
- `node --check` on both modified files: PASS
- Recognised/unrecognised classifier probes: PASS
- `generated-transitive-manifest`: PASS
- Required full command: DENIED at `spawnSync bash EPERM` before both Bash-backed cases could run.

RESIDUAL RISK:
Acceptable: an unrecognised blocking message fails closed, preventing an ambiguous nonzero hook exit from being silently accepted; hooks intentionally returning policy blocks must preserve the recognised signature.
