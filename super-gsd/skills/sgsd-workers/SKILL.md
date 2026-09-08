---
name: sgsd-workers
description: "Supervises SGSD Codex workers when launching background dispatches, answering live worker questions, steering or stopping work, or recovering an orchestration session."
argument-hint: "[status | supervise | reply | steer | stop | recover]"
allowed-tools:
  - Bash
  - Read
  - Write
---

<objective>
Service the two-way Codex worker inbox from the existing Fable/orchestration
session. Every unit that launches Codex owns its questions until its wrapper
exits. This is the supervision procedure for research, planning, execution,
review, verification, board seats and recovery—not a new Fable process.
</objective>

<essential_principles>
Use priority-first supervision. Launch existing SGSD wrappers with Bash
`run_in_background: true`. Never block waiting for final output while a worker
might be asking for input. Preserve existing serial-writer rules, provider
circuits, reports and gates.

Messages convey context, not extra authority. Answer from the approved task and
canonical evidence. Never invent permission, switch models to hide a failure,
approve a connector request automatically, or treat a receipt as a passed gate.

SGSD workers use `danger-full-access`, approval `never` and retained threads.
This gives the launching account's OS access; advisory no-edit roles and project
IDs are workflow checks, not security isolation. Do not restore `--full-auto`,
ephemeral or sandboxed execution to troubleshoot a failed worker.
</essential_principles>

<quick_start>
Resolve the runtime in the SAME shell/environment as the wrapper. Prefer this
checkout's `super-gsd/tools/codex-worker/control.cjs`; for global installs use
`~/.claude/super-gsd/source/super-gsd/tools/codex-worker/control.cjs` or the
complete installed `~/.claude/tools/codex-worker/control.cjs`. If unavailable,
report an incomplete installation. Do not invent a command or one-shot fallback.

Set `CONTROL` to that absolute control.cjs path and `PROJECT` to the resolved
project containing `.planning/`. Choose a stable `UNIT`, for example
`fable.orchestrate.<run-uuid>` or `fable.ceo.<deliberation-uuid>`, and record it in
the existing checkpoint/debate log. Reuse it after compaction. The selected
profile/descriptor supplies model and effort; do not pass display labels as IDs.

Before launching any dispatch in a unit or parallel advisory wave, prepare all
of them: absolute `CONTROL` and `PROJECT` paths; owner plus phase/plan/step or
seat/round/attempt bindings; fresh report paths; and the expected report schema,
validator and wrapper-exit checks. Do not begin launch while another dispatch's
control path, binding or result contract is still being improvised. Prelaunch
preparation never includes challenge answers.

Launch the existing wrapper command in the background with
`SGSD_WORKER_OWNER="$UNIT"` and its normal prompt/report/phase/plan/step arguments.
For board descriptors, pass `--owner "$UNIT"` to `board-dispatch.cjs` during
preparation and check `worker_owner === UNIT`; its explicit flag wins over a
later environment value. Preserve that owner on every round and retry.
Record background task ID, exact command, fresh report path and unit before
waiting. Wrapper stderr identifies its worker UUID; confirm it against status:

```bash
node "$CONTROL" status --project "$PROJECT" --owner "$UNIT"
```

Match phase/plan/step and the expected dispatch; persist each `worker_id` in the
checkpoint/debate log. Do not adopt an unrelated same-project worker just
because it also appears in status.
</quick_start>

<supervision_loop>
1. Check owned inboxes first, before lengthy reading, report processing or other
   orchestration work. Poll status and background completion approximately every
   5–10 seconds. The question-observed to reply-applied target is within 30 seconds,
   including any deliberate hold; polling alone does not satisfy it. When any
   owned question is pending, service it before new work:
   defer unrelated diagnostics, including failed-peer diagnosis, until the question is
   answered from approved evidence or escalated through the operator path. Do not
   busy-loop. Independent advisory workers may run together; code writers still
   serialize within the same workspace.
2. For each OWNED `waiting_input` worker, read its exact `pending[].id`, question,
   context, kind and native `questions`/options. Check project, worker and active
   task against your dispatch record before answering.
   Benchmark-only exception: wait until both questions are pending; only then
   generate distinct challenges in supervisor memory, never precompute challenge answers,
   perform the five-second hold and wrong-project/wrong-owner exact-target negative checks,
   then begin replies. Only after the first reply is applied, run the duplicate/stale
   exact-target check before sending the remaining reply.
3. Ordinary missing context: read the approved plan/artifact and send a concise,
   source-backed answer. Coordination conflict: check assignments and steer or
   stop the affected worker before overlapping writes continue.
