# SGSD Codex Worker connection

SGSD host adapter for a two-way, local Codex App Server connection. Fable or any
owning orchestration unit starts the existing SGSD wrapper in the background,
services the project inbox, then validates the wrapper's final report normally.
The adapter never launches another Fable or changes the requested model.

## Runtime

`run.cjs` reads a bounded prompt from stdin and returns **only the completed
turn's final report** on stdout. Progress/control notices go to stderr. Use the
existing wrappers for real work: their scope checks, report validators, provider
circuit, Atlas registration and existing SGSD gates still apply.

Adapter arguments: `--project ROOT --workspace DIR --model MODEL --reasoning
EFFORT --timeout SECONDS --owner UNIT --role ROLE`. Workspace defaults to the
project root; it may also be a contained directory or a verified linked git
worktree with the same real git common directory. Operational state stays in
the original project's `.planning/worker-sessions/`, even for a linked worktree.
Phase/plan/step metadata comes from `SGSD_WORKER_PHASE`, `SGSD_WORKER_PLAN`,
`SGSD_WORKER_STEP`; Atlas correlation comes from `SGSD_RUN_ID`.

Every thread/turn explicitly requests full access and approval `never`. Threads
are retained (`ephemeral:false`); the effective model/permission response is
checked before work starts. Legacy `--ephemeral`, `--full-auto` and sandboxed
flags are rejected. Dynamic tools require experimental App Server support;
incompatible versions fail explicitly, without one-shot/model fallback.

On Windows, the adapter finds a native Codex executable or the official npm
JavaScript launcher. It does not interpolate prompts/arguments through a shell.
An explicit `.cmd`, `.bat` or `.ps1` override is rejected: set
`SGSD_CODEX_APP_SERVER_COMMAND` to a native executable or JavaScript entrypoint.
On WSL use native Linux Codex and Git. Linked-worktree checks prefer
`/usr/bin/git` on WSL when present, so a Windows Git shim on PATH cannot
misinterpret Linux paths. `SGSD_CODEX_APP_SERVER_ARGS` is a JSON array of
prefix arguments, primarily for isolated protocol fixtures. No auth changes.

## Supervisor commands

Choose the source runtime below, or the installed equivalent under
`~/.claude/tools/codex-worker/`. Keep the runtime and project consistent.

```bash
node super-gsd/tools/codex-worker/control.cjs status --project "$PROJECT" --owner "$UNIT"
node super-gsd/tools/codex-worker/control.cjs reply --project "$PROJECT" --worker "$WORKER" --request "$REQUEST" --text 'Answer from the approved plan'
node super-gsd/tools/codex-worker/control.cjs receipt --project "$PROJECT" --worker "$WORKER" --command "$COMMAND"
node super-gsd/tools/codex-worker/control.cjs steer --project "$PROJECT" --worker "$WORKER" --text 'Revised direction within the same scope'
node super-gsd/tools/codex-worker/control.cjs stop --project "$PROJECT" --worker "$WORKER"
```

Status exposes task metadata, `thread_id`, `turn_id`, pending questions/options
and bounded control receipts. `reply --text` answers a dynamic question or one
native question. For a native request containing multiple questions, answer
each exact `question_ids` entry with `--answers-json '{"q1":"first answer",
"q2":"second answer"}'`. Missing/extra keys or an ambiguous single answer fail.
Optional `--owner UNIT` on control mutations also checks the record's owner.

Control submission means **queued**, not delivered. Poll `receipt` or status's
`control_results`: `applied` means the host forwarded the reply/control (steer
also received an RPC acknowledgement), not that the model or task succeeded.
`rejected` names a stale/invalid target. `unconfirmed` means the task ended before
confirmation; do not silently resend. Observe the worker's subsequent state and
the wrapper exit/report before advancing. Duplicate reply publication is refused.

The worker calls `sgsd_ask_orchestrator({question,context})`; the host publishes
it and returns the supervisor's answer as that pending tool call's result. Native
user-input questions are also relayed with their choices. Unknown permission,
connector or secret-input requests are refused, never silently auto-approved.

## Ownership, recovery and limits

The UUID, resolved project, process instance, thread, active turn and request ID
bind the message. A pending question does not block other workers, but Fable must
poll while wrappers run: blocking on final output can deadlock the conversation.
After supervisor compaction, discover existing records and service their inbox;
do not spawn replacements for live workers or use Codex `--last`.

Resume a non-active recorded thread by setting `SGSD_WORKER_RESUME_ID` when
calling its existing wrapper (or explicit adapter `--resume-worker UUID`). Model
and effort must match. A per-thread exclusive claim prevents concurrent resume
through different historical records. The chosen workspace must still exist or
be an explicitly supplied, verified linked worktree. Retain the original final
report and use a fresh report path for each new wrapper attempt.

