---
schema_version: 2
status: COMPLETE
phase: 170
plan: "170-10"
source_revision: effccead303145f7330f83fb7676761cfd8c999f
authorized_at: "2026-09-09T22:42:46Z"
work_deadline: "2026-09-10T07:42:46Z"
authorization: "Operator: you have tonight, circa 9 hours to close the complete gap. Including muda and atc. Go"
expected_ATC_tier: FULL
skip_gates: []
tasks:
  - id: T170-10-1
    agent: gsd-executor
    model: codex
    files_touched:
      - super-gsd/tools/telemetry-atlas/sgsd-ledger.cjs
      - super-gsd/tools/telemetry-atlas/sgsd-ledger-reader.cjs
      - super-gsd/tools/telemetry-atlas/sgsd-ledger.test.cjs
    input_contract: "Existing source producer ledgers, canonical contract/accounting and registered project identities; the bounded operational-record contract below."
    output_contract: "Pure content-free canonical operational projections and typed numeric MUDA detail, plus safe incremental reading; no native tokens, invented run IDs, provider calls or producer writes."
    hypothesis: "Existing activity can be recorded independently of native token accounting, including legacy records without run identity."
    falsifier: "Raw text escapes; source bytes change; replay duplicates; history acquires current run; malformed/unreadable data disappears from coverage."
    stop_rule: "RED then GREEN private-fixture tests for named families, privacy, tails, rotation, replacement, finite bounds and replay; independent spec then quality review."
  - id: T170-10-2
    agent: gsd-executor
    model: codex
    files_touched:
      - super-gsd/scripts/lib/atlas-observation.cjs
      - super-gsd/scripts/lib/gate-value-log.cjs
      - super-gsd/scripts/lib/review-ledger.cjs
      - super-gsd/scripts/lib/gate-evidence-log.cjs
      - super-gsd/scripts/lib/route-ledger.cjs
      - super-gsd/scripts/lib/edge-guard.cjs
      - super-gsd/scripts/lib/commit-gate-shadow-log.cjs
      - super-gsd/scripts/lib/orchestrator-live-writer.cjs
      - super-gsd/scripts/sgsd-muda-audit.sh
      - super-gsd/tools/codex-worker/mailbox.cjs
      - super-gsd/tools/telemetry-atlas/sgsd-producer-contract.test.cjs
    input_contract: "Actual append/decision boundaries; SGSD_RUN_ID when present; existing mechanical and qualitative MUDA predicates/results."
    output_contract: "Additive observation identity at real writes and structured MUDA numeric/eligibility/skip evidence; original policy, verdicts, output and return behavior preserved."
    hypothesis: "New source records retain real session context while legacy records remain explicitly uncorrelated."
    falsifier: "Historical aggregation gets current identity; no-input PASS becomes measured coverage; a new model call or changed gate result appears."
    stop_rule: "Zero-provider parity tests cover append failure, historical normalization, absent env, MUDA dry-run/debug/eligible/ineligible/error paths, and existing writer self-tests; independent spec then quality review."
  - id: T170-10-3
    agent: gsd-executor
    model: codex
    files_touched:
      - super-gsd/tools/telemetry-atlas/sgsd-ledger-runtime.cjs
      - super-gsd/tools/telemetry-atlas/sgsd-ledger-runtime.test.cjs
      - super-gsd/tools/telemetry-atlas/global.cjs
      - super-gsd/tools/telemetry-atlas/global.test.cjs
      - super-gsd/tools/telemetry-atlas/server.cjs
      - super-gsd/tools/telemetry-atlas/receiver.test.cjs
    input_contract: "T1 projections/readers, registered project.json files and exact run registrations, existing receiver lifecycle and canonical store."
    output_contract: "Automatic receiver-owned fair bounded project collection, durable cursor/replay, separately scoped operational stores, validated original run references, health and low-cardinality overhead counters. Native metrics files remain unchanged by operational capture."
    hypothesis: "One collector covers all registered SGSD projects across sessions without per-project enablement or another model/daemon."
    falsifier: "Restart loses a source occurrence; hot projects starve others; operational rows enter native totals; stale receiver fingerprints miss a new dependency; shutdown leaks collection."
    stop_rule: "Private integration proves two projects, overlapping sessions, retry/storage pressure/restart/cleanup, exact-run and null-run cases and unchanged native accounting; independent spec then quality review."
    depends_on: [T170-10-1, T170-10-2]
  - id: T170-10-4
    agent: gsd-executor
    model: codex
    files_touched:
      - super-gsd/tools/telemetry-atlas/operation-report.cjs
      - super-gsd/tools/telemetry-atlas/operation-report.test.cjs
      - super-gsd/tools/telemetry-atlas/audit.cjs
      - super-gsd/tools/telemetry-atlas/audit.test.cjs
      - super-gsd/tools/telemetry-atlas/run-self-test.cjs
      - super-gsd/tools/telemetry-atlas/install.test.cjs
      - super-gsd/tools/telemetry-atlas/README.md
      - super-gsd/config/hook-manifest.json
    input_contract: "Operational observations/source provenance, native accounting audit, collector health and source coverage."
    output_contract: "Existing audit includes explicit operation-family capture/lag/gaps, with a deterministic read-only JSON report and source verification; installed delivery proven on Linux."
    hypothesis: "Operator can see what ran, what was captured, what is missing and collector overhead without paid analysis calls or false token sums."
    falsifier: "Empty data becomes complete coverage; legacy/fixture rows become current production; report hides rejected/uncorrelated data or copies source text."
    stop_rule: "Report/privacy/real-source reconciliation tests and existing Atlas suite pass; actual Linux producer records incl MUDA/ATC reconcile after normal guarded update; registered reviews remain required."
    depends_on: [T170-10-3]
  - id: T170-10-5
    agent: gsd-executor
    model: codex
    files_touched:
      - super-gsd/scripts/sgsd-muda-audit.sh
      - super-gsd/tools/telemetry-atlas/sgsd-producer-contract.test.cjs
    input_contract: "Actual deployed MUDA invocation on resolved Clarity phase v30-07-product-intelligence-api exited before WASTE/ledger because numeric-only phase extraction fails under errexit."
    output_contract: "Namespaced phase v30-07 and existing numeric/dotted phase identities reach the same existing MUDA audit/append path without changing mechanical verdict, thresholds, qualitative eligibility or curation policy."
    hypothesis: "A bounded phase-identity parsing repair permits the real project's existing audit to produce its own truthful telemetry row."
    falsifier: "Namespaced phase still exits silently, numeric/dotted phase identity changes, or a debug probe/policy override substitutes for the actual mechanical audit."
    stop_rule: "Reproduce actual slug failure with a zero-provider fixture; repair and rerun existing producer/native tests; independent SPEC then registered FULL ATC; normal update and actual MUDA source/receipt proof."
    depends_on: [T170-10-4]
  - id: T170-10-6
    agent: gsd-executor
    model: codex
    files_touched:
      - super-gsd/scripts/lib/atlas-observation.cjs
      - super-gsd/tools/telemetry-atlas/sgsd-producer-contract.test.cjs
      - super-gsd/tools/telemetry-atlas/README.md
    input_contract: "Measured actual worker-events ledger: 5590 save observations, 5569 identical consecutive selected snapshots excluding timestamp/observation envelope; existing worker usage poll saves the same record repeatedly."
    output_contract: "Change-triggered save telemetry suppresses only already-successfully-emitted identical selected snapshots; first save, changed state/identity/pending count, create, submit and result remain observable. Primary mailbox writes and native usage capture are unchanged."
    hypothesis: "Coalescing observational no-op snapshots removes measured recorder waste and avoids prematurely exhausting bounded weekly storage without losing represented state transitions or communication events."
    falsifier: "A changed snapshot or real control boundary disappears; failed append is cached as delivered; two projects share dedup state; cache grows independently of live worker records; primary worker behavior changes."
    stop_rule: "Zero-provider repeat/change/control/failure/project-isolation regressions, existing producer/native tests, independent SPEC then registered FULL ATC; normal incremental update and installed hashes. Preserve historical duplicate rows."
    depends_on: [T170-10-2]
