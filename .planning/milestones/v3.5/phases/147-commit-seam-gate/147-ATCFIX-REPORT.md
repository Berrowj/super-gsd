Implemented the P147 fix in the three requested files only.

Changes:
- Trampoline no longer hardcodes `SGSD_REPO_ROOT` or `cd`s to install root.
- It derives `SGSD_TARGET_REPO_ROOT` via `git rev-parse --show-toplevel`, fails open loudly if absent, and passes it as `SGSD_COMMIT_GATE_TARGET_ROOT`.
- Node hook now resolves SGSD root from that runtime target.
- Diff hashing now streams `git diff --cached --binary` with a 32MB cap; truncated hashes record `diff_hash_truncated_32mb` plus basis details in `next_action`.
- Added linked-worktree target-root and large-diff regression scenarios.

Verification:
- `node --check` all three files: exit `0`.
- `git diff --check`: exit `0` (CRLF warning only).
- Static trampoline/runtime assertions: exit `0`.
- `installer-linked-worktree-target-root`: exit `1`, blocked by sandbox: `spawnSync git EPERM`.
- `large-diff-truncated-hash`: exit `1`, blocked at `git init` by same EPERM; elapsed `281ms`, so real large-diff timing unavailable here.
- `npm test`: exit `1`, sandbox child-process failures (`spawnSync bash EPERM` / null child exits).

Content diff is limited to the three requested files. A chronicle fixture still appears `.M` in `git status`, but `git diff --quiet` for it exits `0`; clearing the stat bit needs the common git-dir index lock, which this sandbox cannot write.
