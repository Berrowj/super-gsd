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
`pane_pid` and `codex` command, primary `rollout-*.jsonl` identity, idle
rollout state, exact empty composer, approval/copy/mode/dead guards, literal
recheck, and pointer-bound pre-Enter recheck. Any mismatch defers or fails
closed; no shell text, model call, or worker launch is available.

## Required config and identity pinning

Root writes one mode-600 JSON file. Every value below is required except the
optional native `window` field. Do not copy identity from an event payload.

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
  "bindings": [
    {"owner": "pm-delivery", "epoch": "<owner-epoch>", "kind": "managed_worker",
      "mailbox": {"project": "/absolute/pm-delivery-project", "worker_id": "<worker-uuid>", "instance": "<instance>", "thread_id": "<thread>", "turn_id": "<turn>"}},
    {"owner": "pm-automation", "epoch": "<owner-epoch>", "kind": "managed_worker",
      "mailbox": {"project": "/absolute/pm-automation-project", "worker_id": "<worker-uuid>", "instance": "<instance>", "thread_id": "<thread>", "turn_id": "<turn>"}},
    {"owner": "deploy", "epoch": "<release-owner-epoch>", "kind": "native_pane",
      "identity": {"pid": 1, "start": "<native-start>", "cwd": "/absolute/deploy", "runtime": "codex", "session": "<tmux-session>", "pane": "<pane-id>", "window": "<window-id>"}}
  ]
}
```

For managed rows, Root obtains the exact current record with the existing
mailbox `read/list` path and copies `project`, `worker_id`, `instance`,
`thread_id`, `turn_id`, and `owner`. For native rows, Root copies the current
`NATIVE-SESSION.json` and `RELEASE-OWNER.json` values and verifies the live
process/rollout/pane before writing the config. A changed owner epoch requires
a new binding and new event epoch; old bindings are never silently stolen.

Each source line is a bounded JSON object with exactly these fields:
`event_id`, `kind` (`question|return|ready`), `lane`, `plan`, `task`, `owner`,
`owner_epoch`, `source_path`, `source_sha256`, `observed_at`, `disposition`,
`next_action`, and, only for `wake_owner`, a short safe `pointer`. `question`
and `return` owners are `pm-delivery` or `pm-automation`; `ready` owner is
`deploy`. Sources are append-only and must end records with a newline.

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
Enter separately, with `Enter` withheld after any post-literal uncertainty.
Applied rows are retained in `state.receipts` with event ID, owner epoch,
route, applied time and wake count.

## Explicit hold and unsupported boundary

Root owns installation, service transition, identity refresh, runtime wake and
any cross-PM arbitration. This source does not perform those actions. The
current exact unsupported boundary is Windows native rollout discovery:
`durable-changed-return-runner.cjs` requires Linux `/proc` to prove the
primary `rollout-*.jsonl` for a native pane; the existing Windows process
identity adapter does not expose an equivalent supported rollout-FD mapping.
Windows native delivery therefore fails closed until Root supplies a reviewed
Windows rollout/guard adapter. Managed mailbox delivery remains independently
supported on platforms where the existing mailbox is available.