semantic_acceptance_criteria:
  - input: "Actual registered DEVCP project source ledgers and deployed operational observations after ordinary SGSD activity, including real MUDA and ATC/review records."
    expected_outcome: "Read-only source verification accounts for supported source records by original byte/digest provenance, without duplicating native tokens or inventing original sessions. Missing/nonexecuted families are explicit, not PASS."
    verification_cmd: "node super-gsd/tools/telemetry-atlas/operation-report.cjs --root /home/jackberrow/.local/state/sgsd/telemetry/global --verify-sources --json"
  - input: "Installed Atlas ledgers and receiver health following update and automatic collection."
    expected_outcome: "Existing audit retains native checksum/dedup/registration validation and reports separately validated operational capture, pending records and gaps; WARN is not a passing complete-coverage claim."
    verification_cmd: "node super-gsd/tools/telemetry-atlas/audit.cjs --root /home/jackberrow/.local/state/sgsd/telemetry/global --json"
---

# Linux operational capture implementation plan

For agentic workers: use subagent-driven-development with isolated task context,
test-driven-development and independent specification then quality reviews.

Goal: finish the missing passive Linux SGSD activity capture, expressly MUDA and
ATC, and make efficiency/coverage inspectable tonight. No replacement gate or
new benchmark orchestration system is part of this work.

