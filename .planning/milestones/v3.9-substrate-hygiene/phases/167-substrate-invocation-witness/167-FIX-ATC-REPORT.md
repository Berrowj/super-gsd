RESULT

Implemented the CRITICAL fix in [install.sh](<HOME>/AppData/Roaming/warp/Warp/data/worktrees/GSDedits/luminaria-hogback/super-gsd/install.sh) and its [registration guard](<HOME>/AppData/Roaming/warp/Warp/data/worktrees/GSDedits/luminaria-hogback/super-gsd/tests/installer-registration-guard/assert-installer-registration-guard.cjs). Only these two allowlisted files changed. P167 witness contracts were untouched.

No writer can execute on ANY entry point before the combined refusal set, Codex entries included, is known.

VERIFICATION

```text
CASE=preflight-static EXIT_CODE=0
CASE=smoke-static EXIT_CODE=0
CASE=bundled-overlay-static EXIT_CODE=0
CASE=bundled-overlay-current EXIT_CODE=1 DENIED=spawnSync_bash_EPERM
CASE=vendored-nine-hook EXIT_CODE=1 DENIED=spawnSync_bash_EPERM
CASE=node-check-both-sites EXIT_CODE=1 DENIED=spawnSync_bash_EPERM
CASE=deployed-hook-smoke EXIT_CODE=1 DENIED=spawnSync_bash_EPERM
CASE=hook-distribution-all-types EXIT_CODE=1 DENIED=spawnSync_bash_EPERM
CASE=hook-manifest-completeness EXIT_CODE=0
CASE=brokered-substrate-capability EXIT_CODE=1 DENIED=spawnSync_bash_EPERM
CASE=sgsd-update-clarity-shape EXIT_CODE=1 DENIED=spawnSync_git_EPERM
CASE=sgsd-update-clarity-recovery EXIT_CODE=1 DENIED=spawnSync_git_EPERM

bash -n super-gsd/install.sh EXIT_CODE=256 DENIED=CreateFileMapping_Win32_error_5
node --check super-gsd/tests/installer-registration-guard/assert-installer-registration-guard.cjs EXIT_CODE=0
node super-gsd/tools/feature-propagation/audit.cjs --self-test EXIT_CODE=0 PASS_LINES=15
git diff --check EXIT_CODE=0
```

ASSERTION RETIREMENT

One assertion was replaced: `repoDistribution < codexDistribution`. Extraction into the required shared detector makes inline inventory impossible; replacements enforce one detector definition plus detect/refuse-before-copy ordering.
