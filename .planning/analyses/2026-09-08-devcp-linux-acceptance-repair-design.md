---
status: APPROVED_NARROW_REPAIR_AND_ACCOUNTING_WORK
date: 2026-09-08
phase: 170
scope: DEVCP_LINUX
implementation_authorized_in_principle: true
implementation_started: false
benchmark_rerun_started: false
windows: OPEN_REQUIRED
---

# DEVCP Linux worker and native capture repair

The operator approved fixing the three failures recorded in the 170-04 rollout
report and rerunning its bounded benchmark. Read-only investigation established
the causes below and an additional provider limitation. This is a proposed
repair design, not an active implementation plan, a deployment or a test pass.
Source edits require a numbered phase plan after design review.

Operator review on 2026-09-08: "lets do both pieces of work please i need this
working" approves the narrow repair and the separate trustworthy accounting
work. Implement the approved repairs under 170-05; investigate and specify the
native accounting source under a separate 170-06 plan before adding that source.
Do not treat the earlier proposal to leave accounting blocked as the final
requested outcome. Preserve truthful identity and the original acceptance bar.

## Verified baseline

- Local release branch: `release/v4.1-atlas-worker-20260908`, HEAD `ce04197`.
  Published and last verified installed source: `6b4581b`. The local HEAD adds
  planning evidence only; this investigation did not push or update DEVCP.
- Prior benchmark: B0/B1 passed, B2 failed, B3/B4 partial only, B5/B6 not run,
  B7 blocked. Two live attempts were used. No new model turns were launched
  during this investigation.
- Evidence: phase report `170-04-EXECUTOR-REPORT.md`, especially its completed
  bounded benchmark section, and private DEVCP evidence under
  `/home/jackberrow/benchmarks/sgsd-worker-rollout-20260908T1745-Yu7jr3/`.
- Windows quota latency remains `OPEN_REQUIRED`; this design does not waive or
  change its ten-millisecond criterion. Existing panes, project pins, model/auth
  defaults and unrelated user work remain outside the repair's mutation scope.

## Causes and evidence

### 1. Worker executable selection changes inside the wrapper

`codex-exec.sh` and `codex-executor.sh` add the nvm Node directory ahead of the
user-local directory. That reverses the fresh Fable shell's selection of Codex
0.153.2 and dispatches 0.144.3 instead. The prior benchmark independently
verified the older version in native metadata and an Astra HTTP 400
newer-Codex-required prewarm error. That error does not prove that 0.153.2 will
succeed; no newer-CLI model turn has been tested.

`codex-worker-shell.sh` computes `CODEX_BIN`, but `run.cjs` separately resolves
the environment selector. Changing a display/check variable alone is not a fix.
Existing launch/install fixtures supply an absolute fake command and do not
exercise competing local/nvm executables.

### 2. Fable diagnosed a failed peer while another worker needed an answer

The validated Sol worker's reply took 83.9 seconds from Fable observation to
applied receipt, against the unchanged 30-second target. Host forwarding took
64 milliseconds. The existing `/sgsd-workers` instructions say to inspect the
inbox between other safe actions; they do not clearly make pending questions
pre-empt unrelated diagnostics. This is a supervision failure, not evidence of
slow mailbox transport. Static instruction tests alone cannot establish that
the latency target is met by a live Fable session.

### 3. Atlas disables the Claude identity it requires

`telemetry-atlas/lifecycle.cjs` emits
`OTEL_METRICS_INCLUDE_SESSION_ID=false`. The benchmark Fable PID 1296359 has that
exact setting. In installed Claude 2.1.263, `CAe()` puts `session.id` into standard
attributes only when that flag is true, and the `So()` log emitter incorporates
those attributes. Atlas's Claude normalizer requires a stable session identity.

