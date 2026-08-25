# P167-T5 fix round 3 — bisected. Capture mode swallows output before the entry line.

Your exit-0 falsifiers work in synthetic tests. They do not fire in real capture
mode. The orchestrator bisected it. These are measurements, not guesses.

## The bisect

All three runs use the same binary, same file, same entry block.

```
A) fail INSIDE parseArgs   (--evidence-file outside project)
   exit=1  stderr=81B
   PROGRESS: harness_entry START
   P167_T5_HARNESS FAIL evidence_path_outside_project        <-- works

B) fail AFTER parseArgs    (--verify with missing evidence)
   exit=1  stderr=72B
   PROGRESS: harness_entry START
   P167_T5_VERIFY FAIL evidence_file_missing                 <-- works

C) capture mode, token REMOVED from env
   exit=0  stdout=0B  stderr=0B                              <-- silent
   no PROGRESS line at all
```

Read C carefully. It does not even emit `PROGRESS: harness_entry START`, which A
and B both emit from the same code path. And it returns 0 despite having no
credentials, when the very first version of this harness failed that same case
loudly with `claude_auth_environment_missing`.

So: **capture mode loses stdout and stderr before the entry progress line, and
returns 0.** It is not the auth check, not `parseArgs`, and not your entry
guards. Something specific to the capture branch destroys the process's own
output streams, or replaces the process environment in a way that breaks them.

## Where to look

Prime suspect is the isolated-environment builder used only by capture. If it
reassigns `process.env` wholesale, mutates `APPDATA`/`LOCALAPPDATA`/
`CLAUDE_CONFIG_DIR` on the CURRENT process rather than on a copy passed to
children, or closes/reopens file descriptors, that would explain all three
observations at once: no entry line, no failure line, exit 0.

Check every place capture mode touches:
- `process.env` assignment versus building a child env object
- any `fs.closeSync`, descriptor reuse, or writing to fd 1 or 2 by number
- `stdio` arrays that could apply to the parent rather than a child
- any `process.chdir` into a directory that is later removed

Confirm by running case C yourself. It needs no credentials and no Claude
process, so your sandbox can run it. It MUST print the entry line and a failure
line and exit non-zero. That is your green condition for this round.

## Then the real assertion

Once capture mode reports honestly again, the underlying finding still stands
from an earlier direct-call run:

```
captureAll REJECTED: active_valid_input_mismatch
```

at the `JSON.stringify(uses[1].input) === JSON.stringify(prepared.payload)`
check. Decide whether byte equality is the right contract for a payload echoed
by a model, or whether it should compare semantically (same keys, same values,
order-independent). If you change it, say why byte equality was wrong rather
than inconvenient.

## Non-negotiable

Exit 0 must mean the evidence file exists and parses. Never fabricate that file.
Never weaken a scenario assertion for a green run. Write failure lines with
`fs.writeSync` so they cannot be buffered away. Never print the auth token.

## Scope

`super-gsd/tests/substrate-invocation-witness/capture-live-runtime.cjs`.

Do not commit. No emoji, no em dashes. Never invoke `claude` yourself.

## Report

```
FILES_CHANGED: path (modified)
VERIFICATION: `cmd` -> exit N (case C is mandatory and must be quoted)
DEVIATIONS: description | none
BLOCKERS: description | none
ONE_LINER: exactly what destroyed the output streams in capture mode
```
