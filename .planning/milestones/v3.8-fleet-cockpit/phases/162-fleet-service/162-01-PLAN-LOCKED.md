---
schema_version: 2
phase: 162
slug: fleet-service
milestone: v3.8-fleet-cockpit
status: PLANNED
revision: 2
governing_decision: .planning/milestones/v3.8-fleet-cockpit/phases/162-fleet-service/CONTEXT.md
depends_on: ['161-01']
intent: >
  Serve a read-only, dependency-free fleet view over the existing twelve-section
  cockpit-state adapter, with Git-authoritative lane discovery, bounded timer
  caching, defensible four-state derivation, explicit no-data and conflict
  semantics, and failure isolation across the fleet.
execution_mode: serial-codex
expected_ATC_tier: GATE
skip_gates: []
lessons_path: null
prior_errors_lookup: true
semantic_acceptance_criteria:
  - input: >
      A real child process running the production CLI against the temporary
      fixture-Git checkout, with no host or port override and port 7777 proven
      free before launch.
    expected_outcome: '`node super-gsd/tools/fleet-cockpit/server.cjs --root <worktrees dir>` starts and binds 127.0.0.1:7777'
    verification_cmd: 'node super-gsd/tools/fleet-cockpit/run-self-test.cjs --case default-bind'
  - input: >
      A temporary real Git repository with a main checkout and registered
      linked worktrees, each carrying .planning/, whose exact porcelain output
      is supplied to one cache cycle.
    expected_outcome: '`/api/fleet` returns every lane git reports, with a status on each'
    verification_cmd: 'node super-gsd/tools/fleet-cockpit/run-self-test.cjs --case fixture-git-discovery'
  - input: >
      A captured schema_version 1 adapter envelope containing all twelve
      sections and sentinel nested values, fetched through the detail and raw
      routes after the cache publishes it.
    expected_outcome: '`/api/lane/:name` returns the adapter output verbatim under `snapshot`'
    verification_cmd: 'node super-gsd/tools/fleet-cockpit/run-self-test.cjs --case verbatim-snapshot'
  - input: >
      A sixty-worktree real-Git fixture whose first cycle is healthy and whose
      next cycle observes one selected lane after its .planning/ directory is
      removed, while the other fifty-nine remain valid.
    expected_outcome: Killing one lane's `.planning/` does not break the other 59
    verification_cmd: 'node super-gsd/tools/fleet-cockpit/run-self-test.cjs --case lane-failure-isolation'
  - input: >
      A fake-clock cache with a counted asynchronous snapshot builder, followed
      by a burst against all four GET routes between two scheduled refreshes.
    expected_outcome: 'Cache age is visible on every response and no request triggers a build'
    verification_cmd: 'node super-gsd/tools/fleet-cockpit/run-self-test.cjs --case structural-load-safety'
  - input: >
      The production cache scheduler under a delayed sixty-lane builder spy,
      including overlapping timer ticks and a concurrent request burst. This
      is the phase-local structural proxy; the actual load measurement remains
      a run-home check on devcp after deployment.
    expected_outcome: 'Load average on devcp does not rise by more than 1.0 with the service running'
    verification_cmd: 'node super-gsd/tools/fleet-cockpit/run-self-test.cjs --case structural-load-safety'
  - input: >
      The complete P162 source diff, repository package manifests, and every
      static require call in the production fleet runtime modules.
    expected_outcome: 'Zero npm dependencies added'
    verification_cmd: 'node super-gsd/tools/fleet-cockpit/run-self-test.cjs --case source-constraints'
