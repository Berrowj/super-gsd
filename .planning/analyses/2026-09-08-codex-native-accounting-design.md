---
status: APPROVED_WORK_IMPLEMENTATION_DESIGN
authorized_by: operator
authorized_at: 2026-09-08
implementation_plan: "170-06"
paired_plan: "170-05"
scope: DEVCP_LINUX
windows: OPEN_REQUIRED
---

# Native Codex accounting and loaded receiver revision

The operator approved both pieces of work: the evidenced Linux repairs and a
trustworthy Codex accounting path. This design implements that approval. The
previous benchmark and its blocked verdicts remain historical evidence, not a
test to relabel. No new live calls were used to choose this design.

## Evidence and choice

The installed native Codex 0.153.2 has a durable `token_usage_record` rollout
item. Its native `response_id` comes from the completed upstream Responses API
response. `usage` is that response's additive usage; `turn_token_usage` and
`thread_token_usage` are cumulative and MUST NOT be added to totals.

Primary release sources inspected locally:

- [Capture and persistence](https://github.com/openai/codex/blob/rust-v0.153.2/codex-rs/core/src/session/mod.rs#L4342).
- [Multiple responses, cold resume and missing-usage test](https://github.com/openai/codex/blob/rust-v0.153.2/codex-rs/core/tests/suite/token_usage_rollout.rs#L33).
- Release protocol `TokenUsageRecord` / `TokenUsage`, rollout wire serializer,
  persistence policy, live-writer flush and task-completion flush were also
  inspected. Upstream tests were read, not executed.

The existing OTEL completion lacks a stable provider identity. It remains
metadata/coverage, even when token-looking fields are present. Experimental
`rawResponse/completed` does not solve cold resume because the installed server
disables that notification on cold resume. Thread token updates can include
historical/recomputed values. Neither is the new accounting authority.

## Capture contract

1. Use only the exact native `opened.thread.path` returned by the worker's
   acknowledged App Server thread. Bind to that thread and the acknowledged
   turn. Do not scan Codex home, discover other sessions, read auth files, or
   copy rollout/transcript contents to Atlas or benchmark output.
2. Establish a verified file/offset baseline before `turn/start`, then project
   bounded newly appended complete lines periodically and once before process
   teardown on every exit path. This excludes pre-existing resumed history.
   Missing files, unsupported paths, changed files and exceeded bounds produce
   explicit capture degradation, never a worker success/failure substitution.
3. Check absolute path, no symlink ancestors/leaf, regular single-linked file,
   current-user ownership on Linux, and descriptor identity against the path.
   Recheck replacement/truncation during capture. No chmod or edits to native
   files. Bound read work, buffered line size, response count and spool retries.
4. Accept only standalone `type: token_usage_record` with matching native
   thread/turn and genuine response identity. Ignore other record kinds and
   inherited/embedded snapshots. Validate nonnegative safe-integer token fields;
   no negative/fractional/unsafe integers, inferred totals or invented IDs.
5. Record `identity.response_id` separately from unknown HTTP `request_id`.
   Keep native thread/session/turn identities and launcher registration distinct.
   `runtime.model` is returned thread configuration, explicitly marked as such;
   it is not provider-reported per-response model. Record a reroute as unknown
   per-response model provenance rather than falsely attributing it.
6. Cache-read and reasoning values are subsets of input/output, not additional
   totals. Use only native total for total-provider tokens. Missing optional
   cache-write remains null unless explicitly supplied. No price/quota guessing.
7. Repeated projection must not add tokens twice. Give the new source stable
   provider-response identity independent of timestamp, file offset, collector
   process and wrapper attempt. Same response with changed usage/attribution is
   an integrity conflict, not a second billable event. Preserve historical
   canonical IDs for existing source kinds. Audit duplicate native response
   identities across projects as invalid evidence, not safe summable totals.
8. A worker's immutable run registration selects the rollout accounting
   authority. OTEL for that run remains non-additive coverage even if a future
   OTEL shape contains IDs, preventing arrival-order double counting. Legacy
   registrations retain their existing semantics. Unregistered or mismatched
   provider/source events remain rejected.
9. Use the existing bounded private spool, receiver, canonical store and audit.
   Extend their strict allowlists for this source, not arbitrary client bodies.
   A failed queue or parse is a visible coverage gap. No observed matching row
   means `native_request_usage_unobserved`, not zero spend. Completed responses
   before a later failure/interruption are still eligible observations.
10. Observed native completed responses establish observed usage, never full
    provider reconciliation. Keep `complete_coverage: false`, unknown quota,
    and warnings for missing HTTP request identity or dropped capture.

## Receiver update contract

Installing files does not reload a running Node receiver. Normal Linux updating
must explicitly transition an owned running receiver before publishing the
project pin and reporting success. The selected minimal design is a bounded
same-port restart, not a new daemon topology.

- Add `global.cjs restart --if-running`. Disabled/absent collection is a no-op;
  `--no-install` never invokes it. Ordinary launches do not silently replace a
  healthy stale receiver. Windows transition remains unsupported and required.
- Keep all three URLs, run registrations, ledgers, manifests and private spools.
  Never restart Fable/Codex panes, re-register runs or touch other project pins.
- Capture a receiver dependency fingerprint once at module load, including
  eagerly loaded native normalizers. Health must not hash current disk contents
  and misreport those as the revision already in memory.
- Serialize launch/restart with the same ownership lock. Require verified
  process start identity, executable/argv/root, health instance/root and all
  three listening port owners. Recheck immediately before SIGTERM. First upgrade
  may adopt an old record only with those live checks, labelled old revision
  unknown; PID-only signalling is forbidden.
- Write a private durable transition journal before stopping: exact original
  endpoints and process identity, target fingerprint, transition token and phase.
  Preserve it independently of the service record. Respect bounded graceful
  drain; do not kill foreign listeners or silently choose new ports.
- Verify replacement identity/ports/nonce/root/fingerprint before success. An
  interrupted requester or failed replacement leaves recoverable journal data;
  subsequent explicit retry reconciles recorded identities. Normal startup sees
  the outstanding transition before any healthy fast path.
- Record a content-free transition gap. Spools survive but exporter delivery
  during downtime is not guaranteed; in-memory metrics reset. Do not claim a
  lossless hot reload or hide the interruption.

## Verification boundary

Offline native Linux tests cover provider-shaped records and the real adapter,
private storage, audit and installed closure. Fixtures are explicitly synthetic
and never sent to production telemetry. Review specification then code quality.
The combined candidate may then be published normally, installed on DEVCP, and
tested in one fresh launcher Fable session under the unchanged B0-B7 budget:
five live attempts maximum, 180 seconds each, 20 minutes live total. No extra
paid probes or retries. Report bridge, capture and fleet freshness separately.

This is not authorization for Windows changes, bulk project rollout, model/auth
changes, old-pane restart, CLI installation/removal, gate bypass, or phase close.