Architecture: existing append-only logs and bounded worker state/receipt
observations feed the existing receiver. Operational evidence lives beside,
not inside, native token-accounting ledgers. Exact native/run identities are
joined only when already recorded and validated. Null original run identity is
preserved for legacy activity. Existing gate policy remains authoritative.

Tech stack: current Node CommonJS, Bash producers, existing canonical store,
receiver health/metrics and existing installer; no new infrastructure.

## Scope decision and preservation

The operator's latest instruction approves the previously proposed practical
existing-log integration and its implementation/deployment to DEVCP Linux.
This is a new active capture-repair increment under open P170, not a claim that
170-09 acceptance passed, nor retroactive activation/closure of P171/P172. It
brings the operational capture slice forward under this explicit task allowlist;
all other governing milestone requirements and failed evidence remain intact.
The old one-use benchmark is not rerun. No gate is skipped or weakened.

Windows remains a separate required platform. A 24-hour soak cannot finish
inside nine hours; tonight must deliver implementation and measured real-data
capture, with longer collection time reported honestly rather than fabricated.
No model/auth/default change, old-session restart, project-pin sweep, source
ledger rewrite, broad filesystem scan or unsupported model fallback is included.
Deployment follows the existing reviewed publication/update path and preserves
unrelated files and processes. Source tests execute in complete private copies.

## Operational record contract and concrete interfaces

T1 exports `SOURCES`, `projectRecord({family,row,projectId,sourceId,recordDigest,
sequence,observedAt})` returning `{event,detail,reason}` and a reader module
`readBatch({file,cursor,maxBytes,maxRecords,maxLineBytes})` returning
`{records,cursor,bytesRead,pendingBytes,gaps,eof}`. Records carry original byte
offset/length and SHA-256, never retained raw source strings outside the read.
Projection must reject unknown schema/unsafe shapes explicitly. Details are
typed content-free numeric/boolean/closed-enum data, not arbitrary metadata.

Canonical operational events use source `sgsd_ledger`, project-registration
scope, distinct stable source occurrence identity, actual producer timestamp or
explicit unknown-time observation, and no input/output/cache/token-cost fields.
Run identity comes only from recorded `sgsd_run_id`/`atlas_run_id`, never from
legacy envelope `run_id`, current environment during backfill, or timestamps.
Caller strings that are not closed enums are hashed; prompts, error prose,
report text, command lines, private paths, `_legacy` and live `data` are not copied.
MUDA measurements/thresholds/denominators must be numeric with named probes;
unknown denominator remains unknown, and synthetic/debug checks are identified.

Producer enrichment uses `atlas_observation:{schema_version:1,observation_id,
sgsd_run_id,gate_invocation_id}`. The observation ID is minted once at the actual
append boundary; optional invocation ID is preserved only from an actual caller.
No current environment is read during historical aggregation. MUDA adds
`atlas_muda` with versioned numeric probe detail and closed-code qualitative
eligibility/results. Worker create/save/submit/result emits a selected-field
`metrics/worker-events.jsonl` observation after successful primary publication;
its failure is fail-open and never changes mailbox behavior. This captures
transient activity that polling a mutable state snapshot would miss.

