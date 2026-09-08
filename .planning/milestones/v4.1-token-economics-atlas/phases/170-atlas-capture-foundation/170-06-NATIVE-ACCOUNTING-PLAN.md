---
phase: 170
plan: "170-06"
status: ACTIVE
authorized_by: operator
authorized_at: 2026-09-08
scope: DEVCP_LINUX_NATIVE_ACCOUNTING_AND_RECEIVER_TRANSITION
paired_plan: "170-05"
formal_phase_close: NOT_CLAIMED
windows: OPEN_REQUIRED
---

# Native usage accounting and receiver transition implementation plan

> Execute the operator-approved paired work using subagent-driven-development:
> one bounded implementation task at a time, independent specification then
> quality review. Do not pause to re-ask approval for the approved work. Native
> source evidence and decisions are in the 2026-09-08 native-accounting design.

**Goal:** Account genuine completed native Codex responses without duplicates or
fabricated identities, and ensure normal Linux updates load the new receiver.

**Architecture:** Exact-thread bounded rollout projection into existing private
Atlas spool/canonical ledger/audit; explicit owned same-port receiver transition.
No new provider call, proxy, always-running App Server or gate implementation.

**Tech stack:** Node 22+ built-ins, native Codex App Server/rollout, Bash updater.

## Task 1: Native response schema, projection and accounting authority

Files: new `super-gsd/tools/codex-worker/usage.cjs` and
`super-gsd/tests/codex-worker/usage.test.cjs`; existing Atlas `contract.cjs`,
`global-store.cjs`, `quota-sampler.cjs`, `global.cjs` registration/prepare wiring only, `server.cjs`
typed spool/native-health wiring only, `audit.cjs`; related Atlas
`store.test.cjs`, `global.test.cjs`, `receiver.test.cjs`, `audit.test.cjs`.

- [ ] Read actual release-source record/flush evidence and current code before
  implementing. Add RED tests for real-shaped per-response usage distinct from
  cumulative fields, native response identity and immutable source authority.
- [ ] Implement a pure allowlisted native projector plus bounded exact-file
  reader. Snapshot native path/offset before starting the current turn; read
  appended complete lines incrementally. No whole-home/session discovery.
  Validate file/owner/link/descriptor identity; reject changed/truncated paths.
  Bound bytes per poll, line bytes, per-turn response index and retry queue.
- [ ] Project only current acknowledged thread/turn `token_usage_record` usage.
  Extend canonical identity with true `response_id` and native thread/turn fields;
  keep request ID unknown. Explicitly label model as thread configuration.
  Missing optional cache-write is null; only safe integer observed fields count.
- [ ] Make new source IDs stable by native provider response, with old source
  hashing byte-compatible. Replays with unchanged payload are duplicates; changed
  usage or attribution conflicts. Test store reconstruction/replay and distinct
  response IDs in a single turn. Existing audit also catches cross-project reuse.
  Native spool filenames must distinguish conflicting payloads for the same
  response so a pending first observation is not overwritten before ingestion.
- [ ] Register rollout authority only for new worker runs that actually use the
  adapter. Suppress additive OTEL usage for those registrations without rewriting
  old ledgers or changing legacy registrations. Provider/role/project authority
  still comes from registration; strict source/schema checks at spool and direct
  ingestion must reject forged/mismatched accounting envelopes.
- [ ] Extend existing spool drain and native-request health observation honestly.
  Extend audit to recognise real native completed response IDs, without claiming
  HTTP request identity or complete coverage. Keep quota, gap and integrity WARNs.
- [ ] Tests: split/truncated/oversized lines; privacy canaries in all ignored
  record types; missing path/usage/identity; invalid numbers; wrong thread/turn;
  old resumed/fork history; repeated scans/restarts; duplicate/conflicting IDs;
  bounds and spool failures; source authority in both arrival orders; existing
  ledger compatibility; cross-provider and cross-project attribution rejection.
- [ ] Run focused native Linux worker-usage and Atlas tests, then full Atlas
  suite. Record RED/GREEN counts/skips; review and commit only task-owned files.

## Task 2: Adapter lifecycle and installed closure

Files: `super-gsd/tools/codex-worker/run.cjs`, usage module/tests as needed,
`super-gsd/tools/codex-worker/worker.test.cjs` and its existing fake peer,
`super-gsd/tests/codex-worker/install.test.cjs`,
`super-gsd/scripts/lib/atlas-shell.sh` and only accounting-authority call arguments
in the three Codex wrappers, installer closure only if required,
`super-gsd/tools/codex-worker/README.md`, Atlas README and root `package.json`
test script only if the existing test glob does not include the new tests.

