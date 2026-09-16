# Root one-time installation packet: durable changed-return watcher

This packet is for Root review and one-time installation only. The source
writer does not run it. It does not install, restart, activate, or send live
input during source acceptance.

## Executable and supported transports

Run the repository Node 22 executable:

```text
node super-gsd/tools/telemetry-atlas/durable-changed-return-runner.cjs --config /absolute/path/to/durable-return-watcher.json
```

Managed destinations call the existing
`super-gsd/tools/codex-worker/mailbox.cjs` `submit(..., 'steer', ...)` and
`receipt(...)` functions. Native destinations use the runner's strict
no-shell `tmux` transport: exact PID/start/cwd/session/pane membership,
`pane_pid`/`pane_start` and `codex` command, primary `rollout-*.jsonl` identity, idle
rollout state, exact empty composer, approval/copy/mode/dead guards, literal
recheck, and pointer-bound pre-Enter recheck. Any mismatch defers or fails
closed; no shell text, model call, or worker launch is available. Successful
native literal/Enter is `delivered`/`awaiting_ack`; it becomes `applied` only
after an exact intake claim matches event ID, owner epoch, native PID/start and
thread. On Linux it also requires the native process to remain descended from
the pinned pane shell; pane-shell start and native process start are separate
identity fields.

## Required config and identity pinning

Root writes one mode-600 JSON file. Every value below is required except the
optional native `window` field. Native `thread` and `intake_path` are required
for an applied receipt. Do not copy identity from an event payload.

```json
{
  "schema_version": 1,
  "root": "/absolute/harness/root",
  "state_path": "/absolute/harness/root/.planning/atlas/durable-return-watcher.json",
  "poll_ms": 8000,
  "sources": [
    {"path": "/absolute/pm-delivery/DURABLE-RETURN-EVENTS.jsonl", "sha256": "<64-hex-source-registration-hash>", "lane": "pm-delivery"},
    {"path": "/absolute/pm-automation/DURABLE-RETURN-EVENTS.jsonl", "sha256": "<64-hex-source-registration-hash>", "lane": "pm-automation"},
    {"path": "/absolute/deploy/DURABLE-RETURN-EVENTS.jsonl", "sha256": "<64-hex-source-registration-hash>", "lane": "deploy"}
  ],
  "producers": [
    {"type": "mailbox", "project": "/absolute/pm-delivery-project", "workerId": "<worker-uuid>", "owner": "pm-delivery", "ownerEpoch": "<owner-epoch>", "lane": "pm-delivery", "outputPath": "/absolute/pm-delivery/DURABLE-RETURN-EVENTS.jsonl", "plan": "<existing-plan>", "task": "<existing-task>"},
    {"type": "ledger", "inputPath": "/absolute/pm-delivery/existing-response-ledger.jsonl", "outputPath": "/absolute/pm-delivery/DURABLE-RETURN-EVENTS.jsonl", "lane": "pm-delivery", "sourceOwner": "pm-delivery", "route": "pm_to_root", "owner": "root", "ownerEpoch": "<root-epoch>"},
    {"type": "ledger", "inputPath": "/absolute/deploy/EVENTS.jsonl", "outputPath": "/absolute/deploy/DURABLE-RETURN-EVENTS.jsonl", "coordinationDir": "/absolute/deploy", "lane": "deploy", "sourceOwner": "deploy", "route": "deploy_to_pm", "owner": "pm-delivery", "ownerEpoch": "<pm-epoch>", "plan": "<existing-plan>", "task": "<existing-task>", "defaultKind": "return"},
    {"type": "inbox_directory", "inputDir": "/absolute/root/inbox", "outputPath": "/absolute/root/DURABLE-RETURN-EVENTS.jsonl", "lane": "root", "sourceOwner": "root", "route": "root_to_pm", "ownerEpochByOwner": {"pm-delivery": "<pm-delivery-epoch>", "pm-automation": "<pm-automation-epoch>"}, "plan": "<existing-plan>", "task": "<existing-task>"},
    {"type": "native_primary", "inputPath": "/absolute/codex/sessions/rollout-<registered>.jsonl", "outputPath": "/absolute/pm-delivery/DURABLE-RETURN-EVENTS.jsonl", "lane": "native-harness", "sourceOwner": "native.<registered-thread>", "owner": "pm-delivery", "ownerEpoch": "<pm-epoch>", "plan": "<existing-plan>", "task": "<existing-task>", "primary": true, "identity": {"pid": 1, "start": "<native-start>", "pane_pid": 2, "pane_start": "<pane-start>", "cwd": "/absolute/harness", "runtime": "codex", "session": "<tmux-session>", "pane": "%<digits>", "window": "@<digits>", "thread": "<registered-thread>", "intake_path": "/absolute/harness/NATIVE-INTAKE.jsonl"}}
  ],
  "bindings": [
    {"owner": "pm-delivery", "epoch": "<owner-epoch>", "kind": "managed_worker",
      "mailbox": {"project": "/absolute/pm-delivery-project", "worker_id": "<worker-uuid>", "instance": "<instance>", "thread_id": "<thread>", "turn_id": "<turn>"}},
    {"owner": "pm-automation", "epoch": "<owner-epoch>", "kind": "managed_worker",
      "mailbox": {"project": "/absolute/pm-automation-project", "worker_id": "<worker-uuid>", "instance": "<instance>", "thread_id": "<thread>", "turn_id": "<turn>"}},
    {"owner": "root", "epoch": "<root-epoch>", "kind": "native_pane",
      "identity": {"pid": 1, "start": "<native-start>", "pane_pid": 2, "pane_start": "<pane-start>", "cwd": "/absolute/root", "runtime": "codex", "session": "<tmux-session>", "pane": "%<digits>", "window": "@<digits>", "thread": "<thread>", "intake_path": "/absolute/root/NATIVE-INTAKE.jsonl"}},
    {"owner": "deploy", "epoch": "<release-owner-epoch>", "kind": "native_pane",
      "identity": {"pid": 1, "start": "<native-start>", "pane_pid": 2, "pane_start": "<pane-start>", "cwd": "/absolute/deploy", "runtime": "codex", "session": "<tmux-session>", "pane": "%<digits>", "window": "@<digits>", "thread": "<thread>", "intake_path": "/absolute/deploy/NATIVE-INTAKE.jsonl"}}
  ]
}
```

