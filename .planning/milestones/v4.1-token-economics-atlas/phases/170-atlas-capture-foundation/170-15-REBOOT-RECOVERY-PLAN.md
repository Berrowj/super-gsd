---
schema_version: 2
status: ACTIVE
phase: 170
plan: "170-15"
authorized_at: "2026-09-11"
authorization: "Operator approved the reboot recovery design and written specification, then instructed yeah go."
expected_ATC_tier: FULL
skip_gates: []
tasks:
  - id: T170-15-1
    agent: gsd-executor
    model: codex
    files_touched: [super-gsd/tools/telemetry-atlas/boot-identity.cjs, super-gsd/tools/telemetry-atlas/boot-identity.test.cjs, super-gsd/tools/telemetry-atlas/fleet.cjs, super-gsd/tools/telemetry-atlas/fleet.test.cjs, super-gsd/tools/telemetry-atlas/global.cjs, super-gsd/tools/telemetry-atlas/global.test.cjs]
    input_contract: "Existing private fleet claims, durable release receipts, receiver service/startup locks and Linux boot/process identity."
    output_contract: "Boot-aware ownership and receiver recovery never mistakes a reused PID for the previous owner, preserves obsolete-record evidence, and blocks unknown unsafe lock recovery."
    hypothesis: "A shared bounded boot-identity helper and existing ownership checks can safely distinguish prior-boot records without signalling unrelated processes."
    falsifier: "A same-boot live owner is stolen, legacy unknown lock deleted, PID reused across boots adopted, or concurrent stale-lock reclaim admits two owners."
    stop_rule: "RED before implementation; native and injected identity fixtures, existing fleet/global tests, independent spec then quality review. No live receiver mutation."
  - id: T170-15-2
    agent: gsd-executor
    model: codex
    files_touched: [super-gsd/tools/telemetry-atlas/workspace-recovery.cjs, super-gsd/tools/telemetry-atlas/workspace-recovery.test.cjs, super-gsd/tools/telemetry-atlas/global-store.cjs, super-gsd/tools/telemetry-atlas/global-store.test.cjs, super-gsd/tools/telemetry-atlas/global.cjs, super-gsd/tools/telemetry-atlas/global.test.cjs]
    input_contract: "Validated managed registrations/claims, current boot identity, existing handover/state references and explicit operator-selected workspace IDs."
    output_contract: "Durable bounded remembered list, explicit forget, migration of validated legacy claims, serialized recoverable restore receipts and immutable validated prior-run lineage."
    hypothesis: "Separating workspace intent from active claims allows reliable retries without treating process exit as forget or replaying work."
    falsifier: "Concurrent restore duplicates a provider, partial failure loses entries, missing project is silently dropped, invalid old run is attributed to a new one, or metadata copies prompts/secrets."
    stop_rule: "Failing-first real filesystem/concurrency/crash-stage fixtures; preserve existing accounting schemas and lifecycle. No extra provider dispatcher or automatic business resume."
  - id: T170-15-3
    agent: gsd-executor
    model: codex
    files_touched: [super-gsd/scripts/sg, super-gsd/scripts/sgsd-remote-tmux.sh, super-gsd/scripts/lib/atlas-session-owner.cjs, super-gsd/scripts/lib/atlas-session-owner.test.cjs, super-gsd/config/hook-manifest.json, super-gsd/tests/propagation/sg-shortcut.test.cjs, super-gsd/tests/propagation/owned-sessions.test.cjs, super-gsd/tests/propagation/reboot-recovery.test.cjs, super-gsd/tests/propagation/runtime-provenance.test.cjs, super-gsd/tools/telemetry-atlas/run-self-test.cjs, super-gsd/tools/telemetry-atlas/README.md, super-gsd/skills/sgsd-sessions/SKILL.md]
    input_contract: "Approved recovery APIs, canonical installed runtime, explicit TTY choice or CLI restore selection and unchanged source/pin provenance gate."
    output_contract: "First interactive sg after reboot offers restore all/selected/not now; explicit list/restore/forget support, detached paused restoration and truthful per-run coverage reporting."
    hypothesis: "Extending the existing shortcut and managed launcher delivers one restart path without losing ordinary current-terminal topology."
    falsifier: "No-choice or non-TTY invocation starts a provider fleet, restore also starts a duplicate local owner, stale vendor scripts win, or unobserved capture is labelled healthy."
    stop_rule: "Native isolated shell tests, focused and propagation suites, independent review and genuine required FULL ATC before intended-only publication and normal update."
