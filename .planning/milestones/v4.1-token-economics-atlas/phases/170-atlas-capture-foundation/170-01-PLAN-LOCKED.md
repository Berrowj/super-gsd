---
schema_version: 2
phase: 170
slug: atlas-capture-foundation
milestone: v4.1-token-economics-atlas
status: IN_PROGRESS
revision: 4
governing_decision: .planning/analyses/2026-09-03-sgsd-token-economics-atlas-design.md
evidence_paths:
  - .planning/analyses/2026-09-03-sgsd-token-economics-atlas-design.md
  - .planning/milestones/v4.1-token-economics-atlas/phases/170-atlas-capture-foundation/CONTEXT.md
depends_on: []
intent: >
  Ship the first passive Atlas increment: content-free native telemetry intake,
  versioned validation and deduplication, bounded local storage, health and
  Prometheus projections, explicit lifecycle control, and fail-open attachment
  that preserves Claude argv and the existing sg/tmux topology.
execution_mode: three-dependent-codex-tasks
expected_ATC_tier: GATE
skip_gates: []
lessons_path: null
prior_errors_lookup: true
lock_status: locked
locked_at: 2026-09-07T12:00:00+01:00
locked_by: codex
allowed_files:
  - super-gsd/tools/telemetry-atlas/contract.cjs
  - super-gsd/tools/telemetry-atlas/server.cjs
  - super-gsd/tools/telemetry-atlas/lifecycle.cjs
  - super-gsd/tools/telemetry-atlas/run-self-test.cjs
  - super-gsd/tools/telemetry-atlas/store.test.cjs
  - super-gsd/tools/telemetry-atlas/runtime.test.cjs
  - super-gsd/tools/telemetry-atlas/receiver.test.cjs
  - super-gsd/tools/telemetry-atlas/stack.test.cjs
  - super-gsd/tools/telemetry-atlas/stack.cjs
  - super-gsd/tools/telemetry-atlas/otlp.cjs
  - super-gsd/tools/telemetry-atlas/quota-sampler.cjs
  - super-gsd/tools/telemetry-atlas/README.md
  - super-gsd/tools/telemetry-atlas/install.test.cjs
  - super-gsd/install.sh
  - super-gsd/config/telemetry-atlas.json
  - super-gsd/scripts/sgsd-remote-tmux.sh
  - super-gsd/hooks/sgsd-statusline.js
  - super-gsd/config/hook-manifest.json
  - package.json
forbidden_files:
  - super-gsd/tools/cockpit-sidecar/cockpit-sidecar.cjs
  - super-gsd/registry/gates.yaml
  - .planning/milestones/v4.0-install-contract/phases/169-atomic-install-transaction/CONTEXT.md
invariants:
  - Telemetry creates zero model calls and never changes prompts, model, effort, gates, routing, retries, or session topology.
  - User prompts, assistant responses, tool content, raw API bodies, account email, and account identifiers are rejected rather than stored.
  - All listeners bind loopback only and all failures are fail-open for SGSD execution.
  - Event identity is deterministic; an identical replay is a no-op and a conflicting replay appends an integrity_conflict without overwriting the first event.
  - Canonical JSONL is append-only; malformed crash tails are quarantined or reported and never make valid prior rows unreadable.
  - VTP is optional and its absence cannot prevent collection or launch.
acceptance_commands:
  - node super-gsd/tools/telemetry-atlas/run-self-test.cjs
  - node super-gsd/tools/telemetry-atlas/lifecycle.cjs status --json
  - node super-gsd/tests/install-contract/assert-install-contract.cjs --case empty-module-tree-real-install
rollback_plan: >
  Disable and stop the Atlas through lifecycle.cjs, revert P170-T3 then T2 then
  T1, and rerun the install-contract semantic case. Existing telemetry files are
  retained; rollback never deletes evidence.
risk_rating: high
operator_checkpoints:
  - DEVCP activation is explicit after local gates pass; sgsd-update must not silently enable telemetry.
  - Baseline starts only after one content-free event, health, permissions, and scrape evidence pass on DEVCP.
