# P153-T1b/T1c live probe evidence

All runs executed by the orchestrator outside the Codex sandbox, which cannot spawn
claude (spawn EPERM, confirmed twice).

## Probes, all under genuine headless Claude dispatch

    --probe planning            PASS  session_id=9201def8-9ac5-49dc-a6e1-973fbcdc7b6f
    --probe no-match            PASS  session_id=775c53a5-d398-4f88-849a-648dd04b4239
    --probe p149-skill-routing  PASS  session_id=4898de8d-099e-482b-80e0-94657227cf29
    --probe p152-shadow         PASS  session_id=7406a9c1-5cd4-4a60-8a8b-40a5ca499803

## Adversarial controls

    --control forged-and-confused-must-fail  PASS
    --control stale-nonce-must-fail          PASS

## Falsifier discrimination test

A passing control proves nothing unless the probe can be made to fail. Test performed:

1. Removed the UserPromptSubmit entry from repo-local .claude/settings.json.
2. Ran --probe planning. Result:

        live dispatch FAIL: exactly one managed UserPromptSubmit classifier entry
        must be installed
        0 !== 1
        exit 1

3. Restored settings.json. assert-registration.cjs then reported
   events_added=1 commands=1
   hooks_sha256=560f5854d4075b8ce6e459771f5ee40ad6079c6979a6c5d13c0582b9eb0a92c1

The hash is byte-identical to the pre-test value, so the test left no residue.

The probe fails when the hook is absent and passes when it is present. The falsifier
discriminates. This is the property rev 1, rev 2 and rev 3 of the plan each failed to
guarantee, and it is now demonstrated rather than argued.

## Code change that made no-match observable

super-gsd/hooks/sgsd-intent-classifier.cjs, appendRoutingDecision:

    - if (!Array.isArray(routes) || routes.length === 0) return;
    + if (!Array.isArray(routes)) return;
    +   decision: routes.length > 0 ? 'matched' : 'no_match',

The early return was why no no-match row was ever written, which made row absence
indistinguishable from the hook never running. That is seam instance 6 in this repo's
anti-pattern ledger, and it was still live in the classifier until this change.
