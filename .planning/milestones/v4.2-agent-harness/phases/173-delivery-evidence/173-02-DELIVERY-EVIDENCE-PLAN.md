---
schema_version: 2
status: DRAFT
phase: 173
plan: "173-02"
depends_on:
  - "173-01"
expected_ATC_tier: FULL
skip_gates: []
tasks:
  - id: T1-exact-owned-identity-and-scope
    agent: gsd-executor
    model: codex
    worker_model: gpt-5.6-terra
    reasoning_effort: xhigh
    files_touched:
      - super-gsd/tools/codex-worker/run.cjs
      - super-gsd/tools/codex-worker/mailbox.cjs
      - super-gsd/tools/codex-worker/control.cjs
      - super-gsd/tools/codex-worker/worker.test.cjs
    read_only_files:
      - super-gsd/tools/telemetry-atlas/lifecycle.cjs
      - super-gsd/scripts/lib/codex-worker-shell.sh
      - super-gsd/skills/sgsd-workers/SKILL.md
    input_contract: "173-01 is accepted; the current mailbox records pid only, lifecycle.cjs already provides Linux processIdentity(pid) and owned(record), and the supervisor's normal control path supplies --owner. No provider, install, or source file outside files_touched is in scope."
    output_contract: "New worker records carry a bounded exact Linux process identity and inherited optional fan-out limit; control status exposes an explicit liveness observation; owner-bearing records reject unowned/mismatched reply, steer, and stop attempts with a durable named receipt; focused fixtures prove dead, unrelated-live, and identity-mismatched/PID-reuse cases."
    hypothesis: "A record bound to pid plus Linux start_time/executable/argv cannot treat a different live process with a reused PID as its worker, and checking owner and optional workspace fan-out in mailbox/control prevents a supervisor convention from becoming an authorization bypass."
    falsifier: "Any status query reports an identity-mismatched or dead owned record as active/completed, an unrelated live record changes that result, a missing/wrong owner reaches the command queue, or an unset fan-out limit changes current behavior."
    stop_rule: "Make one implementation attempt and one evidence-directed repair only. Stop when the two focused failing-first tests pass and the four-file allowance is respected; otherwise preserve the failing evidence for the verifier."
    verification_cmd: "node --test --test-name-pattern='exact owned identity rejects dead and PID-reused workers while unrelated workers remain live|owner-scoped control and inherited fan-out are enforced by the real mailbox path' super-gsd/tools/codex-worker/worker.test.cjs"
  - id: T2-separate-delivery-observation
    agent: gsd-executor
    model: codex
    worker_model: gpt-5.6-terra
    reasoning_effort: xhigh
    depends_on:
      - T1-exact-owned-identity-and-scope
    files_touched:
      - super-gsd/tools/codex-worker/run.cjs
      - super-gsd/tools/codex-worker/mailbox.cjs
      - super-gsd/tools/codex-worker/worker.test.cjs
    read_only_files:
      - super-gsd/tools/codex-worker/fixtures/app-server.cjs
      - super-gsd/tools/codex-worker/control.cjs
      - super-gsd/scripts/lib/atlas-observation.cjs
    input_contract: "T1's exact identity and scope result; current run.cjs rejects empty/mismatched final reports and preserves the first failure, while wrapper receipts separately bind report bytes/hash and exit. Existing app-server fixture modes must be reused unless an isolated test needs one additional local-only mode."
    output_contract: "A versioned bounded delivery_observation is persisted and returned through control status with distinct process_outcome, report_validity, observed_delivery, and independent_verification fields. A later nonzero process outcome preserves already observed artifact metadata without ever turning that delivery into completion."
    hypothesis: "Separating terminal process state, report validity, receipt/delivery evidence, and later independent verification prevents an empty, malformed, unacknowledged, or failed report from being promoted to success while retaining useful evidence for diagnosis."
    falsifier: "Any empty/malformed/unacknowledged report yields core or wrapper success, a nonzero exit erases a prior delivery digest/byte/identity observation, a retained continuation can inherit another instance's observation, or any one of the four fields is derived by overwriting another."
    stop_rule: "Make one implementation attempt and one evidence-directed repair only. Stop when each focused direct-adapter test passes, the observation contains all four separate fields, and no fourth file is changed."
    verification_cmd: "node --test --test-name-pattern='delivery observation keeps process outcome report validity observed delivery and independent verification separate|empty malformed and unacknowledged reports never complete while nonzero exit preserves delivery evidence|retained continuation binds its exact owned instance and result' super-gsd/tools/codex-worker/worker.test.cjs"
  - id: T3-normal-wrapper-consumption-and-portability
    agent: gsd-executor
    model: codex
    worker_model: gpt-5.6-terra
    reasoning_effort: xhigh
    depends_on:
      - T2-separate-delivery-observation
    files_touched:
      - super-gsd/scripts/lib/codex-worker-shell.sh
      - super-gsd/tools/codex-worker/worker.test.cjs
      - super-gsd/tests/codex-worker/launch.test.cjs
    read_only_files:
      - super-gsd/scripts/codex-executor.sh
      - super-gsd/scripts/codex-exec.sh
      - super-gsd/skills/sgsd-workers/SKILL.md
      - super-gsd/tests/codex-worker/install.test.cjs
    input_contract: "T1/T2 records and observations; codex-executor.sh and codex-exec.sh both invoke the shared worker shell, and the supervisor skill consumes control status plus wrapper-result.json. Windows interop/native Node execution is currently explicitly refused by the shared shell."
    output_contract: "The shared normal-wrapper finish path consumes the exact delivery observation before it can persist a successful wrapper receipt; real wrapper fixtures prove it. Long-running/read-only work stays active without source changes until its declared budget/cancel path, and Linux fixture roots contain no SAP/VTP/Clarity assumption."
    hypothesis: "Checking the observation in the actual shared wrapper finish path, rather than only in a mailbox helper, keeps missing/dead/identity-mismatched evidence from being consumed as a successful wrapper result without using file-change activity as progress."
    falsifier: "A real codex-executor or codex-exec wrapper writes/prints success after a killed or identity-mismatched owned worker, waits beyond configured budget plus its one documented observation interval, kills a no-source-change fixture prematurely, accepts unauthorized cancellation, or contains a Clarity/SAP/VTP path assumption."
    stop_rule: "Make one implementation attempt and one evidence-directed repair only. Stop after the focused real-wrapper tests pass, Linux portability evidence is present, Windows is documented as unsupported rather than simulated as covered, and the three-file allowance holds."
    verification_cmd: "node --test --test-name-pattern='real executor wrapper consumes the exact delivery observation before writing a receipt|long-running read-only work uses budget plus one observation interval and authorized cancellation|non-Clarity Linux wrapper fixture has no product-specific path assumption' super-gsd/tests/codex-worker/launch.test.cjs"
