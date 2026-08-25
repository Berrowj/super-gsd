# T1 regressed a P167 guarantee: substrate repair now registers an unrelated project hook.

Green, do not touch: installer-registration-guard 13/13 in one sweep,
install-contract 3/3, feature-propagation self-test, T3 prompt-contracts,
assert-hook-contract 38/38, P166 6/6, P154 real-evidence, composer and enrichment-gate
self-tests, kb-triage-shadow, assert-witness-correlation 13/13.

## The regression

`node super-gsd/tests/substrate-invocation-witness/assert-propagation.cjs` fails at
line 224:

    AssertionError: substrate repair changed an unrelated project hook

    + actual - expected
      [
        { hooks: [ { command: 'operator-hook', ... } ] },
    +   {
    +     hooks: [ { args: ['<tmp>/project/super-gsd/hooks/sgsd-session-start.js'],
    +                command: 'node', timeout: 5, type: 'command' } ],
    +     sgsd_hook_id: 'session-start-governance',
    +     sgsd_managed: true
    +   }
      ]

A substrate-scoped repair registered `session-start-governance` into the project's
SessionStart hooks. It must manage ONLY the witness Pre/Post hook ids and leave every
unrelated project hook alone.

## Why this is a product bug, not a stale test

This exact scoping was fixed in P167 commit `e78847f`, "scope the substrate repair flag to
substrate, stop rewriting operator config". The mechanism is the `managedHookIds` argument
in `repairClaudeSubstrateWitness`:

    managedHookIds: options.repairProjectHooks ? undefined : [
      witnessStore.PRE_HOOK_ID,
      witnessStore.POST_HOOK_ID,
    ],

`undefined` means "manage every id in the overlay". The witness-only path must pass the
two witness ids. T1 has changed which flag reaches this path, so a substrate-scoped repair
now takes the full-overlay branch.

Find where T1 changed that and restore the scoping. Do NOT relax the test, and do NOT
simply force `repairProjectHooks` false somewhere that would disable the new project
module delivery: both behaviours must coexist. A substrate repair scopes to the witness
ids; a full project install may manage the whole overlay. Say in your report which caller
was passing the wrong flag and why.

## Also fix: two suites are flaky back to back

Running the suites in sequence, `brokered-substrate-capability` and
`assert-hook-contract.cjs` each reported failure once in a batch and then passed twice
standalone with exit 0. That smells like fixture temp-directory or environment collision
between consecutive runs. Investigate; if it is a real collision, isolate the fixture
naming or teardown. If you cannot reproduce it, say so plainly rather than guessing, and
do not make speculative changes.

## Constraints

- Never weaken a test to pass.
- P167 witness contract untouchable: PreToolUse fail-closed, PostToolUse returns a bounded
  `substrate_witness_rewrite_failed` object and never passes the raw result through, the
  store accepts only `rewritten` rows.
- Refuse before writing stays literal.
- Fixture paths contain SPACES.

## Verify

- node super-gsd/tests/substrate-invocation-witness/assert-propagation.cjs
- installer-registration-guard --all (must stay 13/13)
- node super-gsd/tests/install-contract/assert-install-contract.cjs (must stay 3/3)
- node --check on every file modified

Sandbox denials: mark DENIED. The orchestrator re-runs unsandboxed. Do not ask approval.

Standard block format, max 300 words.
