---
schema_version: 2
phase: 53
plan: 1
type: execute
wave: 1
model: sonnet
expected_ATC_tier: FULL
depends_on: ["51"]
files_modified:
  - super-gsd/tools/failure-injection/harness.cjs
  - super-gsd/tools/failure-injection/scenarios.json
  - super-gsd/tools/failure-injection/SCENARIOS.schema.json
  - super-gsd/tools/failure-injection/run-self-test.cjs
  - super-gsd/tools/failure-injection/README.md
  - super-gsd/tools/failure-injection/fixtures/token-attribution-poisoned-row/README.md
  - super-gsd/tools/failure-injection/fixtures/token-attribution-poisoned-row/seed-rows.jsonl
  - super-gsd/tools/failure-injection/fixtures/token-attribution-poisoned-row/poisoned-row.txt
  - super-gsd/tools/failure-injection/fixtures/context-packet-missing-capsule/README.md
  - super-gsd/tools/failure-injection/fixtures/context-packet-missing-capsule/seed-capsule.json
  - super-gsd/tools/failure-injection/fixtures/context-packet-missing-capsule/intent-fixture.json
  - super-gsd/tools/failure-injection/fixtures/dispatch-router-vtp-whitelist-violation/README.md
  - super-gsd/tools/failure-injection/fixtures/vtp-bridge-unavailable/README.md
  - super-gsd/tools/failure-injection/fixtures/memory-governance-revocation-replay/README.md
  - super-gsd/tools/failure-injection/fixtures/memory-governance-revocation-replay/synthetic-revocation.jsonl
  - super-gsd/tools/failure-injection/fixtures/redis-adapter-flushdb-recovery/README.md
  - super-gsd/tools/failure-injection/fixtures/sqlite-context-index-deleted-db/README.md
  - super-gsd/tools/failure-injection/fixtures/phase-capsule-corrupted-json/README.md
  - super-gsd/tools/failure-injection/fixtures/phase-capsule-corrupted-json/corrupted-capsule.json
  - super-gsd/tools/failure-injection/fixtures/route-ledger-truncated-stream/README.md
  - super-gsd/tools/failure-injection/fixtures/route-ledger-truncated-stream/valid-rows.jsonl
  - super-gsd/tools/failure-injection/fixtures/route-ledger-truncated-stream/partial-line.txt
  - super-gsd/tools/failure-injection/fixtures/edge-guard-missing-emit/README.md
  - super-gsd/tools/failure-injection/fixtures/edge-guard-missing-emit/synthetic-gates.yaml
  - super-gsd/scripts/sgsd-complete-milestone.cjs
  - .planning/metrics/failure-injection-log.jsonl
autonomous: true
requirements:
  - FAIL-INJ-01
  - FAIL-INJ-02
  - FAIL-INJ-03
  - FAIL-INJ-04
  - FAIL-INJ-05
  - FAIL-INJ-06
  - FAIL-INJ-07
  - FAIL-INJ-08
  - FAIL-INJ-09
  - FAIL-INJ-10

tags:
  - failure-injection
  - real-tool-invocation
  - container-isolation
  - tmpdir-spawnsync
  - 10-scenario-gate
  - crit-backlog-integration
  - edge-guard-miss
  - phase-53
  - v2.0

prior_errors_lookup: true

skip_gates: []

lessons_path: null