semantic_acceptance_criteria:
  - input: "A killed Linux worker has no wrapper-result.json, a separate worker remains alive, and a stale record's PID matches a live process but its start-time identity does not."
    expected_outcome: "control status marks only the target observation dead or identity_mismatch; no unrelated process can satisfy it, and completion remains false."
    verification_cmd: "node --test --test-name-pattern='exact owned identity rejects dead and PID-reused workers while unrelated workers remain live' super-gsd/tools/codex-worker/worker.test.cjs"
  - input: "An empty, malformed, or unacknowledged required report and a final report delivered before a nonzero terminal outcome."
    expected_outcome: "Invalid evidence never establishes completion; the nonzero outcome remains nonzero while observed delivery metadata and useful wrapper artifact evidence remain inspectable."
    verification_cmd: "node --test --test-name-pattern='empty malformed and unacknowledged reports never complete while nonzero exit preserves delivery evidence' super-gsd/tools/codex-worker/worker.test.cjs"
  - input: "A local fixture performs long read-only/no-source-change work within its declared timeout; a correctly owned stop is submitted, and unauthorized plus over-fan-out submissions are attempted."
    expected_outcome: "No source timestamp is used as a death signal; the wait ends within timeout plus one documented observation interval, the authorized stop is applied, and scope/fan-out violations are rejected through control/mailbox."
    verification_cmd: "node --test --test-name-pattern='long-running read-only work uses budget plus one observation interval and authorized cancellation' super-gsd/tests/codex-worker/launch.test.cjs"
  - input: "SGSD_WORKER_RESUME_ID identifies a completed worker and a competing/current instance is present."
    expected_outcome: "The continuation has the recorded thread, a new exact instance identity and its own result observation; concurrent claim or cross-worker substitution is rejected."
    verification_cmd: "node --test --test-name-pattern='retained continuation binds its exact owned instance and result' super-gsd/tools/codex-worker/worker.test.cjs"
  - input: "A core report, a later process outcome, a wrapper receipt, and a downstream verification result are independently varied by fixture."
    expected_outcome: "delivery_observation retains separate process_outcome, report_validity, observed_delivery, and independent_verification values with no success coercion."
    verification_cmd: "node --test --test-name-pattern='delivery observation keeps process outcome report validity observed delivery and independent verification separate' super-gsd/tools/codex-worker/worker.test.cjs"
  - input: "The real codex-executor wrapper reaches shared sgsd_codex_worker_finish after its exact worker is killed or identity-mismatched."
    expected_outcome: "The wrapper consumes the observation, does not print/write a successful result, and persists only a matching nonzero receipt/result record."
    verification_cmd: "node --test --test-name-pattern='real executor wrapper consumes the exact delivery observation before writing a receipt' super-gsd/tests/codex-worker/launch.test.cjs"
  - input: "The Linux wrapper runs in a temporary fixture repository with only .planning and no SAP, VTP, Clarity, devcp, or home-directory assumption."
    expected_outcome: "The shared adapter completes its local fixture path; Windows is reported as an explicit retained unsupported-platform gap because the current shell refuses native/interop Windows dispatch."
    verification_cmd: "node --test --test-name-pattern='non-Clarity Linux wrapper fixture has no product-specific path assumption' super-gsd/tests/codex-worker/launch.test.cjs"
