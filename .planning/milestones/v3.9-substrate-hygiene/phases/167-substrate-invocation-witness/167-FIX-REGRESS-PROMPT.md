# P167 fix — two regressions from the last round

Your false-pass fix was right in substance. Both findings are closed: the
rollback test now requires a real commit-then-fail, and the policy test uses
negative assertions. But it broke two things. Fix those, keep everything else.

## Regression A, real, caused by condensing prompt wording

```
assert-prompt-contracts.cjs
AssertionError: The input did not match the regular expression
  /T1 PostToolUse is the only raw-prompt pre-model cap/
```

T3's contract test asserts that exact sentence appears in the prompts. Your
condensing removed it.

This is a coupling you did not check: prompt prose is asserted on by
`assert-prompt-contracts.cjs`, not only by the P166 caller inventory I warned
you about.

Decide which is right and make them agree:

- If the sentence should stay, restore it and keep the condensing elsewhere.
- If the condensed wording is genuinely better, update the T3 assertion to match
  the new wording, and make sure it still asserts something falsifiable rather
  than being loosened to fit.

Do not delete the assertion to make it pass. It exists to stop a prompt drifting
away from delegating the cap to the hook, which is the whole reason prompts must
not cap.

## Regression B, a FLAKY assertion, not a real escape

```
assert-propagation.cjs
AssertionError: isolated propagation escaped into real profile or source evidence
  '<HOME>\.claude.json': <hash changed>
```

The orchestrator investigated before asking you to change anything. This is NOT
an escape. `~/.claude.json` is rewritten continuously by the live Claude Code
session that is running this very task. Measured directly: with no test running
at all, the file's hash changed twice in 45 seconds.

Your `cleanup()` snapshots `protectedPaths` before the run and compares after,
so any concurrent write by the host agent's own runtime fails the assertion. The
test cannot reliably assert immutability of a file the running agent mutates.

Fix the guard, not the propagation code:

- Drop `~/.claude.json` from the protected snapshot, or
- Restrict the snapshot to paths this propagation code could actually write.

Keep the guard's real purpose intact. It must still fail if propagation writes
into the real profile or mutates source evidence. Removing the whole check is
not acceptable; removing one path that a third party rewrites is.

State in your report exactly which paths remain protected and why each is
immune to concurrent host writes.

## Constraints

Four files:
`assert-propagation.cjs`, `assert-prompt-contracts.cjs`, and the two agent
prompts.

Everything currently green must stay green: T1 34/34, T2 13/13, the four
registration-guard cases, and all ten P166 regressions including
`caller-coverage`, which is exact and single-consumption, so a changed prompt
line may require its inventory entry to match.

Frozen byte-unchanged: `super-gsd/schemas/vtp-mcp-input-schemas.v1.json`,
`.planning/milestones/v3.6-vtp-bridge/phases/154-mcp-arg-contract/154-REAL-MCP-EVIDENCE.json`.

Do not commit. No emoji, no em dashes. Never invoke `claude`.

## Verification reality

You cannot run fixture suites (`EPERM`). `node --check` and load checks only.
The orchestrator runs the rest.

Emit `PROGRESS: <line>` per unit.

## Report

```
FILES_CHANGED: path (modified)
VERIFICATION: `cmd` -> exit N (only what you actually ran)
DEVIATIONS: description | none
BLOCKERS: description | none
ONE_LINER: which way you resolved the prompt sentence, and which paths remain protected
```
