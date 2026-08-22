# P167 plan review, ATC + MUDA, before any execution

Read only. Plan: `.../167-substrate-invocation-witness/167-01-PLAN-LOCKED.md`.
Also read CONTEXT.md and RESEARCH.md beside it, and P166's SUMMARY.md
DEFERRED-1 for what this phase is meant to close.

P166 is the cautionary tale. Its plan passed review, its code passed three
spec-compliance rounds, and its verifier still returned GOAL_MET NO, because the
design mitigated a bypass instead of closing it. Do not let that happen twice.

## Checks, in order of importance

1. **ENFORCEMENT, not observation.** Does the plan actually deny a bad call and
   actually replace an oversized result before the model reads it? A hook that
   logs, warns, or records without blocking is the P166 defect wearing a new
   coat. Point to where in the plan the deny and the rewrite are mechanically
   required, and to the SAC that would fail if they were downgraded to logging.

2. **The witness must not be self-reported.** RESEARCH established that
   `session_id` plus a hook-computed payload SHA-256 avoids any agent-supplied
   identifier. Verify the plan actually uses that and never asks the agent for
   its own `tool_use_id` or digest. If any step accepts an identifier the
   witnessed party supplies, that is CRITICAL: it recreates P166's hole one
   level up.

3. **Fail-closed on absence.** Research found a fresh machine fails open because
   propagation never registers Claude hooks and a missing hook is non-blocking.
   Does the plan make absence loud? Say exactly what refuses, and what happens on
   a machine where the hook was deliberately deleted. If the answer is that
   something writes a warning, that is not fail-closed.

4. **Honest trust claims.** P147's tamper-evidence does NOT transfer; it says of
   itself that it is not tamper-proof and does not protect hook presence. Does
   the plan overclaim what its witness store guarantees? An "authenticated"
   store whose key lives beside it in the repo protects against accident, not
   against the agent. The plan must say which it is. Overclaiming here is worse
   than a modest claim, because it invites false confidence.

5. **The live-runtime proof is real.** T5 promises live Claude MCP
   denial-and-rewrite evidence. Is it genuinely live, or a fixture MCP server
   pretending? A fixture is legitimate for the contract tests, but at least one
   piece of evidence must involve the real tool boundary firing. State which and
   whether the plan says how that run is captured and re-checked later.

6. **No P166 regression.** The gateway, the eight-site inventory, the 16,000
   character cap, and `acceptPromptSubstrateCallRecord` must all survive. This
   phase adds a witness; it does not replace the evidence binding.

7. **MUDA.** Five tasks and roughly nineteen files, reaching into `install.sh`
   and `merge-settings.js`. Is that right-sized for the goal, or has the scope
   grown past what the deferred item needed? Name anything that could be cut
   without weakening the closure.

## Output, contract lines first, then max 250 words

```
FINDINGS: <int>
CRITICAL: <int>
WARNINGS: <int>
PASS_RATE: <n>/7
ONE_LINER: <summary>
VERDICT: GO | GO-WITH-CHANGES | NOGO
REQUIRED_CHANGES: none | <numbered>
```

NOGO if enforcement is advisory, if the witness can be forged by the witnessed
party, or if absence fails open.
