# P167-T5 — the seed trim broke the real install. Restore what the installer needs.

Changes 1 and 2 landed well and the full suite is green: T1 37/37, T2, T3, T4,
four registration-guard cases, ten P166 suites, frozen P154 evidence. 442 lines
removed. Do not undo any of that.

Change 3 went too far.

## The failure

```
PROGRESS: active_path FINISH FAIL
P167_T5_CAPTURE FAIL active-path_real_install_failed:exit_2
EXIT=1
capture wall time: 7s
```

And the independent verify fails downstream with `hook_source_hash_drift`,
which is expected: the stored evidence predates the current hook and will
resolve once the capture succeeds again.

The 402-file minimal runtime seed does not contain everything the REAL installer
needs, so `install.sh` (or the repair path it invokes) exits 2 inside the
disposable project.

## What to do

Find what the installer actually requires and seed exactly that. Do not go back
to copying the whole tree.

Approach:

1. Run the install path against a seeded scenario and read the real reason for
   exit 2. It will name the missing file or directory. Do not guess from the
   file list.
2. Add only what it names, then re-run. Repeat until the install succeeds.
3. Report the final file count and byte size so the improvement is measurable
   against the 10,506 files and 101.7 MB baseline.

If a dependency is large and immutable, prefer sharing it read-only over
copying, as you already did elsewhere.

## Constraints that still bind

- Isolation must hold. Your mutation probe proved a scenario cannot write into
  the source tree or another scenario; that property must survive.
- All three scenarios must pass and `--verify` must re-derive independently.
- Exit 0 must still imply the evidence file exists and parses.
- Keep the diagnostics reduction from change 1 and the redundancy removal from
  change 2. Only the seed needs adjusting.
- The fail-safe passthrough, non-consumable terminal state, PreToolUse
  fail-closed behaviour and the 16,000 character cap are unchanged.

The overlay pins currently match hook
`85fb7355fe6b435913373a51ad7422745d4f188b43be7d013f2ded7d04e063a5`. If you edit
the hook or store again, refresh both pins and say so.

The orchestrator re-runs the full suite AND the capture.

Do not commit. No emoji, no em dashes. Never invoke `claude` yourself. Verify
through PowerShell.

Emit `PROGRESS: <line>` per unit, starting with the real exit-2 reason as soon
as you have it.

## Report

```
FILES_CHANGED: path (modified)
VERIFICATION: `cmd` -> exit N (only what you actually ran)
DEVIATIONS: description | none
BLOCKERS: description | none
ONE_LINER: what the installer was missing, and the final seed size
```