known_deadends:
  - Do not modify, reshape, copy fields into, or add fleet metadata inside adapter.cjs output; the cached snapshot and the detail response snapshot value are the exact returned object.
  - Do not replace git worktree list --porcelain with directory globbing, a hard-coded Clarity path, or this worktree's live lane set; Git output from an isolated fixture repository is the discovery oracle.
  - Do not make request handlers call discovery, buildSnapshot, refresh, or any filesystem mutation; handlers are cache reads only.
  - Do not overlap cache cycles or launch sixty builds at once; four is a ceiling, missed ticks coalesce, and freshness may degrade under load.
  - Do not treat a missing .planning/ lane like an adapter exception; skip it from fleet rows, name it in health.skipped_lanes, and keep every eligible lane live.
  - Do not let one adapter failure reject a fleet cycle; retain an error row with a stable machine code and publish all successful lanes.
  - Do not infer pass or zero from absent evidence; tokens.source absent, empty live gates, and artifacts source reasons remain explicit no-data states.
  - Do not resolve projection_stale by choosing an objective; publish the effective pair, STATE.md pair, source, and confidence beside the unmodified snapshot.
  - Do not add POST, PUT, PATCH, or DELETE route branches or stubs, write controls, resume buttons, npm, package.json, a framework, a bundler, ESM, or non-ASCII source.
  - Do not run a live Clarity discovery test on this Windows dev host, invoke claude, or claim the devcp load delta from a fixture; the load measurement is a run-home acceptance check.
