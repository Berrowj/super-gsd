# P167-T5 fix — the capture harness exits 0 having done nothing

Credentials are now available and the harness runs. It produces nothing.

## Measured

```
CLAUDE_CODE_OAUTH_TOKEN present (length 108, value never printed)

node capture-live-runtime.cjs --capture --project-dir <repo> \
  --evidence-file <phase>/167-REAL-MCP-HOOK-EVIDENCE.json --timeout-ms 60000

REAL exit code : 0
output bytes   : 0        (stdout AND stderr both empty)
evidence file  : absent
claude processes spawned: none (the three running are pre-existing, from prior days)
```

Zero output is the tell. Both branches of `main` write a line: PASS goes to
stdout, FAIL goes to stderr with `P167_T5_CAPTURE FAIL <reason>`. Neither fired.
So `main`'s body never reached its end, yet the process exited 0.

## The defect

At the bottom of the file:

```js
if (require.main === module) {
  main(process.argv.slice(2)).then((status) => { process.exitCode = status; });
}
```

`main` is async. This attaches a `.then` and returns immediately. There is no
`.catch`, and nothing else holds the event loop open. If the awaited work does
not keep a live libuv handle at some point, Node drains the loop and exits with
code 0 while the promise is still pending. Nothing is written because neither
branch ran.

This is the exact anti-pattern this project already recorded as
`silent-success-reports-health`: **exit 0 must mean the work happened.** A
capture harness that reports success while producing no evidence is worse than
one that crashes, because the phase would close on a proof that does not exist.

## Required

1. Make the entry point await properly and fail loudly:
   - handle rejection explicitly, writing `P167_T5_CAPTURE FAIL <reason>` to
     stderr and setting a non-zero exit code;
   - make an early or unexpected exit impossible to mistake for success.
2. **Exit 0 must imply the evidence file exists.** Before returning 0, assert the
   evidence file was written and is parseable, and fail if not. Never return 0
   on a path that wrote nothing.
3. Find and fix the actual reason the async chain does not complete. Do not
   paper over it by adding a keep-alive timer. Diagnose why the awaited work
   settles or stalls without producing output. Likely candidates: a spawn whose
   handle is never awaited, a promise that is created but never resolved on some
   branch, or an early `return` before the capture runs.
4. Emit progress to stderr as each of the three scenarios starts and finishes,
   so a long capture is observably alive rather than silent.

## Do not

- Do not fabricate or stub `167-REAL-MCP-HOOK-EVIDENCE.json`. It must come from
  a real run. A fabricated evidence file is the single worst outcome of this
  phase.
- Do not weaken any scenario assertion to make the run succeed.
- Do not print, log, or write the auth token anywhere. It reaches the harness
  through the environment only.

## Scope

One file: `super-gsd/tests/substrate-invocation-witness/capture-live-runtime.cjs`.
If the fixture also needs a change, stop and say why rather than editing it.

Do not commit. No emoji, no em dashes. Never invoke `claude` yourself.

## Verification you CAN do

`node --check`, module load, and running the harness with NO arguments, which
must still print `P167_T5_HARNESS FAIL choose_exactly_one_mode` and exit
non-zero. That last one is a cheap proof the entry point reports failure
correctly. Run it and quote the exit code.

The orchestrator runs the real capture.

Emit `PROGRESS: <line>` per unit.

## Report

```
FILES_CHANGED: path (modified)
VERIFICATION: `cmd` -> exit N (only what you actually ran)
DEVIATIONS: description | none
BLOCKERS: description | none
ONE_LINER: why it exited 0 silently, and what now guarantees exit 0 implies evidence
```
