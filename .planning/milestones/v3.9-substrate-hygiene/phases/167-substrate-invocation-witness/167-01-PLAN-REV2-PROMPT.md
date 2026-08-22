# P167 planning revision, NOGO round 1, one required change

Revise your own `167-01-PLAN-LOCKED.md` IN PLACE as revision 2, with a
provenance note in the body. No source changes.

Review verdict: NOGO, 6/7, one CRITICAL. Six of seven checks passed and are not
in question: the active enforcement path, the non-self-reported witness, the
modest `local_hmac` trust claim, the real runtime boundary, the P166 regression
coverage, and MUDA sizing. Keep all of it.

## The one CRITICAL

> If both registrations, or the hook source, are deleted, neither boundary
> fires. Audit exits 2 and `acceptPromptSubstrateCallRecord` refuses, but
> acceptance occurs after raw output has entered model context. T3's preflight is
> prompt instruction, and the plan itself says at line 392 that it is not
> enforcement.

Your SAC 3 deletes only the `PostToolUse` registration, which leaves
`PreToolUse` able to deny, so it never tests the case that matters. Delete both,
or delete the hook source, and the raw tool works normally. The refusals that
remain all happen after the model has already read the oversized, unfiltered
response, so F1 is wide open in exactly the scenario an uncooperative agent or a
fresh machine produces.

This is the same failure P166 shipped and this phase exists to fix: a guard that
can be removed is not a guard. Recording that it is missing, after the fact, is
not enforcement.

## Required

**Mechanically disable the raw tool when the hooks or their source are absent.**
Either a protected or managed-policy authority that the witnessed party cannot
edit, or an independent boundary that removes the tool grant itself rather than
policing its use.

You were already reading the managed-settings surface during planning
(`allowManagedHooksOnly` and related). Settle whether it can do this here, on
this platform, and say plainly if it cannot. If managed policy is unavailable or
unreliable, the honest alternative is that the four prompts do not carry the raw
tool at all unless the installer grants it alongside a registered hook, so that
removing the hook removes the capability rather than merely the oversight. Weigh
both and choose, giving your reason.

**Add an SAC that deletes BOTH registrations AND the hook source**, then proves:

- no MCP server invocation occurred, evidenced from the fixture server's own log
  rather than from anything the agent reports, and
- no raw transcript reached model context.

An SAC that only asserts a warning was written, an audit exited non-zero, or
acceptance later refused does NOT satisfy this. The proof must be that the call
did not happen.

If, after genuine investigation, no mechanism on this platform can prevent a
user with write access to their own settings from removing the guard, then say
so explicitly in `known_deadends`, state precisely what the residual is, and
scope the phase to what it can honestly close. Do not paper it over with prompt
text. An honest bounded claim is acceptable; an overclaim is not. That judgement
call is the one thing worth getting right here.

## Keep

Everything else stands: five tasks, the deny plus rewrite contract, the
session-plus-digest correlation with no agent-supplied identifier, the live
runtime evidence in T5, and the P166 regression set. Do not renegotiate scope
downward on any of them.

## Validate before finishing

```
node super-gsd/tools/plan-schema/validate.cjs \
  --plan-file .planning/milestones/v3.9-substrate-hygiene/phases/167-substrate-invocation-witness/167-01-PLAN-LOCKED.md \
  --project-dir . --mode write
```

Exit 0 required. No emoji, no em dashes.

Report: FILES_CHANGED / VERIFICATION / DEVIATIONS / BLOCKERS / ONE_LINER, max
120 words. ONE_LINER must say which mechanism you chose and why.
