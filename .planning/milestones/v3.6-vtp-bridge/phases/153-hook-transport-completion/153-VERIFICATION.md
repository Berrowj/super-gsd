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

---

## T2e re-verification after spec review returned fix_required

Spec-compliance review found the T2d relaxation reopened the harness-green hole:

    RELAXATION_SAFE: no - a successful guard hook pair plus a forged
    session-correlated routing row passes without classifier lifecycle

The orchestrator's earlier Test B did NOT catch this. It removed the classifier ENTRY,
which assert-registration catches on uniqueness. It never exercised the classifier being
registered but not dispatching. The earlier claim that the falsifier discriminated was
therefore narrower than stated.

Fix: the lifecycle check now requires a complete successful hook_started/hook_response
pair for EVERY registered managed hook, not at least one. Matched probes additionally
require a hook_response whose stdout carries the classifier directive.

### All modes green after the fix

    --probe planning             exit 0
    --probe no-match             exit 0
    --probe p149-skill-routing   exit 0
    --probe p152-shadow          exit 0
    --control guard-only-lifecycle-must-fail  exit 0
    --control forged-and-confused-must-fail   exit 0
    --control stale-nonce-must-fail           exit 0

### Live rejection paths verified by breaking the config three ways

    no UserPromptSubmit entry at all      probe exit 1 (isolation precondition)
    classifier target missing on disk     probe exit 1 (resolve-on-disk check)
    classifier slot swapped to other file probe exit 1 (classifier identity check)

Each restored to hooks_sha256 bbabc5b1, byte-identical, no residue.

Disclosure on test coverage. None of those three attempts reached the lifecycle check
itself; each was rejected by an earlier layer. The lifecycle requirement is covered by
the new control, whose implementation was read and confirmed to construct exactly one
guard-only lifecycle pair plus a forged matching routing row and assert rejection on
/registered managed UserPromptSubmit hook/. It is not covered by a live injected
classifier runtime failure.

Also disclosed: two of the three breakage attempts initially mangled the injected path
through unescaped backslash escapes in the orchestrator's own node one-liner, the same
bug class as D2. Corrected with path.resolve and forward slashes before the result above
was taken.
