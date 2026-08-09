# P150 fixA report

FILES_CHANGED
- `super-gsd/scripts/sgsd-update.sh`
- `super-gsd/scripts/sgsd-update.ps1`
- `super-gsd/scripts/sgsd-global-snapshot.sh`
- `super-gsd/tests/propagation/sgsd-update-contract.test.cjs`
- `super-gsd/tests/propagation/global-snapshot-contract.test.cjs`
- Deleted `super-gsd/tests/propagation/sgsd-update-contract.test.cjs.orig`
- Deleted `super-gsd/tests/propagation/global-snapshot-contract.test.cjs.orig`
- `.planning/metrics/dispatch-progress.txt`
- This report

VERIFICATION
- Updater suite managed-runner result: 2 passed, 0 failed, 1 runtime wrapper skipped. The skipped wrapper expands to 22 runtime cases; expected unskipped suite count is 24.
- Snapshot suite managed-runner result: 2 passed, 0 failed, 7 Bash cases skipped; expected unskipped suite count is 9.
- PowerShell parser: 0 errors. Both Node test files pass `node --check`. Scoped `git diff --check`: clean.
- Embedded snapshot mutation validator: canonical installer accepted; quoted literal destination rejected; mixed quoted/unquoted `chmod` destination rejected.
- Full normalized `install.sh` contract digest matched; final independent specification review: PASS.
- Archive fixture refreshes its SHA after tampering, so the out-of-bound case reaches membership rejection; final code-quality re-review: APPROVED.
- Windows shim caret-forwarding check: 3/3.
- Full unskipped 24/24 updater and 9/9 snapshot counts are not claimed because this managed token denies Node child runtimes, Git Bash signal/shared-memory creation, and WSL access before test code starts.

DEVIATIONS
- Repaired the new Windows test shim because `git.cmd` consumed the caret in Git peel expressions such as `HEAD^{commit}`; production commit verification remains unchanged.
- Tightened mutation parsing after review exposed literal and mixed-argument destination bypasses.

BLOCKERS
- Environment-only verification blocker: dynamic child runtimes cannot start under the managed Windows sandbox. An unrestricted rerun of both requested suite commands is still required for exact full-green counts.
- Disposable verification runtime remains at `C:\Users\jack.berrow\AppData\Local\Temp\sgsd-msys-fixa3` (copied `bash.exe` and `msys-2.0.dll`); managed policy rejected its cleanup.

SCRIPTS_CREATED
- None.

ONE_LINER
- Origin trust now fails closed in both shells, snapshot/restore boundaries reject unknown or unsafe mutation paths and archives, and stale salvage backups are removed.

STATUS
- IMPLEMENTATION COMPLETE; FULL DYNAMIC VERIFICATION BLOCKED BY MANAGED RUNNER.
