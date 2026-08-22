# P166-T1 fix round 2 — spec review FAILED with 2 CRITICAL

An independent spec-compliance reviewer read your shipped diff at commit 11cea52
against the locked plan and returned FAIL, PASS_RATE 9/12. Falsifier items 3, 4
and 7 are true. Both findings reopen the exact defect that made round 1 of the
plan review a NOGO: filtering that is advisory rather than mechanical.

Fix both. Do not fix anything else.

## CRITICAL 1 — prompt transport is unmediated

Reviewer's finding, verbatim:

> The enrichment, board, installed researcher, and installed planner callers
> retain direct raw MCP tools. Their constraints are prose only; no production
> code validates `substrate_call_record`. `assertPromptContracts()` merely
> searches prompt text, while its transport captures call `callVtp`
> synthetically, bypassing the actual prompt path. Consequently an unfiltered or
> limit-6 prompt call can reach transport.

You wrote prose in four prompts telling agents to use the prepared envelope and
return gateway evidence. Prose is what the agent forgets. The plan's own
`known_deadends` says: "Do not treat schema validation in a test as enforcement"
and "Do not permit a prompt-recorded raw substrate call without matching gateway
evidence."

Required: PRODUCTION code, not test code, must validate `substrate_call_record`
and REJECT a record that is missing evidence, carries a mismatched digest, was
made directly without a prepared envelope, or is unfiltered / limit-6. A prompt
whose recorded call fails that check must fail its contract, not be accepted
with a warning.

Your conformance test must exercise the REAL acceptance path, not a synthetic
`callVtp` stand-in. If the test constructs its own transport capture and calls
`callVtp` itself, it is testing the gateway you already proved, not the prompt
path that bypasses it.

## CRITICAL 2 — caller coverage is fail-open inside known files

Reviewer's finding, verbatim:

> Coverage classifies every occurrence in several known files as an existing
> site and permits whole files through `/.*/` or unanchored patterns. Its
> negative test injects only a new file, so it misses this defect.

A rogue substrate call added to a file that already contains a legitimate one is
currently invisible. That is the realistic bypass: nobody adds a brand new file,
they add a line to `classify.cjs` or `sgsd-triage-runtime.cjs`.

Required: classify by exact occurrence or branch, never by file. Remove `/.*/`
and every unanchored pattern. Then prove it: your negative test must inject a
rogue occurrence INSIDE an already-known file and require coverage to fail.
Keep the existing new-file injection proof as well.

The two `classify.cjs` declaration allowlist entries from fix round 1 were
judged exact and anchored. Leave them as they are.

## Everything else passed

Falsifier items 1, 2, 5, 6, 8, 9, 10, 11, 12 all pass. Frozen hashes match. Both
Phase-48 branches are distinct and tested. Do not disturb any of it. Do not
widen the diff beyond what these two findings require.

## Constraints

Same eleven-file scope. `vtp-mcp-input-schemas.v1.json` and
`154-REAL-MCP-EVIDENCE.json` stay byte-unchanged. Do not commit. No emoji, no em
dashes. Never invoke `claude`.

You cannot run `executable-emitters` in your sandbox: it spawns a nested Node
process and your sandbox returns `spawnSync EPERM`. Do not fake it and do not
claim it passed. The orchestrator runs it unsandboxed. Say plainly which
commands you actually ran.

Emit `PROGRESS: <line>` as you go.

## Report

```
FILES_CHANGED: path (modified)
VERIFICATION: `cmd` -> exit N (only what you actually ran)
DEVIATIONS: description | none
BLOCKERS: description | none
ONE_LINER: how each CRITICAL is now mechanical rather than advisory
```
