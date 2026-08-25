RESULT: IMPLEMENTED — UNSANDBOXED VERIFICATION REQUIRED

CHANGE:

- [hook-install-contract.cjs](<HOME>/AppData/Roaming/warp/Warp/data/worktrees/GSDedits/luminaria-hogback/super-gsd/scripts/lib/hook-install-contract.cjs:767) now accepts the prepared object directly while retaining descriptor-path and `applyProjectInstall` compatibility.
- CLI failures now include bounded `{code, request, path, message}` diagnostics with stack frames removed.
- [installer guard](<HOME>/AppData/Roaming/warp/Warp/data/worktrees/GSDedits/luminaria-hogback/super-gsd/tests/installer-registration-guard/assert-installer-registration-guard.cjs:1511) now searches for the literal `writeJournal('prepared')`.
- Added regression coverage for prepared-object composition, spaced paths, and CLI error disclosure.
- Installer ordering remains exactly 482/483, 911, 1020/1021, and 1276/1277. P167 files untouched.

VERIFICATION:

- Prepared-envelope and legacy `applyProjectInstall`: PASS
- CLI structured diagnosis: PASS
- `smoke-static`: PASS
- `node --check` modified Node files: 4/4 PASS
- `git diff --check`: PASS

DENIED:

- Install-contract 3/3: `spawnSync node EPERM`
- Registration guard 13/13: first 3 PASS, then `spawnSync bash EPERM`
- `bash -n install.sh`: Git Bash `CreateFileMapping` Win32 error 5

The orchestrator must rerun those three DENIED checks unsandboxed.