For managed rows, Root obtains the exact current record with the existing
mailbox `read/list` path and copies `project`, `worker_id`, `instance`,
`thread_id`, `turn_id`, and `owner`. For native rows, Root copies the current
`NATIVE-SESSION.json` and `RELEASE-OWNER.json` values and verifies the live
process/rollout/pane before writing the config. A changed owner epoch requires
a new binding and new event epoch; old bindings are never silently stolen.

The executable invokes the declared producers before each bounded watcher
poll. `mailbox` producers project existing pending worker questions and
`wrapper-result.json` returns. `ledger` producers incrementally map existing
PM response and Deploy ready/result JSONL rows. The actual Deploy shape
(`at,event,request,repository,accepted_chain,required_services,action,receipt`)
uses `request` as the stable event ID, `at` as timestamp, and resolves
`receipt` below the declared Deploy coordination directory before hashing it;
`action` is never relayed. The dynamic `inbox_directory` producer discovers
new JSON files under Root `inbox`, accepts either `source_hash` or
`source_sha256` and `question`/`result` or `question_or_result`, derives only
bound PM owners, and emits pointer-only `root_to_pm` returns. Malformed or
unbound files are skipped without blocking valid siblings; durable seen IDs
prevent replay.

The `native_primary` producer accepts only a census-registered primary
rollout whose bounded `session_meta` header has `source=cli`,
`originator=codex-tui`, `thread_source=user`, exact registered cwd and
rollout/thread ID. It verifies the registered native PID/start/cwd before
reading from a durable byte cursor, ignores subagent/other records, and maps
only structured `task_complete`, approval, or `request_user_input` records.
Each emitted event has the actual record timestamp, stable event/turn ID, a
rollout path pointer and a hash of the compact record evidence; it never hashes
or rereads the whole transcript and never copies assistant prose.

