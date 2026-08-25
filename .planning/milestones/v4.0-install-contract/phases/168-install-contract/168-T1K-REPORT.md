STATUS: IMPLEMENTED — UNSANDBOXED VERIFICATION REQUIRED

CHANGED:

- [hook-install-contract.cjs](/<HOME>/AppData/Roaming/warp/Warp/data/worktrees/GSDedits/luminaria-hogback/super-gsd/scripts/lib/hook-install-contract.cjs:985): stage narrowed to five derived owned paths; actual filesystem reads are traced.
- [assert-install-contract.cjs](/<HOME>/AppData/Roaming/warp/Warp/data/worktrees/GSDedits/luminaria-hogback/super-gsd/tests/install-contract/assert-install-contract.cjs:64): regression intercepts real filesystem reads with locked unrelated home/config files.
- [assert-installer-registration-guard.cjs](/<HOME>/AppData/Roaming/warp/Warp/data/worktrees/GSDedits/luminaria-hogback/super-gsd/tests/installer-registration-guard/assert-installer-registration-guard.cjs:243): closure-derived package roots are copied; no symlink/junction fallback.

PASS:

- Locked owned-scope probe: 5 mappings.
- Symlink refusal preserved.
- Manifest current.
- Fixture/static ordering case PASS.
- Closure: 32 files, 9 `scripts/lib`, packages derived as `ajv,js-yaml`.
- `node --check` all modified Node files.
- P167 files unchanged; hook contract 38/38.
- `git diff --check`.

DENIED:

- Real install and `bash -n`: Git Bash `CreateFileMapping ... Win32 error 5`.
- Install-contract 3/3: `spawnSync node.exe EPERM`.
- Guard 13/13: first 3 static cases PASS, then `spawnSync bash EPERM`.

No denied command is reported as passing.