must_haves:
  truths:
    - "Operator runs `node super-gsd/tools/failure-injection/harness.cjs --self-test` and gets N/N PASS (target 16-20), exit 0, in <60 seconds, with zero canonical-stream drift across all 11 PHASE_53_GUARDED_STREAMS."
    - "Operator runs `node super-gsd/tools/failure-injection/harness.cjs --run-all` and gets 10/10 PASS (or PASS-WITH-DEFERRED-1 with one verifier_fail row appended) in <120 seconds; emits exactly 10 envelope-v1 rows to .planning/metrics/failure-injection-log.jsonl all sharing one run_id."
    - "Each of the 10 scenarios invokes its target real production tool via child_process.spawnSync with cwd=os.tmpdir()/sgsd-fail-inj-{scenario-id}-XXXX (NOT under project workspace; mock predicates forbidden); the tool_invocation row in failure-injection-log.jsonl proves the real subprocess ran (argv, exit_code, stdout_digest, stderr_digest captured)."
    - "Phase 41-52 tool trees are byte-untouched after a full --run-all: `git diff --quiet -- super-gsd/tools/{token-attribution,context-packet,dispatch-router,vtp-bridge,memory-governance,context-cache,phase-capsule} super-gsd/scripts/lib/{route-ledger.cjs,edge-guard.cjs,crit-backlog.cjs}` exits 0 (Lock 4)."
    - "All 11 PHASE_53_GUARDED_STREAMS have identical sha256+size before and after a full --run-all (Phase 51's 5-stream CANONICAL_STREAMS imported by reference + 6-stream Phase 53 extension covering memory-* + redis-projection-log.jsonl + edge-guard-log.jsonl). Anti-pollution self-test 11 enforces."
    - "Scenario 10 (edge-guard-missing-emit) is the only manifest entry with edge_guard_miss_classified=true; on FAIL it appends a CRIT-BACKLOG row with kind='edge_guard_miss' (forces CANDIDATE-WITH-DEBT, exit 1); on PASS no row is appended. Scenarios 1-9 default to kind='verifier_fail' on FAIL."
    - "Lock 11 holds: scenario selection + verdict scoring use ONLY set-membership on closed-vocab fields (scenario.id, expected_reason_codes, scenario.edge_guard_miss_classified) and byte-equality on canonical-stream sha256. NO regex/embedding/cosine/levenshtein anywhere in harness.cjs."
    - "Lock 13 holds: all 8 public APIs (runAll, runScenario, selfTest, aggregateResults, appendLogRow, _runScenarioImpl, _setupContainer, _spawnTool) wrap internals in try/catch and return a degraded sentinel on error; no path throws upward; missing fixture emits 'bench_scenario_skipped:fixture_unavailable' and continues."
    - "Soft-skip semantics for scenario 6 (redis-adapter-flushdb-recovery): when Redis container absent the subprocess returns 'redis_not_available_soft_skip'; harness verdict is PASS-WITH-SOFT-SKIP (counts toward 10/10, NOT toward deferred-N). Mirrors Phase 51 F12-F15 + F17 precedent."
    - "sgsd-complete-milestone.cjs --milestone v2.0 invokes the harness selfTest() as a triple-gate (Phase 51 context-bench + Phase 52 redis-adapter + Phase 53 failure-injection); if any of the three fail, exit 1 with milestone_close_blocked:* stderr tag."

  artifacts:
    - path: "super-gsd/tools/failure-injection/harness.cjs"
      provides: "Entry point + CLI for the 10-scenario failure-injection harness; orchestrates snapshot/inject/observe/restore for each scenario via tmpdir+spawnSync; aggregates verdict; writes envelope-v1 JSONL; appends CRIT-BACKLOG rows on FAIL. Lock 13 wrapped public APIs."
      exports:
        - "runAll(opts) -> { run_id, verdict, scenarios[], aggregate, exit_code }"
        - "runScenario({scenario, planningDir, tmpdir}) -> { verdict, observed_reason_codes, canonical_state_preserved, tool_invocation, duration_ms }"
        - "selfTest() -> exit 0 on N/N green (target 16-20 assertions)"
        - "aggregateResults(scenarios[]) -> { verdict, pass_count, deferred_count, edge_guard_miss_count, exit_code }"
        - "appendLogRow(planningDir, row) -> appends envelope-v1 row to .planning/metrics/failure-injection-log.jsonl"
        - "SCENARIOS (Object.freeze, 10-entry, mutation no-op)"
        - "PHASE_53_GUARDED_STREAMS (Object.freeze, 11-entry: Phase 51's 5 + 6 Phase 53 extensions)"
        - "FAIL_INJ_REASON_CODES (Object.freeze, >=11 entries)"
        - "VERDICT_KINDS (Object.freeze, 3-entry: [null, 'verifier_fail', 'edge_guard_miss'])"
      contains: "Object.freeze on SCENARIOS, PHASE_53_GUARDED_STREAMS, FAIL_INJ_REASON_CODES, VERDICT_KINDS; require()s super-gsd/scripts/lib/crit-backlog.cjs by absolute path; spawnSync per scenario (NEVER require() of target tools); cwd=os.tmpdir()/sgsd-fail-inj-{id}-XXXX; rm -rf in finally block; Lock 4/11/13 invariants documented at file top; ASCII-only literals"

    - path: "super-gsd/tools/failure-injection/scenarios.json"
      provides: "Frozen 10-entry scenario manifest loaded at module init via require(); each entry locks: id, label, target_tool, inject_mechanism, tool_invocation_argv (template with <tmpdir>/<resolved> placeholders), expected_reason_codes (closed-vocab subset of upstream tool vocabularies), canonical_streams_guarded, soft_skip_when, edge_guard_miss_classified."
      contains: "10 entries in order: token-attribution-poisoned-row, context-packet-missing-capsule, dispatch-router-vtp-whitelist-violation, vtp-bridge-unavailable, memory-governance-revocation-replay, redis-adapter-flushdb-recovery, sqlite-context-index-deleted-db, phase-capsule-corrupted-json, route-ledger-truncated-stream, edge-guard-missing-emit. Only the last has edge_guard_miss_classified=true. Only scenarios 5+6 have non-null soft_skip_when."

    - path: "super-gsd/tools/failure-injection/SCENARIOS.schema.json"
      provides: "JSON-Schema draft-07 validator for scenarios.json; round-trips the shipped manifest at self-test load (assertion #2 + #3 + #5)."
      contains: "additionalProperties:false on top-level + per-entry; closed enum on scenario.id (10-entry), tool_invocation_argv items pattern, expected_reason_codes minItems:1, edge_guard_miss_classified boolean default false"

    - path: "super-gsd/tools/failure-injection/run-self-test.cjs"
      provides: "Single-purpose operator entry; shells `node harness.cjs --self-test`, exits with same code. Mirrors Phase 51 run-self-test.cjs verbatim shape (thin shell, no new aggregator, no new oracle)."
      exports:
        - "main() -> exit 0 on N/N pass (target 16-20)"

    - path: "super-gsd/tools/failure-injection/README.md"
      provides: "Operator documentation. Explains: dispatch sequence (--run-all flow), per-scenario semantics, --self-test flag, how to run a single scenario, where the JSONL ledger lands, how CRIT-BACKLOG row append fires, how Phase 57 release-readiness consumes the tail, soft-skip vs deferred-N distinction (Pitfall 4), edge_guard_miss vs verifier_fail classification rule."

    - path: "super-gsd/tools/failure-injection/fixtures/token-attribution-poisoned-row/"
      provides: "Scenario 1 fixture: 5-10 valid agent-token-spend.jsonl rows + 1 deliberately malformed row (truncated mid-string). Harness seeds tmpdir mirror with valid rows then appends poisoned row.txt."
      contains: "README.md (1-paragraph description + expected reason code 'parse_skipped_malformed_row'); seed-rows.jsonl (5-10 envelope-v1 rows with role=researcher); poisoned-row.txt (e.g. `{\"ts\":\"x\",\"not_json}` — closing brace + newline truncated)"

    - path: "super-gsd/tools/failure-injection/fixtures/context-packet-missing-capsule/"
      provides: "Scenario 2 fixture: a seed PHASE-CAPSULE.json the harness deletes mid-scenario + an intent fixture passed to buildPacket against the now-missing capsule."
      contains: "README.md; seed-capsule.json (valid PHASE-CAPSULE.json shape with goal, decisions[], outputs[]); intent-fixture.json (role:researcher, intent.goal, milestone:v1.8, phase:36)"

    - path: "super-gsd/tools/failure-injection/fixtures/dispatch-router-vtp-whitelist-violation/"
      provides: "Scenario 3 fixture: argv-only injection (no static fixture content); README documents the synthetic input {uncertainty_type:'deterministic_extraction', route_hint:'vtp'} the harness passes to route.cjs."
      contains: "README.md (single file; documents the argv-driven inject + expected matched_uncertainty_type reason code; route.cjs:144-148 ROUTING_TABLE primary verified)"

    - path: "super-gsd/tools/failure-injection/fixtures/vtp-bridge-unavailable/"
      provides: "Scenario 4 fixture: env-only injection (no static fixture content); README documents SGSD_VTP_FORCE_OFFLINE=1 env override + expected provider_vtp_unavailable reason."
      contains: "README.md (single file; documents env-only inject + expected reason code provider_vtp_unavailable + fallback_used:'claude' route-decision)"

    - path: "super-gsd/tools/failure-injection/fixtures/memory-governance-revocation-replay/"
      provides: "Scenario 5 fixture: synthetic memory-revocations.jsonl row that triggers re-read in lifecycle.cjs#processComplaints."
      contains: "README.md; synthetic-revocation.jsonl (one envelope-v1 row with revoked_id, revoked_reason matching REVOKE_REASONS enum, ts within last hour). soft_skip_when='phase_49_writer_unwired' documented"

    - path: "super-gsd/tools/failure-injection/fixtures/redis-adapter-flushdb-recovery/"
      provides: "Scenario 6 fixture: test-hook-driven (no static fixture content); README documents the spawn-via-`node -e` wrapper that calls _testHook_simulateFlushAndPoison + the dual-path verdict (live Redis -> redis_flushdb_recovered_via_sqlite; absent Redis -> redis_not_available_soft_skip both PASS)."
      contains: "README.md (single file; documents Q4 resolution: spawn-via-node-e wrapper preserves real-process boundary; cites redis-adapter.cjs:1502-1604; soft-skip = PASS-WITH-SOFT-SKIP per Phase 51 F12-F15/F17 precedent)"

    - path: "super-gsd/tools/failure-injection/fixtures/sqlite-context-index-deleted-db/"
      provides: "Scenario 7 fixture: README documents the rm of tmpdir/.planning/cache/context-index.db mid-query + expected index_unavailable OR rebuild_error reason code."
      contains: "README.md (single file; documents the inject mechanism + verified reason codes from rebuild.cjs:776-782)"

    - path: "super-gsd/tools/failure-injection/fixtures/phase-capsule-corrupted-json/"
      provides: "Scenario 8 fixture: pre-corrupted PHASE-CAPSULE.json with non-JSON content (e.g. `{\"goal\":\"test\", broken`). Harness overwrites tmpdir mirror's capsule with this file then invokes readCapsule via node -e wrapper."
      contains: "README.md; corrupted-capsule.json (non-JSON content; _safeReadJson returns null per Lock 13)"

    - path: "super-gsd/tools/failure-injection/fixtures/route-ledger-truncated-stream/"
      provides: "Scenario 9 fixture: 5-10 valid envelope-v1 route-decisions rows + a partial-line tail (truncated mid-JSON, no closing brace, no newline). Harness seeds tmpdir mirror with valid rows then appends partial-line.txt."
      contains: "README.md; valid-rows.jsonl (5-10 envelope-v1 rows with run_id matching RUN_ID_REGEX); partial-line.txt (e.g. `{\"ts\":\"x\",\"run_id\":` — truncated mid-string, no newline)"

    - path: "super-gsd/tools/failure-injection/fixtures/edge-guard-missing-emit/"
      provides: "Scenario 10 fixture: synthetic gates.yaml row defining phase53_fixture_gate with expected_emits:['fixture-output.jsonl']. Harness invokes recordTransition with actualEmits:[] (deliberate gap) and asserts r.status==='logged' AND r.missing_emits.length>0."
      contains: "README.md (documents Q5 resolution: synthetic gate isolated from production gates per researcher recommendation); synthetic-gates.yaml (one gate row with name:phase53_fixture_gate, expected_emits:['fixture-output.jsonl'], escalation:'log-only')"

    - path: "super-gsd/scripts/sgsd-complete-milestone.cjs"
      provides: "EXTENDED for v2.0 (currently dual-gate v1.9: Phase 51 + Phase 52). Adds Phase 53 selfTest invocation as the third gate when --milestone v2.0. Order: Phase 51 -> Phase 52 -> Phase 53; first failure short-circuits with milestone_close_blocked:* stderr tag + exit 1."
      contains: "When milestone === 'v2.0': require('../tools/failure-injection/harness.cjs').selfTest() AFTER Phase 51 + Phase 52 selfTests succeed. Lock 13 wrap on harness import (missing harness -> stderr 'milestone_close_blocked:failure_injection_unavailable' exit 1; selfTest exit !==0 -> 'milestone_close_blocked:failure_injection_self_test_failed' exit 1). When milestone === 'v1.9' the existing dual-gate continues unchanged. ASCII-only."

    - path: ".planning/metrics/failure-injection-log.jsonl"
      provides: "envelope-v1 append-only ledger (canonical per Lock 2). One row per scenario per --run-all invocation = 10 rows per run. All 10 rows of one run share an identical run_id (Phase 57 score.cjs groupBy run_id to identify the latest run)."
      contains: "envelope_version:1, command:'logFailureInjectionScenario', status:'ok'|'fail', reason_codes[], run_id, phase:'53', milestone:'v2.0', + 8 extension fields per Section 5.1: scenario_id, tool_invocation{argv,cwd,env_overrides,exit_code,signal,stdout_digest,stderr_digest,duration_ms}, inject_applied, observed_reason_codes[], canonical_state_preserved (boolean), canonical_drift[] (array of stream names that drifted), verdict ('PASS'|'PASS-WITH-SOFT-SKIP'|'FAIL'), verdict_kind (null|'verifier_fail'|'edge_guard_miss'). additionalProperties:true per command-envelope-v1.yaml:260."

  key_links:
    - from: "super-gsd/tools/failure-injection/harness.cjs"
      to: "super-gsd/scripts/lib/crit-backlog.cjs"
      via: "require() by absolute path; calls appendRow(planningDir, {kind:'verifier_fail'|'edge_guard_miss', phase:'53', plan:'01', milestone:'v2.0', summary, evidence_path, ...}) in runAll() aggregate stage when any scenario FAILED. Single-writer protocol (Q1 resolution)."
      pattern: "critBacklog\\.appendRow|crit-backlog\\.cjs"

    - from: "super-gsd/tools/failure-injection/harness.cjs"
      to: "super-gsd/tools/token-attribution/report.cjs"
      via: "spawnSync (NEVER require()); argv: ['node', require.resolve('../token-attribution/report.cjs'), '--summarize', '--planning-dir', tmpdir+'/.planning']; cwd=tmpdir. Lock 4 mechanically preserved."
      pattern: "spawnSync.*token-attribution|require\\.resolve.*token-attribution"

    - from: "super-gsd/tools/failure-injection/harness.cjs"
      to: "super-gsd/tools/context-packet/build.cjs"
      via: "spawnSync via node -e wrapper that calls require(...).buildPacket({role:'researcher', intent, milestone:'v1.8', phase:'36'}); cwd=tmpdir; expects PACKET_REASON_CODES emit packet_capsule_unavailable_raw_fallback (build.cjs:98)."
      pattern: "spawnSync.*context-packet|build\\.cjs"

    - from: "super-gsd/tools/failure-injection/harness.cjs"
      to: "super-gsd/tools/dispatch-router/route.cjs"
      via: "spawnSync; argv passes synthetic --route '{uncertainty_type, route_hint}' input; expects ROUTE_DECISION_REASONS emit matched_uncertainty_type (route.cjs:103-129) AND decision.provider !== 'vtp' for non-whitelisted types."
      pattern: "spawnSync.*dispatch-router|route\\.cjs"

    - from: "super-gsd/tools/failure-injection/harness.cjs"
      to: "super-gsd/tools/vtp-bridge/classify.cjs"
      via: "spawnSync with env overrides {SGSD_VTP_FORCE_OFFLINE:'1'}; expects route-decisions row with reason_codes ⊇ ['provider_vtp_unavailable'] AND fallback_used:'claude'."
      pattern: "spawnSync.*vtp-bridge|SGSD_VTP_FORCE_OFFLINE"

    - from: "super-gsd/tools/failure-injection/harness.cjs"
      to: "super-gsd/tools/memory-governance/lifecycle.cjs"
      via: "spawnSync; argv: ['node', require.resolve('../memory-governance/lifecycle.cjs'), '--process-complaints', '--planning-dir', tmpdir+'/.planning']; expects REVOKE_REASONS|REVALIDATION_KINDS emit (lifecycle.cjs:2087-2090); soft-skip on phase_49_writer_unwired."
      pattern: "spawnSync.*memory-governance|process-complaints"

    - from: "super-gsd/tools/failure-injection/harness.cjs"
      to: "super-gsd/tools/context-cache/redis-adapter.cjs"
      via: "spawnSync via node -e wrapper that calls require(...)._testHook_simulateFlushAndPoison({}); subprocess always exits 0 (soft-skip is documented graceful path); expects 'redis_flushdb_recovered_via_sqlite' OR 'redis_not_available_soft_skip' in stdout JSON."
      pattern: "_testHook_simulateFlushAndPoison|redis-adapter\\.cjs"

    - from: "super-gsd/tools/failure-injection/harness.cjs"
      to: "super-gsd/tools/context-cache/query.cjs"
      via: "spawnSync; argv: ['node', require.resolve('../context-cache/query.cjs'), '--lookup', JSON.stringify({kind:'capsule', limit:5})]; cwd=tmpdir with .planning/cache/context-index.db deleted; expects index_unavailable OR rebuild_error reason code (rebuild.cjs:776-782)."
      pattern: "spawnSync.*context-cache.*query|query\\.cjs"

    - from: "super-gsd/tools/failure-injection/harness.cjs"
      to: "super-gsd/tools/phase-capsule/write.cjs"
      via: "spawnSync via node -e wrapper that calls require(...).readCapsule(corruptedPath); expects stdout JSON null sentinel (Lock 13: _safeReadJson never throws)."
      pattern: "spawnSync.*phase-capsule|readCapsule"

    - from: "super-gsd/tools/failure-injection/harness.cjs"
      to: "super-gsd/scripts/lib/route-ledger.cjs"
      via: "spawnSync via node -e wrapper that reads tmpdir mirror's route-decisions.jsonl line-by-line with try/catch JSON.parse (mirrors lifecycle.cjs:188-200 _readRows pattern); reports row-count delta = lines-1; live route-decisions.jsonl byte-untouched."
      pattern: "spawnSync.*route-ledger|route-decisions\\.jsonl"

    - from: "super-gsd/tools/failure-injection/harness.cjs"
      to: "super-gsd/scripts/lib/edge-guard.cjs"
      via: "spawnSync via node -e wrapper that calls require(...).recordTransition({fromStep:5,toStep:6,phase:'53-fixture',plan:'01',gateName:'phase53_fixture_gate',expectedEmits:['fixture-output.jsonl'],actualEmits:[],projectDir:process.cwd(),gatesYamlPath:process.cwd()+'/.planning/gates.yaml'}); expects stdout JSON {status:'logged',missing_emits:['fixture-output.jsonl'],...} (edge-guard.cjs:56-87)."
      pattern: "edge-guard\\.cjs|recordTransition"

    - from: "super-gsd/tools/failure-injection/harness.cjs"
      to: ".planning/metrics/failure-injection-log.jsonl"
      via: "fs.appendFileSync per scenario; envelope-v1 + 8 extension fields; atomic at row boundary; mirrors crit-backlog.cjs#appendRow newline-termination pattern."
      pattern: "failure-injection-log\\.jsonl|appendFileSync"

    - from: "super-gsd/scripts/sgsd-complete-milestone.cjs"
      to: "super-gsd/tools/failure-injection/harness.cjs"
      via: "When --milestone v2.0: require()s harness AFTER Phase 51 + Phase 52 selfTests pass; calls .selfTest(); propagates exit code with milestone_close_blocked:failure_injection_self_test_failed on non-zero. Lock 13 wrap on import."
      pattern: "failure-injection/harness\\.cjs"

