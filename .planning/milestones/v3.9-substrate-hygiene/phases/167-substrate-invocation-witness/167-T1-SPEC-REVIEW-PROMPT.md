# P167-T1 spec-compliance review

Read only. Judge the SHIPPED CODE against the LOCKED PLAN, task `P167-T1`.
The executor hit its wrapper timeout and never wrote a report, so there is no
self-summary to be misled by. Judge the artifacts.

## Artifacts

- Plan: `.../167-01-PLAN-LOCKED.md` revision 3, reviewed GO 6/6. Read the
  `P167-T1` block: `input_contract`, `falsifier`, `stop_rule`.
- Diff: `.../167-T1-DIFF.patch` (950422a to 6aa2f01)
- Live tree at 6aa2f01.
- The plan's `intent` and `known_deadends`, which bound what may be claimed.

## Work the falsifier literally

Check each item against the code, not against intent. Pay particular attention:

1. **Does PreToolUse actually deny, before transport?** Not log, not warn, not
   record. Trace the path from hook input to the returned decision and confirm
   an invalid v2 payload cannot proceed.
2. **Does PostToolUse actually replace the result the model receives?** Confirm
   it uses `updatedToolOutput` / `updatedMCPToolOutput` and that the capped form
   is what leaves the hook. If the raw form can still reach the model on any
   branch, that is CRITICAL.
3. **Is the witness free of agent-supplied identifiers?** The correlation must
   use `session_id` plus a digest the hook computes itself. If any path accepts
   a digest or tool-use id the witnessed party supplied, that is CRITICAL: it
   recreates P166's defect one level up.
4. **Does the broker withdraw the tool on guard loss, and refuse a stale forced
   call?** Both checks, not one.
5. **Reuse, not reimplementation.** `capSubstrateResponse` and
   `substratePayloadDigest` must be reused. A second cap implementation or a
   second digest function is a defect.
6. **P166 intact.** The gateway, eight-site inventory, 16,000 character cap and
   `acceptPromptSubstrateCallRecord` must all still work.
7. **No overclaim.** The plan's intent is explicit that this does not defeat an
   actor with arbitrary same-user Bash and Write, per an operator ruling. Check
   no code comment, error string, or doc line in this diff claims otherwise.
   Under-claiming is fine.

## Orchestrator evidence, to audit rather than trust

Run unsandboxed at 6aa2f01: `assert-hook-contract.cjs` 34/34 exit 0; twelve P166
regressions all exit 0; exactly five files changed; both frozen files unchanged;
zero em dashes in added lines.

Direct probes: an unfiltered `PreToolUse` payload returned
`permissionDecision: deny` with reason `invalid_v2_payload`; a valid payload
invoked without registration returned `deny` with
`guard_unavailable:pretooluse_missing`.

If a test passes for the wrong reason, say so. The suite was written by the same
run that wrote the code.

## Output

```
FINDINGS: <int>
CRITICAL: <int>
WARNINGS: <int>
PASS_RATE: <n>/7
ONE_LINER: <summary>
VERDICT: PASS | PASS-WITH-FINDINGS | FAIL
REQUIRED_CHANGES: none | <numbered>
```

Max 250 words after the contract lines.
