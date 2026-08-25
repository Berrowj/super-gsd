# P167-T5 — two false-passes. Both must close.

Spec compliance returned FAIL, 4/7, two CRITICAL. It confirmed what is sound:
every enumerated evidence field exists, active-path payload exactness is still
strict, the bypass-only relaxation did not touch the active comparison,
parseable responses still hit the unchanged 16,000 character cap, PreToolUse is
unchanged and fail-closed, and the fixture log holds only digests and metadata.

Two things pass for the wrong reason. Fix both.

## CRITICAL 1 — the bypass characterisation blesses a failure as success

> `same_user_bypass.boundary_result` says `bypass_succeeded`, but the alternate
> call records `fixture_payload_accepted:false` and `result_is_error:true`. The
> verifier deliberately permits this by disabling fixture acceptance and
> requiring acceptance to equal payload exactness.

The previous round narrowed this assertion because the live model refused to
send a deliberately malformed payload. That narrowing went too far: it removed
the acceptance requirement entirely rather than separating it from payload
exactness. The scenario now reports success for a call the fixture rejected and
that returned an error.

That is worse than a failing test. It records a residual as characterised when
it was not, so a later reader would believe the bypass was demonstrated.

Required: the bypass PASSES only when the alternate-registration call is
genuinely accepted by the fixture AND returns a non-error result, AND leaves no
matching witness row. Keep payload exactness OUT of it, since the model will not
emit a malformed payload on request. Reachability and acceptance are separate
properties from byte equality; assert the first two, not the third.

If the call is genuinely being blocked, then the bypass did not happen and the
scenario must fail until the harness makes it happen.

## CRITICAL 2 — passthrough must not satisfy acceptance. This one is on the orchestrator.

> For an unparseable response, the hook correctly returns `null` unchanged, but
> first transitions the Pre row to `rewritten` with zero metrics. T2 now
> explicitly consumes that row after plain non-JSON status text.

The previous prompt asked whether "rewritten" was the right state name for a
passthrough and invited a judgement. That was a bad question, and this is the
result: acceptance can now be satisfied without a real PostToolUse rewrite,
which is precisely the property T2 took three review rounds to establish.

Required:
- Keep the fail-safe. An unparseable response still passes through UNCHANGED.
- Give it its own terminal state, distinct from `rewritten`, recording that a
  passthrough occurred and why.
- `acceptPromptSubstrateCallRecord` must require a REAL rewrite, not a
  passthrough. Restore T2's original strength.
- Restore the T2 case that proves a genuine rewrite is required, and add one
  proving a passthrough row is NOT accepted.

Do not resolve this by removing the passthrough. Both properties must hold at
once: a legitimate search must never be destroyed, and a prompt record must
never be accepted without a real post-transport rewrite.

## WARNING 3 — scope

T5 shipped seven files against a locked three-file scope, because the capture
exposed a production defect in the hook. That was the right call, but it must be
recorded, not left implicit. Add a DEVIATION naming the plan rule, the files
beyond scope, and the reason. Do not revert the repair.

## Constraints

Everything currently green stays green: T1, T3 4/4, T4, the four
registration-guard cases, ten P166 suites, and the frozen P154 evidence. The
live capture AND the independent `--verify` must both still pass, and the
orchestrator will run both.

Any hook edit invalidates the two pinned digests in `repo-settings-overlay.json`.
Refresh them and say so.

Do not commit. No emoji, no em dashes. Never invoke `claude` yourself. Verify
through PowerShell.

Emit `PROGRESS: <line>` per unit.

## Report

```
FILES_CHANGED: path (modified)
VERIFICATION: `cmd` -> exit N (only what you actually ran)
DEVIATIONS: [P167-T5 files_touched] ... 
BLOCKERS: description | none
ONE_LINER: the new passthrough state name, and what the bypass now requires
```
