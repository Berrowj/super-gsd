# P167-T5 ATC fix — remove fourteen rounds of scaffolding

Per-dispatch ATC returned FAIL 4/10, three warnings, no CRITICAL. It confirmed
the important thing: bare-array parsing, the fail-safe unchanged delivery, and
the non-consumable terminal state are ONE coherent design, not three patches.
Imports and parameters are used, no malformed literal remains, and the evidence
verifies independently. Do not disturb any of that.

Roughly 360 lines can go.

## Change 1, diagnostics were scaffolding, not product

> Remove round-specific diagnostics: production response-shape logging and
> exports, duplicate post-condition ledger, and capture payload, lifecycle,
> result and tally dumps. Keep stable errors, scenario progress, and the signed
> `post_passthrough`.

Each dump was added to solve one round and each did its job. They are now
answered questions. **Production response-shape logging is the one that matters
most**: diagnostics do not belong in a hook that runs on every matching tool
call.

Keep what a future failure genuinely needs: stable error reasons, per-scenario
progress lines, and the signed passthrough state. Remove the rest.

## Change 2, redundant safeguards

> Delete `CLI_BOOTSTRAP`'s second exit verifier, the empty `evidenceWritten`
> branch, and the semantic, type and hash `input_comparison` already proven by
> the exact payload digest; trim diagnostic-only exports, reuse `seedRewritten`,
> and share the duplicated witness-transition preamble.

The `input_comparison` point is the instructive one: an exact payload digest
already proves equality, so comparing types and semantic hashes alongside it
proves nothing extra. That comparison existed to DIAGNOSE the type mismatch,
which is fixed.

Do not remove the exit-0-implies-evidence guarantee itself. One verifier, not
two.

## Change 3, stop copying the world

> Replace `createDisposableScenario`'s three whole `super-gsd` copies with a
> minimal runtime seed or shared immutable dependencies. It currently copies
> 10,506 files and 101.7 MB, including 7,569 `node_modules` files and 73.4 MB.

Three scenarios, three full-tree copies. This is the P166 lesson one layer up:
that phase had a test scanning `node_modules` and it was removed for the same
reason.

Seed only what a scenario actually needs, or share immutable dependencies
read-only across scenarios rather than copying them. The isolation property
must survive: a scenario must not be able to write into the real tree or into
another scenario.

## What must not change

- The three scenarios must still pass, and `--verify` must still re-derive
  independently rather than trusting stored values.
- Exit 0 must still imply the evidence file exists and parses.
- The fail-safe passthrough, the non-consumable terminal state, PreToolUse
  fail-closed behaviour, and the 16,000 character cap all stay exactly as they
  are.
- Every suite stays green: T1, T2, T3, T4, four registration-guard cases, ten
  P166 suites, frozen P154 evidence.

Any hook or store edit invalidates the two pinned digests in
`repo-settings-overlay.json`. Refresh them and say so.

The orchestrator re-runs the full suite AND the live capture, so a cleanup that
greens the suite by breaking the capture will be caught.

Do not commit. No emoji, no em dashes. Never invoke `claude` yourself. Verify
through PowerShell; Git Bash loses this harness's stdio on this machine.

Emit `PROGRESS: <line>` per unit.

## Report

```
FILES_CHANGED: path (modified)
LINES_REMOVED: <int>
VERIFICATION: `cmd` -> exit N (only what you actually ran)
DEVIATIONS: description | none
BLOCKERS: description | none
ONE_LINER: what the scenario setup copies now, and what diagnostics survived
```
