# The contract is correct. install.sh's orchestration of it is not. Two defects.

## PROVEN WORKING — do not touch the contract's logic

Run standalone by the orchestrator, exit 0:

    node hook-install-contract.cjs --check-manifest                       -> "hook manifest dependencies current"
    node hook-install-contract.cjs --prepare-candidate --project-dir X    -> prints descriptor path
    node hook-install-contract.cjs --apply-candidate <descriptor>         -> ok:true, 32 files published

32 published, 9 into scripts/lib, with correct provenance, e.g. `sgsd-state.cjs`
required_by five hooks; `vtp-context-composer.cjs` and
`substrate-invocation-witness-store.cjs` required_by the witness hook. The closure,
delivery and journalling are RIGHT. Do not redesign them.

## Defect 1 — install.sh prepares more than one candidate and applies a stale one

Through `install.sh --init-project` the same work fails EVERY time:

    {"ok":false,"reason":"hook_install_contract_failed",
     "underlying_error":{"code":"EBUSY","request":null,"path":null,
                         "message":"EBUSY: resource busy or locked, read"}}
    exit 2, zero files delivered

`precheck_installation_refusals` prepares a candidate, and it is invoked at install.sh
482, 911, 1020 AND again from inside `publish_project_install_contract` at 794, which
then applies `$INSTALL_CANDIDATE_DESCRIPTOR` at 799. A second prepare can replace or tear
down the stage the descriptor refers to, and EBUSY-on-read is what reading a
being-discarded stage looks like.

Fix: exactly one candidate per install run. Make `precheck_installation_refusals`
idempotent so repeated calls reuse the existing prepared candidate instead of preparing
another, and guarantee the descriptor applied is the one prepared. Keep the ordering that
already exists (precheck before ensure_gsd_base, before the update preflight, before
publication) — that ordering is correct and verified.

Also ensure any discarded stage is cleaned up without racing a live one.

## Defect 2 — the fixture symlink collides with the stage's symlink refusal

Guard `bundled-overlay-current` now fails with a correctly diagnosed error:

    {"code":"INSTALLER_STAGE_SYMLINK",
     "message":"installer stage refuses symlink: <tmp>/target project/super-gsd/tools/plan-schema/node_modules/ajv"}

The stage refusing to publish symlinks is a SAFETY PROPERTY and must stay. The fixture
provisioning added earlier links packages in. Change the FIXTURE to copy the resolved
package root instead of linking it, which the original instruction already permitted as
the fallback. Keep deriving the package list from the closure's `packages` output; do not
hardcode `ajv`, and do not copy whole `node_modules` trees, only the resolved package
roots the closure names.

## Constraints

- Never weaken a test or delete an assertion to get green.
- Keep refuse-before-write literal.
- P167 witness contract untouchable.
- Fixture paths contain SPACES.

## Verify — these three must be green

- A real install: `bash super-gsd/install.sh --init-project --skip-cockpit-deps
  --project-dir "<empty tmp>/target project"` run from a DIFFERENT cwd, exit 0, and the
  project then contains the 9 scripts/lib modules.
- node super-gsd/tests/install-contract/assert-install-contract.cjs   (3/3)
- installer-registration-guard --all                                   (13/13)
- bash -n super-gsd/install.sh, node --check on every file modified

Sandbox denials: mark DENIED, never report as passing. The orchestrator re-runs
unsandboxed. Do not ask approval.

Standard block format, max 250 words.
