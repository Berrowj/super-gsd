# URGENT scoping defect: the installer stage snapshots entire user directories.

Your previous dispatch was cut short by a wrapper false positive, so this work is
half-applied. Finish it, starting with the defect below, which must not ship.

## Defect 1 — the stage is scoped to whole user roots

`bash -x` trace of a real `install.sh --init-project`:

    node hook-install-contract.cjs --prepare-installer-stage \
      --project-dir '<tmp>\target project' \
      --home-dir '<tmp>/isolated home' \
      --config-dir 'C:\Users\<user>\AppData\Roaming'

    {"ok":false,"reason":"hook_install_contract_failed",
     "underlying_error":{"code":"EBUSY","message":"EBUSY: resource busy or locked, read"}}

`INSTALL_CONFIG_DIR` (install.sh:1247-1251) is the CONFIG ROOT by convention:
`$XDG_CONFIG_HOME`, else `%APPDATA%` on Windows, else `$HOME/.config`. That convention is
correct and matches `substrate-invocation-witness-store.cjs:49-52`, which then appends
`super-gsd/substrate-invocation-witness/` beneath it.

The stage is treating that ROOT as the thing to snapshot. On this machine that means all
of `C:\Users\<user>\AppData\Roaming`, which is why it hits EBUSY on locked files. The same
mistake applies to `--home-dir "$HOME"`: on a real machine that is the operator's entire
home directory.

Snapshotting a user's whole AppData or home directory is unacceptable regardless of
whether it succeeds: it is slow, it touches unrelated and potentially sensitive files, and
it can lock or copy things SGSD does not own.

Fix: the stage must only ever consider the SGSD-OWNED paths beneath those roots, never the
roots themselves. Derive the exact owned subpaths (for example the Claude assets directory
under home, and `<config-root>/super-gsd/**`) from the existing manifest and store
conventions rather than inventing new ones. If the stage needs a root at all, it must
immediately narrow to owned subpaths before any directory walk or read.

Add a regression test that fails if the stage ever walks a path outside the SGSD-owned
set. Assert on the set of paths the stage reads, not merely that installation succeeds,
because a scoping regression here is silent when the machine happens to have no locked
files.

## Defect 2 — fixture symlink versus the stage's symlink refusal

Guard `bundled-overlay-current` fails with a correctly diagnosed error:

    {"code":"INSTALLER_STAGE_SYMLINK",
     "message":"installer stage refuses symlink: <tmp>/target project/super-gsd/tools/plan-schema/node_modules/ajv"}

The stage refusing symlinks is a SAFETY property and stays. Change the FIXTURE to copy the
resolved package root rather than linking it. Keep deriving the package list from the
closure's `packages` output; do not hardcode any package name, and copy only the resolved
package roots, never whole `node_modules` trees.

## Confirmed working, do not redesign

Standalone, exit 0: `--check-manifest`, `--prepare-candidate`, `--apply-candidate`
publishing 32 files with correct `required_by` provenance, 9 into `scripts/lib`. The
closure, delivery and journalling are right.

## Constraints

- Never weaken a test or delete an assertion to get green.
- Keep the existing precheck-before-writer ordering.
- The P167 witness contract is untouchable.
- Fixture paths contain SPACES.

## Verify — all three green

- Real install from a different cwd into an empty project: exit 0, and 9 modules land in
  the project's `super-gsd/scripts/lib`.
- `node super-gsd/tests/install-contract/assert-install-contract.cjs` 3/3
- installer-registration-guard `--all` 13/13
- `bash -n super-gsd/install.sh`, `node --check` on every file modified

Sandbox denials: mark DENIED, never report as passing. The orchestrator re-runs
unsandboxed. Do not ask for approval; implement and verify.

Standard block format, max 300 words.
