# P167 revertability, mechanical range-revert evidence

Phase-level ATC found that the locked plan's one-commit-per-task description no
longer matched the shipped history. Review and live-capture fixes intentionally
touched earlier task files. History was not rewritten. The contract is restated
as five ordered commit sets and proven in an isolated repository.

## What was proven

The proof used committed HEAD `879aa4c` in an isolated repository created from a
local Git bundle. The ignored plan-schema `node_modules` dependency was copied
in so the surviving task suites could execute. The active worktree was never
modified by the proof.

### T5 reverts first and T1 through T4 survive

```text
git revert --no-commit 879aa4c ca43513 99a8790 eab7715  -> exit 0
capture-live-runtime.cjs absent                           -> true
assert-hook-contract.cjs                                  -> exit 0, 34/34
```

This removes T5's fixture, capture, evidence, production fixes, and cleanup as
one unit, including its later edits to T1/T2 files.

### T4 reverts next and T3 survives

```text
git revert --no-commit e78847f c822dd4 e85d396 a5e1f97 -> exit 0
assert-prompt-contracts.cjs                               -> exit 0, 4/4
```

The range includes `c822dd4`, the cross-surface review repair that touched both
T3 and T4 files. Reverting it with T4 is conflict-free and leaves the earlier T3
contract executable.

### T3, T2, and T1 then revert to the pre-phase source tree

```text
git revert --no-commit 386d027                            -> exit 0
git revert --no-commit be6cfa1 5ec8f1c                    -> exit 0
assert-vtp-substrate-policy.cjs --case prompt-record-acceptance -> exit 0
git revert --no-commit 9ea0bac 6aa2f01                    -> exit 0
git diff --exit-code 950422a -- super-gsd                 -> exit 0
```

The final `super-gsd` tree is byte-identical to the pre-phase baseline for all
tracked source files.

## Revised contract

| Task | Forward commit set | Reverse order |
|---|---|---|
| T5 | `eab7715`, `99a8790`, `ca43513`, `879aa4c` | `879aa4c`, `ca43513`, `99a8790`, `eab7715` |
| T4 | `a5e1f97`, `e85d396`, `c822dd4`, `e78847f` | `e78847f`, `c822dd4`, `e85d396`, `a5e1f97` |
| T3 | `386d027` | `386d027` |
| T2 | `5ec8f1c`, `be6cfa1` | `be6cfa1`, `5ec8f1c` |
| T1 | `6aa2f01`, `9ea0bac` | `9ea0bac`, `6aa2f01` |

Commit `1339eab` is an unrelated privacy scrub over other milestone reports and
cockpit artifacts. It remained present throughout the proof and is not part of
any P167 task revert set. Docs-only state, review-evidence, and memory commits
also remain outside these production ranges.

The phase-ATC repair that accompanies this document is intentionally
uncommitted. It is therefore outside this committed-history proof. Before a
future rollback, the operator must add the eventual repair commit to the T5
repair set and revert it before `879aa4c`.
