# P146 T146-07 fix — 1 CRITICAL (chain-depth bypass) + 1 WARNING (write surface)

<intent milestone="v3.5">
Always-On Orchestration — governance as runtime mechanism in all session modes.
</intent>

SDD implementer: fresh context, THIS FIX ONLY. Files you may touch:
`super-gsd/scripts/sgsd-stop-handoff.sh`,
`super-gsd/tools/autopilot-watchdog/check.cjs`. Nothing else.

## CRIT-1 — spawning rows that are not counted bypass MAX_CHAIN_DEPTH
Depth is computed from rows where `r.reason === 'spawned'` (~line 492, used at
~503). But the `unexpected_auto_stop` branch ALSO spawns a Claude session while
logging a different reason (~line 591:
`_log_row "unexpected_auto_stop" ... "recovery":"spawned_without_checkpoint"`).

Consequence: repeated unexpected-stop recoveries never increment the counted
chain, so each one proposes depth 1 and `MAX_CHAIN_DEPTH` (5) is never reached.
The latch exists to stop runaway handoff loops; under-counting defeats it
entirely. Over-counting merely annoys — this asymmetry should drive the fix.

### Required fix
Count EVERY row that actually spawned a session, not only `reason:"spawned"`.
Derive "did this row spawn?" from a single explicit predicate rather than a
reason-string equality scattered through the file — e.g. a helper that returns
true for `reason === 'spawned'` OR a row carrying a spawn marker such as
`recovery: "spawned_without_checkpoint"`. Audit the whole script for any OTHER
branch that spawns while logging a non-`spawned` reason and include it.
Apply the same predicate to the `cumulative_runtime_s` sum (~line 584), which
has the identical blind spot.

Preserve the T146-07 behavior already verified:
- latest valid row `reason: "refused"` → previous depth treated as 0 (reset);
- the existing malformed-row defence (~475-486) stays;
- a `spawned` latest row behaves exactly as before.

## WARN-1 — watchdog writes under a caller-supplied directory
`autopilot-watchdog/check.cjs --write` derives its output path directly from
caller-supplied `--project-dir` and creates
`.planning/metrics/autopilot-watchdog.json` EVEN WHEN `check()` returned
`reason: "no .planning directory"`.

This is the phase's most-repeated defect: a writer accepting a caller-supplied
destination shipped as CRITICAL in T146-01 and TWICE in T146-02 (the second
escaping lexical validation via an NTFS junction). This is the fourth instance.

### Required fix
Do not write unless the resolved target is inside a REAL SGSD root. Reuse the
established approach: resolve via the shared helper / `realpathSync` on the
nearest existing ancestor, and refuse when there is no `.planning` (that is
already a known state — `check()` reports it). When refusing: write nothing,
create no directories, exit as it does today for that condition, and leave a
non-stack breadcrumb. Do not invent a new bespoke path validator if the shared
helper already answers "is this an SGSD root".

## Verify (report exact exit codes)
1. `bash -n super-gsd/scripts/sgsd-stop-handoff.sh`
2. `node --check super-gsd/tools/autopilot-watchdog/check.cjs`
3. `node super-gsd/tools/autopilot-watchdog/check.cjs --self-test-phase-resolution`
4. CRIT fixture: a log whose rows are N consecutive `unexpected_auto_stop`
   spawn-recoveries → assert computed depth INCREASES with each (does not stay
   at 1) and that `MAX_CHAIN_DEPTH` is reached and enforced.
5. Regression fixtures: latest row `refused` → depth resets to 0; latest row
   `spawned` → unchanged from today; malformed row present → existing defence
   still holds.
6. WARN fixture: `--write --project-dir <temp dir with NO .planning>` → creates
   NOTHING anywhere under that dir (assert zero files), no stack, and the same
   exit code as today for the no-.planning case.
7. WARN regression: `--write` in a REAL SGSD fixture still writes
   `.planning/metrics/autopilot-watchdog.json` as before.
If your sandbox blocks bash/node, say so in BLOCKERS and still report changes.

SURGICAL CONSTRAINT — every changed line must trace to a finding above. Orphan
edits are DEVIATIONS: report, do not commit silently. Match existing style.

## Report contract (<300 words)
FILES_CHANGED: path (modified)
VERIFICATION: `cmd` → exit N ✓|✗
DEVIATIONS: [Rule N] description | none
BLOCKERS: description | none
SCRIPTS_CREATED: none expected
ONE_LINER: substantive summary