tasks:
  - id: P162-T1
    type: fleet-discovery-cache-rollup
    agent: codex
    model: codex
    depends_on: []
    files_touched:
      - super-gsd/tools/fleet-cockpit/fleet.cjs
      - super-gsd/tools/fleet-cockpit/run-self-test.cjs
      - super-gsd/tools/fleet-cockpit/fixtures/lanes/attention.json
      - super-gsd/tools/fleet-cockpit/fixtures/lanes/running.json
      - super-gsd/tools/fleet-cockpit/fixtures/lanes/stale.json
      - super-gsd/tools/fleet-cockpit/fixtures/lanes/idle.json
      - super-gsd/tools/fleet-cockpit/fixtures/lanes/build-error.json
    input_contract: >
      Work red-first in run-self-test.cjs. Its test-only process boundary may
      use Node built-ins needed to create a temporary real Git repository on
      Windows, add linked worktrees with git worktree add, and capture the
      exact git -C <checkout> worktree list --porcelain output; production CJS
      remains on node:fs/node:path plus relative local modules. Never discover
      the live checkout. Add cases fixture-git-discovery,
      fleet-cache-scheduler, lane-failure-isolation, and rollup-first-publish.
      The generated fixture has paths containing spaces, distinct refs/heads/*
      branches, sixty registered lanes for isolation, one no-.planning lane,
      and one injected builder failure.
      Capture five stable schema_version 1 buildSnapshot-shaped JSON envelopes
      with ok, ts, data containing exactly now, objective, unlock, blockers,
      agents, codex, gates, tokens, artifacts, staleness, harness_evolution,
      resume_command, plus _section_degraded/_redactions_applied. In fleet.cjs
      expose parseWorktreePorcelain(text), createFleetCache(options), and no
      CLI. Porcelain parsing consumes worktree and branch records, strips only
      refs/heads/ from a branch, derives a stable lane name from the worktree
      basename, rejects duplicate names with a health diagnostic rather than
      silently overwriting, and preserves absolute path. Retain detached
      worktree records with branch null; ignore only unknown porcelain fields
      rather than dropping a Git-reported lane. The discovery input is the
      exact Git-produced porcelain frame supplied by the service launcher; do
      not enumerate sibling directories. Before scheduling a lane, use fs to
      require path/.planning and record absent lanes in skipped_lanes.
      Construct createFleetCache with injected buildSnapshot, deriveLaneStatus,
      now, timer functions, intervalMs default 20000, concurrency default and
      hard maximum 4, and an acceptDiscovery(porcelain) boundary. Expose
      start(), stop(), refreshNow() for the timer/launcher only, getFleet(),
      getLane(), getRawLane(), and getHealth(). Coalesce timer ticks while a
      refresh is in flight and schedule the next cycle only after the prior one
      settles, so an expensive cycle stretches freshness instead of overlapping
      work. Use four promise workers over the immutable lane queue; tests use
      delayed builders and assert maxActive is exactly 4 when at least four
      lanes are pending and never exceeds 4. Requests are not part of this API.
      Stage snapshot results, derive and atomically publish every roll-up row
      first, then expose the staged full-snapshot map on the next scheduler turn.
      A build rejection becomes status error with reasons
      snapshot_build_failed and error_code snapshot_build_failed for that lane
      and cannot reject the refresh.
      Track cache generation timestamp, cache_age_seconds from the injected
      clock, build_ms_last, last cycle duration, lane count, skipped lanes,
      duplicate-name diagnostics, and last discovery error. Return defensive
      envelopes without mutating the captured snapshot objects.
    output_contract: >
      fleet.cjs is a deterministic, request-agnostic cache core driven only by
      Git porcelain and the adapter/status callbacks. A real fixture proves
      every eligible Git lane is named and cached, missing .planning is visible
      in health, one failed lane is isolated, first publication makes all rows
      available before details, cache age is clock-derived, and cycles never
      exceed four active jobs or overlap. The five committed fixtures preserve
      the adapter's schema_version 1 twelve-section shape for later tasks.
    hypothesis: >
      Separating Git-authoritative discovery input, bounded scheduled refresh,
      and immutable cache reads lets a sixty-lane fleet remain complete and
      failure-isolated without placing adapter work on the HTTP path.
    falsifier: >
      A filesystem glob decides membership; a Git-reported eligible lane is
      absent; a missing .planning lane is hidden from health; spaces or branch
      refs parse incorrectly; duplicate names overwrite; maxActive exceeds 4;
      cycles overlap; a request-shaped getter starts work; rows wait for detail
      publication; one rejection drops other lanes; cache age is constant or
      wall-clock-dependent in tests; a fixture lacks any adapter section; or T1
      is not independently revertable.
    stop_rule: >
      Stop when the four named cases are recorded red then green, all five JSON
      fixtures parse and expose exactly twelve data keys, the only diff is the
      seven listed paths, no production source writes disk or imports a package,
      and T1 is one commit.
    verification_cmd: >
      node super-gsd/tools/fleet-cockpit/run-self-test.cjs --case fixture-git-discovery &&
      node super-gsd/tools/fleet-cockpit/run-self-test.cjs --case fleet-cache-scheduler &&
      node super-gsd/tools/fleet-cockpit/run-self-test.cjs --case lane-failure-isolation &&
      node super-gsd/tools/fleet-cockpit/run-self-test.cjs --case rollup-first-publish
    expected_ATC_tier: GATE
  - id: P162-T2
    type: contractual-fleet-status-derivation
    agent: codex
    model: codex
    depends_on: ['P162-T1']
    files_touched:
      - super-gsd/tools/fleet-cockpit/status.cjs
      - super-gsd/tools/fleet-cockpit/run-self-test.cjs
      - super-gsd/tools/fleet-cockpit/fixtures/lanes/noise-agent-tools.json
      - super-gsd/tools/fleet-cockpit/fixtures/lanes/noise-tokens-absent.json
      - super-gsd/tools/fleet-cockpit/fixtures/lanes/noise-gates-empty.json
      - super-gsd/tools/fleet-cockpit/fixtures/lanes/noise-artifacts-source.json
      - super-gsd/tools/fleet-cockpit/fixtures/lanes/projection-conflict.json
      - super-gsd/tools/fleet-cockpit/fixtures/lanes/checkpoint-attention.json
      - super-gsd/tools/fleet-cockpit/fixtures/lanes/agent-in-flight.json
    input_contract: >
      Work red-first and make each handover noise filter a named fixture and
      independently selectable case: noise-agent-tools, noise-tokens-absent,
      noise-gates-empty, noise-artifacts-source, plus projection-conflict. Add
      status-precedence as a table-driven mutation matrix over the captured
      attention/running/stale/idle envelopes.
      In status.cjs expose deriveLaneStatus(snapshot,{nowMs,staleAfterMs}) and
      focused pure helpers; require no runtime module. Return status, headline,
      ordered machine-readable reasons, phase, phase_name, last_activity_ts,
      age_minutes, conflict, degraded, and detail metadata for agents, tokens,
      gates, artifacts, and objective_conflict. Apply first-match status
      precedence attention > running > stale > idle. Attention matches any
      gates.latest_per_gate verdict fail or failed, an
      operator_attention_required later than the last run_started,
      blockers.count > 0, or a checkpoint_written with no later run_started;
      use ordered codes gate_failed, operator_attention_required,
      blockers_present, checkpoint_waiting_for_run.
      Running matches a fresh codex live signal whose live_state is the
      handover value ok or the current adapter value running and whose
      live_json_age_seconds is below stale_threshold_seconds, or
      agent_dispatched without a task_id-matched agent_completed; use
      codex_live and agent_in_flight. Stale matches
      staleness.state_md.stale true, data.now.ts older than staleAfterMs default
      86400000, or codex.live_state stale; use state_md_stale,
      last_activity_stale, codex_stale. Idle is the fallback with
      idle_no_signal. Only reasons for the winning status class are returned,
      followed by the cross-cutting state_projection_conflict when applicable.
      Derive a stable headline from the first winning reason without inventing
      evidence. Calculate activity age only from a parseable data.now.ts; null
      evidence stays null and never becomes stale merely because it is absent.
      The noise-agent-tools fixture includes Bash and SendUserFile rows with
      null model plus a recognised gsd-executor with null model and a
      model-bearing custom worker; filter out the two bare tools and retain the
      latter two. Keep the recognised-name set explicit and narrow:
      gsd-executor, gsd-planner, gsd-researcher, gsd-verifier, codex, planner,
      researcher, executor, verifier, and reviewer; any non-null, non-empty
      model also qualifies. The tokens-absent fixture returns state no_data,
      value null, reason tokens_source_absent, never zero. The gates-empty
      fixture with gates.gates [], latest_per_gate {}, and live_event_count 0
      returns state no_data and reason no_gate_data, never passed. The
      artifacts fixture preserves source phases_dir_missing as state no_data
      and reason phases_dir_missing rather than an empty-success claim.
      When objective.projection_stale is true, set conflict true, append
      state_projection_conflict, and expose objective_conflict with effective
      milestone/phase/source, state_md_milestone/state_md_phase, and
      effective_confidence side by side. Never rewrite objective or snapshot.
      Malformed or ok:false snapshots yield a stable status error derivation;
      _section_degraded is copied into degraded metadata, not hidden.
    output_contract: >
      status.cjs is a pure adapter-to-derived-view contract. The four statuses
      have deterministic first-match precedence and reason codes; all four
      observed noise families remain explicitly no-data or filtered; and a
      projection conflict exposes both value pairs and confidence without
      resolving or mutating the adapter envelope.
    hypothesis: >
      Fixture-locking each noisy adapter shape and every precedence branch
      prevents the fleet from turning missing evidence into reassuring claims
      or hiding state-model disagreements.
    falsifier: >
      Lower-precedence evidence wins; a gate failure is idle; completed agents
      remain running; Bash or SendUserFile survives; tokens absent renders 0;
      empty live gates render passed; phases_dir_missing renders empty success;
      projection_stale is false, hidden, or resolved; either objective pair or
      confidence is absent; malformed timestamps create false staleness; the
      input snapshot changes; reasons are prose; or any named fixture can pass
      without exercising its contractual assertion.
    stop_rule: >
      Stop when status-precedence and all five named contractual cases are red
      then green, deep-frozen fixture inputs remain byte-identical, T1 cases
      stay green, the diff is the nine listed paths, and T2 is one commit after
      T1.
    verification_cmd: >
      node super-gsd/tools/fleet-cockpit/run-self-test.cjs --case status-precedence &&
      node super-gsd/tools/fleet-cockpit/run-self-test.cjs --case noise-agent-tools &&
      node super-gsd/tools/fleet-cockpit/run-self-test.cjs --case noise-tokens-absent &&
      node super-gsd/tools/fleet-cockpit/run-self-test.cjs --case noise-gates-empty &&
      node super-gsd/tools/fleet-cockpit/run-self-test.cjs --case noise-artifacts-source &&
      node super-gsd/tools/fleet-cockpit/run-self-test.cjs --case projection-conflict
    expected_ATC_tier: GATE
  - id: P162-T3
    type: read-only-fleet-http-service-operator-entry
    agent: codex
    model: codex
    depends_on: ['P162-T2']
    files_touched:
      - super-gsd/tools/fleet-cockpit/server.cjs
      - super-gsd/tools/fleet-cockpit/run-self-test.cjs
      - super-gsd/scripts/sgsd-fleet.sh
      - super-gsd/docs/FLEET-COCKPIT.md
    input_contract: >
      Work red-first in the existing runner and add default-bind,
      http-contract, verbatim-snapshot, lane-failure-isolation,
      structural-load-safety, source-constraints, wrapper-contract, and all.
      The runner mirrors cockpit-state/run-self-test.cjs operator output,
      accepts --case, uses test-only temporary roots and processes, guarantees
      child cleanup in finally paths, and never invokes claude or live Clarity.
      In server.cjs require only node:http, node:fs, node:path and the relative
      fleet, status, and cockpit-state adapter modules. Export parseArgs(argv),
      createFleetServer, and main. On CLI, accept --root, --host default
      127.0.0.1, --port default 7777, and --interval seconds default 20 with
      positive bounded validation. The strict production require scan permits
      only those three node built-ins and relative local modules; status.cjs
      has no require. Because the binding allowlist forbids a production
      node:child_process dependency, keep the exact Git command at the shell
      launcher boundary. sgsd-fleet.sh runs git -C <one checkout> worktree list
      --porcelain once per interval and feeds explicitly framed porcelain
      cycles to server.cjs stdin; server and fleet never glob lane directories.
      Direct server.cjs still starts and binds for the verbatim acceptance
      command; the operator wrapper is the populated fleet entrypoint.
      In launcher-fed production mode, one accepted discovery frame is one
      cache cycle: call only fleet.acceptDiscovery and refreshNow outside
      request handling, and disable the internal fallback timer so the shell
      interval cannot double-build. Pass the real
      buildSnapshot({projectDir: lane.path}) callback and deriveLaneStatus into
      createFleetCache. Implement only these GET paths. /api/fleet returns ok,
      schema_version 1, ts, root, cache_age_seconds, counts for attention,
      running, stale, idle, and deterministic lanes with name, path, branch,
      status, headline, phase, phase_name, last_activity_ts, age_minutes,
      conflict, and degraded. /api/lane/:name returns ok, name, status, reasons,
      cache_age_seconds, all derived detail metadata beside snapshot, and the
      exact cached adapter object under snapshot. /api/lane/:name/raw returns
      only that exact adapter envelope. /healthz returns ok, lanes,
      cache_age_seconds, build_ms_last, skipped_lanes, duplicate_names, and the
      last discovery/build diagnostics without stacks.
      Put X-SGSD-Cache-Age-Seconds on every response, including raw and errors,
      so raw stays verbatim while age remains visible. Match lane names through
      the cache map after decodeURIComponent; traversal or unknown names get a
      stable 404 JSON error without a path or stack. A failed adapter build
      remains an error row and detail error while healthy rows and routes
      survive. Use one generic non-GET rejection before route selection; add no
      mutating method handlers, branches, stubs, controls, or disk writes. HTTP
      request functions may call only cache getters. structural-load-safety
      uses a fake clock and delayed builder plus a real request burst to prove
      build call count is unchanged, maxActive <= 4, refreshes do not overlap,
      defaults are interval 20 and concurrency 4, and source contains no
      request-to-refresh or request-to-build edge. It is the local proxy for
      the devcp <1.0 load criterion; do not fabricate the run-home measurement.
      source-constraints asserts CJS extensions, ASCII bytes in all new source,
      no package manifest diff or npm/framework import, the runtime require
      allowlist, no mutating fs token in production CJS, no mutator route
      literal or handler, and no change to adapter.cjs. Run the existing adapter
      self-test as an external baseline and require its exact
      Self-test: 19/19 passed summary. In sgsd-fleet.sh, use Bash, set -o
      pipefail, resolve SCRIPT_DIR, quote every path, validate root/.planning
      and Git before launch, and provide start, stop, and status with host, port,
      and interval forwarding. Keep PID, log, and temporary framing only below
      ${XDG_CACHE_HOME:-$HOME/.cache}/super-gsd/fleet-cockpit, make repeated
      start and stop idempotent, default to loopback, and print the URL plus a
      LAN exposure warning for 0.0.0.0.
      The wrapper preserves sgsd-agent-dashboard.sh conventions of explicit
      project validation, script-relative helpers, pipefail, readable errors,
      and Ctrl+C cleanup. FLEET-COCKPIT.md documents direct bind smoke, wrapper
      lifecycle, four statuses and reason precedence, cache age/header,
      skipped/error lanes, no-data semantics, conflict pairs and confidence,
      raw route, loopback/LAN, read-only guarantees, and the separate devcp
      before/after load check.
    output_contract: >
      The service binds loopback by default and exposes four cache-only GET
      contracts. Fleet failures are row-local, detail snapshots and raw output
      are byte-for-byte adapter values, cache age is observable everywhere,
      health explains skipped and degraded inputs, and no request can discover,
      build, mutate, or leak a stack. The Bash entrypoint supplies exact Git
      porcelain without widening the CJS dependency allowlist, and operator
      docs distinguish local structural load proof from the devcp run-home
      measurement. The untouched adapter remains 19/19.
    hypothesis: >
      A thin node:http layer over the scheduled cache, with Git execution kept
      in the constrained launcher boundary and exhaustive source and route
      tests, can satisfy the fleet contract without changing adapter semantics,
      adding dependencies, or introducing a control plane.
    falsifier: >
      Default bind differs; a documented GET route is missing; a mutating route
      or write token exists; any request changes build count; raw or snapshot is
      reshaped; cache age is absent from a response; a lane error returns a
      stack or 500 that blanks the fleet; skipped lanes vanish from health; Git
      is replaced by globbing; a production runtime require falls outside the
      allowlist; source is non-ASCII or ESM; package metadata changes; wrapper
      state escapes its cache dir; the docs imply the devcp delta was measured;
      adapter is modified or not 19/19; or T3 is not independently revertable.
    stop_rule: >
      Stop when all eight named cases are recorded red then green, the complete
      fleet runner exits 0, the untouched adapter freshly reports 19/19, source
      constraints and wrapper cleanup pass on the fixture host, the diff is the
      four listed paths after T2, every top-level SAC command exits 0, and T3 is
      one commit after T2. Actual devcp load delta remains explicitly pending
      run-home verification and is not a source-phase blocker.
    verification_cmd: >
      node super-gsd/tools/fleet-cockpit/run-self-test.cjs &&
      node super-gsd/tools/cockpit-state/run-self-test.cjs
    expected_ATC_tier: GATE
---

# P162 - Fleet Service

Three serial, independently revertable commits establish the service without
touching the adapter. T1 turns exact Git porcelain into a bounded, timer-fed,
roll-up-first in-memory cache and locks five twelve-section lane snapshots. T2
derives attention, running, stale, and idle with contractual fixtures for every
known noise filter and for state projection conflict. T3 adds the cache-only
HTTP surface, strict source invariants, the Git-feeding Bash lifecycle wrapper,
and operator documentation.

The production CJS boundary stays on node:http, node:fs, node:path, and local
relative modules. The launcher owns the required Git process and feeds
porcelain frames; the self-test may use test-only process and os helpers to
create the real fixture repository and exercise child servers. The local load
proof is structural: concurrency is bounded, cycles never overlap, and requests
cannot build. The <1.0 devcp measurement remains a run-home acceptance
observation.

## AMENDMENT-1 (2026-08-21, orchestrator-recorded, plan-review round 1)

GO-WITH-CHANGES: HANDOVER.md references qualified to the in-repo copy at
.planning/milestones/v3.8-fleet-cockpit/HANDOVER.md; bind command corrected to
node super-gsd/tools/fleet-cockpit/server.cjs.