---

# 173-02 Delivery evidence plan

## Authority, baseline, and bounded change set

Phase 173 / S1 is scoped by the harness programme S1 authority (HS-01 and the
worker-control portions of HS-09 and HS-15), including research concerns
MH-05 and MH-06: production-path evidence must be distinct from helper success,
and generic components must work in a non-Clarity fixture repository. The phase
goal is to wait for the exact owned worker, observe silence/death within a
configured bound, and keep process outcome, report validity, observed delivery,
and independent verification separate.

Baseline HEAD: `f3e89f7677d929387daa261d781122c70a9e3bfb`.
Plan 173-01 is an accepted prerequisite only; this plan neither reviews nor
changes it. Tasks are serial. Per-task changed-file allowances are exactly T1
four files, T2 three files, and T3 three files. No source file outside those
allowances may change. In particular, `codex-executor.sh` is read-only: both
normal wrappers already reach `codex-worker-shell.sh`, so touch it only through
the shared shell seam. A needed change to the executor wrapper itself requires
a plan amendment.

### Candidate source hash ledger

| File | SHA-256 | Role at HEAD |
| --- | --- | --- |
| `super-gsd/tools/codex-worker/run.cjs` | `0ab821c1245213559fce812ee098e69c96984d085a00cab7b02ece29bcfe0f59` | adapter launch, turn/result state, exit 124 |
| `super-gsd/tools/codex-worker/control.cjs` | `50fc48e18425acd2b6af84fe80f81dc36cd9fb1f82333bdfba2f92b9e0638a0b` | status, command, receipt CLI |
| `super-gsd/tools/codex-worker/mailbox.cjs` | `4586209bcf6e78f33908ed58733f402f51591474082c46b83c915bf5fcaf7764` | persisted records, PID-only liveness, scoped commands |
| `super-gsd/tools/codex-worker/worker.test.cjs` | `c1a6affe9b4d3fd19e86e95190e26c672e6edd8a1bd4318c75a87dd99d222a14` | direct adapter/fixture coverage |
| `super-gsd/scripts/codex-executor.sh` | `d6bdb14a768bfb76a631b4fa82a8c53bd573aeadea0921115f0bf2d3106697c8` | normal executor wrapper (read-only) |
| `super-gsd/scripts/lib/codex-worker-shell.sh` | `dd5f2168bc0116536fa9135533568719678404dccf7b18b4a38a8b3f4ef8cdc3` | common watchdog, launch, finish and receipt seam |
| `super-gsd/scripts/codex-exec.sh` | `f3d6658ecf9bc6a8b15df738a50d67305fe791e053ae4ad4570108e079e5167e` | normal reviewer/ATC wrapper (read-only) |

### Rehashed supporting inputs