T2 narrow producer repair discovered by failing fixtures: the mechanical probe
branch enables Bash errexit, so a later nonzero qualitative wrapper can abort
before its existing degraded-result branch and ledger append. Capture that
wrapper status while preserving the incoming shell-option state, then execute
the existing degraded branch and documented mechanical exit. This is an explicit
bugfix, not a claim of byte-for-byte parity on the formerly aborted path. Keep
legacy qualitative verdict parsing/output intact; strict telemetry counts use
separate fields. No threshold, eligibility condition or gate enforcement changes.

Sources include gate-value, canonical/per-phase ATC reviews, gate evidence,
mechanical and qualitative MUDA, routing, edge guard, live orchestration, worker
state and immutable wrapper results. Other named `.planning/metrics/*.jsonl`
sources receive safe generic activity projection plus an explicit schema/detail
coverage classification; an unknown producer must not vanish from the census.
Do not parse arbitrary markdown/transcripts for model text or invented findings.

Reader bounds: 256 KiB/file/batch, 256 records/file/batch, 64 KiB maximum row;
file-descriptor and parent containment/ownership/symlink/hardlink checks precede
reads. Partial tails are retried; truncation/replacement is detected and replayed
with durable identity/dedup rather than silently advanced. Oversized/malformed
complete rows produce a bounded gap and count in the source denominator.

The incremental reader checks file identity, size, timestamp and bounded content
anchors; it does not claim continuous proof of every old byte during an append.
An old-middle in-place rewrite combined with growth can evade those anchors.
Existing append-only producer contracts remain the normal input assumption;
T4 source-digest reconciliation checks stored observations against actual source
bytes and reports mismatches or an incomplete/racing verification explicitly.
Do not add a full-history read to every five-second poll to hide this limitation.

Runtime uses `createStore` with separate
`projects/<digest>/operational/` storage (256 MiB, 100000 event-index entries per
project); at most eight stores and 150000 indexed entries cached globally. Idle
sources do not reconstruct a store. This stream preserves
uncorrelated observations without weakening native `createGlobalStore` rules.
Content-free provenance/details are bounded and digest referenced. Durable
cursors advance only after accepted/duplicate/conflict or explicit recorded
rejection; storage failure retains pending input. No raw-content outbox.
Operational capture writes this canonical-shaped stream directly inside the
existing receiver process; it does not duplicate rows through the native metrics
HTTP intake. Exact recorded run references are checked with existing `readRun`;
unmatched or cross-project references are uncorrelated/gaps, never a guessed
current session. This prevents activity volume exhausting native usage storage.

First collection freezes a seven-day initial lookback in private collector
state; subsequent restarts reuse that exact cutoff. Older dated source rows
are counted as `excluded_before_capture_window`, not silently lost or labelled
captured; original ledgers are untouched. Unknown-time rows remain visible.
This is a bounded historical bootstrap, not a moving filter on new events.
The live census found approximately 89000 existing Clarity metric rows, 18000
since Monday, so unlimited historical ingestion would exhaust the original
25000-entry proposal before the weekly trial. Store-pressure warnings and a
hard bound remain mandatory; no automatic source/evidence deletion is allowed.

One receiver-owned collector, 5-second poll, non-overlapping cycles, 1 MiB read
budget/cycle, 100 ms processing budget/cycle, at most 32 projects enumerated per
discovery batch; project/file rotation ensures fairness. Directory iterators are
bounded and closed. Discovery uses only registered project roots, never $HOME
search. New sessions/projects become visible automatically. Health records
cycle duration/bytes/lag/pending/rejections and family counts using bounded
labels. Native usage counters remain unchanged by semantic collection.

## Task checklist and verification sequence

- [x] T1: write failing projection/reader tests; run in private source copy;
  implement the fixed APIs and source mappings; rerun tests; spec then quality.
- [x] T2: write failing writer/MUDA parity tests; enrich only true append paths;
  no enrichment during historical aggregate normalization; run existing writer
  tests and fixture-only MUDA scripts; spec then quality.
- [x] T3: write failing auto-collection/restart/identity/bounds tests; integrate
  the receiver, attested dependency list and metrics; run native Linux private
  integration; spec then quality.
