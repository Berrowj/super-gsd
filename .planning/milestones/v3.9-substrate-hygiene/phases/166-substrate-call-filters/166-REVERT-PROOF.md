# P166 revertability, mechanical range-revert evidence

Phase-level ATC raised one CRITICAL: the plan promises "P166-T1 is one
policy/schema/caller commit. P166-T2 depends on it and is one
response-cap/artifact commit", but the phase shipped six code commits, four for
T1 and two for T2, with review fix rounds between them.

The reviewer offered two remedies: consolidate the commits, or "formally revise
that contract with mechanical range-revert evidence". Consolidation was
rejected. It requires rewriting pushed-adjacent history, this project forbids
amending, and a prior incident recorded in memory (`squash-tree-reverts-unmerged-master`)
shows commit-tree squashing here has silently deleted work that master gained
after the branch base.

The contract is therefore restated as ranges, and proven.

## What was proven

Run in an isolated detached worktree at `c628abb`, with the gitignored Ajv
dependency copied in so the suites could actually execute. The working branch
was never touched.

**T2 reverts as a unit, and T1 survives it.**

```
git revert --no-edit --no-commit 2e40c95 dc8e40e     -> exit 0, no conflicts
caller-coverage                                       -> exit 0
prompt-record-acceptance                              -> exit 0
composer.SUBSTRATE_CALL_POLICY                        -> present
composer.capSubstrateResponse                         -> absent
```

This is exactly the plan's claim: "Reverting T2 restores untruncated responses
without removing filters."

**T1 then reverts as a unit, returning to the pre-phase baseline.**

```
git revert --no-edit --no-commit ec02369 e216712 d63a6e6 11cea52  -> exit 0
composer.SUBSTRATE_CALL_POLICY                                     -> gone
composer.acceptPromptSubstrateCallRecord                           -> gone
git diff --stat f39200a -- super-gsd                               -> empty
```

The tree is byte-identical to the pre-phase baseline after both reverts.

## Revised contract

| Unit | Revert range | Effect |
|---|---|---|
| T2 | `2e40c95`, `dc8e40e` | removes the per-hit cap and degradation notes, leaves the gateway and filters in place |
| T1 | `ec02369`, `e216712`, `d63a6e6`, `11cea52` | removes the argument policy, gateway, v2 schema, and prompt acceptance as one unit |

Docs-only commits (`820b549`, `f9f4426`, `a35dc49`, `0feebfa`, `c628abb`) touch
no source and need not be reverted.

Reverting in the other order is not supported: T2 consumes T1's validated
wrapper, so T1 must be reverted after T2, which is the same dependency the plan
already declares through `depends_on: ['P166-T1']`.
