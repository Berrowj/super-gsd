# P157 Audit — evidence gate record

Audited 2026-08-20 at phase close, orchestrator-verified.

## Evidence chain

- Plan rev 2 (GO-WITH-CHANGES, AMENDMENT-1 path-leak redaction), validate.cjs exit 0.
- T1: red (no registry/loader, 0/1) then green 39/39; spec review sole finding was
  scope isolation, resolved by the exact three-file commit stat.
- T2: dual red preserved (runner-absent Rule 0; consult row without dispatch);
  green 57/57 then 107/107 after realpath-containment fix (spec review finding);
  AMENDMENT-1 redaction assertions green; wrapper timeout salvage documented.
- T3: executor refused to fake red at sandbox boundary; orchestrator ran the real
  installer red (exit 1, HOOK_NOT_REGISTERED) and post-implementation green 28/28.
- Close review (900s round): 1 CRITICAL — manual readiness short-circuited on a
  fresh manifest before the probes. Sole fix round moved consult ahead of the
  short-circuit with a full-sequence falsifier; suite now 140/140.
- P155 regressions: all five suites exit 0 (p153 case requires --mode executor).
- orchestrator-hooks self-test 18/19; sole failure A1 pre-existing on HEAD.

## Verification commands of record

    node super-gsd/tests/vtp-readiness/assert-vtp-readiness.cjs --case all
    node super-gsd/tests/propagation-readiness/assert-p153-regression.cjs --mode executor

Both exit 0 on 2026-08-20.
