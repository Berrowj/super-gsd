# 173-02 local execution evidence (frozen candidate)

Frozen 2026-09-15T21:08:24Z by Fable (unit fable.harness.20260915) after T1, T2, T3 completed serially on gpt-5.6-terra/xhigh. HEAD f3e89f7677d929387daa261d781122c70a9e3bfb, uncommitted candidate. control.cjs and codex-executor.sh unchanged (executor hash d6bdb14a...).

## Candidate
- Diff: 173-02-CANDIDATE-SOURCE-DIFF.patch (five files); hashes in 173-02-CANDIDATE-MANIFEST.sha256.
- Executor receipts (wrapper-result.json exit 0, sha/bytes matched): T1 cdd49623-59ab-4cba-a369-75a04b751a12 report 57225214; T2 8409ee53-898d-494c-95c4-567355fbfc4c report 29f988c5; T3 0fb17be7-6dd2-4133-a446-705eaeeb5c7b report fd02a722.
- T3 mailbox decision: legacy launch test reply gained the fixture owner (T1 owner-scope contract); no production change for it.

## Fable independent local verification (clean environment, no SGSD_CODEX_PROFILES_REGISTRY)
- Focused T1 2/2, T2 3/3 rerun by Fable: exit 0.
- `node --test super-gsd/tests/codex-worker/install.test.cjs`: pass 2 fail 0 (T3 worker's two install failures were an environment artefact: it inherited the Terra registry variable from its own dispatch; with it unset the suite passes).
- `node --test super-gsd/tests/codex-worker/launch.test.cjs`: pass 24 fail 1. The one failure, "board wrapper pauses for its exact worker reply before validating the completed board report", also fails on a pristine `git archive HEAD` export (pass 21 fail 1): pre-existing baseline, not caused by 173-02.
- `npm run test:codex-worker`: exit 1; counts in .planning/tmp/173-02-test-codex-worker.txt (copied below).
- `git diff --check`: exit 0.

ℹ tests 102
ℹ pass 98
ℹ fail 2
ℹ skipped 2

## Retained gaps
- Native Windows: explicit unsupported-platform gap (shell refuses win32/interop before dispatch); not simulated.
- Pre-existing launch baseline failure above is left for its own unit.

## Full-suite runs by Fable (clean environment), exact
- Run 1 `npm run test:codex-worker`: tests 102, pass 98, fail 2, skipped 2. Failures: the pre-existing "board wrapper pauses for its exact worker reply before validating the completed board report" and one occurrence of "stopping an adapter cleans up its owned App Server process tree (child)" (worker.test.cjs:141, a retained regression, not a 173-02 test).
- Follow-up: `node --test super-gsd/tools/codex-worker/worker.test.cjs` alone: pass 39, fail 0. Focused cleanup test run three times: 2/2 pass each time. Run 2 `npm run test:codex-worker`: tests 102, pass 99, fail 1, skipped 2, the only failure being the pre-existing board-wrapper test.
- The cleanup failure therefore reproduced 1 time in 6 executions, only under the parallel full-suite run. It is recorded as an intermittent observation for the reviewers, not hidden and not fixed here.
- Pristine HEAD export full suite for comparison: tests 94, pass 89, fail 3, skipped 2 (board-wrapper test plus two install tests that pass in the real worktree; the export lacks the worktree's install fixtures/permissions).
- Outputs: .planning/tmp/173-02-test-codex-worker.txt, .planning/tmp/173-02-test-codex-worker-2.txt, .planning/tmp/173-02-worker-test-alone.txt.

## Candidate v2 after the single evidence-directed repair (2026-09-15T21:30:55Z)
- Spec review R1 (worker a99a8fd5) timed out at 180 s, preserved as 173-02-SPEC-REVIEW-R1-TIMEOUT-REPORT.md. R2 finish on the same thread (worker 04556717, resumed_from a99a8fd5) returned FINDINGS 2, CRITICAL 1 (T3 codex-worker-shell.sh:220 wrapper could return at deadline+5 s while the documented interval was 3 s), WARNING 1 (T1 mailbox.cjs:153 identity-less legacy active records lost liveness/commands). Report sha d1478668, kept as 173-02-SPEC-REVIEW-REPORT.md until R3 replaces it.
- Repair worker aa1da77c (report sha ea0ce650, exit 0): observation interval now declared as 5 s (3 s slack + 2 s kill-after) with the T3 test asserting budget plus that interval, actual watchdog timing unchanged; identity-less legacy records keep PID-only liveness and report liveness_observation unknown/missing_identity; new failing-first test "legacy records without identity keep PID-only liveness and report unknown identity". Files: codex-worker-shell.sh, launch.test.cjs, mailbox.cjs, worker.test.cjs. run.cjs, control.cjs (50fc48e1) and codex-executor.sh (d6bdb14a) untouched by the repair.
- v1 diff/manifest retained as 173-02-CANDIDATE-V1-*. v2 diff 173-02-CANDIDATE-SOURCE-DIFF.patch sha256 6f9eebf82ab892012e62b0e6a65e68d7f8bb832e7f2433d96cb5db9b84041635; hashes in 173-02-CANDIDATE-MANIFEST.sha256.
- Fable clean-environment verification of v2: worker.test 40 pass 0 fail; launch.test 24 pass 1 fail (board baseline); install.test 2 pass; `npm run test:codex-worker` tests 103 pass 100 fail 1 skipped 2 (only the board baseline; .planning/tmp/173-02-test-codex-worker-3.txt); git diff --check exit 0. The repair worker's two extra "codex-executor.sh line 112 Permission denied" self-test failures did not reproduce in Fable's clean shell (tracked mode 100644 is pre-existing at HEAD); recorded as worker-environment dependent, not a candidate defect.

## Candidate v3 after the ATC-directed repair (2026-09-15T21:53:06Z)
- Spec R3 (worker cc29c2c7, same thread) PASS 23/23 on v2 (report sha b463ef41, kept as 173-02-SPEC-REVIEW-REPORT.md).
- Per-dispatch ATC R1 (worker 87a68af7) timed out at 180 s (173-02-ATC-REVIEW-R1-TIMEOUT-REPORT.md); R2 finish on the same thread (worker 3abec1f0) returned BLOCK: FINDINGS 1 CRITICAL 1 PASS_RATE 9/10, mailbox.cjs:174 non-atomic fan-out check (report sha 98812398, kept as 173-02-ATC-REVIEW-REPORT.md until R3 replaces it). Repair taken under gates.yaml per-dispatch-ATC repair_instruction.
- ATC-repair worker dc77d9dd (report sha 9c0df576, exit 0): cross-process fan-out lock around count-and-publish, identity-safe stale rule (never reclaims an identity-matched live holder; 60 s bound only for unavailable/dead/mismatched identity; busy holder yields a named failure, never an overrun), new failing-first test "concurrent creates cannot exceed the inherited fan-out limit". Files: mailbox.cjs (d1af308c1eacb25e3ff6b4b194cccc69db698bfb561e5b579b64130d3583f097), worker.test.cjs (497d8e8bc1112cb5d2e48860bcdeedaf463325b702d008187ff41d5c47804dfb) only. v2 diff/manifest retained as 173-02-CANDIDATE-V2-*. v3 diff sha256 6d461c76ba3ce84ad76d8c42329c721e120f1f20437865780d5e281e05a8696c.
- Fable clean-environment verification of v3: worker.test 41 pass 0 fail; focused fan-out test 1/1; `npm run test:codex-worker` tests 104 pass 101 fail 1 skipped 2 (only the board baseline; .planning/tmp/173-02-test-codex-worker-4.txt); git diff --check exit 0.
- Intermittent note: "stopping an adapter cleans up its owned App Server process tree (child)" (retained regression, worker.test.cjs) failed once in the ATC-repair worker's direct suite run and once in Fable's first full run; it passed in every other execution (about 12). Recorded for reviewers; not fixed here.