Normal timeout, stop, provider disconnect and failure paths clear ownership and
stop the owned App Server process tree. A hard-killed **adapter** can leave an
orphaned thread claim; resume then fails `worker_thread_already_claimed`. It is
not automatically stolen or deleted. An operator must investigate that exact
record/process before manual recovery. Cross-machine relay and unattended
supervisor restart are not implemented.

Limits: prompt 768 KiB; RPC frame/final report 1 MiB; pending RPCs 64; pending
questions 16; JSON records 128 KiB; answer 16 KiB; control messages 128 per worker;
visible control receipts all 128 permitted commands; project inventory 4096 entries. Default worker
deadline 1200 seconds, configurable 1–86400, including CLI prompt collection.
An input stream without EOF times out before any provider starts.
Exit 124 = timeout, 130 = interrupt,
other nonzero = failure/configuration error. Empty final reports are failures.

## Permissions and telemetry

Full access was explicitly requested for SGSD workers. They can access anything
available to the launching OS account; project IDs and advisory no-edit roles
are **workflow checks, not an OS security boundary**. Plan/allowed-file/report/
verification/release gates remain. Removing the sandbox does not grant new
business authority to delete evidence, deploy, purchase or contact others.

Project operational records contain bounded questions/replies and metadata.
Directories/files request private permissions (Windows inherits the account's
ACLs). Do not put secrets in questions. Raw prompts, provider events, code and
reasoning are not persisted by this adapter or copied to Atlas. Existing native
Atlas export configuration is forwarded, with `otel.log_user_prompt=false`.
Atlas is separate observability, never the worker message bus.

Normal Linux wrappers explicitly register `accountingSource: codex_rollout`.
The adapter snapshots the exact `opened.thread.path` before `turn/start`.
Existing files start at EOF. Native 0.153.2 can defer a fresh file and its date
directories: only the adapter's actual fresh-opening branch may snapshot that
absence and pin existing ancestor identities. After the turn ACK, the reader
opens that exact safely created file at offset zero; it never creates native
files/directories. Missing resume or null paths remain degraded, and a replaced
ancestor or disappearing opened file never becomes a new zero baseline.
The adapter binds only the acknowledged thread/turn, polls every 250 ms independently of
control replies, and performs bounded synchronous finalization before controlled
transport close. A disconnected/already-killed peer permits only a bounded
postmortem read, not a guaranteed provider flush. Timeout remains the original
deadline, including while initialize/thread-open/turn-start ACK is pending.
Synchronous setup is checked against that deadline before every startup request,
so delayed timer delivery cannot authorize a new turn after budget expiry.

Only standalone native `token_usage_record.payload.usage` is projected. Native
response IDs are preserved as `response_id`; HTTP `request_id` stays unknown.
Input/output/cache/reasoning fields and the provider's total are copied, not
derived: cached input and reasoning output are subsets, so never add them again
to input/output or blindly sum the Prometheus token-type series. Cumulative
turn/thread snapshots are ignored. Missing optional cache-write stays null.
The model is the returned **thread configuration**, not a provider-confirmed
per-response model; actual response model and current runtime version remain
unknown. A native completed response can be observed even if the worker later
fails or is interrupted; response completion does not prove worker success.
A logical failure arriving before a valid matching turn ACK still permits final
capture on the open transport; dead/finalized transport cannot restart capture.

Native records enter Atlas through the registered private spool, with stable
response deduplication and conflicting-payload evidence. Its source authority
makes that run's Codex OTEL metadata non-additive. Reader bytes, line buffers,
response index and retries are bounded; backpressure retains unread responses.
Missing paths/usage, limits, or delivery failure produce content-free capture
status/gaps without replacing the final report or true worker failure. Gaps go
to registered global project/root evidence; missing data is unknown, not zero.

Coverage is only this acknowledged worker thread/turn: no home/history scan,
internal child-thread coverage, or complete provider/billing reconciliation is
claimed. Cold resume excludes all pre-open history. Non-worker/manual runs keep
legacy accounting. Windows native rollout capture is not implemented and remains
OPEN_REQUIRED; Windows launchers do not opt into Linux-only authority.
`SGSD_ATLAS_DISABLED=1` prevents attachment and capture. The global installer
delivers the Atlas dependency closure beside both installed worker layouts.

## Verification

```bash
node --test super-gsd/tools/codex-worker/worker.test.cjs
# Opt-in: initialize the locally installed CLI, with no thread or paid model turn.
SGSD_WORKER_LIVE_INIT=1 node --test --test-name-pattern=local super-gsd/tools/codex-worker/worker.test.cjs
```

Fixtures launch real adapter/control processes with a fake App Server and
temporary project roots. They are not evidence of provider model availability.
Protocol reference: local codex-cli 0.153.4 generated schemas and the official
[Codex App Server documentation](https://learn.chatgpt.com/docs/app-server).