semantic_acceptance_criteria:
  - input: "Two concurrent restores, changed boot with PID reuse, stale or unsafe locks, partial launch, missing project, corrupt state and source/pin mismatch."
    expected_outcome: "At most one active owner per canonical worktree; named blockers persist; no unrelated process stop, pin change, metadata deletion or false observation."
    verification_cmd: "node --test super-gsd/tools/telemetry-atlas/boot-identity.test.cjs super-gsd/tools/telemetry-atlas/workspace-recovery.test.cjs super-gsd/tests/propagation/reboot-recovery.test.cjs"
  - input: "Normal sg, changed-boot interactive offer, explicit selected restore, provider exit and explicit forget."
    expected_outcome: "Ordinary Claude remains in caller terminal; restore produces detached paused owners with new run IDs and prior-run/context references; exit keeps list and forget preserves project/evidence."
    verification_cmd: "node --test super-gsd/tests/propagation/sg-shortcut.test.cjs super-gsd/tests/propagation/owned-sessions.test.cjs super-gsd/scripts/lib/atlas-session-owner.test.cjs"
---

# Reboot-safe workspace recovery

Approved specification: `.planning/analyses/2026-09-11-sgsd-reboot-recovery-DESIGN.md`.
Execute continuously in the existing isolated linked worktree. Preserve unrelated
planning edits. Implementers do not commit, publish or mutate DEVCP production.
Root integrates only intended files after reviews. No actual reboot for testing.

## T1: identity and lock foundation

1. Add failing tests for cross-boot PID/start reuse, current-boot live/unknown
   processes, stale fleet/startup locks, concurrent reclaim and malformed/symlink
   metadata. Use real private temporary files plus injectable boot/process reads.
2. Add `boot-identity.cjs`: bounded Linux boot ID read and shared guarded lock
   identity/reclaim primitives. Persist boot ID for new records. Legacy records
   remain readable; absent boot ID is unknown, not proof of an old boot. Recovery
   requires existing dead-process proof for legacy metadata. Never kill by PID.
3. Integrate fleet claim identity/release and receiver startup/service paths.
   Serialize reclaim; revalidate lock identity immediately before removal and
   preserve obsolete-record receipt. Keep exact process/port/health verification
   for current-boot service transition. Update runtime dependency attestation.
4. Run fleet/global focused tests. Independent spec then quality review, repair
   demonstrated findings and retain failing evidence before T2.

## T2: durable intent and serialized recovery

1. Define `workspace-recovery.cjs` exports `remember`, `list`, `forget`,
   `restore` and boot-offer metadata, using validated options objects. Keep
   catalog independent of fleet claims; avoid require cycles. Only binding/finish
   or an explicit validated legacy migration records workspace intent.
2. RED tests exercise real persisted files, limits/ownership/symlinks, legacy
   migration, reference hashes, explicit forget, selected/all restore, concurrent
   attempts and interrupted release/reserve/tmux/bind stages. Launch via an
   injectable subprocess seam for unit tests, never a production alternate path.
3. Store canonical project ID/path, stable display/session preference, old run,
   known boot and bounded existing checkpoint/state/handover references/hashes.
   Do not store raw contents or arbitrary argv. Preserve entries when sources
   disappear. Snapshot cheaply on remember/finish/restore; no paid summaries.
