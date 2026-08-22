# P166 phase-ATC fix — findings 2 and 3

Phase-level ATC returned FAIL, 7/10, three findings. It confirmed the design is
coherent: "one design, T2 preserves T1's validated gateway and policy
guarantees", and that `SUBSTRATE_CALL_POLICY` is the single production owner of
intent-to-arguments policy. Do not disturb any of that.

You are fixing findings 2 and 3 only. Finding 1 is about commit structure and
the orchestrator owns it.

## Finding 2, duplication

> Remove duplicate missing-record enforcement and exact duplicate policy-test
> executions; factor the near-identical planner/researcher prompt appenders.

Three separate things:

a. Duplicate missing-record enforcement. There are two checks where one now
   suffices. Note the history: an earlier ATC round tried to remove the explicit
   missing-record guard in `vtp-enrichment-gate.cjs` and it was KEPT, because
   removing it changed the both-missing path reason code from
   `substrate_call_record_missing` to `prepared_call_missing_or_invalid` and
   broke `prompt-record-acceptance`. If that is the same duplication being
   flagged again, the correct action is to keep the behaviour and remove the
   redundancy some other way, or to state that it cannot be removed without a
   reason-code change and leave it. Do not silently change a reason code.

b. Exact duplicate policy-test executions. Find cases where the same assertion
   runs twice under different names and collapse them. Two cases that look
   similar but falsify different things are NOT duplicates; leave those.

c. Near-identical planner/researcher prompt appenders in
   `feature-propagation/audit.cjs`. Factor the shared body. These are separately
   classified sites in the caller inventory and must REMAIN separately
   classified and separately tested after factoring.

## Finding 3, stale comments

> Correct stale comments describing transport flow, dependencies/exports, and
> the obsolete 11-assertion self-test count.

Comments now describing behaviour that no longer exists. The bridge self-test
count in particular moved from 11 to 13. Find every stale count, dependency
list, export list, and transport-flow description across the files this phase
touched, and correct them to what the code actually does. A comment that lies is
worse than no comment.

## Constraints

Behaviour must not change. Every one of these must stay green, and the
orchestrator will re-run all of them plus the two spawn-bound suites:

```
megachunk-degraded-artifact, cap-shapes, caller-coverage, prompt-record-acceptance,
repair-safe-t2, substrate-policy-required, emitted-args, real-evidence,
vtp-fallback-contained-degradation, staged-vtp-null-reflection-fallback,
composer --self-test, enrichment-gate --self-test, classify --self-test,
feature-propagation --self-test, kb-triage-shadow
```

The three live falsifications must still bite: a rogue substrate call in a known
file, the same in a new file, and `gate.run` with `{ok:false}` and no record.

Frozen byte-unchanged: `vtp-mcp-input-schemas.v1.json`,
`154-REAL-MCP-EVIDENCE.json`. Same eleven-file scope. Do not commit. No emoji,
no em dashes. Never invoke `claude`.

`executable-emitters` and `staged-vtp-oversized-response` are orchestrator-owned.

Emit `PROGRESS: <line>` as you go.

## Report

```
FILES_CHANGED: path (modified)
LINES_REMOVED: <int>
VERIFICATION: `cmd` -> exit N (only what you actually ran)
DEVIATIONS: description | none
BLOCKERS: description | none
ONE_LINER: what was removed, what was kept and why
```
