STATUS
Implementation complete; full acceptance awaits unsandboxed verification.

FILES_CHANGED

- [install.sh](<HOME>/AppData/Roaming/warp/Warp/data/worktrees/GSDedits/luminaria-hogback/super-gsd/install.sh:848)
- [hook-registration-preflight.cjs](<HOME>/AppData/Roaming/warp/Warp/data/worktrees/GSDedits/luminaria-hogback/super-gsd/scripts/lib/hook-registration-preflight.cjs:229)
- [assert-installer-registration-guard.cjs](<HOME>/AppData/Roaming/warp/Warp/data/worktrees/GSDedits/luminaria-hogback/super-gsd/tests/installer-registration-guard/assert-installer-registration-guard.cjs:1412)

IMPLEMENTED
Preflight now derives normalized delivery paths from the existing sealed candidate descriptor. Only missing hooks in that set are exempted. Missing excluded hooks still produce the exact refusal before writes. No new mode, recomputation, hook list, assertion weakening, or P167 changes.

PASS

- TDD RED observed, then GREEN.
- `preflight-static`
- `smoke-static`
- Manifest freshness
- `node --check` on both modified JavaScript files
- `git diff --check`
- Exactly three allowlisted files modified
- Spaced-path regression included with byte-identical refusal snapshot

DENIED

- Guard `--all`: 3 static cases passed, then `spawnSync bash EPERM`
- Install-contract: generated case passed, then `spawnSync bash EPERM`
- Both Clarity cases: `spawnSync bash EPERM`
- `bash -n`: Git Bash `CreateFileMapping` error 5
- FIRST and LAST real installs: same sandbox denial before installer execution; 0/0 delivery counts are not passes.