- [ ] First RED: native-shaped fake peer writes durable usage before completion;
  actual adapter currently emits no canonical observation. Exercise real mailbox,
  RPC, final report validation and spool boundary, mocking only provider exchange.
- [ ] Establish source baseline after verified thread open and before turn/start;
  bind acknowledged thread/turn, collect periodically and before `rpc.close()` on
  normal/failed/interrupted/timeout paths. Keep the existing bounded deadline and
  process-tree termination; no extra model call or delayed timeout allowance.
- [ ] Missing capability or capture error is visible content-free degradation,
  never fabricated usage or a replacement for worker outcome. Reroute must not
  falsely claim configured model as provider-reported per-response model.
- [ ] Verify multiple responses, one missing usage, response before subsequent
  failure, cold resume excluding old history, early notifications, final flush,
  timeout and full-access/never/retained-thread invariants. No raw-event opt-in.
- [ ] Ensure normal installed wrappers pass the immutable accounting authority
  at registration and install the complete new dependency closure. Existing
  non-worker/manual Codex paths remain honestly legacy/partial, not silently
  advertised as using a reader they do not run.
- [ ] Run full worker, board, model-routing and Atlas suites on native Linux;
  installed empty-tree smoke must exercise the new module. Document source,
  response-versus-request identity, subsets, provenance and incomplete coverage.
  Review and commit task-owned paths.

## Task 3: Owned Linux receiver revision transition

Files: `super-gsd/tools/telemetry-atlas/global.cjs`, `server.cjs`, new minimal
runtime fingerprint/transition helper(s) if needed; `global.test.cjs`,
`receiver.test.cjs`; `super-gsd/scripts/sgsd-update.sh`,
`super-gsd/tests/propagation/sgsd-update-contract.test.cjs`, Atlas README.

- [ ] RED: show installed-file replacement leaves old loaded runtime healthy;
  current update lacks a same-port transition before project pin publication.
- [ ] Implement immutable loaded closure fingerprint and eagerly loaded native
  normalizers. Reuse existing Linux process identity/port ownership functions.
  Match exact argv/executable/root, service/health instance, and three ports.
- [ ] Implement explicit `restart --if-running`, disabled/absent no-op, shared
  startup lock, durable private journal before signal, unchanged endpoint binding,
  bounded drain and replacement verification. Ordinary launch must respect a
  pending transition and may not silently replace a healthy stale process.
- [ ] Legacy-record adoption requires live identity/health/all-port proof and
  labels old revision unknown. Recheck process identity immediately before signal.
  Never use PID-only kill, random-port fallback, foreign listener termination,
  run re-registration, spool/ledger cleanup or Fable/Codex pane restart.
- [ ] Preserve journal/ownership across requester crash, delayed child and failed
  replacement; explicit retry reconciles recorded identities. Log content-free
  downtime gap. Do not promise exporter losslessness or persistent metric memory.
- [ ] Wire installed Linux update after successful install/revision checks and
  before project pin/complete output. Failure leaves project pin unchanged;
  `--check` and `--no-install` never invoke transition. Do not edit Windows updater.
- [ ] Tests: stable URLs/run IDs/old endpoint after replacement; queued event
  survival/dedup; competing launch/restart; requester crash/timeout and recovery;
  PID reuse/impostor/port takeover; disabled/absent; fingerprint immutability;
  drain/partial bind cleanup; updater ordering/failure and unchanged pin.
- [ ] Run relevant native Linux tests plus complete Atlas and propagation
  contracts. Review specification then quality, fix findings and commit.

## Task 4: Combined verification, publication and bounded live acceptance

Files: executor reports, state and benchmark evidence pointers under `.planning/`.

- [ ] Record source tests, skip reasons, both review stages and known limitations
  in `170-05-EXECUTOR-REPORT.md` / `170-06-EXECUTOR-REPORT.md`. No phase gate claim.
- [ ] Run combined native Linux worker/board/routing/Atlas/propagation/installation
  checks freshly. Windows performance remains OPEN_REQUIRED, not a Linux skip PASS.
- [ ] Read upstream/source/worktree status. Publish normally with no force push;
  run normal DEVCP updater only from the already approved Clarity project. Prove
  source/install hashes and loaded receiver fingerprint/unchanged endpoints.
  Preserve all old panes/configs and all other project pins.
- [ ] Create one fresh normal-launcher Fable session and run unchanged B0-B7 only
  after B0 passes. Max five live wrapper attempts, 180 seconds each, 20 minutes
  live total. No source edits during benchmark, extra paid probes or retries.
- [ ] Retain prior failed report unmodified. Separate bridge acceptance, observed
  native capture and global installation/fleet freshness verdicts. Missing data
  stays unknown. If live failure occurs, retain exact evidence and remaining work;
  do not silently expand budget, bypass gates or claim all instances current.
