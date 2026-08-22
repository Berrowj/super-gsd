# P166-T2 fix round 1 — both gates FAILED, both findings in classify.cjs

Spec compliance: FAIL, 11/12, 1 CRITICAL. Per-dispatch ATC: FAIL, 7/10, 1
WARNING. Independent reviewers, same file, two distinct defects. Fix both.
Nothing else.

Everything else passed. The ATC explicitly cleared the thing worth worrying
about: all four propagation boundaries are earned, and none of T1's slop classes
recurred (no production-tree copy, no dead import or parameter, no malformed
prompt literal). Do not disturb any of that.

## CRITICAL, from spec compliance

> In `classify.cjs`, budget degradation notes before `_enforcePacketCap`,
> include them in `body_token_estimate`, and add an exact-ceiling regression.
> A no-write probe returned a 211-byte note after the reported token estimate
> had already reached the configured cap.

Falsifier item 9 is true: the Phase-48 bridge packet cap is weakened. Notes are
attached AFTER enforcement, so the packet can exceed its locked budget by
however many notes it carries. The plan is explicit that T2 must not weaken this
cap.

Budget the notes before `_enforcePacketCap` runs and count them in
`body_token_estimate`. Then prove the ceiling holds exactly: a regression that
lands the packet ON the configured cap with notes present and shows it is not
exceeded. An off-by-one either way is a fail.

## WARNING, from ATC

> In `classify.cjs:446-453`, match notes solely by guaranteed
> `hit_index === _substrate_hit_index`; remove the identity/doc/path/chunk
> alternatives.

The OR-chain is just-in-case code. Composer-generated notes always carry a raw
hit index and `_substrate_hit_index` already preserves it, so the `doc_id`,
`rel_path` and `chunk_id` alternatives are unreachable in practice and actively
harmful: two hits sharing a `doc_id` can both attach the same note.

Match on `hit_index === _substrate_hit_index` alone. Roughly 5 lines go.

Before deleting, confirm `_substrate_hit_index` really is present on every path
that reaches this matching code, including after book filtering and after packet
elision, both of which reorder or drop hits. If some path loses it, say so and
fix that instead of keeping the fallback chain.

## Constraints

`super-gsd/tools/vtp-bridge/classify.cjs` and the policy test are the expected
scope. Anything else, say why.

Do not weaken the cap to make budgeting easier. Do not drop notes to fit the
budget without saying so in the packet. Do not change what a note contains.

Frozen byte-unchanged: `vtp-mcp-input-schemas.v1.json`,
`154-REAL-MCP-EVIDENCE.json`. Do not commit. No emoji, no em dashes. Never
invoke `claude`.

`executable-emitters` and `staged-vtp-oversized-response` are orchestrator-owned
spawn-bound suites. Do not claim them.

Emit `PROGRESS: <line>` as you go.

## Report

```
FILES_CHANGED: path (modified)
LINES_REMOVED: <int>
VERIFICATION: `cmd` -> exit N (only what you actually ran)
DEVIATIONS: description | none
BLOCKERS: description | none
ONE_LINER: how the ceiling is now exact, and what you confirmed before deleting the fallback chain
```
