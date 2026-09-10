# 170-12 visible trial — verification and review

Status: DEPLOYED_VERIFIED; registered FULL ATC PASS. See the bounded
`170-12-VISIBLE-TRIAL-ACCEPTANCE.md` for actual schedules, transfer and preservation.

Scope is the approved visible-weekly-trial plan. No gate policy, worker bridge,
model roster, receiver implementation or credentials changed. Two independent
implementers owned monitor/exporter files; root owned cockpit/client/scheduling.
Source base: `e008fc5`.

## Independent SPEC and quality review

Monitor owner independently reviewed root UI/scheduler; exporter owner reviewed
monitor and root client/PowerShell/install. Root independently reviewed exporter.
Existing `workflows/atc-gate.md` seven steps and ten anti-slop points were used.
Initial reviews found real issues; they were not marked PASS until corrected:

- Nested malformed snapshots, invalid prior findings and unbounded output.
- Hidden native/receipt tail truncation and invalid canonical rows.
- Invalid daily state overwrite and false successful scheduler execution.
- Unsafe PID-only stale-lock reclaim (removed; fail-closed inspection required).
- Silent invalid-client-config fallback, future/unproven copy success and
  deadline overrun success.
- Sanitized registration size incorrectly constrained by original source length.

Independent final review: no remaining actionable blocker. Monitor is about 720 lines,
above the approximate 400–600-line preference; bounded metadata validation and
incident persistence account for the excess. No extra service or dependency was
introduced. Known limitations are documented rather than hidden.

## Executed checks

- Final native DEVCP candidate: **55/55** new monitor/export/client/schedule/UI
  tests passed with zero skips in the private copy
  `/home/jackberrow/.cache/atlas-visible-native-I74CVr`.
- Full native Atlas suite: **249 pass, 0 fail, 4 platform/opt-in skips** (253
  tests). Subsequent two small monitor safety refinements passed the final
  55-test native run above. One nested optional real-runtime test was not enabled.
- Initial full-suite shell lacked Node on PATH: existing launch/runtime tests
  failed, then passed when rerun with the actual installed Node directory on PATH.
- Windows monitor bundle: 52 pass/0 fail/1 Linux-only skip before final extra
  monitor fallback assertion; peer monitor+audit final: 32 pass/0 fail/1 skip.
- Node syntax checks, `git diff --check`, PowerShell parsing, and task installer
  `-WhatIf` passed. No task was installed by the dry run.
- Real exporter/client fixtures: verified WARN bundle copied once, repeat polls
  reused the verified receipt, later corrupt copy failed, prior good bundle
  independently verified intact. Missing/invalid config, future status, time
  budget and unrelated occupied listener tests passed.
- Real cockpit `/atlas` endpoint tested: GET 200/no-store, missing -> unknown,
  fresh WARN preserved. Nested malformed data cannot throw through the endpoint.
- Agent-browser rendered the actual UI at desktop and 390px; Atlas itself had
  no horizontal overflow, unsafe source text was escaped, and original event
  time stayed separate from receive time. These were labelled fixtures, not
  production capture evidence.
- Existing registered Playwright gate final: **PASS, 37 checks pass, 2 warn,
  0 fail** at 2026-09-10T12:04:15Z. Warnings concern existing phase-detail content.
  Earlier run against an empty fixture was invalid for full-cockpit expectations;
  the source-workspace run then identified existing 768px hotkey overflow.
  The unchanged 812px width after removing Atlas proved its origin. Two scoped
  CSS properties repaired it and the unchanged gate passed.
- Existing cockpit rationale drawer SAC-P142-03 remains a baseline failure:
  HEAD and working client render one card on the same snapshot. The full legacy
  cockpit suite is not claimed PASS; no unrelated expectation was weakened.

## Registered FULL ATC lane

First actual `codex-cli-reviewer` wrapper attempt failed at
`app_server_frame_limit` before producing a valid report. Worker
`bc1d7d3f-2b5f-43ad-898d-58b1c9569289`, thread
`01a08b2f-ca3b-7171-83c9-785eab759491`; evidence remains in the private copy.
No bridge limit, credential or gate was changed. One explicit bounded-read retry
uses the same registered provider/profile. Its result must be recorded below
before publication. No fresh board/model acceptance calls were made.

The bounded-read retry timed out after 180 seconds (including its clarification
wait), worker `7d1204f4-0a17-4526-955a-132a402604c4`. Its failure was retained in
the canonical review and gate-value ledgers. The same reviewer thread then
continued with a 300-second bound, reusing its inspection. Final worker
`064044ed-d380-45a9-8316-054b4ec257c6` completed in 292583ms, wrapper exit 0,
thread `01a08b34-0226-77a1-807d-c9e2d63eb9ea`, new turn
`01a08b38-7859-7850-bc20-fb74d15fdc95`. Its report:

```text
FINDINGS: none
CRITICAL: 0
WARNINGS: 0
PASS_RATE: 100
ONE_LINER: Atlas monitor/export/cockpit path stays fail-visible; no new correctness or security blockers found.
```

The final two-line audit-severity fix was explicitly steered into this ongoing
review, acknowledged as applied, and named in the final report's INFO findings.
The new regression was RED (WARN rather than FAIL) then GREEN. Thus deterioration
of a daily audit changes the incident/notification identity even amid other WARNs.
No gate/provider/timeout policy or source bridge limits were modified. Final
native usage for the review is unavailable (`native_request_usage_unobserved`);
do not estimate spend or treat this private review as production trial usage.

## Rollout gate

Completed: normal DEVCP update, installed hash match, minute cron checks, daily
real export, Windows scheduled pull, independent local bundle verification and
scoped protected-state/session/pin comparison. Evidence is in the acceptance file.
No weekly completeness, complete billing or old-session refresh claim.
