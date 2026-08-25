# P167-T4 spec-compliance review

Read only. Judge the SHIPPED CODE against the LOCKED PLAN, task `P167-T4`.
The executor timed out and never wrote its own report, so there is no
self-summary to be misled by; two follow-up fix rounds did report.

## Artifacts

- Plan `.../167-01-PLAN-LOCKED.md` revision 3, task `P167-T4`:
  `input_contract`, `falsifier`, `stop_rule`, `known_deadends`.
- Diff `.../167-T4-CUMULATIVE-DIFF.patch` (386d027 to a5e1f97)
- Reports `.../167-T4-FIX1-REPORT.md`, `.../167-T4-FIX2-REPORT.md`
- Live tree at a5e1f97.

## The property this task exists for

Research established that propagation never registered Claude hooks and that a
missing hook is non-blocking, so a fresh machine failed open and every guard
T1-T3 built would be decorative there.

So the question is not "does it register hooks". It is: **on a machine where the
hook is absent, stale, mismatched or duplicated, does something REFUSE?**

Trace it. Name exactly what refuses and where. If the answer anywhere is that it
logs, warns, records, or continues with a flag set, that is CRITICAL, because it
is the original defect wearing new clothes.

## Then work the falsifier

1. Grants are derived ONLY after the key, both hook registrations, and the
   broker verify. Confirm no path derives a grant first and validates after.
2. An absent or unsupported upstream leaves all four frontmatters raw-tool-free.
3. `install.sh` and `merge-settings.js` changes are additive and idempotent:
   running the installer twice must not double-register. Verify the dedupe and
   managed-id reconciliation actually achieve that, rather than assuming.
4. The installer returns nonzero on a failed mandatory witness or broker step,
   before grants.
5. P166's exact single-consumption caller inventory still accounts for every
   substrate occurrence. Fix round 1 claims `audit.cjs` held five literal
   occurrences before T4 and still holds five. Verify that independently.
6. T1, T2, T3 and every P166 regression intact.
7. Seven files only; frozen files byte-unchanged.
8. No overclaim: per an operator ruling this does not defeat a same-user actor
   with Bash and Write.

## Scrutinise the two repairs

- `merge-settings.js` had `reconcileRepoLocalManagedIds` declared inside
  `mergeSettingsFiles` but exported at module scope, so the module threw on
  load. It is now module-scoped. Confirm the move did not change behaviour for
  the inner caller at the old call site, and that no other export is undefined.
- The locked hook basename list had the new hook mis-sorted. It was reordered,
  deliberately NOT made order-insensitive. Confirm the ordering check still has
  teeth and that every duplicated copy of that list was fixed.

## Orchestrator evidence, to audit rather than trust

At a5e1f97, unsandboxed, all exit 0: assert-propagation, feature-propagation
self-test, four registration-guard cases (`hook-manifest-completeness`,
`bundled-overlay-current`, `hook-distribution-all-types`,
`brokered-substrate-capability`), hook-contract 34/34, witness-correlation 13/13,
prompt-contracts 4/4, and ten P166 regressions. `bash -n install.sh` exit 0.

Codex could not run the fixture suites, the guard cases, or bash at all.

## Output

```
FINDINGS: <int>
CRITICAL: <int>
WARNINGS: <int>
PASS_RATE: <n>/8
ONE_LINER: <summary>
VERDICT: PASS | PASS-WITH-FINDINGS | FAIL
REQUIRED_CHANGES: none | <numbered>
```

Max 250 words after the contract lines.
