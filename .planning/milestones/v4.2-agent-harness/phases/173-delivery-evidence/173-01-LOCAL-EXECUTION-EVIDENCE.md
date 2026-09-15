# 173-01 local execution evidence

Owner: `pm-automation.harness.20260915`
Status: **BLOCKED before paid review / commit** — see install-regression block.

## Reproduction before source change

No paid model was invoked. A local fake App Server child using the same
newline-delimited JSON-RPC notification shape as
`tools/codex-worker/fixtures/app-server.cjs` delivered one aggregate stdout
chunk containing two `item/completed` frames. The legacy parser faulted before
splitting lines:

| Probe | Byte evidence | Legacy result |
| --- | ---: | --- |
| Individually valid frame 1 | 614,531 | below 1,048,576 |
| Individually valid frame 2 | 614,531 | below 1,048,576 |
| Aggregate one data delivery | 1,229,062 | `app_server_frame_limit`; closed |
| Aggregate above legacy limit | 180,486 | false rejection |
| Newline-free tail | 1,048,577 | `app_server_frame_limit` |
| Serialized outbound line | 1,048,599 | `app_server_frame_limit` (23 over) |

The local installed Codex 0.154.0 `app-server` supports stdio and generated
schemas include `ItemCompletedNotification` and `TurnCompletedNotification`.
Its schema generator exposes no application payload cap. Root's preserved
rollout evidence records a legitimate 2,284,876-byte `item/completed` event.

## Candidate verification

`rpc.cjs` drains newline-complete frames first, enforces each full native frame
and only the retained partial tail at 4,194,304 bytes, and preserves the
1,048,576-byte outbound guard. `rpc.test.cjs` passed six focused checks:
the exact 2,284,876-byte native frame; aggregate valid frames; partial and
outbound rejection; UTF-8 multibyte bytes; invalid JSON; request deadline,
classified authentication rejection, and pending cleanup.

Passed local commands:

- `node --test super-gsd/tools/codex-worker/rpc.test.cjs` — 6/6 pass.
- `node --test super-gsd/tools/codex-worker/worker.test.cjs` — all exercised
  cases passed (two Windows/live-init cases skipped); includes existing
  oversized-frame, negative, deadline, diagnostic-privacy, and owned-child
  cleanup cases.
- `node --test super-gsd/tests/codex-worker/launch.test.cjs` — 12/12 pass,
  including fake-only online wrapper self-test.
- `bash super-gsd/scripts/codex-exec.sh --self-test --skip-network` — 7/7
  local probes pass; no network/model turn.
- `git diff --check` — pass (only pre-existing CRLF advisory warnings).

## Blocking local install regression

`node --test super-gsd/tests/codex-worker/install.test.cjs` has two failures
unrelated to this bounded parser/test change and outside write scope:

1. line 66 expects `{ routes: 30 }`, while the checked-in routing registry
   resolves `{ routes: 31, source: "yaml" }`.
2. its npm fixture copies
   `tools/plan-schema/node_modules/.package-lock.json`, which is absent before
   this worktree change.

No paid Spec/ATC review, commit, push, or `/opt/clarity` installation was
attempted. Those actions remain blocked until Root resolves or separately
adjudicates the pre-existing install regression.