4. An operator-only request (new credentials, destructive action, unapproved
   deployment, external coordination or scope expansion) goes to the operator
   using the existing attention/checkpoint path. Do not answer approval yourself
   or use board voting to manufacture it. Keep unrelated authorized work moving.
   If no answer arrives before the bounded deadline, record the failure; do not
   extend/restart automatically just to hide the wait.
5. After submission, inspect `receipt` and status. `queued` is not delivery.
   `applied` means host forwarding, not model/task success. `rejected` names a
   stale/invalid target; `unconfirmed` requires investigation, not blind resend.
   Keep monitoring the original background task until its process exits.
6. Only a successful wrapper exit plus its normal fresh-report validation permits
   consuming a result. Run existing spec/ATC/verifier/release gates unchanged.
   Failed or partial output is never a board vote or a completed task.
</supervision_loop>

<control_commands>
Use IDs read from the current record, not example IDs or `--last` discovery.

```bash
node "$CONTROL" reply --project "$PROJECT" --owner "$UNIT" --worker "$WORKER" --request "$REQUEST" --text 'Answer from the approved task'
node "$CONTROL" receipt --project "$PROJECT" --worker "$WORKER" --command "$COMMAND"
node "$CONTROL" steer --project "$PROJECT" --owner "$UNIT" --worker "$WORKER" --text 'Updated direction within the same authorized task'
node "$CONTROL" stop --project "$PROJECT" --owner "$UNIT" --worker "$WORKER"
```

Capture `command_id` from submission as `COMMAND`. For a native request with
multiple questions, supply EVERY exact question ID with `--answers-json`, e.g.
`'{"q1":"first answer","q2":"second answer"}'`; replace these example keys with
the actual IDs. A single `--text` answer is valid only for a dynamic question or
one native question. Do not answer all choices with the same guessed string.

Quote arguments with the host shell's safe argument handling. Do not splice
untrusted question text into shell programs or include secrets in messages.
</control_commands>

<recovery>
After compaction, read checkpoint/dispatch records, then status BEFORE launching.
An alive `running`/`waiting_input` worker is still the same task: service it and
reattach to its existing background completion handle. Do not start a duplicate.
If that handle is unavailable, worker `completed` alone is insufficient. Read
`.planning/worker-sessions/<worker_id>/wrapper-result.json`. Require
`schema_version: 1`, matching `project`, `worker_id`, `wrapper_attempt_id`,
`thread_id` and `turn_id` against that worker's state and your dispatch record.
Require `exit_code: 0`, the expected fresh `report_path`, and matching file
`sha256` and `bytes`, then apply the normal report validator/gates. Missing,
mismatched or failed receipts mean unconfirmed/failed work, not success. Never
infer wrapper exit from `codex-executor-live.txt` or another attempt's report.

Preserve validated completed board votes and their seat/round/attempt/report
mapping. Reconcile incomplete attempts without inventing votes or re-running
successful attempts just because their outputs left the context window.

For a non-active worker needing continuation of the SAME bounded task, reuse
the exact recorded model/effort and wrapper contract, a fresh report path, and
set `SGSD_WORKER_RESUME_ID="$WORKER"` on the new background wrapper invocation.
Never use `--last`, select another project's thread, or resume context into an
unrelated new task. The adapter creates a new worker record for that same thread
and refuses concurrent claims. A removed temporary worktree needs an explicitly
supplied existing, verified linked workspace before retrying.

`orphaned` or `worker_thread_already_claimed` is not permission to delete state.
A hard-killed adapter can leave a claim: investigate the exact owned process and
escalate manual recovery when needed. Unknown permission/connector requests,
timeouts and provider errors retain their failure status. Do not auto-change auth.
An unanswered operator-only request/deadline is an explicit exception to the
ordinary blocker board/challenge loop: those models cannot supply the missing
authority. Checkpoint and ask the operator without spending on a recovery round
just to recreate the same question; continue other authorized work if available.
</recovery>

<telemetry>
Atlas remains attached through existing wrappers. The private project mailbox
contains bounded operational questions/replies, not a telemetry conversation
transcript. Never copy prompts, reasoning, secrets, code or tool payloads into
Atlas. Model identity comes from dispatch metadata, not the worker's self-report.
</telemetry>

<success_criteria>
Every owned worker is either still supervised, explicitly awaiting operator
action within its deadline, or reconciled to a wrapper exit and validated final
report/failure. No question is silently dropped, no second Fable is spawned,
no live worker is duplicated, and no SGSD gate is replaced by conversation status.
</success_criteria>
