# P167 plan review, round 2, confirmation only

Round 1 returned NOGO on one CRITICAL. Revision 2 claims to have closed it.
Confirm that one item. Six of seven checks passed in round 1 and are not in
question; raise them only if revision 2 regressed one, which would be CRITICAL.

## The round-1 CRITICAL

> If both registrations, or the hook source, are deleted, neither boundary
> fires. Audit exits 2 and `acceptPromptSubstrateCallRecord` refuses, but
> acceptance occurs after raw output has entered model context.

Required was: mechanically disable the raw tool when the hooks or their source
are absent, plus an SAC deleting both registrations AND the hook source and
proving no server invocation and no raw transcript delivery.

## What revision 2 did

It rejected machine-managed policy with a stated reason (available on Windows
Claude Code 2.1.240 via HKLM or `C:\Program Files\ClaudeCode\managed-settings.json`,
but not deployed, operator is non-admin, and `allowManagedHooksOnly` would
suppress the existing hook fleet). It chose instead a guarded MCP capability
broker that becomes the only Claude-visible vtp-kb server, withdraws
`vtp_search_substrate` from `tools/list` when a guard is absent, and rejects any
stale or forced `tools/call` at a second check.

## Confirm

1. **Does removing the guard actually remove the capability?** Trace it. With
   both hook registrations deleted, and separately with the hook source deleted,
   is the tool genuinely not offered, and is a forced call genuinely refused
   before any upstream request? Name where each of the two checks lives.

2. **Does the new SAC prove absence of the call, not merely presence of a
   complaint?** It must show no MCP server invocation, evidenced from the
   fixture server's own log rather than anything the agent reports, and no raw
   transcript reaching model context. An SAC satisfied by a warning, a non-zero
   audit exit, or a later acceptance refusal does not count.

3. **Is the broker itself a new bypass?** It now sits in the transport path. Can
   an agent reach the real vtp-kb server around it, for example through a stale
   registration, a second server definition, or a direct connection? If the
   broker can be replaced as easily as the hook could be deleted, the CRITICAL
   has moved rather than closed.

4. **Are the trust claims still honest?** `known_deadends` now says the local
   HMAC store and broker are not tamper-proof and that a same-user process can
   defeat them. Check that no task text or SAC elsewhere contradicts that by
   claiming stronger protection than the mechanism delivers. Under-claiming is
   fine; over-claiming is not.

5. **No regression** in the six round-1 passes: active deny plus rewrite, the
   non-self-reported witness, the modest trust claim, the real runtime boundary
   in T5, P166 regression coverage, and MUDA sizing. The plan is still 5 tasks
   and now 5 SACs.

## Output

```
FINDINGS: <int>
CRITICAL: <int>
WARNINGS: <int>
PASS_RATE: <n>/7
ONE_LINER: <summary>
VERDICT: GO | GO-WITH-CHANGES | NOGO
REQUIRED_CHANGES: none | <numbered>
```

GO only if removing the guard removes the capability and the new SAC proves the
call did not happen. Max 200 words after the contract lines.