- [x] T4: write failing report/source-verification tests; integrate existing
  audit and all test discovery/install checks; verify no token double counting;
  spec then quality/registered ATC review before publication.
- [x] T5: repair the demonstrated namespaced-phase MUDA producer abort, with
  regression, independent SPEC, registered FULL ATC and guarded incremental update.
- [x] T6: coalesce measured identical worker-save observations without suppressing
  real state/control changes; verify independently and publish normally.
- [x] Publish reviewed source through the existing normal DEVCP update path;
  compare installed hashes and protected config/session state before/after.
- [x] Observe actual source rows and automatic capture, with source-digest
  reconciliation for MUDA/ATC, low-overhead sampling and explicit idle/gap status.
- [x] Hand off the Linux result with source revision, capture evidence, measured
  overhead and any genuinely remaining limitations; preserve all failure history.

Concrete private commands after their files exist:

```sh
node --test super-gsd/tools/telemetry-atlas/sgsd-ledger.test.cjs
node --test super-gsd/tools/telemetry-atlas/sgsd-producer-contract.test.cjs
node --test super-gsd/tools/telemetry-atlas/sgsd-ledger-runtime.test.cjs
node --test super-gsd/tools/telemetry-atlas/operation-report.test.cjs
npm run test:atlas
```

Falsifiers include canary content surviving projection, source rewrite, wrong
project/run attribution, missing source records hidden by the report, dropped
pending records after receiver interruption, and native totals increasing from
operational delivery. A fixture PASS is never relabelled real acceptance.

## Time and spend discipline

Work window starts 22:42:46 UTC and ends approximately 07:42:46 UTC. Use compact
task-specific agent contexts, no recursive delegation or paid availability
probes. Offline tests precede any real review execution. Each review receives
only its task diff/contract; repeated findings trigger code repair, not a fresh
full benchmark. Telemetry itself must generate zero model calls. Do not invent
a combined token-spend total when the available ledgers omit this API session.

Review execution adjustment at 23:40Z: the platform refused new reviewer threads
and two fresh native SPEC calls timed out without verdicts. Existing independent
agents may cross-review the task they did not implement. No self-review substitutes
for acceptance. The existing registered ATC path remains required; subsequent
quality review should receive a bounded self-contained candidate/diff packet,
not repeat open-ended repository exploration. T1/T2 may share one full-scope ATC
review after both independent SPEC reviews pass, recorded as one invocation.

Parallel delivery adjustment at 00:13Z: T3 and T4 may implement independent
allowlisted code/tests against the frozen capture state/receipt interface below.
T4's dependency remains binding for integration verification and acceptance;
neither is accepted or published until T3 passes SPEC/quality and the combined
native tests succeed. This changes sequencing only, not scope or gate policy.
T3/T4 may share one FULL-scope registered quality/ATC invocation after both
independent cross-SPEC reviews pass, as for T1/T2. Record the actual single
invocation and findings; do not duplicate its counts or treat tests as ATC.

T3 exports `createLedgerRuntime({root,now,storeFactory,readRunFn,limits})` with
`cycle()`, cached `status()` and idempotent `close()`, plus read-only
`readCaptureState({root,projectId})` and `capturePaths(root,projectId)`.
Per-project operational storage adds fsync/rename `sgsd-ledger-state.json`
and fsynced `sgsd-ledger-receipts.jsonl` (256 MiB cap/project; measured-capacity
adjustment below). Private state
alone contains validated relative source paths; receipts expose only hashes,
file identity, byte offset/length/digest, stable observed time, disposition,
closed reason, source event ID and digest-referenced content-free typed detail.
Pending batches are bounded to 256 records and freeze original run resolution.
Stable receipt IDs allow crash replay without inflated source counts or changed
first correlation. Reports validate repeated receipts, not silently sum them.
Collector shutdown precedes listener/store closure. Cached store index bounds
must conservatively account for conflicts as well as accepted events.

Installer dependency adjustment at 00:23Z: the existing read-only
`hook-install-contract.cjs --check-manifest` fails for four hooks after T2's
new helper expands their transitive closure. T4 therefore includes the derived
`super-gsd/config/hook-manifest.json`. Refresh dependency arrays with the existing
renderer after T3's full runtime exists, and verify the existing check/install
tests. Do not change hook registrations, policies or the manifest-drift gate.
The root agent owns this mechanical metadata refresh; T4's agent owns its
original report/audit/test files. This resolves a demonstrated delivery blocker,
not an unrelated installer redesign.