| File | SHA-256 | Why it matters |
| --- | --- | --- |
| `super-gsd/tools/telemetry-atlas/lifecycle.cjs` | `1cb5a306a3f61cf44925dfb4f75f0de7465eca6c84c5e748ff5c3353e21dde2a` | existing Linux pid/start-time/executable/argv exact-identity primitive |
| `super-gsd/tools/codex-worker/fixtures/app-server.cjs` | `8b0c983c3ba2697a58dc881bfbe08d99e6bd11a7f17179d6f993e81b39b6ec69` | local provider-free App Server fixture |
| `super-gsd/scripts/lib/atlas-observation.cjs` | `466d1b486ca6c6a07d4663e179e2db9931b69ba18e4fd4b705be9514fefdfaae` | existing bounded worker-event emission; not a completion oracle |
| `super-gsd/skills/sgsd-workers/SKILL.md` | `8b41d6e137642cbd9a0562a4e44f73b945f88b5e3289c62f514403bc571cf686` | normal supervisor launch/status/receipt procedure |
| `package.json` | `aeb4da5abfe0ddd76a3173b55305c3d79c33300cb90d6da44bdecb1df122d959` | canonical `test:codex-worker` suite registration |
| `super-gsd/tests/codex-worker/launch.test.cjs` | `c9f3e8e5fa5a5d515b4d85896b33e77c80a5da7d7ca268391d91883525c071c2` | real wrapper path fixture |
| `super-gsd/tests/codex-worker/install.test.cjs` | `a974beeb4ed7e72c4d06d2b952ec95153a85f6228a0ae71533ab8f70b2cf234f` | installed worker closure/real wrapper fixture |
| `super-gsd/tests/codex-worker/orchestration.test.cjs` | `1d34eee4f5a173d83e7777a31fdb7f7f412a26a38178819083b35dbb3334a7d0` | supervisor contract regression |
| `super-gsd/tests/codex-worker/permissions.test.cjs` | `f6f1633ddf661e8ed931409f5416f559909fed6921310132365f836bc37e33ba` | retained/full-access wrapper contract regression |
| `super-gsd/tests/codex-worker/usage.test.cjs` | `de4dc671f05a301f3129915384224a3993d8d1f2d18b623a09fdc717ca1389a6` | run.cjs usage-path regression |
| `super-gsd/templates/plan-schema-v2.json` | `336cd06838c30d6125348536d66390c2e8f5e42f772ef6f79aab77a14ae75fdd` | plan frontmatter contract |
| `super-gsd/tools/plan-schema/{package.json,package-lock.json,validate.cjs}` | `77988d93f570ef7da99cdda25ea3dd1d3cae5b20162b809470d2d164c02055d7`, `e64491257bf2df2c24f1ab593fc8f5ca971456ae8ffd5867b101841f3cfbeafe`, `c5047c2702c2f165a6fd93878ab586b90c378e69fc0717b77d7239159149b3d1` | isolated schema validator inputs |
| `.planning/milestones/v4.2-agent-harness/ROADMAP.md` | `217699fec83c35b3d92dd8ee2870faff4c8bc4d055a0b6da208ef84c447caaa9` | phase goal/acceptance |
| `.planning/briefs/2026-09-14-harness-programme/2026-09-14-sgsd-harness-build-plan.md` | `e939cfd93c110dc4d060d64380ae7e5b37b927fa02e00472a772b567f438727d` | S1/reuse authority |

## Production caller and result map

`sgsd-workers` directs a supervisor to launch the existing wrapper in the
background with `SGSD_WORKER_OWNER`, then poll `control.cjs status` by owner
and persist the exact worker ID (SKILL.md:54-68, 71-105). It consumes a result
only after the original background wrapper exits successfully and its fresh
report is validated. Recovery requires `wrapper-result.json` to match project,
worker, wrapper attempt, thread, turn, exit zero, report path/hash/bytes and
then re-runs the normal report validator (SKILL.md:127-150).

Both `codex-executor.sh` and `codex-exec.sh` resolve a profile, call
`sgsd_codex_worker_prepare`, run the shared shell synchronously, capture stdout
and stderr, and call `sgsd_codex_worker_finish` on every exit. The shell starts
`run.cjs` under GNU `timeout` at configured timeout plus three seconds and
normalizes killed watchdog exit 137 to 124 (codex-worker-shell.sh:165-221).
`run.cjs` has its own deadline, sends `turn/interrupt`, closes its App Server,
and emits exit 124 for `worker_timeout`, 130 for interruption, otherwise 1
(run.cjs:157-160, 229-242, 258-268). The executor copies raw stdout to its
report before remapping 124 to wrapper exit 5 (codex-executor.sh:222-298);
the reviewer writes a raw failure report on 124/nonzero and rejects malformed
required report contracts as exit 6 (codex-exec.sh:1003-1062, 1262-1305).

