# P167 — the live capture PASSES. Your hook fix regressed T2. Fix that.

## First, the good news, because it constrains the fix

The live capture now passes completely and the evidence file is written and
independently re-verified:

```
active_path FINISH PASS      absent_guard FINISH PASS      same_user_bypass FINISH PASS
P167_T5_CAPTURE PASS schema=sgsd.p167.real-mcp-hook-evidence.v1
P167_T5_VERIFY  PASS {"active_invocations":1,"absent_invocations":0,"same_user_bypass_invocations":2}
```

Your bare-array parser fix is what made that possible. Do not revert it.

## The regression

Full suite re-run at HEAD. Everything passes except one:

```
assert-witness-correlation (T2)  FAIL
  FAIL CLI inherits runtime session and emits accepted JSON only after consumption
  AssertionError: vtp_accept_substrate_call_record_failed:
                  vtp_prompt_substrate_contract_invalid:substrate_witness_not_rewritten
```

T1 is 37/37, T3 4/4, T4 and all ten P166 suites pass. So the hook works for the
shapes T1 exercises, and something about the rewrite bookkeeping changed such
that T2's acceptance path no longer sees a witness row marked rewritten.

## What to work out

`acceptPromptSubstrateCallRecord` requires a REWRITTEN witness row, not merely a
Pre row. Your fix changed the PostToolUse path, including a passthrough branch
for responses that cannot be parsed. The likely cause is that some path now
returns without transitioning the witness row to rewritten.

Establish which, and be careful about the distinction:

- If a response is passed through UNCHANGED because it could not be parsed, does
  the row still get marked rewritten? It should reflect what actually happened.
  Think about whether "rewritten" is the right state name for a passthrough, and
  whether acceptance should require "rewritten" or "post-processed".
- If the bare-array branch skips the transition that the `{content:[...]}`
  branch performs, that is a plain omission; make both branches transition
  identically.

Instrument if it is not obvious from reading. That approach has resolved six
rounds in one shot each tonight.

## Constraints that decide this

- **Do not weaken acceptance.** Requiring a real post-transport witness state is
  what stops a prompt-reported record being accepted without a corresponding
  invocation. That property took three review rounds to establish in T2 and is
  the reason the task exists.
- **Do not revert the bare-array parsing.** Production sends bare arrays; that
  is measured, not assumed.
- **Do not weaken the fail-safe passthrough.** A response that cannot be parsed
  must still reach the agent unchanged rather than becoming an error.
- Every currently-passing suite must stay passing: T1 37/37, T3 4/4, T4, the
  four registration-guard cases, and all ten P166 suites.

## After any hook edit

The two pinned digests in `super-gsd/config/repo-settings-overlay.json` must be
refreshed to the new hook hash, or the live capture fails with
`overlay_pre_source_hash_drift`. Do it and say so.

The orchestrator will re-run the full suite AND the live capture, so a fix that
green-lights T2 by breaking the capture will be caught.

## Scope

`sgsd-substrate-invocation-witness.cjs`, `assert-witness-correlation.cjs`,
`assert-hook-contract.cjs`, `repo-settings-overlay.json`.

Do not commit. No emoji, no em dashes. Never invoke `claude` yourself. Verify
through PowerShell.

Emit `PROGRESS: <line>` per unit.

## Report

```
FILES_CHANGED: path (modified)
VERIFICATION: `cmd` -> exit N (only what you actually ran)
DEVIATIONS: description | none
BLOCKERS: description | none
ONE_LINER: which path skipped the transition, and what the witness state means now
```