The main agent independently inspected the process's allowlisted environment
and binary on 2026-09-08 at approximately 19:44 UTC. Claude binary SHA-256:
`26d020351e8112f4006790f3cfce43b4c9df0c1bb1d0e542364d64151b81d5ba`.
Source anchors in its UTF-8 representation: `CAe` 178172901; `So` 178176030.
No credentials, user transcripts or raw telemetry payloads were exported.
[Anthropic's standard-attributes documentation](https://code.claude.com/docs/en/monitoring-usage#standard-attributes)
also documents the session flag's effect on events.

### 4. Codex's completion schema differs, and lacks provider request IDs

`codex-otlp.cjs` checks `kind`, whereas both installed native Codex binaries
declare `event.kind` for `codex.sse_event` / `response.completed`. The existing
positive fixture is a synthetic Claude-shaped record modified to contain
`kind` and `request_id`; it is not an installed-provider capability test.

The main agent independently decoded both binaries' compiled completion field
arrays and adjacent event constants read-only at approximately 19:44 UTC:

| Binary | SHA-256 | Completion field-array file offsets |
|---|---|---|
| 0.144.3 npm | `37e6f5953f191b04f7b62cb07dae90f51d0947ad89f0355665b421fbde28700b` | 294916560 (20 fields), 294917000 (18 fields) |
| 0.153.2 standalone | `f8786262ebc0fa1337448a2977332beadec66c8d0cda0ce973c7849766d7943c` | 255489968 (19 fields), 255490392 (21 fields) |

Both arrays include `event.kind`, `input_token_count`, `output_token_count`,
`cached_token_count`, `reasoning_token_count`, `tool_token_count`, `ttft_ms`,
`event.timestamp`, `conversation.id` and `app.version`. The newer binary also
includes `cache_write_token_count`. Neither completion schema includes a
provider request/response ID. Some transport events include `auth.request_id`;
that is not evidence of a reliable join to a token-bearing completion.

The saved canonical benchmark rows discarded the original kind and usage.
They cannot be replayed to recover those fields, nor do their six `sse_event`
names alone establish which were completions.

Therefore correcting CLI selection and `event.kind` cannot, by themselves,
satisfy unchanged B7's positive native Codex request-accounting requirement.
Timestamp hashes, turn IDs or guessed cross-event joins must not be passed off
as provider request IDs. Missing accounting remains unknown, not zero.

### 5. Installing files does not reload the existing receiver

`global.cjs:ensureService()` reuses a healthy receiver. It does not check the
loaded parser revision. A future deployment must prove the running receiver
loaded the candidate, not merely compare hashes of files on disk. Its existing
clients have endpoint URLs fixed in their process environments; replacing it
on new random ports would not retrofit those sessions. Do not kill or replace
the current receiver as an incidental benchmark step.

## Recommended narrow design

1. Resolve and pin the caller-selected native Codex executable before Node PATH
   recovery. Preserve `SGSD_CODEX_APP_SERVER_COMMAND` over `SGSD_CODEX_COMMAND`
   over default discovery. Export the absolute selection through the existing
   adapter selector. Repair Node discovery independently. Invalid explicit
   overrides fail visibly; retain native/interop checks and argument handling.
   Apply the shared helper consistently to review, executor and patch wrappers.
   Do not select by version or install/remove a CLI.
2. Prepare control paths, report schemas and dispatch records before workers
   start. Pending owned questions take priority over unrelated diagnostics and
   report processing. Poll every 5-10 seconds; preserve exact project/owner/
   worker/request targeting, operator-only escalation and receipt checks.
   Precompute control mechanics, not benchmark answers. Do not add an automatic
   answering service or another Fable. Retain the 30-second live criterion.
3. Enable Claude's session attribute while retaining content/account suppression
   and finite metric labels. Recognize the real Codex `event.kind` shape. Accept
   request accounting only when a genuine request identity is present; actual
   installed shapes without it remain coverage with
   `missing_stable_request_identity` and null accounting usage. Do not change
   the audit or B7 to score those as verified requests.
4. Before publishing receiver changes, separately resolve its loaded-revision
   transition using verified ownership and preserving existing client endpoints
   and evidence. If a safe transition is not available within the approved
   scope, report a deployment blocker rather than silently replacing processes.
5. Add regression tests first: competing CLI selection through actual wrapper
   and isolated install paths; explicit/relative/spaced selectors and Node-only
   bootstrap; priority-first instruction contracts; Claude environment-to-log
   identity; real-shaped Codex completion without request ID; privacy, replay
   deduplication and truthful missing-data handling.
6. Run existing bounded worker, board, routing and Atlas tests on native Linux.
   Preserve Windows limitations and all test skips explicitly. Use independent
   review before publication, the normal updater, and a fresh normal-launcher
   Fable for any approved rerun. At most five live attempts, 180 seconds each,
   20 minutes total, no extra probes, model/auth swaps or automatic retries.

## Alternatives and decision boundary

- Broad launcher PATH and independent supervisor redesign: addresses more entry
  points but changes substantially more behavior and still cannot create missing
  native provider IDs. Not recommended for this repair.
- New observed-usage accounting source/contract: investigate native App Server
  or another supported source for trustworthy accounting with its actual
  identity/granularity. This is separate work, not permission to label
  turn-level or timestamp-derived data as provider-request accounting. It needs
  its own evidence-backed design and tests before it can resolve B7.

Recommendation: implement the narrow repair with honest partial Codex capture;
do not promise a complete B7 pass or reliable exhaustive weekly accounting.
Before new paid benchmarking, make the provider limitation explicit and decide
whether testing the repaired worker bridge alone is worth the bounded spend.
The original B0-B7 acceptance criteria and separate rollout verdicts remain
unchanged; a component test is not whole-system acceptance.

## Design self-review

No model aliases, fake request IDs, alternate authority, test waivers, bulk
worktree updates or raw payload capture are proposed. Linux repair, receiver
transition and the unresolved provider-identity contract are distinguished.
Implementation, publication, runtime migration and live acceptance are all
unclaimed. The next step is operator review of this proposed scope, followed
by a numbered phase-170 implementation plan before source changes.
