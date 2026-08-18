# P153 Verification

All commands run by the orchestrator outside the Codex sandbox, which cannot spawn
claude (spawn EPERM, confirmed three times). Config under test is the installed
two-entry repo-local .claude/settings.json: intent classifier plus secret-leak guard.

## All 11 semantic acceptance criteria pass

    PASS  assert-registration.cjs
    PASS  assert-live-dispatch.cjs --probe planning
    PASS  assert-live-dispatch.cjs --probe no-match
    PASS  assert-live-dispatch.cjs --probe p149-skill-routing
    PASS  assert-live-dispatch.cjs --probe p152-shadow
    PASS  assert-live-dispatch.cjs --control forged-and-confused-must-fail
    PASS  assert-live-dispatch.cjs --control stale-nonce-must-fail
    PASS  assert-block-guard.cjs --case secret
    PASS  assert-block-guard.cjs --case benign
    PASS  assert-block-guard.cjs --case dual-surface-shared
    PASS  kb-triage-shadow/assert-shadow.cjs

    11 / 11 passing, 0 failing

Registration state: events_added=1 commands=2
hooks_sha256=bbabc5b17a578d89246e2e2ed638e8d586f665b5b8cbe6360bf2a7c7213e53c6

## Falsifier discrimination, tested both ways

Eleven green results prove nothing unless the probe can be made to fail. Two
deliberate breakages:

TEST A, no UserPromptSubmit registered at all:
    --probe planning  exit 1

TEST B, secret-leak guard left registered, intent classifier removed:
    remaining ids: user-prompt-secret-leak-guard
    --probe planning  exit 1

Test B is the decisive one. A probe asserting only that some known managed hook is
registered would pass with the guard alone while the classifier never ran. It failed,
so the allowlist enforces classifier uniqueness rather than mere id recognition.

After each test the settings were restored and assert-registration.cjs reported the
identical hash bbabc5b1, so neither test left residue.

## Transport confirmed under adverse conditions

A direct claude -p run was executed while the account was out of credits. Both hooks
dispatched, both returned exit_code 0 outcome success, the classifier injected
"SGSD directive: /sgsd-triage", and the routing ledger went from 15 to 16 rows:

    signal      intent_routing_decision
    decision    matched
    route_ids   ["planning-triage"]
    session_id  4b678f53-291d-40c5-b745-7121f8f518bf

The child exited 124 on the model turn it never needed. A UserPromptSubmit hook fires
before the model call, so the hook completing while the session fails is correct
behaviour, not a defect.

## Orchestrator error corrected during verification

The p149 and p152 probes were first reported as a regression caused by installing the
second hook. That was wrong. Both hooks had dispatched successfully in the failing run
and the P152 shadow row was written text-free at 16:27:41.883Z with
matched_signature_ids ["kb-lookup-triage"]. The failure was out_of_credits plus ten
529 overloaded retries. The real defect was in the probe: it required the whole session
to succeed when it only needed the hook to have fired. Fixed in T2d, which also made
the probes roughly four times faster by terminating as soon as evidence appears, and
stopped them consuming model quota they never needed.

## Deferred, not done

STATE.md frontmatter current_phase is stale at "150" while v3.6 has P151 and P152
closed. Live routing rows are therefore stamped phase 150 milestone v3.5. State files
are orchestrator-owned per commit discipline. Correcting it is the next action.