tasks:
  - id: "53-01-T1"
    agent: gsd-executor
    model: sonnet
    files_touched:
      - super-gsd/tools/failure-injection/harness.cjs
      - super-gsd/tools/failure-injection/scenarios.json
      - super-gsd/tools/failure-injection/SCENARIOS.schema.json
    input_contract: |
      Reads:
        - .planning/milestones/v2.0/phases/53-gate-failure-injection-harness/53-RESEARCH.md (sections 2, 3.5, 5.2, 7, 8 - locked spec)
        - .planning/milestones/v2.0/phases/53-gate-failure-injection-harness/53-CONTEXT.md (locked decisions)
        - super-gsd/tools/context-bench/failure-injectors.cjs (Phase 51 INJECTION_FIXTURES Object.freeze pattern lines 81-263; CANONICAL_STREAMS lines 307-313; fingerprintStream/fingerprintsEqual lines 319-396 - mirror verbatim)
        - super-gsd/tools/context-bench/SCENARIO.schema.json (Phase 51 schema shape - structural mirror)
        - super-gsd/scripts/lib/crit-backlog.cjs (VALID_KINDS line 29: includes 'verifier_fail' + 'edge_guard_miss'; appendRow line 61 - import target)
      Inputs from prior tasks: none (T1 is the skeleton task; must run first).
    output_contract: |
      Writes super-gsd/tools/failure-injection/harness.cjs (skeleton):
        - 'use strict'; ASCII-only header doc explaining Lock 4/11/13 invariants + 4-step protocol + 8 public API names.
        - require()s: fs, os, path, crypto, child_process.spawnSync, '../../scripts/lib/crit-backlog.cjs' (absolute path via path.resolve(__dirname,...)).
        - Object.freeze constants:
          * SCENARIOS = require('./scenarios.json') wrapped in Object.freeze (and each entry frozen recursively via deepFreeze helper).
          * PHASE_53_GUARDED_STREAMS = Object.freeze([5 Phase-51 streams + 6 Phase-53 extensions]) - exactly 11 entries.
          * FAIL_INJ_REASON_CODES = Object.freeze([>=11 entries: scenario_pass, scenario_pass_soft_skip, scenario_fail_canonical_drift, scenario_fail_reason_code_missing, scenario_fail_structural_edge_guard_miss, scenario_fail_lock13_violation, scenario_fail_timeout, aggregate_pass_clean, aggregate_pass_with_deferred, aggregate_candidate_with_debt, aggregate_fail]).
          * VERDICT_KINDS = Object.freeze([null, 'verifier_fail', 'edge_guard_miss']) - exactly 3 entries.
        - 8 public API stubs (each Lock 13 wrapped in try/catch returning a degraded sentinel; never throws upward):
          * runAll(opts), runScenario(args), selfTest(), aggregateResults(rs), appendLogRow(row, opts), _runScenarioImpl(scenario, tmpdir), _setupContainer(scenarioId), _spawnTool(scenario, tmpdir).
          * Bodies are stubs that return {ok:true, stub:true} so bootstrap self-test can verify wiring (T2-T7 fill bodies).
        - module.exports = { runAll, runScenario, selfTest, aggregateResults, appendLogRow, SCENARIOS, PHASE_53_GUARDED_STREAMS, FAIL_INJ_REASON_CODES, VERDICT_KINDS }.
        - if (require.main === module) { CLI dispatch: --run-all | --self-test | --help } - thin shell.

      Writes super-gsd/tools/failure-injection/scenarios.json (frozen 10-entry manifest):
        - Top-level: {schema_version:1, scenarios:[10 entries]}.
        - Each entry follows Section 2.1 shape exactly:
          { id, label, target_tool, inject_mechanism, tool_invocation_argv (array of strings; <tmpdir>/<resolved> placeholders), expected_reason_codes (array, minItems:1, closed-vocab subset of upstream tool vocabularies), canonical_streams_guarded (array, subset of PHASE_53_GUARDED_STREAMS), soft_skip_when (string|null), edge_guard_miss_classified (boolean) }.
        - Order locked: 1.token-attribution-poisoned-row, 2.context-packet-missing-capsule, 3.dispatch-router-vtp-whitelist-violation, 4.vtp-bridge-unavailable, 5.memory-governance-revocation-replay, 6.redis-adapter-flushdb-recovery, 7.sqlite-context-index-deleted-db, 8.phase-capsule-corrupted-json, 9.route-ledger-truncated-stream, 10.edge-guard-missing-emit.
        - ONLY scenario 10 has edge_guard_miss_classified:true; all others false.
        - Scenario 5 soft_skip_when:'phase_49_writer_unwired'; scenario 6 soft_skip_when:'redis_not_available_soft_skip'; all others null.

      Writes super-gsd/tools/failure-injection/SCENARIOS.schema.json (JSON-Schema draft-07):
        - $schema:'http://json-schema.org/draft-07/schema#', additionalProperties:false on top-level object + per-entry.
        - top-level required:['schema_version','scenarios']; scenarios.minItems:10, maxItems:10.
        - Per-entry required:['id','label','target_tool','inject_mechanism','tool_invocation_argv','expected_reason_codes','canonical_streams_guarded','soft_skip_when','edge_guard_miss_classified'].
        - Closed enum on id (10-entry list verbatim); pattern on inject_mechanism ([a-z][a-z0-9_]*); items.type:string on tool_invocation_argv; expected_reason_codes.minItems:1.

      Bootstrap self-test (4-5 assertions in selfTest() body):
        * Test 1: SCENARIOS Object.frozen, length===10, mutation no-op (push/pop/assign throws or no-ops in strict mode).
        * Test 2: SCENARIOS round-trips SCENARIOS.schema.json validation (Ajv compile + validate; 0 errors).
        * Test 3: Public-API stubs exist on module.exports (runAll, runScenario, selfTest, aggregateResults, appendLogRow are all typeof === 'function').
        * Test 4: Lock 13 wrapper present - calling each public API with malformed input returns a degraded sentinel object (never throws); use a bad-input fixture per API.
        * Test 5: ASCII-only check on harness.cjs (no smart quotes, no emoji, no non-ASCII byte).
      ASCII-only literals on every file. NO fs.writeFile/appendFile/spawnSync inside harness body until T2-T6 wire the actual implementations (skeleton is read-only-by-shape).
    hypothesis: |
      A canonical skeleton + frozen 10-entry manifest + JSON-Schema validator must land first because every subsequent task (T2 container isolation, T3-T5 per-scenario implementations, T6 aggregator+JSONL writer, T7 self-test entry+gate wire) depends on the frozen public-API surface and on SCENARIOS being immutable. Locking SCENARIOS/PHASE_53_GUARDED_STREAMS/FAIL_INJ_REASON_CODES/VERDICT_KINDS via Object.freeze + a 4-5 assertion bootstrap self-test prevents downstream drift; mirrors Phase 51 T1 skeleton-first pattern that shipped cleanly. Lock 4 (require by absolute path; never fork) and Lock 13 (never throws upward) are documented at file-top so executors of later tasks cannot accidentally introduce semantic similarity, embeddings, or unguarded throws. The 10-scenario JSON manifest is decoupled from the .cjs (loaded via require) so future SCHEMA-only edits do not require a code change - this is the same pattern Phase 51 used for SCENARIO.schema.json + scenario fixtures.
    falsifier: |
      Plan is wrong if any of:
        - bootstrap self-test fails (Object.freeze missing, public-API stub absent, FAIL_INJ_REASON_CODES <11 entries, VERDICT_KINDS not exactly [null,'verifier_fail','edge_guard_miss']).
        - scenarios.json fails SCENARIOS.schema.json round-trip (additionalProperties drift, closed-enum violation, scenarios.length !== 10).
        - More than one scenario has edge_guard_miss_classified:true (must be exactly scenario 10).
        - PHASE_53_GUARDED_STREAMS.length !== 11 (5 Phase-51 + 6 Phase-53 extensions: redis-projection-log.jsonl, edge-guard-log.jsonl, memory-revocations.jsonl, memory-promotions.jsonl, memory-demotions.jsonl, memory-revalidations.jsonl).
        - Any non-ASCII literal lands in harness.cjs or scenarios.json or SCENARIOS.schema.json (PS5.1/cockpit cross-rendering breaks).
        - Skeleton imports any Phase 41-52 tool by relative path or COPIES code from those modules (Lock 4 violation - only crit-backlog.cjs may be required at this stage).
        - Skeleton calls fs.writeFile/fs.appendFile/spawnSync inside harness body before T2-T6 (premature wiring; T1 is read-only-by-shape).
    stop_rule: |
      `node super-gsd/tools/failure-injection/harness.cjs --self-test` exits 0 with the bootstrap 4-5 assertions PASS. scenarios.json + SCENARIOS.schema.json present and ASCII-clean and round-trip. `node super-gsd/tools/plan-schema/validate.cjs --plan-file .planning/milestones/v2.0/phases/53-gate-failure-injection-harness/53-01-gate-failure-injection-harness-PLAN.md --project-dir C:/Users/user/GSDedits --mode load` exits 0. Atomic commit `feat(53-01): failure-injection skeleton + 10-scenario manifest + JSON-Schema + bootstrap self-test`.
    verification_cmd: "node super-gsd/tools/failure-injection/harness.cjs --self-test"
    expected_ATC_tier: FULL

  - id: "53-01-T2"
    agent: gsd-executor
    model: sonnet
    files_touched:
      - super-gsd/tools/failure-injection/harness.cjs
    depends_on: ["53-01-T1"]
    input_contract: |
      Reads:
        - super-gsd/tools/failure-injection/harness.cjs (T1 skeleton; SCENARIOS frozen, public API stubs, PHASE_53_GUARDED_STREAMS frozen)
        - 53-RESEARCH.md sections 3.1 (overall flow), 3.2 (tmpdir isolation primitive verbatim), 3.3 (real-process boundary - spawnSync NOT require), 5.2 (canonical-stream anti-pollution guard 5+6 streams), 9.1 (spawn pattern code example), 9.2 (fingerprint code example)
        - super-gsd/tools/harness-benchmark/sgsd-blind-live-controller.mjs lines 104-138 (spawnSync pattern mirror)
        - super-gsd/tools/context-bench/failure-injectors.cjs lines 307-396 (CANONICAL_STREAMS + fingerprintStream + fingerprintsEqual - mirror verbatim; W1 fix at line 358-370 = sha256+size only, mtime excluded from equality)
      Inputs from T1: SCENARIOS frozen array, public API stubs, PHASE_53_GUARDED_STREAMS frozen 11-entry.
    output_contract: |
      Extends super-gsd/tools/failure-injection/harness.cjs:

        * `_setupContainer(scenarioId)` returns { tmpdir, planningDir } where:
          - tmpdir = fs.mkdtempSync(path.join(os.tmpdir(), `sgsd-fail-inj-${scenarioId}-`)).
          - Creates tmpdir/.planning/{metrics,milestones,cache,gates.yaml-parent} via fs.mkdirSync recursive.
          - Returns absolute paths only. Asserts tmpdir.startsWith(os.tmpdir()) (workspace-traversal guard).

        * `_teardownContainer(tmpdir)` removes tmpdir recursively (fs.rmSync(tmpdir,{recursive:true,force:true})). Lock 13 wrapped: errors logged, never thrown.

        * `_spawnTool(scenario, tmpdir, extraEnv)` mirrors sgsd-blind-live-controller.mjs:104-138 spawnSync pattern verbatim:
          - Resolves <tmpdir> placeholder in scenario.tool_invocation_argv to absolute tmpdir path.
          - Resolves <resolved> placeholder via require.resolve(scenario.target_tool).
          - Calls spawnSync(argv[0], argv.slice(1), { cwd: tmpdir, env: Object.assign({}, process.env, scenario.env_overrides||{}, extraEnv||{}), timeout: 30000, encoding: 'utf8', maxBuffer: 4*1024*1024 }).
          - Returns { argv, cwd, env_overrides, exit_code, signal, stdout, stderr, stdout_digest:'sha256:'+sha256OfBytes(stdout), stderr_digest:'sha256:'+sha256OfBytes(stderr), duration_ms }.
          - On timeout: signal!==null returns { ..., reason:'scenario_fail_timeout' } (Lock 13 - no throw).

        * `_fingerprintStream(filePath)` mirrors failure-injectors.cjs:319-356 verbatim (sha256OfBytes + fs.statSync; absent file -> {sha256:sha256(empty), mtime:0, size:0, absent:true}; error -> {sha256:'', mtime:-1, size:-1, ok:false}).

        * `_fingerprintsEqual(a, b)` mirrors failure-injectors.cjs:358-370 (W1 fix: sha256+size only; mtime excluded; absent-vs-absent === true).

        * `_fingerprintAllStreams(planningDir)` returns Map<streamName, fingerprint> over PHASE_53_GUARDED_STREAMS resolving each as path.join(planningDir,'metrics',streamName). Used pre and post each scenario against the LIVE .planning/metrics/ (not tmpdir).

      Adds 3-4 self-test assertions (running total 7-9 of target 16-20):
        * Test 6: PHASE_53_GUARDED_STREAMS.length === 11 and Object.frozen.
        * Test 7: _setupContainer creates tmpdir under os.tmpdir() (NOT under project workspace; assert tmpdir.startsWith(os.tmpdir()) and !tmpdir.includes(__dirname)).
        * Test 8: _teardownContainer is idempotent (calling twice on the same path does not throw; second call is no-op).
        * Test 9: _spawnTool with a no-op argv (`['node','-e','process.exit(0)']`) returns {exit_code:0, stdout:'', stderr:'', duration_ms:>=0}; cwd matches tmpdir; signal === null. Verifies real-process boundary smoke.
        * Test 10: _fingerprintStream + _fingerprintsEqual round-trip - write a file, fingerprint, mutate by 1 byte, fingerprint again, _fingerprintsEqual returns false; restore byte, fingerprint, equality returns true. Absent file -> absent fingerprint -> equal-to-self.

      Lock 13: every helper try/catch wrapped. _spawnTool catches subprocess throws; _fingerprintStream catches fs errors; _setupContainer/_teardownContainer never throw upward.
    hypothesis: |
      Container isolation + real-process boundary + canonical-stream fingerprint guard are the three load-bearing primitives every per-scenario task depends on; landing them in one task lets T3-T5 (per-scenario implementations) call _spawnTool + _setupContainer + _fingerprintAllStreams without re-implementing the plumbing. Mirroring sgsd-blind-live-controller.mjs:104-138 and failure-injectors.cjs:307-396 verbatim is correct because (a) those patterns shipped Phase 51 cleanly with W1+W3 ATC fixes already applied, (b) any deviation would re-litigate already-resolved canonical-fingerprint issues (mtime in equality, absent-file shape), (c) Lock 4 - failure-injection MUST consume Phase 51 patterns by mirror (NOT by import: Phase 51 lives in context-bench/, scope-isolated). spawnSync (NOT require) is the operationalization of mock-predicate-forbiddance per CONTEXT.md:81 + Pitfall 1 - any future regression to require() can be caught by self-test 9 (which asserts the subprocess actually ran with cwd=tmpdir).
    falsifier: |
      Plan is wrong if any of:
        - _setupContainer creates tmpdir under project workspace instead of os.tmpdir() (Pitfall 2; Lock 4 mechanical violation - subprocess cwd would resolve .planning/ to live workspace).
        - _spawnTool uses any of: require() of target tool, spawn (async) instead of spawnSync, or omits cwd argument (Pitfall 1; mock-predicate forbiddance violated).
        - _fingerprintsEqual includes mtime in equality check (W1 regression - mtime drift across filesystems would falsely fail anti-pollution).
        - _fingerprintsEqual treats absent-vs-present as equal (W3 regression - missing canonical stream would silently pass anti-pollution).
        - _teardownContainer throws on missing tmpdir (Lock 13 violation - rm-rf must be idempotent).
        - Any helper allows a subprocess throw to propagate upward (Lock 13 violation; subprocess stack traces in stderr must surface as verdict_kind:'verifier_fail' not as harness-level throws).
        - Self-test 9 asserts spawnSync was NOT called (would mean require() snuck in or stub leaked through).
        - PHASE_53_GUARDED_STREAMS gets mutated or shrunk (Pitfall 6).
    stop_rule: |
      `node super-gsd/tools/failure-injection/harness.cjs --self-test` exits 0 with bootstrap (T1) + 3-4 new T2 assertions all PASS (running 7-9 of target 16-20). `git diff --quiet -- super-gsd/tools/context-bench/` exits 0 (Phase 51 byte-untouched - we mirrored, not imported). Atomic commit `feat(53-01): container isolation + spawnSync boundary + 11-stream fingerprint guard`.
    verification_cmd: "node super-gsd/tools/failure-injection/harness.cjs --self-test"
    expected_ATC_tier: FULL

  - id: "53-01-T3"
    agent: gsd-executor
    model: sonnet
    files_touched:
      - super-gsd/tools/failure-injection/harness.cjs
      - super-gsd/tools/failure-injection/fixtures/token-attribution-poisoned-row/README.md
      - super-gsd/tools/failure-injection/fixtures/token-attribution-poisoned-row/seed-rows.jsonl
      - super-gsd/tools/failure-injection/fixtures/token-attribution-poisoned-row/poisoned-row.txt
      - super-gsd/tools/failure-injection/fixtures/context-packet-missing-capsule/README.md
      - super-gsd/tools/failure-injection/fixtures/context-packet-missing-capsule/seed-capsule.json
      - super-gsd/tools/failure-injection/fixtures/context-packet-missing-capsule/intent-fixture.json
      - super-gsd/tools/failure-injection/fixtures/dispatch-router-vtp-whitelist-violation/README.md
    depends_on: ["53-01-T1", "53-01-T2"]
    input_contract: |
      Reads:
        - 53-RESEARCH.md sections 4.1 (scenario 1), 4.2 (scenario 2), 4.3 (scenario 3), 2 (manifest table for tool_invocation_argv shape)
        - super-gsd/tools/token-attribution/report.cjs (--summarize CLI - ASSUMPTION A4 to verify; if --summarize/--planning-dir flags absent, use node -e wrapper calling summarize() directly)
        - super-gsd/tools/context-packet/build.cjs lines 92-220 (PACKET_REASON_CODES; 'packet_capsule_unavailable_raw_fallback' at line 98 - VERIFIED)
        - super-gsd/tools/dispatch-router/route.cjs lines 103-179 (ROUTE_DECISION_REASONS 18-entry; VTP_WHITELIST line 175-179; ROUTING_TABLE line 144-148 - 'matched_uncertainty_type' for non-whitelisted types - VERIFIED)
        - super-gsd/tools/failure-injection/harness.cjs (T2 helpers _setupContainer/_spawnTool/_fingerprintAllStreams)
      Inputs from T2: container isolation + spawnSync + fingerprint primitives.
    output_contract: |
      Writes 3 fixture directories per Section 3.4:

        * fixtures/token-attribution-poisoned-row/README.md (1-paragraph; expected reason code: parse_skipped_malformed_row OR row-count delta = lines-1).
        * fixtures/token-attribution-poisoned-row/seed-rows.jsonl (5 valid envelope-v1 rows with role:'researcher', milestone:'v1.8', phase:'36', token_breakdown.total_tokens populated).
        * fixtures/token-attribution-poisoned-row/poisoned-row.txt (deliberately malformed JSONL: e.g. `{"ts":"2026-04-28T22:00:00.000Z","not_json` - truncated mid-string, no closing brace, no trailing newline).

        * fixtures/context-packet-missing-capsule/README.md (1-paragraph; expected: packet_capsule_unavailable_raw_fallback in tmpdir's context-packet-log.jsonl).
        * fixtures/context-packet-missing-capsule/seed-capsule.json (valid PHASE-CAPSULE.json shape: {schema_version:1, milestone:'v1.8', phase:'36', goal:'fixture for scenario 2', decisions:[], outputs:[]} - the harness deletes this file mid-scenario via fs.unlinkSync).
        * fixtures/context-packet-missing-capsule/intent-fixture.json (intent passed to buildPacket: {role:'researcher', goal:'fixture intent', files_touched:[], depends_on_phase_capsules:[]}).

        * fixtures/dispatch-router-vtp-whitelist-violation/README.md (1-paragraph; argv-only inject: synthetic input {uncertainty_type:'deterministic_extraction', route_hint:'vtp'}; expected: matched_uncertainty_type AND decision.provider !== 'vtp'; cites route.cjs:144-148 ROUTING_TABLE primary='local-script' for deterministic_extraction).

      Extends super-gsd/tools/failure-injection/harness.cjs with `_runScenarioImpl(scenario, tmpdir)` body for scenarios 1-3:

        scenarios['token-attribution-poisoned-row']:
          - inject: copy fixtures/token-attribution-poisoned-row/seed-rows.jsonl to tmpdir/.planning/metrics/agent-token-spend.jsonl + append poisoned-row.txt content.
          - spawn: _spawnTool(scenario, tmpdir).
          - observe: parse stdout for parse_skipped_malformed_row OR count tmpdir/.planning/metrics/agent-token-spend.jsonl lines vs aggregator output (expect delta = 1).
          - verdict: PASS if exit_code===0 AND (reason code observed OR delta detected) AND canonical_state_preserved.

        scenarios['context-packet-missing-capsule']:
          - inject: copy seed-capsule.json to tmpdir/.planning/milestones/v1.8/phases/36-fixture/PHASE-CAPSULE.json then fs.unlinkSync that path; copy intent-fixture.json to tmpdir/intent.json.
          - spawn: _spawnTool with node -e wrapper calling buildPacket({role:'researcher',intent:loadJSON('./intent.json'),milestone:'v1.8',phase:'36'}).
          - observe: read tmpdir/.planning/metrics/context-packet-log.jsonl tail; expect row.reason_codes ⊇ ['packet_capsule_unavailable_raw_fallback'].
          - verdict: PASS if exit_code===0 AND expected reason code present AND canonical_state_preserved.

        scenarios['dispatch-router-vtp-whitelist-violation']:
          - inject: argv-only via _spawnTool (no static fixture; scenario.tool_invocation_argv carries `--route '{"uncertainty_type":"deterministic_extraction","route_hint":"vtp"}'`).
          - spawn: _spawnTool(scenario, tmpdir).
          - observe: parse stdout JSON; expect decision.provider !== 'vtp' AND decision.reason_codes ⊇ ['matched_uncertainty_type'].
          - verdict: PASS if exit_code===0 AND decision.provider!=='vtp' AND expected reason code present AND canonical_state_preserved.

      Adds 3 self-test assertions (one per scenario; running total 10-12):
        * Test 11: scenario 1 inject+spawn+observe+restore returns verdict='PASS' AND canonical_state_preserved===true AND tmpdir cleaned up.
        * Test 12: scenario 2 returns verdict='PASS' with packet_capsule_unavailable_raw_fallback in observed_reason_codes.
        * Test 13: scenario 3 returns verdict='PASS' with decision.provider !== 'vtp' (closed-vocab assertion - NO regex on stdout; parse stdout as JSON).

      ASCII-only on all .md/.jsonl/.json/.txt files. SECRET_PLACEHOLDER_X literals only if any fixture needs a credential-shaped string (none of scenarios 1-3 do).
    hypothesis: |
      Scenarios 1-3 are grouped because they share the same observation pattern (parse subprocess stdout/stderr OR read tmpdir/.planning/metrics/{stream} tail), zero env-only injects (env-only is scenarios 4+6), and zero structural-failure semantics (structural is scenario 10). The fixture authoring is parallel to the harness wiring: each scenario's inject is implemented in tandem with its fixture content, so the executor proves the inject->observe roundtrip end-to-end before T4-T5 add more scenarios. Cross-checking expected reason codes against verified source-code lines (build.cjs:98 packet_capsule_unavailable_raw_fallback; route.cjs:144-148 ROUTING_TABLE; route.cjs:103-129 ROUTE_DECISION_REASONS) prevents reason-code drift; if the source vocabularies change, scenario verdicts will fail loudly rather than silently.
    falsifier: |
      Plan is wrong if any of:
        - Any fixture file lands outside super-gsd/tools/failure-injection/fixtures/{scenario-id}/ (CONTEXT.md:94 violation - fixtures path is locked).
        - Scenario 1 inject pollutes the LIVE .planning/metrics/agent-token-spend.jsonl (Pitfall 5; subprocess cwd must resolve to tmpdir, not workspace).
        - Scenario 2 inject deletes the LIVE PHASE-CAPSULE.json (Lock 4 violation - production data lost).
        - Scenario 3 verdict logic depends on regex over stdout instead of JSON parse + set-membership (Lock 11 violation).
        - Any inject path uses a relative path that resolves to project workspace under any cwd (Pitfall 5 + Pitfall 7).
        - Any fixture contains a real credential prefix ('AKIA','sk-','ghp_') (CLAUDE.md absolute rule; only SECRET_PLACEHOLDER_X if any string-shaped credential needed).
        - Test 11 self-test passes when canonical streams drift (would mean fingerprint guard is broken; T2 regression).
    stop_rule: |
      `node super-gsd/tools/failure-injection/harness.cjs --self-test` exits 0 with bootstrap + T2 + T3 assertions PASS (running 10-12 of 16-20 target). `git diff --quiet -- super-gsd/tools/{token-attribution,context-packet,dispatch-router}` exits 0 (Lock 4 - upstream tools byte-untouched). All 3 fixture dirs present, ASCII-clean. Atomic commit `feat(53-01): scenarios 1-3 (token-attribution + context-packet + dispatch-router) + 3 fixture dirs`.
    verification_cmd: "node super-gsd/tools/failure-injection/harness.cjs --self-test"
    expected_ATC_tier: FULL

  - id: "53-01-T4"
    agent: gsd-executor
    model: sonnet
    files_touched:
      - super-gsd/tools/failure-injection/harness.cjs
      - super-gsd/tools/failure-injection/fixtures/vtp-bridge-unavailable/README.md
      - super-gsd/tools/failure-injection/fixtures/memory-governance-revocation-replay/README.md
      - super-gsd/tools/failure-injection/fixtures/memory-governance-revocation-replay/synthetic-revocation.jsonl
      - super-gsd/tools/failure-injection/fixtures/redis-adapter-flushdb-recovery/README.md
      - super-gsd/tools/failure-injection/fixtures/sqlite-context-index-deleted-db/README.md
    depends_on: ["53-01-T1", "53-01-T2"]
    input_contract: |
      Reads:
        - 53-RESEARCH.md sections 4.4 (scenario 4), 4.5 (scenario 5), 4.6 (scenario 6 - F17 reuse + soft-skip semantics), 4.7 (scenario 7), section 9.3 (soft-skip code example)
        - super-gsd/tools/vtp-bridge/classify.cjs (--bridge CLI; SGSD_VTP_FORCE_OFFLINE env consumer; provider_vtp_unavailable reason emit)
        - super-gsd/tools/memory-governance/lifecycle.cjs lines 2087-2090 (REVOKE_REASONS, REVALIDATION_KINDS), lines 188-200 (_readRows pattern), lines 2072-2103 (public API surface; --process-complaints CLI - ASSUMPTION A5)
        - super-gsd/tools/context-cache/redis-adapter.cjs lines 1502-1604 (_testHook_simulateFlushAndPoison; redis_flushdb_recovered_via_sqlite vs redis_not_available_soft_skip - VERIFIED)
        - super-gsd/tools/context-cache/query.cjs (--lookup CLI - ASSUMPTION A3) + super-gsd/tools/context-cache/rebuild.cjs lines 776-782 (index_unavailable, rebuild_error - VERIFIED)
        - super-gsd/tools/context-bench/failure-injectors.cjs lines 215-294 (Phase 51 F12-F15 + F17 soft-skip semantics - mirror)
      Inputs from T2: container + spawnSync + fingerprint primitives.
    output_contract: |
      Writes 4 fixture directories:

        * fixtures/vtp-bridge-unavailable/README.md (env-only; SGSD_VTP_FORCE_OFFLINE=1; expected provider_vtp_unavailable + fallback_used:'claude').
        * fixtures/memory-governance-revocation-replay/README.md (synthetic-revocation.jsonl seeded into tmpdir/.planning/metrics/; soft_skip_when='phase_49_writer_unwired' documented).
        * fixtures/memory-governance-revocation-replay/synthetic-revocation.jsonl (one envelope-v1 row with revoked_id, revoked_reason in REVOKE_REASONS enum, ts within last hour, schema_version:1).
        * fixtures/redis-adapter-flushdb-recovery/README.md (test-hook-driven; documents Q4 resolution: spawn-via-`node -e` wrapper calling _testHook_simulateFlushAndPoison; soft_skip_when='redis_not_available_soft_skip' counts as PASS-WITH-SOFT-SKIP per Phase 51 F17 precedent at failure-injectors.cjs:271-279).
        * fixtures/sqlite-context-index-deleted-db/README.md (rm tmpdir/.planning/cache/context-index.db mid-query; expected index_unavailable OR rebuild_error per rebuild.cjs:776-782; cites F4 fixture precedent at failure-injectors.cjs:122).

      Extends harness.cjs `_runScenarioImpl` body for scenarios 4-7:

        scenarios['vtp-bridge-unavailable']:
          - inject: env-only via _spawnTool extraEnv:{SGSD_VTP_FORCE_OFFLINE:'1'}.
          - observe: read tmpdir/.planning/metrics/route-decisions.jsonl; expect row.reason_codes ⊇ ['provider_vtp_unavailable'] AND row.fallback_used==='claude'.
          - verdict: PASS if expected reason code present AND fallback_used==='claude' AND canonical_state_preserved.

        scenarios['memory-governance-revocation-replay']:
          - inject: copy synthetic-revocation.jsonl to tmpdir/.planning/metrics/memory-revocations.jsonl.
          - spawn: _spawnTool with --process-complaints --planning-dir tmpdir/.planning (or node -e wrapper if CLI absent per A5).
          - observe: parse stdout JSON; expect reason ⊇ {REVOKE_REASONS|REVALIDATION_KINDS} OR scenario.soft_skip_when='phase_49_writer_unwired' matched.
          - verdict: PASS if expected reason OR soft-skip matched, AND canonical_state_preserved across 4 memory-* streams.
          - applySoftSkip helper (Section 9.3): if observed contains 'phase_49_writer_unwired', verdict='PASS-WITH-SOFT-SKIP', reason_codes:['scenario_pass_soft_skip','bench_fixture_skipped:phase_49_writer_unwired'].

        scenarios['redis-adapter-flushdb-recovery']:
          - inject: spawn child via node -e wrapper: `const r=require(<resolved>)._testHook_simulateFlushAndPoison({}); r.then(o=>{console.log(JSON.stringify(o));process.exit(0);}).catch(e=>{console.error(e.message);process.exit(1);})`.
          - observe: parse stdout JSON; expect reason ∈ {'redis_flushdb_recovered_via_sqlite','redis_not_available_soft_skip'}.
          - verdict: PASS if exit_code===0 AND one of two expected reasons; soft-skip path counts as PASS-WITH-SOFT-SKIP (NOT deferred-N per Pitfall 4).

        scenarios['sqlite-context-index-deleted-db']:
          - inject: write tmpdir/.planning/cache/context-index.db (small valid SQLite) then fs.unlinkSync after _setupContainer (or skip seed if rebuild can run on absent DB).
          - spawn: _spawnTool with --lookup '{"kind":"capsule","limit":5}' (per A3; fallback to node -e require(...).query(...) if CLI absent).
          - observe: parse stdout/stderr; expect reason ∈ {'index_unavailable','rebuild_error'} AND query returns degraded-empty.
          - verdict: PASS if exit_code===0 (Lock 13 binding) AND expected reason present AND canonical_state_preserved.

      Adds 4 self-test assertions (one per scenario; running total 14-16):
        * Test 14: scenario 4 returns verdict='PASS' with provider_vtp_unavailable + fallback_used='claude'.
        * Test 15: scenario 5 returns verdict='PASS' OR 'PASS-WITH-SOFT-SKIP'; canonical_state_preserved across 4 memory-* streams.
        * Test 16: scenario 6 returns verdict='PASS' OR 'PASS-WITH-SOFT-SKIP'; soft-skip explicitly counts as PASS toward 10/10 (Pitfall 4 enforcement).
        * Test 17: scenario 7 returns verdict='PASS' with index_unavailable OR rebuild_error; query.cjs returns without throwing (Lock 13).

      ASCII-only on all files. NO BENCH_*/TEST_* env vars passed to subprocesses (Pitfall 9).
    hypothesis: |
      Scenarios 4-7 are grouped because they share env-or-test-hook-driven injects (no static fixture content beyond README + one synthetic JSONL row) and because they exercise the soft-skip semantic that Phase 51 F12-F15 + F17 already proved. Bundling them in one task lets the executor land applySoftSkip helper once + apply it across scenarios 5+6 consistently. Q4 resolution (spawn-via-node-e wrapper for scenario 6) preserves the real-process boundary mechanically: the hook lives inside a real production-tool subprocess; it's not a mock predicate. Cross-checking against Phase 51 F12-F15 (failure-injectors.cjs:215-248 soft-skip emits) and F17 (lines 271-279 redis cross-binding) inherits the proven shape; any deviation from that shape would re-introduce the Pitfall 4 conflation (soft-skip-PASS vs deferred-N-FAIL) Phase 51 already retired. The scenario 7 query.cjs CLI shape (A3) is the only architectural unknown; the falsifier permits a node -e fallback so a CLI-shape mismatch does not block the phase.
    falsifier: |
      Plan is wrong if any of:
        - Scenario 4 inject sets BENCH_* or TEST_* env vars (Pitfall 9 - anti-cheat boundary breach).
        - Scenario 5 SOFT-SKIP is treated as deferred-N (Pitfall 4 - soft-skip on documented degraded path is PASS, never deferred).
        - Scenario 6 inject uses require() of redis-adapter directly instead of node -e subprocess (Pitfall 1 + mock-predicate forbiddance).
        - Scenario 7 inject deletes the LIVE .planning/cache/context-index.db (production data loss; subprocess cwd must resolve to tmpdir).
        - applySoftSkip helper appends a CRIT-BACKLOG row for soft-skip cases (T6 will handle this; soft-skip must NEVER trigger CRIT-BACKLOG append).
        - Scenario 5 verdict ignores canonical_state_preserved across the 4 memory-* streams (Section 5.3 Phase 53 extension to PHASE_53_GUARDED_STREAMS - those streams MUST be byte-equal pre/post).
        - Any test asserts verdict='PASS' (capital) when the actual aggregate verdict is 'PASS-WITH-SOFT-SKIP' (closed-vocab string mismatch).
    stop_rule: |
      `node super-gsd/tools/failure-injection/harness.cjs --self-test` exits 0 with bootstrap + T2 + T3 + T4 assertions PASS (running 14-16 of 16-20 target). `git diff --quiet -- super-gsd/tools/{vtp-bridge,memory-governance,context-cache}` exits 0 (Lock 4). All 4 fixture dirs present, ASCII-clean. Atomic commit `feat(53-01): scenarios 4-7 (vtp + memory-governance + redis-adapter + sqlite-index) + 4 fixture dirs + soft-skip helper`.
    verification_cmd: "node super-gsd/tools/failure-injection/harness.cjs --self-test"
    expected_ATC_tier: FULL

  - id: "53-01-T5"
    agent: gsd-executor
    model: sonnet
    files_touched:
      - super-gsd/tools/failure-injection/harness.cjs
      - super-gsd/tools/failure-injection/fixtures/phase-capsule-corrupted-json/README.md
      - super-gsd/tools/failure-injection/fixtures/phase-capsule-corrupted-json/corrupted-capsule.json
      - super-gsd/tools/failure-injection/fixtures/route-ledger-truncated-stream/README.md
      - super-gsd/tools/failure-injection/fixtures/route-ledger-truncated-stream/valid-rows.jsonl
      - super-gsd/tools/failure-injection/fixtures/route-ledger-truncated-stream/partial-line.txt
      - super-gsd/tools/failure-injection/fixtures/edge-guard-missing-emit/README.md
      - super-gsd/tools/failure-injection/fixtures/edge-guard-missing-emit/synthetic-gates.yaml
    depends_on: ["53-01-T1", "53-01-T2"]
    input_contract: |
      Reads:
        - 53-RESEARCH.md sections 4.8 (scenario 8), 4.9 (scenario 9), 4.10 (scenario 10 - structural-failure exemplar - Q5 synthetic gate), section 9.5 (edge-guard wiring code example)
        - super-gsd/tools/phase-capsule/write.cjs (readCapsule API + _safeReadJson degraded sentinel; ASSUMPTION A1 - returns null on malformed JSON without throwing)
        - super-gsd/scripts/lib/route-ledger.cjs lines 70-99 (BOUNDARIES 9-entry frozen + run_id generator + RUN_ID_REGEX) + lifecycle.cjs:188-200 (_readRows try/catch pattern)
        - super-gsd/scripts/lib/edge-guard.cjs lines 38-87 (recordTransition shape contract: returns {status:'logged'|'halt', missing_emits:[], row:{...}}; RELATIVE_LOG path; escalation log-only/halt - VERIFIED)
        - super-gsd/tools/failure-injection/harness.cjs (T2 helpers; T3+T4 _runScenarioImpl partial body)
      Inputs from T2: container + spawnSync + fingerprint primitives.
    output_contract: |
      Writes 3 fixture directories:

        * fixtures/phase-capsule-corrupted-json/README.md (1-paragraph; expected behavior: stdout JSON null sentinel from readCapsule; downstream consumer would emit packet_capsule_unavailable_raw_fallback; Lock 13 binding).
        * fixtures/phase-capsule-corrupted-json/corrupted-capsule.json (deliberately non-JSON content: e.g. `{"goal":"test", broken` - truncated mid-string, unclosed brace).

        * fixtures/route-ledger-truncated-stream/README.md (1-paragraph; expected: row-count delta = lines-1 with valid rows preserved; live route-decisions.jsonl byte-untouched).
        * fixtures/route-ledger-truncated-stream/valid-rows.jsonl (5 envelope-v1 rows with run_id matching RUN_ID_REGEX from route-ledger.cjs:99; each row JSON.parse-able).
        * fixtures/route-ledger-truncated-stream/partial-line.txt (truncated tail: e.g. `{"ts":"2026-04-28T22:00:00.000Z","run_id":` - no closing brace, no closing quote, no newline).

        * fixtures/edge-guard-missing-emit/README.md (1-paragraph; documents Q5 resolution: synthetic phase53_fixture_gate isolated from production gates; expected r.status='logged' AND r.missing_emits=['fixture-output.jsonl']).
        * fixtures/edge-guard-missing-emit/synthetic-gates.yaml (one gate row: name:phase53_fixture_gate, fromStep:5, toStep:6, expected_emits:['fixture-output.jsonl'], escalation:'log-only').

      Extends harness.cjs `_runScenarioImpl` body for scenarios 8-10 (completes the 10-scenario coverage):

        scenarios['phase-capsule-corrupted-json']:
          - inject: copy corrupted-capsule.json to tmpdir/.planning/milestones/v1.8/phases/36-fixture/PHASE-CAPSULE.json (overwrite path).
          - spawn: _spawnTool with node -e wrapper: `const w=require(<resolved>); console.log(JSON.stringify(w.readCapsule(process.argv[1])))` argv: corrupted path.
          - observe: parse stdout; expect JSON null OR a sentinel object (per A1 _safeReadJson contract); subprocess.stderr empty; exit_code===0.
          - verdict: PASS if exit_code===0 AND stdout JSON null/sentinel AND canonical_state_preserved.

        scenarios['route-ledger-truncated-stream']:
          - inject: copy valid-rows.jsonl to tmpdir/.planning/metrics/route-decisions.jsonl + append partial-line.txt content (NO trailing newline added).
          - spawn: _spawnTool with node -e wrapper: `const fs=require('fs');const txt=fs.readFileSync(process.argv[1],'utf8');const lines=txt.split('\\n');let n=0;for(const l of lines){if(!l)continue;try{JSON.parse(l);n++;}catch(_){}};console.log(n)` argv: tmpdir route-decisions.jsonl path.
          - observe: parse stdout integer; expect n === valid_row_count (i.e. 5); subprocess.stderr empty; exit_code===0.
          - verdict: PASS if exit_code===0 AND parsed-row-count === 5 AND canonical_state_preserved (live route-decisions.jsonl byte-equal).

        scenarios['edge-guard-missing-emit'] (the structural-failure exemplar):
          - inject: copy synthetic-gates.yaml to tmpdir/.planning/gates.yaml.
          - spawn: _spawnTool with node -e wrapper per Section 9.5 verbatim: `const eg=require(<resolved>);const r=eg.recordTransition({fromStep:5,toStep:6,phase:'53-fixture',plan:'01',gateName:'phase53_fixture_gate',expectedEmits:['fixture-output.jsonl'],actualEmits:[],projectDir:process.cwd(),gatesYamlPath:process.cwd()+'/.planning/gates.yaml'});console.log(JSON.stringify(r))`.
          - observe: parse stdout JSON; expect r.status==='logged' (or 'halt' depending on escalation) AND Array.isArray(r.missing_emits) && r.missing_emits.includes('fixture-output.jsonl').
          - verdict: PASS if r.status==='logged' AND r.missing_emits.length>0 AND tmpdir/.planning/metrics/edge-guard-log.jsonl has matching row.
          - CRITICAL: if r.status==='ok' OR r.missing_emits empty -> verdict='FAIL', verdict_kind='edge_guard_miss' (the structural defect surfaces here per Pitfall 8).

      Adds 3 self-test assertions (one per scenario; running total 17-19):
        * Test 18: scenario 8 returns verdict='PASS' with stdout JSON null/sentinel; subprocess never throws (Lock 13 binding via _safeReadJson).
        * Test 19: scenario 9 returns verdict='PASS' with parsed-row-count === valid_row_count (5); live route-decisions.jsonl byte-equal pre/post.
        * Test 20: scenario 10 returns verdict='PASS' with r.status==='logged' AND r.missing_emits=['fixture-output.jsonl'] (Pitfall 8 - explicitly assert 'logged' AND missing_emits.length>0; never weakly assert r.status!=='fail'). edge_guard_miss_classified=true is set on the scenario manifest entry.

      ASCII-only on all files. SECRET_PLACEHOLDER_X if any string-shaped credential needed (none of scenarios 8-10 do).
    hypothesis: |
      Scenarios 8-10 are grouped because they each test a degraded-read or structural-emit path and they complete the 10-scenario coverage. Scenario 10 must land in the same task as the manifest's edge_guard_miss_classified=true entry (T1 already locked this in scenarios.json) so the implementation and the classification are paired - any drift between the two would make verdict_kind classification non-deterministic. Pitfall 8 enforcement (explicit 'logged' + missing_emits.length>0 assertion, NOT a weak negative assertion) is the load-bearing test: if edge-guard regresses to silently passing on missing emits, scenario 10 is the canary. The synthetic gate (Q5 resolution) keeps the test isolated from production gate evolution; if a future phase adds new gates with different escalation behavior, scenario 10 stays stable. Section 9.5's verbatim code shape is mirrored to avoid Pitfall 8's weak-assertion regression vector.
    falsifier: |
      Plan is wrong if any of:
        - Scenario 8 inject overwrites the LIVE PHASE-CAPSULE.json (production data loss; subprocess cwd must resolve to tmpdir).
        - Scenario 8 verdict treats a thrown subprocess as PASS (Lock 13 violation - readCapsule must return null, not throw; if it throws, the harness records verifier_fail).
        - Scenario 9 reader logic uses a regex over the file content instead of line-by-line JSON.parse with try/catch (Lock 11 violation; semantic-similarity-style tolerance).
        - Scenario 9 verdict succeeds when partial-line was successfully parsed (would mean the malformed line was accepted; tail-skip semantic broken).
        - Scenario 10 weakly asserts r.status !== 'fail' instead of explicitly r.status==='logged' AND r.missing_emits.length>0 (Pitfall 8 - structural defect would silently pass).
        - Scenario 10 uses a real production gate's expected_emits instead of the synthetic phase53_fixture_gate (Q5 violation - production gate evolution would destabilize the test).
        - Scenarios.json edge_guard_miss_classified field is mutated for any other entry (only scenario 10 has it true; T1 invariant).
        - Any of scenarios 8-10 raises a subprocess exception that propagates upward instead of being captured as verdict_kind='verifier_fail' (Lock 13 violation).
    stop_rule: |
      `node super-gsd/tools/failure-injection/harness.cjs --self-test` exits 0 with bootstrap + T2 + T3 + T4 + T5 assertions PASS (running 17-19 of 16-20 target). `git diff --quiet -- super-gsd/tools/phase-capsule super-gsd/scripts/lib/{route-ledger.cjs,edge-guard.cjs}` exits 0 (Lock 4). All 3 fixture dirs present, ASCII-clean. All 10 scenarios fully implemented in _runScenarioImpl. Atomic commit `feat(53-01): scenarios 8-10 (phase-capsule + route-ledger + edge-guard structural exemplar) + 3 fixture dirs`.
    verification_cmd: "node super-gsd/tools/failure-injection/harness.cjs --self-test"
    expected_ATC_tier: FULL

  - id: "53-01-T6"
    agent: gsd-executor
    model: sonnet
    files_touched:
      - super-gsd/tools/failure-injection/harness.cjs
      - .planning/metrics/failure-injection-log.jsonl
    depends_on: ["53-01-T1", "53-01-T2", "53-01-T3", "53-01-T4", "53-01-T5"]
    input_contract: |
      Reads:
        - 53-RESEARCH.md sections 5.1 (envelope-v1 row schema with 8 extension fields), 6 (release-readiness contract for Phase 57), 7 (CRIT-BACKLOG integration: append site, classification logic, row shape, aggregate decision tree), 9.4 (CRIT-BACKLOG row append code example)
        - super-gsd/scripts/lib/crit-backlog.cjs lines 11-100 (VALID_KINDS line 29 includes verifier_fail + edge_guard_miss; appendRow line 61 - import-by-reference target; _guardCodexUnavailableClaim line 46 will not fire on Phase 53 summaries)
        - super-gsd/scripts/lib/route-ledger.cjs lines 96-99 (run_id generator + RUN_ID_REGEX - mirror)
        - super-gsd/registry/command-envelope-v1.yaml line 260 (additionalProperties:true - extension fields require no schema bump)
        - super-gsd/tools/failure-injection/harness.cjs (T1-T5 partial body; needs runAll() outer loop + appendLogRow + aggregateResults + _appendCritBacklogRow + _classifyVerdictKind)
      Inputs from T1-T5: SCENARIOS frozen, _runScenarioImpl complete for 10 scenarios, container+spawn+fingerprint primitives.
    output_contract: |
      Extends super-gsd/tools/failure-injection/harness.cjs:

        * `runAll(opts)` outer loop:
          - Generate run_id = `${new Date().toISOString()}-${crypto.randomBytes(2).toString('hex')}` (mirrors route-ledger.cjs:96-99).
          - planningDir = opts.planningDir || path.join(process.cwd(), '.planning').
          - Pre-fingerprint: liveFingerprintPre = _fingerprintAllStreams(planningDir).
          - For each scenario S in SCENARIOS (sequential per CONTEXT.md:107):
            - tmpdir = _setupContainer(S.id).
            - try { result = _runScenarioImpl(S, tmpdir) } catch(_e) { result = {verdict:'FAIL', verdict_kind:'verifier_fail', reason_codes:['scenario_fail_lock13_violation']} } (Lock 13 outer wrap).
            - liveFingerprintPost = _fingerprintAllStreams(planningDir).
            - canonical_state_preserved = mapEqual(liveFingerprintPre, liveFingerprintPost) using _fingerprintsEqual on each stream; canonical_drift = list of stream names that drifted.
            - if canonical_state_preserved===false: result.verdict='FAIL', result.verdict_kind='verifier_fail', result.canonical_drift=canonical_drift.
            - appendLogRow(planningDir, _buildEnvelopeRow(run_id, S, result, tmpdir)).
            - finally: _teardownContainer(tmpdir).
          - aggregate = aggregateResults(allResults).
          - if aggregate.fail_count > 0 OR aggregate.deferred_count > 0: for each failed S, _appendCritBacklogRow(planningDir, S, S.observed, S.expected, _classifyVerdictKind(S, result.verdict)).
          - return { run_id, verdict: aggregate.verdict, scenarios: allResults, aggregate, exit_code: aggregate.exit_code }.

        * `aggregateResults(scenarios[])` per Section 7.4 decision tree:
          - pass_count = scenarios.filter(s => s.verdict==='PASS' || s.verdict==='PASS-WITH-SOFT-SKIP').length.
          - failed = scenarios.filter(s => s.verdict==='FAIL').
          - edge_guard_miss_count = failed.filter(s => s.verdict_kind==='edge_guard_miss').length.
          - if pass_count===10: { verdict:'PASS', exit_code:0, deferred_count:0, edge_guard_miss_count:0, fail_count:0 }.
          - elif pass_count===9 AND edge_guard_miss_count===0: { verdict:'PASS-WITH-DEFERRED-1', exit_code:0, deferred_count:1, edge_guard_miss_count:0, fail_count:1 }.
          - elif edge_guard_miss_count > 0: { verdict:'CANDIDATE-WITH-DEBT', exit_code:1, edge_guard_miss_count, fail_count: failed.length }.
          - else: { verdict:'FAIL', exit_code:1, fail_count: failed.length, edge_guard_miss_count }.

        * `_classifyVerdictKind(scenario, scenarioVerdict)` per Section 7.2:
          - if scenarioVerdict==='PASS' || scenarioVerdict==='PASS-WITH-SOFT-SKIP': return null.
          - if scenario.edge_guard_miss_classified===true: return 'edge_guard_miss'.
          - return 'verifier_fail'.

        * `_appendCritBacklogRow(planningDir, scenario, observed, expected, verdictKind)` per Section 9.4 verbatim:
          - if verdictKind===null: return (no row for PASS/PASS-WITH-SOFT-SKIP).
          - require crit-backlog.cjs by absolute path.
          - critBacklog.appendRow(planningDir, { kind:verdictKind, phase:'53', plan:'01', milestone:'v2.0', attempts_made:1, summary:`${scenario.id}: observed ${(observed||[]).join(',')||'none'}, expected ${(expected||[]).join(',')}`, evidence_path:'.planning/metrics/failure-injection-log.jsonl', last_diff_sha:null, tagged_for_milestone:'v2.0', added_at:new Date().toISOString() }).

        * `appendLogRow(planningDir, row)` per Section 5.1 envelope-v1 + 8 extension fields:
          - envelope_version:1, ts (ISO), command:'logFailureInjectionScenario', status, reason_codes[], artifacts[], evidence[], next_action:null, risk:null, duration_ms, run_id, phase:'53', milestone:'v2.0', + extension fields: scenario_id, tool_invocation{argv,cwd,env_overrides,exit_code,signal,stdout_digest,stderr_digest,duration_ms}, inject_applied, observed_reason_codes[], canonical_state_preserved (bool), canonical_drift[], verdict, verdict_kind.
          - fs.appendFileSync(path.join(planningDir,'metrics','failure-injection-log.jsonl'), JSON.stringify(row)+'\n', 'utf8'). Atomic per row.

        * `_buildEnvelopeRow(run_id, scenario, result, tmpdir)` constructs the row per the schema above; sha256 digests computed via crypto.createHash.

      Adds 2-3 self-test assertions (running total 19-21):
        * Test 21: aggregate pass_count===10 -> verdict='PASS', exit_code=0, no CRIT-BACKLOG rows appended (verify via crit-backlog.jsonl byte-equal pre/post).
        * Test 22: aggregate pass_count===9 with one verifier_fail FAIL -> verdict='PASS-WITH-DEFERRED-1', exit_code=0, exactly 1 verifier_fail row appended; aggregate with any edge_guard_miss FAIL -> verdict='CANDIDATE-WITH-DEBT', exit_code=1, 1 edge_guard_miss row appended.
        * Test 23: appendLogRow envelope-v1 conformance - row has all 13+ required fields (envelope-v1 base + 8 extension); JSON.parse round-trip; ASCII-only.

      ASCII-only.
    hypothesis: |
      Aggregator + JSONL writer + CRIT-BACKLOG integration must be one task because they share the row schema (Section 5.1) and the verdict decision tree (Section 7.4) is a single pipeline. Splitting them risks schema drift or double-write bugs. Single-writer protocol for CRIT-BACKLOG (Q1 resolution: harness writes inline at end of runAll() AFTER per-scenario fingerprint phase) is correct because the canonical-fingerprint guard must be stable during scenario execution; if scenario writes raced with CRIT-BACKLOG appends, anti-pollution would falsely fail. The classification logic (_classifyVerdictKind) is scenario-id-keyed (Lock 11: set membership on scenario.edge_guard_miss_classified) which is deterministic and replayable. envelope-v1 conformance (additionalProperties:true) lets extension fields land without schema bump, mirroring Phase 51's context-bench-runs.jsonl precedent. Pitfall 10 enforcement (any edge_guard_miss -> exit 1, regardless of pass_count) is the load-bearing decision tree shape - the aggregator must not promote CANDIDATE-WITH-DEBT to PASS-WITH-DEFERRED-N just because pass_count===9.
    falsifier: |
      Plan is wrong if any of:
        - aggregateResults promotes pass_count===9 with an edge_guard_miss FAIL to PASS-WITH-DEFERRED-1 instead of CANDIDATE-WITH-DEBT (Pitfall 10 violation).
        - aggregateResults treats PASS-WITH-SOFT-SKIP as a deferred fail (Pitfall 4 violation).
        - _classifyVerdictKind returns non-null for a PASS/PASS-WITH-SOFT-SKIP scenario (would append spurious CRIT-BACKLOG rows on green runs).
        - CRIT-BACKLOG row append happens MID-scenario instead of in aggregate stage (would race the canonical-fingerprint guard; Q1 violation).
        - appendLogRow row count per --run-all is not exactly 10 (Section 6.2 determinism requirement; Phase 57 score.cjs slice(-10) would mis-identify the run).
        - Multiple --run-all invocations write rows with the same run_id (would break Phase 57 groupBy run_id).
        - envelope-v1 row missing any of the 13+ required fields (envelope_version, ts, command, status, reason_codes, run_id, phase, milestone, scenario_id, tool_invocation, inject_applied, observed_reason_codes, canonical_state_preserved, verdict).
        - CRIT-BACKLOG summary string contains 'codex unavailable' substring (would trigger _guardCodexUnavailableClaim; Phase 53 summaries must not match this regex).
        - The harness fingerprint pre/post is taken against TMPDIR mirror instead of LIVE planningDir (Section 5.2 anti-pollution invariant - the live workspace is what gets guarded).
    stop_rule: |
      `node super-gsd/tools/failure-injection/harness.cjs --self-test` exits 0 with bootstrap + T2-T6 assertions PASS (running 19-21 of 16-20 target; can expand to 22-23). `node super-gsd/tools/failure-injection/harness.cjs --run-all` writes >=10 rows to .planning/metrics/failure-injection-log.jsonl all sharing one run_id; `git diff --quiet -- super-gsd/tools/{token-attribution,context-packet,dispatch-router,vtp-bridge,memory-governance,context-cache,phase-capsule}` exits 0; `git diff --quiet -- super-gsd/scripts/lib/{crit-backlog.cjs,route-ledger.cjs,edge-guard.cjs}` exits 0 (Lock 4). Atomic commit `feat(53-01): aggregator + envelope-v1 JSONL writer + CRIT-BACKLOG integration + verdict decision tree`.
    verification_cmd: "node super-gsd/tools/failure-injection/harness.cjs --self-test"
    expected_ATC_tier: FULL

  - id: "53-01-T7"
    agent: gsd-executor
    model: sonnet
    files_touched:
      - super-gsd/tools/failure-injection/run-self-test.cjs
      - super-gsd/tools/failure-injection/README.md
      - super-gsd/tools/failure-injection/harness.cjs
      - super-gsd/scripts/sgsd-complete-milestone.cjs
    depends_on: ["53-01-T1", "53-01-T2", "53-01-T3", "53-01-T4", "53-01-T5", "53-01-T6"]
    input_contract: |
      Reads:
        - super-gsd/tools/failure-injection/harness.cjs (consolidated 16-20 assertion self-test from T1+T2+T3+T4+T5+T6; running total 19-21)
        - super-gsd/scripts/sgsd-complete-milestone.cjs (existing v1.9 dual-gate per Phase 51-T7 + Phase 52-T7 wire; needs v2.0 triple-gate extension - context-bench + redis-adapter + failure-injection)
        - 53-RESEARCH.md sections 8.2 (16-20 self-test assertion target), 8.4 (verifier exit criteria)
        - .planning/ROADMAP-AGENT.md lines 622-648 (Phase 53 acceptance verbatim - 10/10 required for SHIPPED clean)
      Inputs from T1-T6: complete harness; all 10 scenarios implemented; aggregator + JSONL writer + CRIT-BACKLOG + canonical-fingerprint guard all in place.
    output_contract: |
      Writes super-gsd/tools/failure-injection/run-self-test.cjs (thin shell):
        - 'use strict'; ASCII-only header doc.
        - main() spawns `node harness.cjs --self-test` via child_process.spawnSync, propagates exit code.
        - Header comment: "Phase 53 self-test entry. Idempotent: each run snapshots+restores LIVE canonical streams (T6 anti-pollution). Operator runs `node super-gsd/tools/failure-injection/run-self-test.cjs` for a fast 16-20-assertion green."
        - NO new aggregator. NO new oracle. NO new CRIT-BACKLOG logic. (Mirrors Phase 51 run-self-test.cjs verbatim shape.)

      Writes super-gsd/tools/failure-injection/README.md (operator documentation):
        - Sections: Overview (10-scenario harness, real-tool boundary, no mock predicates); Usage (--self-test, --run-all, --help); Scenario catalog (10 entries with one-line summaries each); JSONL ledger schema; CRIT-BACKLOG integration (verifier_fail vs edge_guard_miss); release-readiness contract (Phase 57 will consume tail); soft-skip vs deferred-N (Pitfall 4 explainer); how to run a single scenario (--scenario <id>); how to debug a failing scenario (tmpdir is logged in tool_invocation.cwd; replay by hand).
        - ASCII-only.

      EXTENDS super-gsd/scripts/sgsd-complete-milestone.cjs (currently v1.9 dual-gate per Phase 51-T7 + Phase 52-T7):
        - Adds a v2.0 branch: when --milestone v2.0:
          1. require Phase 51 context-bench harness, call selfTest(); on exit !==0 stderr 'milestone_close_blocked:context_bench_self_test_failed' exit 1.
          2. require Phase 52 redis-adapter, call selfTest(); on exit !==0 stderr 'milestone_close_blocked:redis_adapter_self_test_failed' exit 1.
          3. require Phase 53 failure-injection harness, call selfTest(); on exit !==0 stderr 'milestone_close_blocked:failure_injection_self_test_failed' exit 1.
          4. Optional: also run --run-all and assert 10/10 PASS per ROADMAP-AGENT.md:644-646 (gate-only, NOT in self-test path because --run-all is slow); deferred to verifier per Section 8.4 - the .cjs gate runs --self-test only.
          5. All three pass -> exit 0.
        - Lock 13 wrap on each require(): import failure -> stderr 'milestone_close_blocked:{phase}_unavailable' + exit 1 (NEVER silent advance).
        - When --milestone v1.9: existing dual-gate continues unchanged (no regression).
        - When --milestone <other>: existing no-op exit 0 unchanged.
        - ASCII-only.

      Final consolidation in harness.cjs:
        - Verify all 16-20 assertions list-locked (per RESEARCH section 8.2 table; tests 1-20 covered across T1-T6; running total 19-21 acceptable per Q7 - planner may consolidate weakly-overlapping tests if total exceeds 20).
        - Final list-lock check: each assertion's name + intent matches RESEARCH section 8.2 row; no 21st+ assertion sneaked in without a RESEARCH row; no assertion silently disabled.
        - All 8 public APIs (runAll, runScenario, selfTest, aggregateResults, appendLogRow, _runScenarioImpl, _setupContainer, _spawnTool) export from harness top-level and each is try/catch wrapped (Lock 13 confirmation).
        - Documentation block at file top explaining: dispatch sequence, run-once protocol, --run-all flag, --self-test flag, --scenario <id> flag, where canonical artifacts land (failure-injection-log.jsonl + CRIT-BACKLOG.md), AND the milestone-close consumer chain (sgsd-complete-milestone.cjs --milestone v2.0 -> harness.selfTest() as the third gate).

      NO new self-test assertions added in T7 (consolidation only).
    hypothesis: |
      Wiring the self-test into the milestone-close gate is what makes the 10-scenario harness non-skippable for v2.0; without this gate, Phase 53 ships but a future milestone-close could advance v2.0 to closed without the harness actually being green. The cleanest extension to sgsd-complete-milestone.cjs is to add a v2.0 triple-gate branch alongside the existing v1.9 dual-gate (Phase 51 + Phase 52); the existing pattern is proven (Phase 52-T7 already extended the file once for v1.9 - this is the third gate, identical shape). Lock 13 wrap on each phase's harness import is critical: a missing phase 53 module must produce milestone_close_blocked:failure_injection_unavailable, NOT silently advance the milestone (silent advance would be the worst-possible Phase 53 failure mode - the v2.0 acceptance contract at ROADMAP-AGENT.md:644 explicitly requires harness running as a precondition). The run-self-test.cjs entry is a thin shell to make the contract operator-runnable in one line for fast greens; mirrors the Phase 51 + Phase 52 pattern. The README.md is operator documentation - not load-bearing for verification but required for Phase 53 closure (Section 8.1 required files list). The list-lock check catches T1-T6 assertion drift: if a later task accidentally disabled an assertion, T7's cross-check against RESEARCH section 8.2 row table catches it.
    falsifier: |
      Plan is wrong if any of:
        - run-self-test.cjs exits 0 even when harness self-test fails (entry must propagate exit code).
        - sgsd-complete-milestone.cjs v2.0 branch silently exits 0 when failure-injection.selfTest() fails (worst-case silent advance; Lock 13 violation).
        - sgsd-complete-milestone.cjs v2.0 branch throws upward on a missing failure-injection module import (Lock 13 violation; must produce stderr 'milestone_close_blocked:failure_injection_unavailable' + exit 1 instead).
        - sgsd-complete-milestone.cjs v1.9 branch is regressed (any change to the v1.9 dual-gate; the v2.0 branch must be additive).
        - Any of the 16-20 self-test assertions silently disabled (running count drops below the lower bound without an explicit deferred-debt entry).
        - Phase 41-52 tool trees touched: `git diff --quiet -- super-gsd/tools/{token-attribution,token-waste,phase-capsule,context-registry,context-packet,sqlite-context-index,dispatch-router,vtp-bridge,memory-governance,context-cache,context-bench,harness-benchmark} super-gsd/scripts/lib/{crit-backlog.cjs,route-ledger.cjs,edge-guard.cjs}` returns non-zero.
        - run-self-test.cjs introduces any new aggregator or oracle (must be a thin shell over harness --self-test, nothing more).
        - README.md contains any non-ASCII literal or emoji.
        - Final list-lock check passes when an assertion was renamed or repurposed without updating the RESEARCH section 8.2 row table.
    stop_rule: |
      `node super-gsd/tools/failure-injection/run-self-test.cjs` exits 0 with N/N PASS (target 16-20) in <60 seconds. `node super-gsd/scripts/sgsd-complete-milestone.cjs --milestone v2.0` exits 0 (because all three harness self-tests are green). `grep -F 'failure-injection/harness.cjs' super-gsd/scripts/sgsd-complete-milestone.cjs` returns at least one line (the v2.0 branch wire is present). `node super-gsd/tools/failure-injection/harness.cjs --run-all` exits 0 with 10/10 PASS in <120s; .planning/metrics/failure-injection-log.jsonl gains 10 rows all sharing one run_id; CRIT-BACKLOG.md byte-equal pre/post. `git diff --quiet -- super-gsd/tools/{token-attribution,token-waste,phase-capsule,context-registry,context-packet,sqlite-context-index,dispatch-router,vtp-bridge,memory-governance,context-cache,context-bench,harness-benchmark} super-gsd/scripts/lib/{crit-backlog.cjs,route-ledger.cjs,edge-guard.cjs}` exits 0 (Phase 41-52 byte-untouched). `node super-gsd/tools/plan-schema/validate.cjs --plan-file .planning/milestones/v2.0/phases/53-gate-failure-injection-harness/53-01-gate-failure-injection-harness-PLAN.md --project-dir C:/Users/user/GSDedits --mode load` exits 0 (frontmatter validates). Atomic commit `feat(53-01): self-test entry shell + README + sgsd-complete-milestone v2.0 triple-gate wire + final list-lock`.
    verification_cmd: "node super-gsd/tools/failure-injection/run-self-test.cjs"
    expected_ATC_tier: FULL
---

<objective>
Phase 53 ships the v2.0 falsifiable proof that failure-injection works end-to-end across 10 production tools. The harness invokes each target tool via child_process.spawnSync against a fixture in an isolated tmpdir (cwd = os.tmpdir()/sgsd-fail-inj-{scenario-id}-XXXX); mock predicates are forbidden by construction. The 10 scenarios cover token-attribution, context-packet, dispatch-router, vtp-bridge, memory-governance, redis-adapter, sqlite-context-index, phase-capsule, route-ledger, and edge-guard - each scenario tests one real failure mode and asserts graceful degradation via closed-vocab reason codes + canonical-stream byte-equality.

Purpose: Phases 41-52 ship machinery; Phase 53 measures whether the machinery degrades gracefully when one production component fails. The phase is a tool, not a feature. It lives at super-gsd/tools/failure-injection/ and ships a deterministic harness + 10 fixture directories + a frozen scenarios.json manifest + a JSON-Schema validator + an envelope-v1 JSONL ledger at .planning/metrics/failure-injection-log.jsonl + a single-writer CRIT-BACKLOG integration. Lock 4 (require by absolute path; never fork) is the dominant constraint: Phase 41-52 tool trees are CONSUMED via spawnSync, never byte-modified. Lock 11 (no semantic similarity; byte-equality + set-membership only) and Lock 13 (never throws upward; missing fixture -> bench_scenario_skipped) extend verbatim across all 8 public APIs.

Output: 26 NEW files (1 harness CJS + 1 scenarios.json + 1 SCENARIOS.schema.json + 1 run-self-test CJS + 1 README + 10 fixture dirs containing 16 fixture files: 10 README.md + 6 supporting fixture artifacts). 1 EDITED file (sgsd-complete-milestone.cjs - additive v2.0 triple-gate branch). 1 CANONICAL output created on first --run-all (.planning/metrics/failure-injection-log.jsonl). 7 atomic commits, ASCII-only on every written file, read-only invariant on Phase 41-52 trees, 16-20 assertion self-test green in <60 seconds, 10-scenario --run-all green in <120 seconds, anti-pollution canonical-fingerprint guard across 11 streams.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/milestones/v2.0/phases/53-gate-failure-injection-harness/53-CONTEXT.md
@.planning/milestones/v2.0/phases/53-gate-failure-injection-harness/53-RESEARCH.md
@.planning/milestones/v2.0/phases/53-gate-failure-injection-harness/PHASE-CAPSULE.json
@.planning/ROADMAP-AGENT.md
@.planning/milestones/v1.9/SUMMARY.md
@.planning/milestones/v1.9/phases/51-context-stress-benchmark/51-RESEARCH.md
@super-gsd/tools/context-bench/failure-injectors.cjs
@super-gsd/tools/harness-benchmark/sgsd-blind-live-controller.mjs
@super-gsd/scripts/lib/crit-backlog.cjs
@super-gsd/scripts/lib/edge-guard.cjs
@super-gsd/scripts/lib/route-ledger.cjs
@super-gsd/registry/command-envelope-v1.yaml

<interfaces>
<!-- Forward contracts the executor consumes BY REFERENCE. Do not re-implement.       -->
<!-- All shapes verified against source code at the line citations in 53-RESEARCH.md. -->

From super-gsd/scripts/lib/crit-backlog.cjs (line 29 + 61 - VERIFIED):
```javascript
// Closed enum (5 entries): VALID_KINDS includes 'verifier_fail' + 'edge_guard_miss'
const VALID_KINDS = ['per_dispatch_atc', 'phase_atc', 'verifier_fail', 'edge_guard_miss', 'cleared'];

// Single-writer canonical append. Phase 53 calls this from runAll() aggregate stage.
// Row schema: { id?, kind (required, in VALID_KINDS), phase, plan, milestone,
//   attempts_made, summary, evidence_path, last_diff_sha, tagged_for_milestone,
//   added_at, resolved_at?, resolved_by? }
//
// _guardCodexUnavailableClaim (line 46): rejects rows whose summary matches /codex unavailable/i
//   without provider_health_check; Phase 53 summaries must NOT match this regex.
function appendRow(planningDir, row) { ... }

module.exports = { appendRow, VALID_KINDS, ... };
```

From super-gsd/scripts/lib/edge-guard.cjs (lines 38-87 - VERIFIED):
```javascript
// recordTransition shape contract used by scenario 10 (edge-guard-missing-emit):
// Returns { status: 'logged' | 'halt', missing_emits: [...], row: {...} }
// Writes row to .planning/metrics/edge-guard-log.jsonl
//
// Scenario 10 inputs:
//   { fromStep:5, toStep:6, phase:'53-fixture', plan:'01',
//     gateName:'phase53_fixture_gate',
//     expectedEmits:['fixture-output.jsonl'], actualEmits:[],   // deliberate gap
//     projectDir, gatesYamlPath }
//
// PASS: r.status==='logged' AND r.missing_emits.includes('fixture-output.jsonl')
// FAIL: r.status==='ok' OR r.missing_emits empty -> verdict_kind='edge_guard_miss'
function recordTransition(opts) { ... }
```

From super-gsd/scripts/lib/route-ledger.cjs (lines 70-99 - VERIFIED):
```javascript
// BOUNDARIES: 9-entry frozen enum - mirror for Phase 53 closed-vocab reason codes
// run_id generator pattern (mirror in harness.cjs runAll):
//   `${new Date().toISOString()}-${crypto.randomBytes(2).toString('hex')}`
// RUN_ID_REGEX: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z-[a-f0-9]{4}$/
// All 10 scenarios in one --run-all share one run_id (Section 6.2 determinism contract).
```

From super-gsd/tools/context-bench/failure-injectors.cjs (Phase 51 LOCKED, lines 307-396 - mirror verbatim):
```javascript
// CANONICAL_STREAMS: 5-entry frozen, the Phase 51 W3 ATC fix.
// Phase 53 EXTENDS to 11 entries (Section 5.3) - never SHRINKS:
const CANONICAL_STREAMS = Object.freeze([
  'agent-token-spend.jsonl', 'context-packet-log.jsonl',
  'context-complaints.jsonl', 'route-decisions.jsonl', 'crit-backlog.jsonl',
]);

// fingerprintStream (lines 319-356) - W1 + W3 fixes applied; mirror verbatim.
// fingerprintsEqual (lines 358-370) - sha256 + size only; mtime EXCLUDED from equality (W1 fix).
//   absent-vs-absent === true. absent-vs-present === false (W3 fix).
```

From super-gsd/tools/context-packet/build.cjs (Phase 45 LOCKED, line 92-102 - VERIFIED):
```javascript
// PACKET_REASON_CODES: 9-entry frozen. Used by scenarios 2 + 8.
// 'packet_capsule_unavailable_raw_fallback' is the expected emit when the capsule is missing/corrupt.
// _safeReadJson returns null on parse failure (Lock 13: never throws).
```

From super-gsd/tools/dispatch-router/route.cjs (Phase 47 LOCKED, lines 103-179 - VERIFIED):
```javascript
// ROUTE_DECISION_REASONS: 18-entry frozen. Used by scenarios 3 + 4.
// VTP_WHITELIST (line 175-179): {'architecture_challenge','prior_memory_lookup','book_lookup'}
// ROUTING_TABLE (line 144-148): deterministic_extraction primary='local-script' (NOT vtp).
// 'matched_uncertainty_type': scenario 3 expected reason code.
// 'provider_vtp_unavailable': scenario 4 expected reason code.
```

From super-gsd/tools/context-cache/redis-adapter.cjs (Phase 52 LOCKED, lines 1502-1604 - VERIFIED):
```javascript
// _testHook_simulateFlushAndPoison({}) returns one of:
//   { reason: 'redis_flushdb_recovered_via_sqlite', ok: true, ... }   (live Redis available)
//   { reason: 'redis_not_available_soft_skip',     ok: true, ... }   (no Redis container)
// Both shapes count as PASS in Phase 53 (Pitfall 4 - soft-skip on documented degraded path is PASS).
// Subprocess wrapper always exits 0; Lock 13.
```

From super-gsd/registry/command-envelope-v1.yaml (line 260 - VERIFIED):
```yaml
# additionalProperties: true - the Phase 51 + Phase 53 extension fields require no schema bump.
# Extension fields: scenario_id, tool_invocation, inject_applied, observed_reason_codes,
#                   canonical_state_preserved, canonical_drift, verdict, verdict_kind.
```

</interfaces>
</context>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| harness.cjs -> spawnSync subprocess | Untrusted only in the sense that the subprocess may write to its own cwd (tmpdir); workspace traversal mitigated by tmpdir.startsWith(os.tmpdir()) guard. |
| Fixture file content -> tmpdir mirror | Fixture content is project-controlled (committed to repo), but the harness must validate scenario.id against `[a-z][a-z0-9-]*` before using it as a directory name (path-traversal mitigation). |
| Subprocess stdout/stderr -> harness stdout JSON parser | Untrusted in the sense that a regressed target tool could emit malformed JSON; parser uses try/catch with degraded sentinel (Lock 13). |
| harness -> .planning/metrics/failure-injection-log.jsonl + CRIT-BACKLOG | Single-writer protocol; no concurrent runs (sequential scenarios; mkdtempSync uniqueness guarantees no tmpdir collision across concurrent harness invocations). |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-53-01 | Tampering | Subprocess command injection via scenario.tool_invocation_argv | mitigate | scenarios.json is committed-to-repo + frozen via Object.freeze + JSON-Schema-validated at module init; never built from user input; argv items typed as strings; placeholders <tmpdir>/<resolved> resolved with path.resolve only. |
| T-53-02 | Tampering | Path traversal in fixture paths | mitigate | scenario.id validated against `[a-z][a-z0-9-]*` regex before use as directory name; fixture paths joined via path.join (no `..`); tmpdir.startsWith(os.tmpdir()) asserted in _setupContainer (T2 self-test 7). |
| T-53-03 | DoS | Subprocess timeout / runaway target tool | mitigate | spawnSync timeout:30000 (30s) hard cap per scenario; total --run-all budget <120s per Q6; on timeout: signal!==null -> verdict_kind='verifier_fail', reason_codes:['scenario_fail_timeout']. |
| T-53-04 | Information Disclosure | Real credentials accidentally seeded into fixtures | mitigate | Synthetic placeholders only (SECRET_PLACEHOLDER_X); CLAUDE.md absolute rule + ASCII-only check at self-test 5; secret-prefix paranoia list ('AKIA','sk-','ghp_') excluded from any fixture content (verified via grep at task stop_rule). |
| T-53-05 | Tampering | tmpdir collision across concurrent harness runs | mitigate | mkdtempSync returns unique random suffix per call (OS-guaranteed uniqueness); harness is sequential within one --run-all (CONTEXT.md:107 lock). |
| T-53-06 | DoS | failure-injection-log.jsonl unbounded growth | accept | Append-only is intentional (envelope-v1 contract). Log rotation deferred to v2.1+ (status-consistency lane). Risk: low - 10 rows per run; even daily runs yield <4000 rows/yr. |
| T-53-07 | Information Disclosure | tmpdir leakage (rm-rf failure leaves fixture mirror behind) | mitigate | _teardownContainer wrapped in finally block (T2); fs.rmSync({recursive:true,force:true}); idempotent on missing paths; OS auto-cleans on reboot if rm-rf misses. Self-test 8 enforces idempotency. |
| T-53-08 | Tampering | Edge-guard regression (silent pass on missing emit) hides structural defects | mitigate | Scenario 10 explicitly asserts r.status==='logged' AND r.missing_emits.length>0 (Pitfall 8 - never weakly assert r.status!=='fail'); edge_guard_miss_classified=true so a regression surfaces as kind=edge_guard_miss -> CANDIDATE-WITH-DEBT (exit 1; visible). |
| T-53-09 | Spoofing | Anti-cheat boundary breach: subprocess receives BENCH_*/TEST_* env -> target tool short-circuits | mitigate | Section 9.1 Pitfall 9: scenario.env_overrides closed list (only SGSD_VTP_FORCE_OFFLINE for scenario 4); no BENCH_*/TEST_* keys; falsifier in T4 explicitly forbids them. |
| T-53-10 | Repudiation | Per-run row written without proof the subprocess actually ran | mitigate | tool_invocation row carries spawnSync argv + cwd + exit_code + signal + stdout_digest (sha256) + stderr_digest (sha256) + duration_ms; envelope-v1 row schema (Section 5.1); FAIL-INJ-02 acceptance criterion. |
</threat_model>

<verification>
Phase-level verification (gsd-verifier dispatch):

- [ ] All required files exist (harness.cjs, scenarios.json, SCENARIOS.schema.json, run-self-test.cjs, README.md, 10 fixture dirs with their supporting files, sgsd-complete-milestone.cjs extended).
- [ ] `node super-gsd/tools/failure-injection/harness.cjs --self-test` exits 0 with N/N PASS (target 16-20 assertions; running total from T1-T6 19-21 acceptable per Q7).
- [ ] `node super-gsd/tools/failure-injection/harness.cjs --run-all` exits 0 with 10/10 PASS in <120s; .planning/metrics/failure-injection-log.jsonl gains exactly 10 rows all sharing one run_id; envelope-v1 conformance verified.
- [ ] No row in .planning/metrics/crit-backlog.jsonl has kind='edge_guard_miss' after a clean run (would force CANDIDATE-WITH-DEBT per Phase 57 hard-precondition).
- [ ] All 11 PHASE_53_GUARDED_STREAMS are byte-untouched (sha256+size equality) after a full --run-all (Lock 4 + Lock 11 anti-pollution).
- [ ] Lock 4 verified: `git diff --quiet -- super-gsd/tools/{token-attribution,token-waste,phase-capsule,context-registry,context-packet,sqlite-context-index,dispatch-router,vtp-bridge,memory-governance,context-cache,context-bench,harness-benchmark} super-gsd/scripts/lib/{crit-backlog.cjs,route-ledger.cjs,edge-guard.cjs}` exits 0.
- [ ] `node super-gsd/scripts/sgsd-complete-milestone.cjs --milestone v2.0` exits 0 (triple-gate: Phase 51 + Phase 52 + Phase 53 all green).
- [ ] `node super-gsd/scripts/sgsd-complete-milestone.cjs --milestone v1.9` exits 0 (existing dual-gate unchanged; no regression).
- [ ] `node super-gsd/tools/plan-schema/validate.cjs --plan-file .planning/milestones/v2.0/phases/53-gate-failure-injection-harness/53-01-gate-failure-injection-harness-PLAN.md --project-dir C:/Users/user/GSDedits --mode load` exits 0 (frontmatter v2 schema).
- [ ] ASCII-only invariant: `grep -P '[^\x00-\x7F]' super-gsd/tools/failure-injection/*.cjs super-gsd/tools/failure-injection/*.json super-gsd/tools/failure-injection/*.md super-gsd/tools/failure-injection/fixtures/*/*.md` returns empty.

Defer-with-debt allowed if: 9/10 PASS with no edge_guard_miss (Phase 53 closes as PASS-WITH-DEFERRED-1).
Hard fail if: any scenario has canonical_state_preserved=false OR pass_count <= 8 OR any edge_guard_miss row.
</verification>

<success_criteria>
Phase 53 is COMPLETE when:

1. `node super-gsd/tools/failure-injection/run-self-test.cjs` exits 0 with 16-20 assertions PASS in <60s.
2. `node super-gsd/tools/failure-injection/harness.cjs --run-all` exits 0 with 10/10 PASS in <120s; produces deterministic envelope-v1 ledger row count of exactly 10 sharing one run_id.
3. CRIT-BACKLOG.md has zero new edge_guard_miss rows after a clean run; verifier_fail rows appear only on PASS-WITH-DEFERRED-1 (not PASS).
4. Phase 41-52 tool trees byte-untouched (Lock 4: git diff --quiet exits 0).
5. PHASE_53_GUARDED_STREAMS (11 entries) byte-untouched pre/post --run-all (Lock 11 anti-pollution).
6. sgsd-complete-milestone.cjs --milestone v2.0 invokes triple-gate (Phase 51 + Phase 52 + Phase 53 selfTests) and propagates exit code; --milestone v1.9 unchanged.
7. All 10 fixture directories present at super-gsd/tools/failure-injection/fixtures/{scenario-id}/ with README.md per scenario; ASCII-only.
8. Phase-plan frontmatter validates against plan-schema-v2.json via super-gsd/tools/plan-schema/validate.cjs --mode load (exit 0).
9. release-readiness/score.cjs (Phase 57; not yet shipped) can deterministically tail-read failure-injection-log.jsonl and compute scenarios bucket = round((pass_count/10) * 15) (Section 6.3 contract emitted; consumer is Phase 57's responsibility).
10. 7 atomic commits landed (one per task: T1-T7); each commit message follows `feat(53-01): {task summary}` format.
</success_criteria>

<output>
After completion, the gsd-verifier will read this PLAN.md to confirm all success_criteria are met, run the verification checks, and produce .planning/milestones/v2.0/phases/53-gate-failure-injection-harness/53-VERIFICATION.md with the per-criterion verdict and any deferred-debt or candidate-with-debt rows. PHASE-CAPSULE.json will be updated by the orchestrator post-verifier with the gates.verifier verdict, gates.atc_review verdict (Phase-level FULL ATC review with prior_errors_lookup=true), source_hashes.{plan,verification,atc_review}, and token_cost. Phase 53 promotes to SHIPPED on 10/10 + verifier PASS + ATC FULL PASS.
</output>
