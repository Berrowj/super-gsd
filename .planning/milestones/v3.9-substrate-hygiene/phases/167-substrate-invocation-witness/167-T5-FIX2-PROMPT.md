# P167-T5 fix round 2 — measured facts, two separate defects

Your last fix did not work. The orchestrator measured rather than guessed.

## Fact 1, the real scenario failure

Calling the exported function DIRECTLY (bypassing `main`) works and fails
honestly:

```
node -e "h.captureAll(h.parseArgs(argv)) ..."

PROGRESS: active_path START
PROGRESS: active_path FINISH FAIL
captureAll REJECTED: active_valid_input_mismatch
```

So the harness DOES run, the active path DOES execute, and it rejects on the
assertion at line 1056:

```js
requireCondition(JSON.stringify(uses[1].input) === JSON.stringify(prepared.payload),
  'active_valid_input_mismatch');
```

The second tool use's input does not equal the composer-prepared payload. That
is a genuine finding and it is the actual work of this task. Diagnose it: dump
both sides, compare key order, types, and whether the model reproduced the
payload verbatim. Do NOT relax the assertion to make it pass. If the model
cannot be relied on to echo a payload byte-identically, the harness must compare
semantically (same keys, same values) rather than by `JSON.stringify` equality,
and must say so.

## Fact 2, the CLI path is still silent, and your guards did not fire

Run as a CLI with the same arguments, repeatedly, in foreground, with stdout and
stderr redirected to separate files:

```
exit: 0    stdout: 0 bytes    stderr: 0 bytes    evidence file: absent
```

No `PROGRESS` line. No `P167_T5_CAPTURE FAIL`. No `unexpected_early_exit` from
either the `beforeExit` or `exit` handler you added. Yet the same build, called
directly, prints PROGRESS and rejects.

The no-argument guard DOES work: it prints `choose_exactly_one_mode` and exits
1. So the `require.main === module` block runs for that path.

Something on the `--capture` path silences everything and yields exit 0 before
your handlers can fire. Find it. Candidates worth checking, in order:

- output written with `console.log` / `process.stdout.write` being lost because
  the process ends before a flush, versus `fs.writeSync(1, ...)` which cannot be
  lost;
- a spawned child inheriting or closing the parent's stdio handles;
- `process.exitCode` being reset by a later handler;
- the async IIFE's rejection path not being reached because the failure happens
  during module-level or argument-time work.

Prove the fix by running the CLI yourself if you can, or state precisely which
observation would confirm it.

## The rule that matters

Exit 0 must mean the evidence file exists. Silence with exit 0 is the worst
possible outcome, because the phase would close claiming a live proof that never
ran. Prefer a loud crash over a quiet success in every ambiguous case. Use
`fs.writeSync` for the failure lines so they cannot be buffered away.

## Do not

- Do not fabricate or stub `167-REAL-MCP-HOOK-EVIDENCE.json`.
- Do not weaken a scenario assertion to get a green run.
- Do not print or persist the auth token; it arrives via environment only.

## Scope

`super-gsd/tests/substrate-invocation-witness/capture-live-runtime.cjs`, and the
fixture only if you can show the mismatch originates there.

Do not commit. No emoji, no em dashes. Never invoke `claude` yourself.

Emit `PROGRESS: <line>` per unit.

## Report

```
FILES_CHANGED: path (modified)
VERIFICATION: `cmd` -> exit N (only what you actually ran)
DEVIATIONS: description | none
BLOCKERS: description | none
ONE_LINER: what silenced the CLI path, and what the payload mismatch actually was
```