semantic_acceptance_criteria:
  - input: A valid content-free Claude OTLP JSON event submitted twice, followed by the same event ID with a changed permitted numeric field.
    expected_outcome: One canonical event is stored, the exact replay is counted as duplicate, and one integrity_conflict is appended without changing the first row.
    verification_cmd: node super-gsd/tools/telemetry-atlas/run-self-test.cjs --case ingestion-dedup-conflict
  - input: An event containing prompt, response, tool content, email, account ID, and raw body fields at arbitrary nesting depth.
    expected_outcome: The request is rejected with a privacy reason, no sensitive bytes enter JSONL, logs, metrics, or error output, and health remains available.
    verification_cmd: node super-gsd/tools/telemetry-atlas/run-self-test.cjs --case privacy-canary
  - input: A fake Claude executable launched once with a healthy Atlas and once with the Atlas absent.
    expected_outcome: Both launches receive byte-identical argv and preserve the direct tmux pane process; only the healthy launch receives process-scoped content-off OTEL environment and the absent launch proceeds within one second.
    verification_cmd: node super-gsd/tools/telemetry-atlas/run-self-test.cjs --case launcher-equivalence
known_deadends:
  - Do not treat the existing cockpit sidecar or token-attribution ledger as provider request telemetry.
  - Do not enable global Claude telemetry settings or capture raw content for later redaction.
  - Do not make Prometheus the canonical request ledger.
  - Do not report zero usage when coverage is absent.
tasks:
  - id: P170-T1
    type: event-contract-and-store
    agent: codex
    model: codex
    depends_on: []
    files_touched:
      - super-gsd/tools/telemetry-atlas/contract.cjs
      - super-gsd/tools/telemetry-atlas/run-self-test.cjs
    input_contract: Write red-first tests for validation, privacy rejection, deterministic IDs, replay deduplication, conflict rows, append-only JSONL, and malformed-tail recovery. Implement only the content-free schema and store needed to pass them.
    output_contract: A dependency-free CommonJS contract/store with explicit provenance and coverage fields; no raw content is accepted or logged.
    hypothesis: A small allowlisted envelope and deterministic append seam can preserve accounting truth without collecting conversational content.
    falsifier: Any forbidden canary reaches disk, duplicate rows inflate counts, a conflict overwrites evidence, or a malformed tail hides prior rows.
    stop_rule: Stop when every T1 test passes and the diff is confined to the two T1 files.
    verification_cmd: node super-gsd/tools/telemetry-atlas/run-self-test.cjs --task T1
    expected_ATC_tier: GATE
    known_deadends:
      - Never ingest first and redact later; reject non-allowlisted content at the boundary.
  - id: P170-T2
    type: loopback-receiver-health-and-metrics
    agent: codex
    model: codex
    depends_on: [P170-T1]
    files_touched:
      - super-gsd/tools/telemetry-atlas/server.cjs
      - super-gsd/tools/telemetry-atlas/lifecycle.cjs
      - super-gsd/tools/telemetry-atlas/run-self-test.cjs
      - super-gsd/config/telemetry-atlas.json
    input_contract: Add red-first real-socket tests for loopback binding, OTLP JSON intake, health, bounded Prometheus counters, PID identity, idempotent start/status/stop, port collision, malformed events, and fail-open disk pressure.
    output_contract: Explicit lifecycle control and a passive local receiver; no implicit download, enable, model call, or external bind.
    hypothesis: A bounded local receiver can establish Monday capture without coupling SGSD execution to telemetry availability.
    falsifier: Non-loopback bind, unsafe PID kill, unbounded label cardinality, a listener failure blocks SGSD, or canonical storage is overwritten/deleted.
    stop_rule: Stop when all T1/T2 cases pass and no process remains after the suite.
    verification_cmd: node super-gsd/tools/telemetry-atlas/run-self-test.cjs --task T2
    expected_ATC_tier: GATE
    known_deadends:
      - Never reuse an occupied port unless PID and command-line identity match.
  - id: P170-T3
    type: launcher-attachment-and-install-delivery
    agent: codex
    model: codex
    depends_on: [P170-T2]
    files_touched:
      - super-gsd/tools/telemetry-atlas/lifecycle.cjs
      - super-gsd/scripts/sgsd-remote-tmux.sh
      - super-gsd/hooks/sgsd-statusline.js
      - super-gsd/config/hook-manifest.json
      - super-gsd/tools/telemetry-atlas/run-self-test.cjs
      - package.json
    input_contract: Add red-first fake-Claude equivalence, status-line output-equivalence, quota-capture, and install-delivery tests; expose the fixed allowlisted process environment from lifecycle.cjs, then attach only those process-scoped content-off OTEL variables when verified healthy. Preserve direct Claude launch, argv, pane, status-line bytes, and absent-sidecar latency. The status line may submit only content-free five-hour/seven-day percentages, reset epochs, context usage, cache counters, session ID and prompt ID, with a bounded localhost timeout.
    output_contract: The Atlas ships through SGSD's install contract and can be explicitly enabled on DEVCP without becoming a launch dependency.
    hypothesis: Health-gated environment-only attachment preserves delivery behavior while adding native request telemetry.
    falsifier: Claude argv/topology changes, unhealthy telemetry delays launch over one second, content flags are not forced off, or installed files are missing.
    stop_rule: Stop when the full Atlas suite and install-contract semantic case pass with allowed-file-only diff.
    verification_cmd: node super-gsd/tools/telemetry-atlas/run-self-test.cjs && node super-gsd/tests/install-contract/assert-install-contract.cjs --case empty-module-tree-real-install
    expected_ATC_tier: GATE
    known_deadends:
      - Do not launch Claude through a telemetry wrapper or silently enable collection during update.