4. Persist selected restore intent before release/launch, durable stage receipts
   after each transition and failure per entry. One private recovery lock covers
   serialized launches; lock identity uses T1 safety. Reconcile existing claims
   and pending transactions conservatively. Never steal pending live startup.
5. New `global.prepare` recovery option validates prior registration belongs to
   the exact real project before any fresh run. Add immutable previous-run and
   context-reference lineage to private registration or receipt; use existing
   schema-valid coverage/handoff fields, never synthetic request/token identity.
6. Reuse managed launcher with explicit installed dirs, `--greet --no-attach`,
   and validated recovery lineage. Successful command exit is not binding proof:
   verify exact project/run/provider/pane, bounded wait, otherwise pending/failed.
   Health/native/operational are separate, observed only from existing evidence.

## T3: operator and install integration

Integration notes after T1 review and T2 API design: recovery ticket IDs use
`recovery-UUID`, module CLI restore consumes repeated `--project-id` or `--all`,
and `global.prepare` accepts `restoreId` / CLI `--restore-id`. Prepared environment
carries SGSD_RESTORE_ID only after validation. Binding hook may remember using a
short catalog lock while restore holds its separate long coordinator lock. The
monitor's project rows include exact-run entries under `runs[]`, enabling native
attribution without treating project aggregates as new-session evidence.

Root prepared failing-first native shell-boundary tests (8 tests, 7 expected
failures) before shortcut changes and independently checked the skill additions.
T3 implementer owns sg, launcher, owner hook module/tests, propagation integration,
self-test selection and manifest. Existing root-authored README/SKILL additions
must be retained, with only actual CLI-contract corrections if necessary.
Full propagation exposed an existing runtime-provenance fixture's explicit fleet
copy list omitting the new boot helper. T3 includes this test-only closure update;
no provenance assertion or production gate is weakened.

1. RED shell scenarios for literal `sg` current-terminal, help, first changed boot
   offer with explicit all/selected/not-now choice, explicit list/restore/forget,
   non-TTY no-menu/no-default-fleet, and restore returns without local duplication.
   Proposed flags: `sg --sessions`, `sg --restore [all|ID,...]`,
   `sg --forget ID`; finalize exact parsing in tests/docs, no ambiguous paths.
2. Shortcut handles recovery before project discovery (works from home), passes
   canonical installed scripts/agents/source, and respects normal provenance.
   Shared launcher passes preferred tmux name/recovery context into prepared run
   and existing binding hook remembers only a verified managed owner. Do not
   automatically resume conversations or business work; greet carries references
   and explicit paused/approval-holds instruction only.
3. Extend hook closure/generated manifest and self-test enumeration. Update
   existing session skill and README with actual CLI, pending vs observed,
   explicit forget semantics and legacy/unsafe blocker remedies. Use applicable
   skill-authoring instructions and baseline/forward skill scenarios.
4. Run native isolated Linux focused suites and propagation; no production model
   canaries. Independent full spec then quality review and genuine FULL ATC via
   existing installed worker/gate writer. Fix material findings, retain outcomes.

## Publication and already-rebooted DEVCP recovery

Fresh inventory first: source, installed revision/pins, saved claims, boot ID,
sessions and service identities. No assumptions from Sept10 PIDs. Publish only
intended reviewed changes, use normal update on the five approved workspaces,
preserve private completed worker mailbox bytes if custody is needed for the
existing clean-source gate. No hand-editing pins or bypassing source provenance.

Recover SQL, Design, Quote, Email and DCE once if still dead and correctly
identified. Each fresh owner stays paused on its original business holds. Check
exact new run/project/process/pane, prior-run relation and real native delivery;
operational gaps and unexercised gates stay explicit. No retries/replays of
business operations, extra model probes or unrelated session/service stops.
Report installed/published revision, tests/ATC, restore results and blockers.
