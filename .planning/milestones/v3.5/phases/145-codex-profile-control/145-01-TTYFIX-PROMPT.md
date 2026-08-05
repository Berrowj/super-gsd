# P145 GAP-1 fix — close TTY guard env-var bypass (CRITICAL)

<intent milestone="v3.5">
Always-On Orchestration — governance as runtime mechanism in all session modes.
</intent>

SDD implementer contract: fresh context, this task only, verify before report,
self-review, explicit DONE/DONE_WITH_CONCERNS/BLOCKED status.

## Defect (verified by live probe)
`super-gsd/tools/codex-pro/profile-resolver.cjs:506`:
`const ttyOverride = options.ttyOk === true || process.env.SGSD_CODEX_CONTROL_TTY_OK === '1';`
A plain env var is trusted as equivalent to an interactive TTY, so ANY
non-interactive process that sets `SGSD_CODEX_CONTROL_TTY_OK=1` and supplies
the predictable confirm phrase can `--set-cli <profile> sandbox
danger-full-access`. This violates the phase invariant: danger profiles must
never be settable non-interactively. `options.ttyOk` has zero callers.
`selfTestCliGuard` (line ~709) deletes the env var before probing — the test
avoids the bypass instead of closing it.

## Fix (surgical)
1. In `assertCliMutationGuard`: remove trust in the env var AND the dead
   `options.ttyOk` parameter. Guard passes only when
   `confirm === phrase && Boolean(process.stdin.isTTY && process.stdout.isTTY)`.
2. `super-gsd/scripts/sgsd-codex-control.sh` line 108: remove the
   `SGSD_CODEX_CONTROL_TTY_OK=1` prefix. The script already TTY-checks and the
   spawned node inherits the operator's real TTY, so the legit interactive
   path still works (verify this reasoning against the script's stdin/stdout
   wiring; if node would NOT inherit a TTY there, report BLOCKED with the
   evidence instead of inventing a new override channel).
3. In `selfTestCliGuard`: drop the now-pointless save/delete/restore of
   `SGSD_CODEX_CONTROL_TTY_OK`, and ADD a regression assertion: with
   `SGSD_CODEX_CONTROL_TTY_OK=1` set in the env and correct confirm phrase
   (still no TTY), the mutation must STILL refuse and registry must be
   unchanged.
4. Remove any other reference to SGSD_CODEX_CONTROL_TTY_OK that your change
   makes dead (grep the repo). Do NOT touch unrelated code.

## Verify (run all; all must pass)
- node super-gsd/tools/codex-pro/run-self-test.cjs   (expect 21/21 or higher)
- bash super-gsd/scripts/sgsd-codex-control.sh --self-test
- Non-interactive bypass probe must now REFUSE:
  SGSD_CODEX_CONTROL_TTY_OK=1 node super-gsd/tools/codex-pro/profile-resolver.cjs --set-cli triage sandbox danger-full-access --confirm "CONFIRM SGSD CODEX PROFILE triage sandbox danger-full-access" --registry <temp copy of super-gsd/registry/codex-profiles.yaml>
  (expect nonzero exit + refusal message + registry unchanged)

SURGICAL CONSTRAINT — every changed line must trace to this fix. Orphan edits
are DEVIATIONS; report, don't commit silently. Match existing style. Remove
only what YOUR change made unused.

## Report contract (<300 words)
FILES_CHANGED: path (created|modified)
VERIFICATION: `cmd` → exit N ✓|✗
DEVIATIONS: [Rule N] description | none
BLOCKERS: description | none
SCRIPTS_CREATED: none expected
ONE_LINER: substantive summary