ATC repair clarification at 01:29Z: the actual combined T3/T4 FULL review blocked
on partial canonical scans being treated as definite corruption and incomplete
conflict/orphan reconciliation. Receipt proof may add `canonical_event_id` and
`canonical_payload_sha256`, derived only from the existing candidate
canonicalization and populated only after an accepted/duplicate/conflict store
result. The event ID is the candidate ID: for conflicts it matches the stored
`conflicting_event_id`; payload SHA matches `conflicting_payload_sha256`. The
report must join normal and conflict records with those proofs and count
distinct matched physical canonical IDs, including duplicate-of-conflict replay.
Retain explicit legacy/unknown proof when a prior private diagnostic receipt
lacks additive fields; never fabricate conflict verification. Raced or bounded
scans remain incomplete, while stable proven corruption fails. The same review
requires conservative receipt-capacity admission before canonical ingestion and
a durable capacity gap without advancing the pending source cursor. These are
repairs inside the existing T3/T4 files and budgets, not gate-policy changes.

Measured receipt-capacity adjustment at 01:33Z: a complete private read-only
Clarity bootstrap produced 87,011 receipts occupying 110,611,691 bytes before
the required additive conflict proofs. A 128 MiB cap would leave little room
for the upcoming weekly trial. Increase only the receipt cap to 256 MiB/project
and share that exported bound with the report. Canonical 256 MiB/100,000-index,
state, read, cache and processing limits remain unchanged. Capacity admission
also preserves the existing 10% free-space floor for receipt-only/excluded
batches. Do not prune, rotate away, rewrite or delete evidence. Full conditions
must remain explicit; this is finite measured headroom, not unlimited retention.

Live producer repair at 02:19Z: the first normal installed MUDA invocation on
Clarity's resolved `.planning/phases/v30-07-product-intelligence-api` exited 1
without WASTE.md or a MUDA ledger row. Its numeric-only `PHASE_NUM` grep fails
under errexit after the mechanical probe. T170-10-5 is an explicitly bounded
follow-up inside the two existing producer files. Preserve ordinary numeric
and dotted identities, support the actual namespaced identity, and retain
mechanical/qualitative policy and the first failed evidence. Do not rename the
project's phase, choose a fake numeric phase, inject a synthetic MUDA result,
disable the mechanical probe, or relabel this producer failure as capture PASS.

Live efficiency repair at 02:25Z: the actual overnight worker-events ledger has
5,599 rows/3,967,231 bytes, including 5,590 saves. Of those, 5,569 (99.624%) repeat
the previous selected snapshot for the same worker after excluding timestamp
and newly minted observation envelope. The 200 ms usage-poll save path can
therefore consume the finite 100,000-event operational index during normal
long-running work. T170-10-6 may coalesce only identical save projections at
the observational helper; it must not alter mailbox publication or native usage
capture. A weakly held per-record cache, with project and selected snapshot in
its identity and updated only after successful append, is sufficient; no new
daemon, persisted cache, heartbeat framework or source-history rewrite. Create,
submit, result and actual selected state/identity/pending changes stay emitted.
T5's test author is frozen; T6 owns the shared producer test file only after
independently reviewing T5, preventing concurrent edits. T5/T6 may share one
FULL registered follow-up ATC after independent SPEC and native verification.

## Implementation outcome

Linux capture increment complete: core `59762975`, producer repairs `50440c65`.
Both were published and installed through the ordinary guarded update. Actual
ATC review/gate records and actual Clarity MUDA observation are source-byte,
receipt and canonical verified. MUDA's genuine stale-narrative FAIL and its
qualitative skip were retained, not changed to passing results. Details and
exact review/test/deployment/resource evidence are in the companion report.

This completes the implementation and observed-capture slice, not a completed
weekly trial, exhaustive provider-billing reconciliation, historical backfill,
formal phase/milestone closure, old-session/pin refresh, or Windows delivery.
Historical collection continues automatically with bounded resources and zero
model calls; absent/unsafe/malformed sources and unexecuted families remain
explicit. No operator action or additional agent run is required to drain it.