`sgsd_codex_worker_finish` finds exactly one record by wrapper attempt, requires
core `completed` for wrapper exit zero, and writes immutable
`wrapper-result.json` with core worker/thread/turn plus wrapper exit/report
hash/bytes (codex-worker-shell.sh:228-276). `control status` currently returns
`mailbox.list` rows; `receipt` returns an applied/rejected result or queued/
unconfirmed state (control.cjs:4-17; mailbox.cjs:103-110, 151-163).

Retained continuation is already exact at the logical thread level:
`SGSD_WORKER_RESUME_ID` reads a completed old record, rejects an active one,
requires model/effort equality, starts a new record, and uses `claimThread` to
prevent concurrent ownership (run.cjs:40-59, 162-175; mailbox.cjs:164-173).
Commands are already instance/thread/turn bound before forwarding, and stop
interrupts then closes the owned App Server tree (run.cjs:204-228; worker test
141-154). Existing active liveness is not exact: records store only `pid`, and
`mailbox.list` converts an active row to orphaned solely when `alive(pid)` is
false (mailbox.cjs:74, 81-95, 103-110). Therefore a reused PID can satisfy the
current normal status path. The reusable Linux lifecycle primitive already
compares PID, `/proc` start time, executable, and argv (lifecycle.cjs:104-120);
reuse it rather than matching image names. Native Windows is not covered: the
shared shell explicitly refuses win32/interop dispatch before launch
(codex-worker-shell.sh:183-193). This plan retains that explicit platform gap;
it does not claim a Windows process test.

## Existing coverage map and S1 deltas

| S1 acceptance case | Current status and evidence | Planned delta |
| --- | --- | --- |
| 1. Dead owned process/no exit file, unrelated live worker, PID reuse | **Missing.** `worker.test.cjs:141-154` proves stop cleans a known child; `mailbox.cjs:103-110` is PID-only. | T1 exact identity/status/control fixture. |
| 2. Empty/malformed reports fail; nonzero preserves useful artifacts | **Partial.** `worker.test.cjs:111-117` rejects empty, disconnect, malformed transport and permission cases; `:294-300` retains native responses through failure/timeout/death. `launch.test.cjs:293-300` retains non-success wrapper exits, and `:490-504` binds failure receipts, but no one observation joins them. | T2 distinct fields and retained delivery metadata; T3 real wrapper proof. |
| 3. Long read-only work; bounded wait; authorized cancellation and fan-out | **Partial.** `worker.test.cjs:185-191` and `:320-326` bound input/pre-ACK deadlines; `:101-109` proves exact turn stop; `launch.test.cjs:303-353` bounds a FIFO and cleans descendants. No test proves no-source-change activity, owner-required cancellation, or fan-out in the real adapter. | T1 owner/fan-out contract; T3 budget/observation/cancel fixture. |
| 4. Retained continuation binds owned instance/result | **Partial.** `worker.test.cjs:119-139` proves claim and recorded-thread resume; `:302-310` binds native usage to resumed thread/turn. It lacks process identity/delivery-observation binding. | T2 continuation observation fixture. |
| 5. Four fields remain separate | **Missing.** Core status and wrapper receipt exist, but there is no delivery observation with the four required fields. | T2 versioned bounded record and tests. |
| 6. Normal wrapper/skill path consumes observation | **Partial.** SKILL.md:98-104 requires wrapper exit and normal validation; shell writes a receipt (codex-worker-shell.sh:234-276); `launch.test.cjs:143-171,293-300,490-504` exercises wrappers. No wrapper consumes an exact process observation. | T3 shared-shell guard and real wrapper test. |
| 7. Non-Clarity Linux fixture and honest Windows handling | **Partial.** Temporary Linux wrapper fixtures are product-neutral (`launch.test.cjs:39-70`) and installed Linux path is exercised (`install.test.cjs:57-248`); native Windows dispatch is intentionally refused, not exercised. | T3 explicit no-product-path fixture assertion and retained Windows gap. |

`worker.test.cjs:111`, `:141`, `:294`, `:320`, and `:402-409` are retained
regressions, not substitutes for the seven failing-first tests above. In
particular `:402-409` proves unacknowledged native usage never counts and an
earlier failure survives timeout cleanup; it does not prove exact process
ownership or normal-caller consumption.

## Task execution detail

### T1 — exact identity and adapter-level scope

Write the two named worker tests first. Add a generic worker-record identity
using the existing Linux lifecycle routine; it must require the returned PID,
start time, executable and argv identity and must classify missing/mismatched
identity as non-live/unknown, never as an image-name match. Preserve old
non-active records and do not signal a process from an observation path. Extend
status rows with the exact liveness observation so the supervisor's existing
`control status` call sees it.