The retained native shell ancestry is pinned independently. The current
Linux census examples are DCE `%8` (pane PID `2908759`, native PID `3410299`),
Opps `%0` (`2906284` → `3413253`), Email `%12` (`2935274` → `918077`), and
SQL `%16` (`2936262` → `3417853`). Root must refresh start times and ancestry
at installation; these values are evidence of the distinct pane/native shape,
not permission to wake a pane.

Each source line is a bounded JSON object with exactly these fields:
`event_id`, `kind` (`question|return|ready`), `lane`, `plan`, `task`,
`source_owner`, `route` (`native_to_pm` is the registered-primary-to-PM route), `owner`, `owner_epoch`, `source_path`,
`source_sha256`, `observed_at`, `disposition`, `next_action`,
`artifact_path`, `artifact_sha256`, and, only for `wake_owner`, a short safe
`pointer`. Supported routes are `worker_to_pm`, `pm_to_root`, `root_to_pm`,
`pm_to_worker`, `pm_to_deploy`, `deploy_to_pm`, and `deploy_to_root`; each is
validated against the source/target ownership relationship and exact binding.
Sources are append-only and must end records with a newline.

## Bounded scheduler and one-time command sequence

1. Root verifies the config and source hashes, then runs the no-wake check:

   ```text
   node super-gsd/tools/telemetry-atlas/durable-changed-return-runner.cjs --config /absolute/path/to/durable-return-watcher.json --check
   ```

2. Root supervises exactly one long-lived invocation of the executable above.
   Its internal scheduler clamps `poll_ms` to 1–60 seconds (the packet default
   is 8 seconds), uses an exclusive lock at `<state_path>.lock`, and refuses a
   second instance. The scheduler timer is intentionally referenced, so a
   normal CLI remains alive even when no source or transport handle is open;
   `--once` is available only for a controlled single poll.

3. Root records the runner PID/start and config SHA in its existing service
   ledger. No second watcher, queue, launcher, hook, or model loop is added.

The focused normal-run proof starts the exact executable with an empty declared
source, confirms the child remains alive after its first poll with no unrelated
handle, then sends only SIGTERM and confirms the lock is released. A `--check`
or `--once` result alone is not a liveness or daemon-readiness claim.

## Cursor, acknowledgement, restart and applied receipt

The watcher atomically writes `state_path` after every complete source line.
It stores per-source device/inode, stable prefix hash and byte cursor; a
rewrite, truncation, symlink, malformed line, or source mismatch is visible
and never wakes. Per-event key is `event_id|owner|owner_epoch`; payload
alteration under an existing event ID is an integrity conflict. A prepared
managed/native send is recovered as uncertain unless the existing mailbox
receipt or an explicitly provided reconciliation hook proves applied; it is
never replayed blindly. Managed receipts remain `acknowledged` until
`mailbox.receipt` returns `applied`. Native delivery records literal and
Enter separately, remains `awaiting_ack` after Enter, and requires the bound
native intake claim before `applied`; `Enter` is withheld after any
post-literal uncertainty.
Applied rows are retained in `state.receipts` with event ID, owner epoch,
route, applied time and wake count.

## Explicit hold and unsupported boundary

Root owns installation, service transition, identity refresh, runtime wake and
any cross-PM arbitration. This source does not perform those actions. The
Codex-only adapter also does not claim Claude-owned lanes: Design `%4` and
quote diagnosis `%57` remain their existing Claude/native external-hold or
completed lanes, with existing owner handling unchanged. The current exact
unsupported boundary is Windows native rollout discovery:
`durable-changed-return-runner.cjs` requires Linux `/proc` to prove the
primary `rollout-*.jsonl` for a native pane; the existing Windows process
identity adapter does not expose an equivalent supported rollout-FD mapping.
Windows native delivery therefore fails closed until Root supplies a reviewed
Windows rollout/guard adapter. Managed mailbox delivery remains independently
supported on platforms where the existing mailbox is available.
