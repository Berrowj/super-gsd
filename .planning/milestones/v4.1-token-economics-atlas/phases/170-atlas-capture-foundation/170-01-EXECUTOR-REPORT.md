# P170 capture foundation — executor evidence

Date: 2026-09-07. Status: capture implementation verified in fixtures and DEVCP activated; formal release remains open.
Plan: 170-01-PLAN-LOCKED.md revision 4. No commit, push, production update,
production enablement, live provider event or weekly baseline is claimed here;
DEVCP activation evidence is recorded below.

## Implemented scope

- Strict typed nested content-free envelope, provider/session/event-kind identity,
  idempotent replays and once-only checksummed conflict evidence.
- Indexed bounded canonical storage, quota-reset partitions, immutable closed
  partition hashes, corruption refusal and independent pressure/recovery gaps.
- Native OTLP mapping preserves request failures/refusals and available stable
  identities. Missing identity is a coverage gap, never fabricated timestamp
  identity. Native metric observations are not added to request usage totals.
- Explicit checksum-pinned Collector/Prometheus installation, sanitization before
  buffering/disk, local endpoints, queue/spool/retention limits and runtime watcher.
- Linux process/port ownership, project-bound readiness, fail-open environment
  attachment, bounded quota spool with change/heartbeat sampling, unchanged
  status-line output and direct Claude argument/topology preservation.

Zero additional model calls are made by the telemetry runtime. Development
review/testing is separate from workload telemetry. No model/routing/gate/retry
policy or Claude prompt has been changed.

## Verification evidence

The new regression tests were written against reproduced prototype failures,
then repaired. Independent review additionally reproduced stale closed-partition
writers, unverifiable crash locks and malformed conflict recovery; each now has
a regression and checksummed/referenced recovery validation.

| Check | Observed evidence |
| --- | --- |
| Plan validator, `--mode load` | VALID, no errors |
| Linux store + receiver tests | Final parent rerun 30/30 PASS, zero skips/failures |
| Linux `SGSD_ATLAS_REAL_RUNTIME_TEST=1 node runtime.test.cjs` | Final parent rerun 16/16 PASS, zero skips/failures; quota p95 1.348 ms; stalled attachment added 663.356 ms; real pinned stack and monitor start/attach/stop tested |
| Project install contract `--case empty-module-tree-real-install` | PASS on Linux, including real install and stale-dependency update |
| Computed statusline dependency graph | Both quota-sampler.cjs and contract.cjs are present; manifest check current |
| Real pinned Collector → normalizer → JSONL → Prometheus | Final parent rerun 9/9 PASS, zero skips/failures, 37.4 seconds. Native request/tool/response-count/retry/compaction data and distinct token series verified with canaries; isolated fixture only |
| Flat global installation + installed enabled statusline | Final parent rerun via `run-self-test.cjs --case install-delivery`: 1/1 PASS, zero skips/failures, 66.0 seconds. Entire installer exits 0; installed Atlas file hashes match; two private quota rows; nonempty stdout unchanged |
| `git diff --check` | PASS at verification snapshot |

These are separate domain suites, not a substitute for the SGSD gates below.
Tests use disposable fixtures; synthetic token values are
never economics/baseline evidence. Real-stack tests are explicit opt-ins so the
ordinary test command does not download executables. Final runnable commands:

```sh
node --test --test-reporter=spec super-gsd/tools/telemetry-atlas/store.test.cjs super-gsd/tools/telemetry-atlas/receiver.test.cjs
SGSD_ATLAS_REAL_RUNTIME_TEST=1 node super-gsd/tools/telemetry-atlas/runtime.test.cjs
SGSD_ATLAS_REAL_STACK_TEST=1 node --test super-gsd/tools/telemetry-atlas/stack.test.cjs
node super-gsd/tests/install-contract/assert-install-contract.cjs --case empty-module-tree-real-install
node --test super-gsd/tools/telemetry-atlas/install.test.cjs
```

In total, the four Atlas domain runs above exercised 56 passing checks with no
skips. The existing project install contract separately passed. This count is
not an ATC/spec/release verdict. Syntax checks on every Atlas CommonJS file,
the computed hook manifest check, and `git diff --check` also passed after the
final source changes. No source has been committed or pushed.

The parent ran Linux commands through WSL, and the full stack case against
latest source copies in a separate `/tmp/sgsd-atlas-stack-fixture-B9C1Yjpp`
fixture on DEVCP. That path contains verification code, not a production install.

## Existing gate triage — not bypassed

Command actually invoked:

```sh
bash super-gsd/scripts/sgsd-muda-audit.sh 170 --project . --dry-run
```

At 2026-09-07T12:53:54Z it returned a failed audit: one FAIL, zero WARN.
`narrative_age_sec=1090256`, fail threshold 3600 seconds. The underlying
`.planning/metrics/narrative.md` last-write time was 2026-08-25T22:02:54Z.
Dry-run printed its proposed WASTE.md but did not publish it. Latest persisted
gate-value rows belong to earlier phases, not this phase; no P170 pass is inferred
from those historical ledgers. SGSD MCP gate tools were unavailable, so the
existing local gate and canonical files were used directly.

Recommended repair: resume the existing execution/review evidence workflow with
an honest current narrative, then rerun MUDA. Do not touch timestamps, suppress
the stale-narrative probe, or fabricate gate rows to force a pass. Formal spec
review, per-dispatch ATC, phase verification and release close remain unclaimed.

## Production blockers requiring operator direction

1. DEVCP canonical source is at
   `dd58adf520a67dc09a6e5c176d61d664203cb6f8` with four meaningful existing edits:
   `block-forbidden-write.cjs`, `enforce-allowed-files.cjs`, `log-tool-event.cjs`,
   `validate-stop-contract.cjs`. They change cwd-aware root resolution and
   stop-contract applicability. The existing updater requires a clean source.
   Preserve these changes; do not stash/discard/overwrite them automatically.
2. The existing `clarity-prometheus` container owns host port 9090. The proposed
   Atlas alternative is loopback 9091, subject to explicit operator agreement
   and a fresh availability check. No silent fallback or listener termination.
3. Existing `clarity` tmux panes contain active Codex sessions. No reset, restart,
   or interruption has been authorized to displace those sessions.

The approved DEVCP path is complete: existing hook changes were preserved, Atlas
uses loopback 9091, the global install exited 0, and lifecycle enable/start
reported healthy. A content-free calibration request reached the canonical
ledger; two installed statusline quota rows reached a reset partition with zero
private canary bytes. The currently running `clarity` session was deliberately
not reset; attach telemetry on the next fresh launcher with
`SGSD_ATLAS_STATE_DIR=$HOME/.local/state/sgsd/telemetry/atlas-clarity`. The
canonical source remains dirty by design, so a later updater must reconcile
those edits before any fast-forward operation.

Phase 169 remains parked, not closed. Phase 171 correlation and Phase 172 weekly
reporting remain pending. First deployed capture will be calibration; it is not
a full weekly window or an approved before/after comparison baseline.

## Model-routing switch update

The routing contract now uses a validated model catalog (`fable`, `astral`,
`opus`, `codex`) with independent defaults and allowlists for each
orchestrator, deliberation, execution, and lightweight role. The orchestrator
default is Fable; Astral can be selected per role through the resolver or the
corresponding `SGSD_MODEL_*` override. Focused model-routing and propagation
tests passed: 8 total, 0 failed, 0 skipped.
