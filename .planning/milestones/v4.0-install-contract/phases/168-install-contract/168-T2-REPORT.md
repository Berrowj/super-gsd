P168-T2 RESULT

STATUS: **IMPLEMENTED — ORCHESTRATOR_REQUIRED**

CHANGED:

- [hook-install-contract.cjs](<HOME>/AppData/Roaming/warp/Warp/data/worktrees/GSDedits/luminaria-hogback/super-gsd/scripts/lib/hook-install-contract.cjs:509)
- [install.sh](<HOME>/AppData/Roaming/warp/Warp/data/worktrees/GSDedits/luminaria-hogback/super-gsd/install.sh:352)
- [assert-install-contract.cjs](<HOME>/AppData/Roaming/warp/Warp/data/worktrees/GSDedits/luminaria-hogback/super-gsd/tests/install-contract/assert-install-contract.cjs:423)

DELIVERED:

- Report-only `formatProjectInstallStatus` with normalized paths, exact hashes, current summaries, and source revision.
- Read-only `--doctor`, exit codes 0/10/2, writer-action conflict refusal.
- Worktree-aware `git -C` freshness and separate remote-unavailable verdict.
- Real-process regression covering `.git` directory/file shapes and whole-fixture byte identity.
- Explicit 17-hook/9-module real-install assertions.

PASS:

- Both modified Node syntax checks.
- Manifest check.
- Generated-transitive T1 case.
- Current status exit 0.
- Spaced drift fixture exit 10 and byte identity.
- P167 hook contract 38/38.
- Three-file allowlist and `git diff --check`.

DENIED:

- `bash -n`, live doctor, FIRST/LAST real install, focused/full process suite, guard 13/13, and P167 propagation: sandbox returned Win32 access denial or `spawnSync … EPERM`.

No gate was reported as passing from a denial. No merge or phase close performed.