---

# P170 — Atlas Capture Foundation

## Revision 4 repair scope (operator continuation, 2026-09-07)

The revision 3 implementation was a prototype, not completion evidence. This
revision restores the approved design's Collector/Prometheus delivery rather
than substituting three HTTP endpoints for those services. No release or phase
gate has passed yet. DEVCP activation remains conditional on real validation.

Independent repair ownership: T1 owns contract.cjs and store.test.cjs (strict
nested allowlists, bounded indexed append storage, corruption/pressure gaps,
quota-reset partitions); T2 owns server.cjs, otlp.cjs and receiver.test.cjs
(native semantics, health identity, bounded input); T3 owns lifecycle.cjs,
quota-sampler.cjs, runtime.test.cjs, launcher and statusline (process identity,
fail-open timing, process-scoped sanitised environment, quota sampling); T3's
delivery subtask owns stack.cjs, stack.test.cjs, telemetry-atlas.json and README
(explicit pinned checksum-verified Collector/Prometheus install/config).
The independent domains can run concurrently after agreeing interfaces. Shared
integration tests and manifest regeneration remain the coordinating agent's work.

Additional acceptance: no arbitrary nested fields; repeated conflicts append
once; corruption anywhere prevents further writes without destroying old rows;
disk/size/index limits yield independent gap evidence; counter observations do
not inflate request totals; statusline output unchanged and added p95 under
10ms; occupied/unowned ports/PIDs fail closed for telemetry and open for SGSD;
no implicit enable/download; actual binaries validate config in a Linux fixture.
Phase 171/172 and the two complete weekly measurement windows are not claimed
by capture-foundation completion. The first deployed interval is calibration.

T3 delivery clarification: the project computed closure and flat global hooks
are separate installation targets. Deliver the complete self-contained Atlas
runtime directory to the existing flat global sibling-tools destination via
install.sh's existing copy_tree_files primitive, and prove actual global sampler
loading with telemetry enabled. This is Atlas delivery only, not a repair or
closure of the parked P169 global-install/transaction work. No gate is duplicated
or suppressed if the existing global install refuses for another dependency.

The three tasks land in dependency order. T1 owns evidence integrity, T2 owns
the local process boundary, and T3 owns delivery/attachment. Phase 171 may not
begin until a DEVCP event and explicit coverage status prove this foundation.
