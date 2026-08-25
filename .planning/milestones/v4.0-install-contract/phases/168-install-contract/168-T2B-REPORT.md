P168-T2B RESULT

STATUS: **IMPLEMENTED — ORCHESTRATOR_REQUIRED**

CHANGED:

- [install.sh](/<HOME>/AppData/Roaming/warp/Warp/data/worktrees/GSDedits/luminaria-hogback/super-gsd/install.sh:1213)
- [assert-install-contract.cjs](/<HOME>/AppData/Roaming/warp/Warp/data/worktrees/GSDedits/luminaria-hogback/super-gsd/tests/install-contract/assert-install-contract.cjs:543)

DELIVERED:

- Deferred explicit-project normalization until after complete argument/conflict validation.
- Missing Node now reaches doctor’s status 2 path; `set -e` remains enabled.
- PATH-based Node-unavailable test uses space-bearing paths.
- Writer conflict assertion strengthened to exact status 1.
- No P167, writer, staging, or self-reexecution changes.

EXIT-CODE CONTRACT — all reachable:

- `0` current: [contract:888](/<HOME>/AppData/Roaming/warp/Warp/data/worktrees/GSDedits/luminaria-hogback/super-gsd/scripts/lib/hook-install-contract.cjs:888); asserted [test:579](/<HOME>/AppData/Roaming/warp/Warp/data/worktrees/GSDedits/luminaria-hogback/super-gsd/tests/install-contract/assert-install-contract.cjs:579).
- `10` drift: contract:888, propagated [install:437](/<HOME>/AppData/Roaming/warp/Warp/data/worktrees/GSDedits/luminaria-hogback/super-gsd/install.sh:437); asserted test:594.
- `2` inability: [install:358](/<HOME>/AppData/Roaming/warp/Warp/data/worktrees/GSDedits/luminaria-hogback/super-gsd/install.sh:358), coerced at 373, returned at 437; asserted test:566.
- `1` usage conflict: [install:1258](/<HOME>/AppData/Roaming/warp/Warp/data/worktrees/GSDedits/luminaria-hogback/super-gsd/install.sh:1258); asserted test:622.

PASS:

- Node syntax, manifest check, generated-transitive case, diff check.
- Inventory: 17 hooks and 9 modules; FIRST/LAST checked.
- Independent review: 0 findings.

DENIED:

- `bash -n`, full suite, guard 13/13, real install, focused doctor, and live repository doctor: sandbox returned `EPERM`/Win32 access denial. None counted as passing.
