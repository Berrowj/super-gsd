# P167-T5 fix round 5 — instrument the hook-lifecycle assertion before changing it

Your typed-fixture fix WORKED. The payload mismatch is gone and the capture now
gets further:

```
PROGRESS: harness_entry START
PROGRESS: active_path START
PROGRESS: active_path FINISH FAIL
P167_T5_CAPTURE FAIL active_pre_hook_lifecycle_invalid
EXIT=1
```

It now fails at `capture-live-runtime.cjs:1163`:

```js
requireCondition(preHooks.summary.started === 2 && preHooks.summary.responses === 2,
  'active_pre_hook_lifecycle_invalid');
```

## Do this in order, and do not skip step 1

**Step 1, instrument.** Before changing any assertion, print what actually
happened, exactly as you did for the payload comparison, which is what let the
last round be solved in one shot. On failure write to fd 2:

- `preHooks.summary` and `postHooks.summary` in full;
- the distinct hook-related event types observed in the transcript;
- the count of tool uses seen for the target tool.

The orchestrator will run it and hand you the real numbers. Do not guess which
of `started` or `responses` is wrong, or by how much.

**Step 2, then judge.** Two readings, needing opposite fixes:

- *The expectation is wrong.* Two attempts do not necessarily produce two
  PreToolUse lifecycle pairs in the transcript. A denied call may be recorded
  differently from an allowed one, or the model may not retry after a denial, so
  the second attempt never happens. Then the harness must assert what the runtime
  really emits.
- *The hook genuinely did not fire twice.* That would be a real finding and the
  most important thing this phase could surface, because it would mean the guard
  is not reliably invoked in a live session.

State which, with the observed numbers as evidence. If it is the second, say so
plainly and do not soften the assertion to get a green run.

## The rule that has held all phase

Do not weaken an assertion to make a run pass. Every time a test in this phase
was bent to fit, a review caught it: the omitted `expectedEvent`, the
positive-match truncation assertions, the rollback test that proved no mutation
instead of rollback. Fix the cause or report the finding.

Do not fabricate `167-REAL-MCP-HOOK-EVIDENCE.json`. Do not add type coercion to
production. Do not touch the hook, composer, broker, or v2 schema.

## Scope

`capture-live-runtime.cjs`, and the fixture only if the evidence points there.

Do not commit. No emoji, no em dashes. Never invoke `claude` yourself.

Verify through PowerShell; a Git Bash invocation of this harness loses stdio on
this machine, which is an environment artefact, not a code defect.

Emit `PROGRESS: <line>` per unit.

## Report

```
FILES_CHANGED: path (modified)
VERIFICATION: `cmd` -> exit N (only what you actually ran)
DEVIATIONS: description | none
BLOCKERS: description | none
ONE_LINER: what the instrumentation will reveal, or if you already know, which reading is true and why
```