Make `SGSD_WORKER_FANOUT_LIMIT` an optional positive integer inherited by
`run.cjs` into the worker metadata. Before creating an active worker, reject a
new worker for the same owner/workspace only when that explicit limit would be
exceeded; unset means no new cap. For a record that has an owner, make
reply/steer/stop require the same nonempty owner before any command file or
signal-capable path; write a named rejected control result that `receipt` can
retrieve. Owner-less legacy records retain current behavior. This is scope
enforcement in mailbox/control, not a supervisor-text convention.

### T2 — terminal delivery observation

Write the three named direct-adapter tests first. Add a bounded,
content-minimizing `delivery_observation` to the worker record with exactly
these independent top-level fields: `process_outcome`, `report_validity`,
`observed_delivery`, and `independent_verification`. Define only explicit
states; use `not_run`/`unknown` where a layer has not observed evidence. An
agent final message may create observed-delivery metadata (thread/turn binding,
bytes, digest, timestamp) but cannot create completion by itself. Empty,
malformed or unacknowledged reports remain invalid; a later failure, timeout,
interruption, death or identity mismatch updates only process outcome and keeps
the already observed metadata. Do not persist prompts, raw reports, provider
diagnostics, credentials, source-content scans, or an image-name process test.

Bind a resumed record's observation to its fresh `worker_id`/`instance`, the
recorded resumed thread and its acknowledged new turn. Retain `claimThread` and
all command identity checks. Independent report validators/gates set only their
own verification field; they must not rewrite a failed process outcome or
invalid report as success.

### T3 — shared wrapper consumption, liveness budget, and portability

Write the three named real-wrapper tests first using only temporary fixture
repositories and the local App Server fixture. In `sgsd_codex_worker_finish`,
read the unique wrapper-attempt record through the exact observation contract
before a zero wrapper receipt can be written. A dead, missing, unknown or
identity-mismatched active record must result in non-success/no success banner;
preserve the receipt's truthful nonzero outcome and any existing report
hash/byte evidence. Do not bypass this via `codex-executor.sh`: it already uses
this shared seam.

Document one observation interval from the existing shared-shell watchdog
slack, and test that a long read-only fixture makes no source edits yet remains
supervisable until its declared timeout or a correctly owner-scoped stop.
Assert the wrapper return is within declared budget plus that one interval.
Exercise the optional fan-out rejection and wrong/missing owner through real
`control.cjs`, not a helper-only call. The fixture path must have only a local
`.planning` project root and no SAP, VTP, Clarity, devcp, or operator-home
literal. Linux is covered. Native Windows remains an explicit retained gap
because its shell path currently fails before dispatch; do not mark an
unsupported platform as tested.

## Verification sequence

After each task, run its focused command. Then run the direct and affected
wrapper/launch/install coverage necessitated by the changed adapter, shared
shell and installed closure:

```bash
node --test super-gsd/tools/codex-worker/worker.test.cjs
node --test super-gsd/tests/codex-worker/usage.test.cjs
node --test super-gsd/tests/codex-worker/permissions.test.cjs
node --test super-gsd/tests/codex-worker/launch.test.cjs
node --test super-gsd/tests/codex-worker/install.test.cjs
npm run test:codex-worker
git diff --check
```

Do not run an install, provider call, network action, new gate, or phase work
for 174-179 or Atlas 171/172. After these local checks, use the existing
sequential independent reviews only: first a Spec review and then an ATC review
through `super-gsd/scripts/codex-exec.sh`, each explicitly selecting
`--model gpt-5.6-terra --reasoning xhigh`, with fresh prompt/report paths,
`--phase 173 --plan 173-02`, a bounded review timeout, and an owner. For each,
confirm the matching `wrapper-result.json` has the exact worker/attempt/thread/
turn, exit, report path, SHA-256 and bytes before consuming the report. Preserve
any review failure; do not retry paid review to manufacture a pass.

## Non-goals and rollback

This plan does not change app-server framing (173-01), App Server protocol
semantics, provider/model selection, source-file progress heuristics, Atlas
accounting, report-gate criteria, Windows support, any installation, or any
phase outside 173. It adds no gate. Root alone owns candidate publication and
normal installation. If the single candidate commit is unsuitable, rollback is
one `git revert <candidate-commit>` followed by Root's established publication/
install procedure; no state, evidence, or unrelated dirty work is removed.
