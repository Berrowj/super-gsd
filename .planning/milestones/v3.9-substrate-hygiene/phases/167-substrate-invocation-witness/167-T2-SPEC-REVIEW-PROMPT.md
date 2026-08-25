# P167-T2 spec-compliance review

Read only. Judge the SHIPPED CODE against the LOCKED PLAN, task `P167-T2`.

## Artifacts

- Plan `.../167-01-PLAN-LOCKED.md` revision 3, task `P167-T2`:
  `input_contract`, `falsifier`, `stop_rule`, `known_deadends`.
- Diff `.../167-T2-CUMULATIVE-DIFF.patch` (f939314 to 5ec8f1c)
- Executor report `.../167-T2-EXEC-REPORT.md` and fix report
  `.../167-T2-FIX1-REPORT.md`
- Live tree at 5ec8f1c.

## The property that matters most

T2 exists so that a tidy prompt record with no real call behind it is refused.
It fails completely if any correlation input can come from the witnessed party.

Trace every field the correlation consumes back to its source. Each must come
from the runtime or from the hook-written store, never from the record the agent
supplies. If even one is agent-sourced, that is CRITICAL: it rebuilds P166's
defect one level up, and the whole task is theatre.

## Specifically scrutinise

The composer gained this line:

```
: (findSgsdRoot(process.cwd()) || fs.realpathSync(process.cwd()));
```

Establish what happens when `findSgsdRoot` returns null and the fallback takes
effect. Can that fallback let a witness from one project satisfy acceptance in
another, or otherwise weaken the project binding? The suite's
different-project case passes, but confirm it exercises the fallback branch and
not only the happy path. If the fallback is unreachable in production, say so;
if it is reachable and weakens the binding, that is a finding.

## Also work the falsifier

- Replay: two identical real calls must pass twice, and a third acceptance must
  be refused. Confirm the count is enforced by consumption, not by a heuristic.
- Forged records must not consume a witness. A rejection that still burns the
  row would let an attacker exhaust legitimate calls.
- P166 rejection order preserved; the gateway, eight-site inventory, 16,000
  character cap and existing rejections all intact.
- T1 unchanged and still 34/34.
- Three files only. Frozen files byte-unchanged.
- No overclaim: the plan under-claims deliberately per an operator ruling, so no
  comment or error string may imply protection against an actor with arbitrary
  same-user Bash and Write.

## Note on the fix round

The executor's suite failed when the orchestrator ran it, with
`vtp_substrate_record_file_uncontained`. The executor diagnosed it as a wrong
test fixture, missing the `.planning/STATE.md` root marker that `findSgsdRoot`
requires, and changed only the test. Verify that diagnosis independently. If
production containment was in fact wrong and the test was bent to fit it, that
is CRITICAL.

## Orchestrator evidence, to audit rather than trust

At 5ec8f1c, unsandboxed: correlation 14/14, hook contract 34/34, and ten P166
regressions, all exit 0. Containment function definitions unchanged in the diff.
Zero em dashes in added lines. Codex ran no suite at all this round; every result
above is the orchestrator's.

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
