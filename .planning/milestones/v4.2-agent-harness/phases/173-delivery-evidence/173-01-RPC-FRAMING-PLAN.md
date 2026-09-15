# 173-01 RPC newline-frame repair plan

## Scope and hypothesis

Owner: `pm-automation.harness.20260915`
Bounded files: `super-gsd/tools/codex-worker/rpc.cjs`, one adjacent direct
`rpc.test.cjs`, and the Phase 173 evidence/handoff files in this directory.

Hypothesis: `Rpc` applies its 1 MiB receive check to the accumulated UTF-8
string before it removes newline-terminated JSON-RPC frames. Consequently a
single stdout delivery containing several individually valid frames can be
rejected solely because their aggregate exceeds the bound. The same 1 MiB
receive bound rejects supported large native completion events.

Local no-provider reproduction against the local fake App Server transport:

| Measurement | Exact bytes | Result with current `rpc.cjs` |
| --- | ---: | --- |
| Legacy partial-frame/send bound | 1,048,576 | enforced |
| Native-event frame 1 | 614,531 | individually valid |
| Native-event frame 2 | 614,531 | individually valid |
| One delivered aggregate | 1,229,062 | `app_server_frame_limit`, closed |
| Aggregate excess over legacy bound | 180,486 | false rejection |
| Newline-free partial probe | 1,048,577 | `app_server_frame_limit` |
| Serialized outbound probe | 1,048,599 | `app_server_frame_limit` (23 over) |

Root's preserved local rollout evidence names a legitimate
`item/completed` event of 2,284,876 bytes. Installed Codex 0.154.0's local
`app-server` exposes a stdio transport and generated protocol schemas; the
protocol declares event objects but does not furnish an application frame-size
cap. Therefore select a finite **4 MiB (4,194,304-byte) inbound complete-frame
and retained-partial limit**: it exceeds the observed event by 1,909,428 bytes
while limiting a malformed, newline-free stream. Retain the existing finite
**1 MiB outbound** serialized-line limit. This is an adapter resource bound,
not a protocol claim or an unlimited buffer.

Falsifier: after processing complete newline frames before checking the
remainder, either (a) two sub-4 MiB valid frames delivered in one chunk still
fault, (b) a <=4 MiB native event faults, (c) a >4 MiB unterminated tail does
not fault, or (d) a >1 MiB outbound line sends. Any falsifier blocks commit.

## Protocol and safety invariants

1. stdout remains UTF-8 newline-delimited JSON-RPC; only a complete
   newline-terminated line is parsed or emitted.
2. Each nonblank complete inbound frame and the unframed remainder have a
   4 MiB byte cap measured with `Buffer.byteLength`, including multibyte UTF-8.
   There is never an unlimited retained buffer.
3. The receive handler first drains complete frames in delivery order, then
   caps the remaining partial frame. Invalid JSON still fails closed as
   `app_server_invalid_json`.
4. Outbound JSON plus newline stays capped at 1 MiB; pending RPC cap (64),
   per-request deadlines, remote auth/rate/model classification, and request
   resolution order remain unchanged.
5. stderr stays bounded/redacted (classification tail only); no raw native
   event, prompt, credential, or provider diagnostic is persisted in tests or
   evidence. Spawn argument handling, model routing, approval/auth behavior,
   and owned child process-tree cleanup are unchanged.

## Implementation and tests

1. Add named finite inbound/outbound constants in `rpc.cjs`; drain and parse
   complete newline frames before applying the inbound remainder limit. Check
   individual complete-frame bytes before parse.
2. Add a focused adjacent RPC test using an in-memory local fake child. This
   is smaller and more direct than changing the shared worker fixture: it can
   deterministically deliver one aggregate stdout chunk and has no worker
   report-output cap. Cover valid 2,284,876-byte native event; two valid
   aggregate frames above old 1 MiB; 4 MiB+1 partial; 1 MiB+ serialized send;
   multibyte byte accounting; invalid JSON; request deadline/error
   classification/pending cleanup. Existing `worker.test.cjs` retains the
   integration negative and process-tree cleanup cases.
3. Run the focused RPC test and existing worker suite; run the wrapper's
   bounded local fake self-test and the relevant launch/install regression;
   run `git diff --check`. Record commands, concise results, and hashes.
4. Only after green local evidence, request exactly one sequential independent
   Spec review and one sequential ATC review through the worktree
   `codex-exec.sh`, each using `gpt-5.6-terra` / `xhigh`, owner
   `pm-automation.harness.20260915`, compact read-only prompts and exact
   report/receipt validation. Preserve any failure and stop; no repeated paid
   review.

## Rollback and non-goals

No install, push, restart, configuration/model/profile change, gate bypass,
or modifications outside the bounded files are authorized. Root will make a
backup before normal checked publication/install and may roll back with the
single candidate commit via `git revert <commit>` followed by the established
update procedure. This plan does not alter native protocol semantics, payload
content, telemetry, request limits, reviewer criteria, or product code.
