# One defect. The pre-write preflight refuses hooks that this very run is about to deliver.

## Verified green right now, do not disturb

- Real `install.sh --init-project` from a decoy cwd into an EMPTY project: exit 0,
  17 hooks and 9 `scripts/lib` modules delivered.
- install-contract 3/3.
- installer-registration-guard: 11 of 13 PASS.

Only `sgsd-update-clarity-shape` and `sgsd-update-clarity-recovery` fail.

## The defect, fully diagnosed

The spec-review fix correctly moved `preflight_existing_repo_local_hooks` ahead of
distribution, so no rejection-capable check runs after the first write. Keep that.

But in the Clarity RECOVERY scenario the fixture deliberately starts with three managed
hooks absent, and the update exists to restore them. The relocated preflight now refuses
before distribution can deliver them:

    [sgsd-update] Running installer...
    hook manifest dependencies current
    [super-gsd] Preflighting existing managed repo-local hooks before distribution...
    ERROR: hook_registration_missing <project>/super-gsd/hooks/sgsd-session-start.js       [SessionStart/session-start-governance]
           hook_registration_missing <project>/super-gsd/hooks/sgsd-intent-classifier.cjs  [UserPromptSubmit/user-prompt-intent-classifier]
           hook_registration_missing <project>/super-gsd/hooks/sgsd-quality-gate.js        [PostToolUse/post-tool-use-quality-gate]
    [sgsd-update] Installer exited non-zero (see above)  -> exit 5, expected 0

A managed hook that is missing AND is in this run's delivery set is not a fault. It is the
thing being repaired. A managed hook that is missing and will NOT be delivered still must
refuse.

## The fix

Teach the pre-write preflight to distinguish those two cases by consulting the prepared
candidate, which already knows exactly what this run will deliver:

- missing, and present in the candidate's delivery set  -> NOT a refusal; the run repairs it
- missing, and NOT in the candidate's delivery set      -> refuse, exactly as now
- present but stale, unmanaged, or operator-owned       -> unchanged behaviour

Do not solve this by moving the preflight back after distribution. That would reintroduce
the CRITICAL the spec review raised, which has now occurred four times in this codebase.
Do not solve it by skipping the preflight in update mode.

Derive the delivery set from the existing prepared candidate. Do not recompute it and do
not hand-maintain a list of hook names.

## Tests

Both Clarity cases must pass for the right reason. Additionally assert, in whichever case
fits best, that a managed hook missing from BOTH the project and the candidate delivery
set still refuses before any write. Without that, this fix could silently become
"never refuse on a missing hook", which would be worse than the bug.

## Constraints

- Only the three allowlisted files.
- Never weaken or delete an assertion.
- No new CLI modes, no installer-wide staging, no self re-execution. A previous attempt
  built that, shipped an install that exited 0 delivering nothing, and was reverted.
- P167 witness contract untouchable.
- Fixture paths contain SPACES.

## Verify

- installer-registration-guard `--all` 13/13
- install-contract 3/3
- Real install from a different cwd into an empty project: exit 0, 17 hooks, 9 modules.
  Check this FIRST and LAST; it is the regression the reverted attempt caused.
- `bash -n super-gsd/install.sh`, `node --check` on every file modified

Sandbox denials: mark DENIED, never as passing. The orchestrator re-runs unsandboxed.
Do not ask for approval.

Standard block format, max 250 words.
