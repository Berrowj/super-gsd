STATUS: IMPLEMENTED — verification partially DENIED by sandbox.

FILES:
- [install.sh](<HOME>/AppData/Roaming/warp/Warp/data/worktrees/GSDedits/luminaria-hogback/super-gsd/install.sh)
- [hook-registration-preflight.cjs](<HOME>/AppData/Roaming/warp/Warp/data/worktrees/GSDedits/luminaria-hogback/super-gsd/scripts/lib/hook-registration-preflight.cjs)
- [assert-installer-registration-guard.cjs](<HOME>/AppData/Roaming/warp/Warp/data/worktrees/GSDedits/luminaria-hogback/super-gsd/tests/installer-registration-guard/assert-installer-registration-guard.cjs)

CHANGES:
- Moved global, existing-update, settings validation, and Codex registration checks before publication.
- Split GSD/Codex checks from their write paths.
- Policy decisions now require the entire output to be one clean decision.
- Preserved real bounded diagnostics in both module/non-module branches while removing stack frames.
- Corrected and strengthened ordering assertions. No stage lifecycle or CLI modes added.

RED→GREEN:
- `smoke-static` initially failed on policy-prefix laundering, then passed.
- Ordering guard initially failed on post-publication checks, then passed.

VERIFICATION:
- Node syntax checks: PASS 2/2.
- Focused guard cases: PASS.
- P167 hook contract: PASS 38/38.
- P167 prompt contract: PASS 4/4.
- Feature-propagation self-test: PASS.
- Allowlist/diff checks: PASS.
- Real install, first and last: DENIED — `spawnSync bash EPERM`.
- Install-contract 3/3: DENIED after 1 PASS.
- Guard 13/13: DENIED after 3 PASS.
- `bash -n`: DENIED — Git Bash `CreateFileMapping`, Windows error 5.

LIMITATION:
The global settings merge’s destination-existence check must remain after hook copying because its installed paths do not exist beforehand; moving it earlier would require the forbidden staging design. Actual filesystem/npm/repair/registration writes can still fail from I/O conditions.
