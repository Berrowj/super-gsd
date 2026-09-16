# 173-02 accepted candidate packet (v3)

Frozen 2026-09-15T22:00:02Z by the Harness Fable supervisor (unit fable.harness.20260915) under Root/PM2 go order ROOT-HARNESS-17302-IMPLEMENTATION-GO.md (sha256 5f8a9e34...). Base HEAD f3e89f7677d929387daa261d781122c70a9e3bfb. Plan 173-02 sha256 9514b40cef2ab9f3e9218d4acf99a321352bdeaa7ed4d4e272175db1d8b2164b, plan check 3cbf3345 PASS 5/5.

## Candidate bytes (v3)
Diff 173-02-CANDIDATE-SOURCE-DIFF.patch sha256 6d461c76ba3ce84ad76d8c42329c721e120f1f20437865780d5e281e05a8696c; per-file hashes in 173-02-CANDIDATE-MANIFEST.sha256:
- 6ef97576de0efea1af284b084faa2ffd4d4954cbdfa4fe1a239e3a69cf007549  super-gsd/tools/codex-worker/run.cjs
- d1af308c1eacb25e3ff6b4b194cccc69db698bfb561e5b579b64130d3583f097  super-gsd/tools/codex-worker/mailbox.cjs
- 497d8e8bc1112cb5d2e48860bcdeedaf463325b702d008187ff41d5c47804dfb  super-gsd/tools/codex-worker/worker.test.cjs
- 9c54f7c62878ba63306b15ef6fc73e7242deac21910d1fc62cc7c4495a5430e9  super-gsd/scripts/lib/codex-worker-shell.sh
- 2dbacef60aa77f022dcc8d2bdec723e24adfc348bb332a4ff0450a472973cd3b  super-gsd/tests/codex-worker/launch.test.cjs
- 6d461c76ba3ce84ad76d8c42329c721e120f1f20437865780d5e281e05a8696c  .planning/milestones/v4.2-agent-harness/phases/173-delivery-evidence/173-02-CANDIDATE-SOURCE-DIFF.patch
Unchanged: super-gsd/scripts/codex-executor.sh d6bdb14a768bfb76a631b4fa82a8c53bd573aeadea0921115f0bf2d3106697c8, super-gsd/tools/codex-worker/control.cjs 50fc48e18425acd2b6af84fe80f81dc36cd9fb1f82333bdfba2f92b9e0638a0b. Earlier candidates retained: 173-02-CANDIDATE-V1-* (after T3), 173-02-CANDIDATE-V2-* (after Spec repair).

## Independent reviews on exactly these bytes
- Spec: R1 a99a8fd5 timed out 180 s (preserved); R2 04556717 FINDINGS 2 (CRITICAL 1, WARNING 1) on v1; repair aa1da77c; R3 cc29c2c7 PASS 23/23 on v2; R4 0e897d98 PASS 24/24 focused on the v2 to v3 delta. All on thread 01a0a6e9-b69e-7413-a660-9c430d02148d. Final report 173-02-SPEC-REVIEW-REPORT.md sha256 71970e5fce780fa072f2993fb614b4784878088e5771741d3d69e0b0f5e1d861.
- Per-dispatch ATC (gates.yaml per-dispatch-ATC, code-reviewer-v1, gpt-5.6-terra/xhigh): R1 87a68af7 timed out (preserved); R2 3abec1f0 BLOCK CRITICAL mailbox.cjs:174 fan-out race on v2; gate-directed repair dc77d9dd; R3 ddd60468 timed out (preserved); R4 b8bfb8c9 PASS 10/10 on v3. All on thread 01a0a6fd-4c92-7333-8365-e77e57e7e07d. Final report 173-02-ATC-REVIEW-REPORT.md sha256 dfd83041a0f97dce4bbf734665befb0f19dbd16db0bdbf503d554e16463e8d39.
- Every wrapper-result.json (exit 0, report sha/bytes, thread, attempt) was checked before its report was consumed; records under .planning/worker-sessions/.

## Executors (all gpt-5.6-terra/xhigh, registry sha256 a947462a91359ef08d023e6b2a6224a7bd132631a344211043e11d787a5fc82a, dry-run ok:registry each time)
T1 cdd49623 (report 57225214), T2 8409ee53 (29f988c5), T3 0fb17be7 (fd02a722), Spec repair aa1da77c (ea0ce650), ATC repair dc77d9dd (9c0df576). Mailbox decisions relayed by Fable: T3 legacy reply gains fixture owner; repair continues non-mutating checks; identity-matched live lock never reclaimed, busy yields named failure.

## Local verification of v3 (Fable, clean environment)
worker.test.cjs 41 pass 0 fail 2 skip; install.test.cjs 2 pass; launch.test.cjs 24 pass 1 fail; `npm run test:codex-worker` tests 104 pass 101 fail 1 skipped 2; git diff --check exit 0. The single failure, "board wrapper pauses for its exact worker reply before validating the completed board report", also fails on a pristine HEAD export and is pre-existing. Intermittent: "stopping an adapter cleans up its owned App Server process tree (child)" failed 2 times in about 14 executions across worker and Fable runs, never in isolation; recorded, not fixed. Details in 173-02-LOCAL-EXECUTION-EVIDENCE.md.

## Retained gaps and non-claims
Native Windows dispatch remains an explicit unsupported-platform gap. Not installed, not published, not deployed; no live business action; phases 174-179, Atlas 171/172 and the later live-PM duty plan untouched. Root owns reviewing this packet and any install/publication.
