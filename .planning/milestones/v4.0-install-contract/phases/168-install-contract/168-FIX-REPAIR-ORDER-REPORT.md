RESULT: PASS

CHANGE:
- Moved repo hook smoke before all mutations in [audit.cjs](<HOME>/AppData/Roaming/warp/Warp/data/worktrees/GSDedits/luminaria-hogback/super-gsd/tools/feature-propagation/audit.cjs:683).
- Added SHA-256 full-fixture regression coverage in [assert-installer-registration-guard.cjs](<HOME>/AppData/Roaming/warp/Warp/data/worktrees/GSDedits/luminaria-hogback/super-gsd/tests/installer-registration-guard/assert-installer-registration-guard.cjs:2377).
- Smoke uses `tool_name: Read`; the witness returns before loading runtime. Required hooks are distributed earlier by both installer paths.
- No assertions, refusal text/reasons, or P167 contracts changed.

TDD:
- Before fix: exit 1; recorded broker copy, key creation, and global registration removal.
- After fix: exit 0; actions empty and fixture byte-identical.

VERIFICATION:
- `node --check` both modified files: exit 0
- `audit.cjs --self-test`: exit 0
- Focused regression: exit 0
- Preflight, smoke-static, manifest, bundled-overlay guards: exit 0
- `git diff --check` and two-file allowlist: exit 0

DENIED:
- `brokered-substrate-capability`: `spawnSync bash EPERM`
- `deployed-hook-smoke`: `spawnSync bash EPERM`
