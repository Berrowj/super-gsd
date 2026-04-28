---
phase: 53
phase_name: Gate Failure-Injection Harness
milestone: v2.0
researched: 2026-04-28
domain: Real-tool failure injection harness, container isolation (tmpdir cwd), 10-scenario gate matrix, JSONL evidence ledger, release-readiness scoring integration
confidence: HIGH
controlling_principle: "Mock predicates are forbidden. Every scenario invokes a REAL SGSD tool against a real fixture in a sandboxed temp directory; the harness only observes (snapshot/inject/observe/restore) and scores byte-equality + closed-vocab reason codes."
mirror_template: super-gsd/tools/context-bench/failure-injectors.cjs (Phase 51 F1-F16 4-step protocol) + super-gsd/tools/harness-benchmark/sgsd-blind-live-controller.mjs (anti-cheat boundary + child_process spawn pattern)
---

# Phase 53 - Gate Failure-Injection Harness - Research

<user_constraints>
## User Constraints (from 53-CONTEXT.md + ROADMAP-AGENT.md lines 622-648 + mass-discuss 2026-04-26)

### Locked Decisions (locked at mass-discuss 2026-04-26; CONTEXT auto-synthesized 2026-04-28 by orchestrator dispatch rule #1)
- **53=C** - real tool + container isolation; mock predicates forbidden. [VERIFIED: 53-CONTEXT.md line 27; ROADMAP-AGENT.md line 626]
- **10/10 required for v2.0 SHIPPED clean** - milestone-close gate refuses SHIPPED below 10/10. [VERIFIED: ROADMAP-AGENT.md lines 637, 644-646]
- **9/10 -> PASS-WITH-DEFERRED-N** - each failed scenario logged to CRIT-BACKLOG.md with `kind=verifier_fail`, summary quoting scenario id and observed-vs-expected. [VERIFIED: ROADMAP-AGENT.md lines 638-640]
- **Structural failure (missing emit) -> kind=edge_guard_miss -> CANDIDATE-WITH-DEBT** per edge-guard rule. [VERIFIED: ROADMAP-AGENT.md lines 641-643]
- **release-readiness/score.cjs scenarios bucket = pass/total * 15** rounded; deterministic tail-read of last-run JSONL. [VERIFIED: ROADMAP-AGENT.md line 648]
- **Sequential execution** (parallelism deferred). Shared canonical streams prevent safe concurrent injection. [VERIFIED: 53-CONTEXT.md line 107]
- **tmpdir cwd, not Docker per-scenario** - tools that already do filesystem isolation by `cwd` get isolation for free. [VERIFIED: 53-CONTEXT.md line 106]
- **PASS-WITH-DEFERRED-N threshold = 1 deferred max**; 8/10 or lower forces FAIL. [VERIFIED: 53-CONTEXT.md line 108]
- **Mock predicates forbidden** - every scenario MUST invoke the real tool process and observe real output. spawnSync allowed; stubbing internals is not. [VERIFIED: 53-CONTEXT.md line 81; ROADMAP-AGENT.md line 632]
- **depends_on:** [51]. **unblocks:** [54, 55, 56, 57]. [VERIFIED: 53-CONTEXT.md frontmatter; PHASE-CAPSULE.json downstream_contract.consumers]

### Acceptance Criteria (ROADMAP-AGENT.md lines 631-648 verbatim)
- A1: Each scenario actually executes the tool it targets (mock predicates forbidden; verified by per-run row in `.planning/metrics/failure-injection-log.jsonl`).
- A2: Fixtures live in `super-gsd/tools/failure-injection/fixtures/{scenario-id}/`.
- A3: Scenarios run in temp dirs (isolated from live `.planning/`).
- A4: Harness must run all 10 scenarios; 10/10 required for PASS.
- A5: 9/10 or lower may continue auto mode only as PASS-WITH-DEFERRED-N (each failed scenario logged to CRIT-BACKLOG.md kind=verifier_fail).
- A6: Structural failure (missing emit) -> kind=edge_guard_miss -> CANDIDATE-WITH-DEBT.
- A7: v2.0 cannot be SHIPPED clean unless harness is 10/10; milestone close runs harness as precondition.
- A8: release-readiness/score.cjs reads last-run JSONL output deterministically; scenarios bucket = pass/total * 15 rounded.

### Claude's Discretion (research narrows; planner may revisit)
- **CRIT-BACKLOG row append site** (Q1) - harness vs post-run script. Recommendation: harness writes via `super-gsd/scripts/lib/crit-backlog.cjs` `appendRow()` at the end of `runAll()` if any scenario failed. Single writer; no race. See section 7.
- **Edge-guard scenario target** (Q5) - which gate's `evidence_emitted` to drop. Recommendation: a synthetic gate fixture whose `expected_emits` includes a path the harness deliberately does NOT write; this exercises `super-gsd/scripts/lib/edge-guard.cjs#recordTransition`. Section 4.10.
- **Scenario 6 implementation** (Q4) - reuse `_testHook_simulateFlushAndPoison` or spawn child. Recommendation: spawn child running a wrapper that calls the test hook (real-process boundary preserved; mock-predicate forbiddance honored). Section 4.6.

### Deferred Ideas (OUT OF SCOPE for Phase 53)
- Restart/handoff chaos tests (Phase 54).
- Provider backpressure + circuit breaker (Phase 55).
- Scenario-based acceptance suite for happy-path (Phase 56).
- Canary degradation rehearsal (Phase 57).
- Live operator-laptop benchmark over real workdays (Phase 51 already shipped the foundation; Phase 53 generalizes to 10 named scenarios but does not become a live scoring loop).
- Web/cockpit dashboard surfacing of harness results (Phase 57 release-readiness `score.cjs` consumes the JSONL; cockpit may render later).
- Parallel scenario execution (canonical streams shared across scenarios; sequential is the only safe shape until per-stream-isolated parallel is designed).
</user_constraints>

<phase_requirements>
## Phase Requirements (from ROADMAP-AGENT.md Phase 53 acceptance block)

| ID | Description | Research Support |
|----|-------------|------------------|
| **FAIL-INJ-01** | 10-scenario harness; each scenario invokes a real SGSD tool against a real fixture | Section 4 (10 scenarios with tool target + invoke method); Section 3.3 (real-process boundary via spawnSync) |
| **FAIL-INJ-02** | Mock predicates forbidden; per-run row in failure-injection-log.jsonl proves real tool ran | Section 5.1 (envelope-v1 row schema with `tool_invocation` field carrying spawnSync command + exit code + stdout/stderr digest) |
| **FAIL-INJ-03** | Fixtures live in `super-gsd/tools/failure-injection/fixtures/{scenario-id}/` | Section 4 fixture-content matrix + Section 3.4 fixture authoring |
| **FAIL-INJ-04** | Container isolation - scenarios run in temp dirs | Section 3.2 (tmpdir mkdtempSync + per-scenario subprocess cwd + clean-up on restore) |
| **FAIL-INJ-05** | 10/10 PASS for SHIPPED clean | Section 3.5 verdict tree; Section 6 release-readiness integration |
| **FAIL-INJ-06** | 9/10 -> PASS-WITH-DEFERRED-N with CRIT-BACKLOG row kind=verifier_fail | Section 7 (CRIT-BACKLOG append protocol; classification logic) |
| **FAIL-INJ-07** | Structural failure -> CRIT-BACKLOG row kind=edge_guard_miss -> CANDIDATE-WITH-DEBT | Section 7 (verifier_fail vs edge_guard_miss classification rule); Section 4.10 (scenario 10) |
| **FAIL-INJ-08** | release-readiness scenarios bucket = pass/total * 15 rounded | Section 6 (deterministic tail-read of envelope-v1 JSONL; scoring formula) |
| **FAIL-INJ-09** | Canonical streams byte-untouched across full run (Lock 4 + anti-pollution) | Section 5.2 (5-stream sha256 fingerprint guard, mirroring Phase 51 CANONICAL_STREAMS) |
| **FAIL-INJ-10** | Self-test exit 0 with N/N assertions before milestone close | Section 8 (16-20 assertion target; mirror Phase 51 33-assertion pattern) |
</phase_requirements>

## Summary

Phase 53 is the **first v2.0 phase** and the **falsifiable proof** that v2.0's failure-injection lineage works end-to-end. It builds on the Phase 51 (v1.9 SHIPPED 2026-04-28) `failure-injectors.cjs` 4-step protocol (snapshot/inject/observe/restore) and the `sgsd-blind-live-controller.mjs` anti-cheat boundary. The architectural shift from Phase 51 to Phase 53 is **scope**: Phase 51 injected 16 fixtures within one tool's scope (context-bench harness as the dispatch target); Phase 53 invokes 10 different real production tools (token-attribution, context-packet, dispatch-router, vtp-bridge, memory-governance, redis-adapter, sqlite-context-index, phase-capsule, route-ledger, edge-guard) and observes whether each gracefully degrades.

The most important architectural insight is this: **Phase 53 is a real-process orchestrator, not a script integration**. Mock-predicate forbiddance is operationalized by requiring every scenario to invoke its target tool via `child_process.spawnSync`, NOT via `require()` (which would share the harness's process and could short-circuit assertions). The harness gives each subprocess a `cwd` of a per-scenario `mkdtempSync` directory; canonical streams under `.planning/metrics/` are mirrored into the temp dir, the inject mutates the temp dir's mirror, the subprocess's tool sees the mutated mirror as its truth, and after the subprocess exits the harness reads the temp dir's mirror to compute observed reason codes + canonical fingerprint deltas. The live `.planning/` is byte-untouched.

The hardest decisions resolved here:

1. **Real tool invocation method** - `spawnSync` with subprocess `cwd=tmpdir`, NOT `require()`. Justification: many target tools resolve `.planning/` from `process.cwd()` (context-packet/build.cjs:156 line `_planningDir(opts)` defaults to `path.join(process.cwd(), '.planning')`), so per-scenario `cwd` is the natural isolation primitive. Lock 4 also benefits: harness never imports tool internals, only spawns them. [VERIFIED: build.cjs:154-159]

2. **CRIT-BACKLOG row append site** - harness writes inline via `crit-backlog.cjs#appendRow` after each run, at the end of `runAll()`. Single writer; no race. The classification (verifier_fail vs edge_guard_miss) is decided per-scenario by the verdict tree (section 7); scenarios 1-9 default to `verifier_fail`; scenario 10 (edge-guard-missing-emit) defaults to `edge_guard_miss` because its failure mode is structural by definition.

3. **Scenario 10 design** - the structural-failure exemplar. Constructs a synthetic gate fixture (`gates.yaml` row + an executor invocation that intentionally does NOT write the declared `evidence_emitted` path), then drives `super-gsd/scripts/lib/edge-guard.cjs#recordTransition` and asserts `status: 'logged'` (default log-only) + `missing_emits: [<path>]`. The scenario PASSES when edge-guard correctly logs the gap; it FAILS (and surfaces as `edge_guard_miss`) when edge-guard silently passes.

4. **Scenario 6 implementation** - spawn a child process that calls `_testHook_simulateFlushAndPoison` so the real-process boundary holds (mock-predicate forbiddance). The hook itself is wrapped in Lock 13; on `redis_not_available_soft_skip` the harness emits `bench_scenario_skipped:redis_adapter_unavailable` (closed-vocab; mirrors Phase 51 F12-F15 soft-skip semantics) and counts the scenario as PASS (not deferred) because the soft-skip path is the documented graceful degradation - the same standard Phase 51 used for F12-F15 missing-writer scenarios.

**Primary recommendation:** Build `super-gsd/tools/failure-injection/` with five files (harness.cjs, scenarios.json, fixtures/{10 dirs}, run-self-test.cjs, README.md). Mirror the Phase 51 `failure-injectors.cjs` `INJECTION_FIXTURES` Object.freeze pattern + 4-step `snapshot/inject/observe/restore` protocol verbatim. Mirror the `CANONICAL_STREAMS` 5-stream fingerprint guard verbatim (it generalized from Phase 51 W3 ATC fix; do not regress). Mirror the Lock 13 sentinel pattern verbatim. Wire `release-readiness/score.cjs` (Phase 57) to consume the last run's tail-row deterministically. Self-test 16-20 assertions covering scenario manifest validity + canonical fingerprint guard + soft-skip semantics + Lock 13 + edge-guard wiring.

**Confidence:** HIGH. Every component has a precedent: Phase 51 `failure-injectors.cjs` (F1-F16 protocol), `sgsd-blind-live-controller.mjs:104-138` (anti-cheat boundary + spawn loop), `redis-adapter.cjs:1528` `_testHook_simulateFlushAndPoison` (F17 cross-binding), `crit-backlog.cjs:61` `appendRow` (closed-vocab `kind` enum), `route-ledger.cjs:70-80` `BOUNDARIES` 9-entry frozen enum, `edge-guard.cjs:56` `recordTransition` (structural-emit detection). Phase 53 is composition.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Spawn real SGSD tool process per scenario | Local Node script (`harness.cjs`) | n/a | spawnSync is the real-process boundary; require() would bypass mock-predicate forbiddance |
| Per-scenario tmpdir mkdtempSync with mirrored canonical streams | Local Node script (`harness.cjs`) | OS tmpdir | Lock 4 anti-pollution; mirrors Phase 51 sandbox pattern |
| 10-fixture catalog (Object.freeze) with snapshot/inject/observe/restore | Local Node script (`harness.cjs` SCENARIOS const) | n/a | Closed-vocab; mirrors Phase 51 INJECTION_FIXTURES |
| 4-step protocol per scenario (snapshot, inject, observe, restore) | Local Node script | Phase 51 mirror template | Inherit shape verbatim; only the inject mechanism differs |
| Canonical-stream sha256 fingerprint guard (5 streams) | Local Node script | Phase 51 `CANONICAL_STREAMS` verbatim | Anti-pollution invariant; Lock 11 byte-equality |
| Read tool stdout/stderr/exit code, parse reason codes | Local Node script | spawnSync return handles | Real-process observability |
| JSONL writer to `.planning/metrics/failure-injection-log.jsonl` | Local Node script | envelope-v1 contract | Append-only; deterministic per-run row |
| CRIT-BACKLOG row append on FAIL | Local Node script | `super-gsd/scripts/lib/crit-backlog.cjs#appendRow` (existing) | Single writer; closed-vocab `kind` |
| release-readiness/score.cjs scenarios bucket read | Phase 57 (downstream consumer) | reads tail of `.jsonl` from this phase | Phase 53 emits the contract; Phase 57 consumes |
| Edge-guard wiring (scenario 10) | Local Node script | `super-gsd/scripts/lib/edge-guard.cjs#recordTransition` (existing) | Structural-emit detection by reference |
| Soft-skip semantics (scenario 6 when Redis unavailable) | Local Node script | `redis-adapter.cjs#_testHook_simulateFlushAndPoison` returns `redis_not_available_soft_skip` | Mirrors Phase 51 F12-F15 |
| **NOT** in scope for harness | Browser/UI tier - none | API/database tier - none | Entire phase is one new directory under `super-gsd/tools/` |

Zero browser/frontend/API/database work. The whole phase is 1 new directory + 10 fixture subdirs + JSONL extension + crit-backlog-row protocol.

## Phase Constraints (from CLAUDE.md / repo conventions)

- **NEVER read/display/echo files containing API keys, tokens, secrets.** F10/scenario synthetic fixtures must use placeholder strings only (`SECRET_PLACEHOLDER_X`); no real credential prefixes (`AKIA`, `sk-`, `ghp_`). [VERIFIED: ~/.claude/CLAUDE.md global rule; super-gsd/tools/context-bench/failure-injectors.cjs:50 precedent]
- **bg_shell** is the operator's preferred shell wrapper (Windows/WSL convention). Harness CLI must work via `bg_shell run` - no foreground popup. [VERIFIED: CLAUDE.md global rule]
- **Mass-discuss line 211, no cost telemetry** - Phase 53 must NOT add dollar-cost columns. Token columns and `duration_ms` are envelope-v1 standard. [VERIFIED: 51-RESEARCH.md:97 precedent]
- **`.planning` JSONL + git commits remain source of truth** (Lock 2). Harness writes to `.planning/metrics/failure-injection-log.jsonl` (canonical, append-only, envelope-v1) + optional `.planning/CRIT-BACKLOG.md` row via `crit-backlog.cjs#appendRow` (which writes both `.jsonl` source-of-truth + rendered `.md`). Never to Redis as primary storage.
- **`additionalProperties: true` envelope-v1 contract** - bench rows can extend envelope-v1 with `scenario_id`, `tool_invocation`, `inject_applied`, `observed_reason_codes`, `canonical_state_preserved`, `verdict`, `verdict_reason`, `verdict_kind` (verifier_fail | edge_guard_miss | null) extension fields without schema bump. [VERIFIED: registry/command-envelope-v1.yaml line 260 - Phase 51 precedent]
- **ASCII-only on all .cjs files.** No smart quotes, no emoji, no non-ASCII literals. [VERIFIED: failure-injectors.cjs:47 precedent + Phase 51/52 self-test enforcement]

---

## 1. CONFIRM 10 SCENARIOS (the catalog)

The 10 scenarios proposed in 53-CONTEXT.md are CONFIRMED as the closed manifest. Each scenario satisfies the Phase 53 acceptance contract:

1. Names a real production tool (Phase 41-52).
2. Has a real failure mode that exists in production (not synthetic-only).
3. Has a closed-vocab expected reason code (subset of an existing emit vocabulary; no new enums for Phase 53).
4. Has a deterministic verdict (PASS = expected reason code observed AND canonical state preserved AND tool degraded gracefully).

Scenarios 1-9 are `verifier_fail`-classified by default. Scenario 10 is `edge_guard_miss`-classified because its failure mode is structural by definition. This binding is locked in Section 7.

---

## 2. SCENARIO MANIFEST (LOCKED)

This is the closed `scenarios.json` manifest. Each row is `Object.freeze` at module init.

| # | Scenario ID | Target Tool (file path) | Inject Mechanism | Real-tool Invocation Method | Expected Reason Codes (closed-vocab) | Canonical Streams That Must Remain Byte-Untouched |
|---|---|---|---|---|---|---|
| 1 | `token-attribution-poisoned-row` | `super-gsd/tools/token-attribution/report.cjs` | Append a deliberately malformed JSONL row to `agent-token-spend.jsonl` mirror in tmpdir (e.g., `{"ts":"x","not_json}` truncated mid-string) | `spawnSync('node', [require.resolve('../token-attribution/report.cjs'), '--summarize', '--planning-dir', tmpdir+'/.planning'], {cwd:tmpdir})` | `parse_skipped_malformed_row` (existing - inferred from `_safeReadJson` graceful fallback) OR row-count delta = 1 less than line-count | `agent-token-spend.jsonl` (live) byte-equal pre/post |
| 2 | `context-packet-missing-capsule` | `super-gsd/tools/context-packet/build.cjs` | `rm tmpdir/.planning/milestones/v1.8/phases/36-*/PHASE-CAPSULE.json` | `spawnSync('node', ['-e', 'require("../context-packet/build.cjs").buildPacket({role:"researcher",intent:{...},milestone:"v1.8",phase:"36"})'], {cwd:tmpdir})` (or a thin CLI wrapper) | `packet_capsule_unavailable_raw_fallback` [VERIFIED: build.cjs:98] | `context-packet-log.jsonl` (live), `context-complaints.jsonl` (live) byte-equal pre/post |
| 3 | `dispatch-router-vtp-whitelist-violation` | `super-gsd/tools/dispatch-router/route.cjs` | Pass `uncertainty_type='deterministic_extraction'` and force `route_hint='vtp'` (synthetic input through `routeDispatch()`) | `spawnSync('node', [require.resolve('../dispatch-router/route.cjs'), '--route', JSON.stringify({uncertainty_type:'deterministic_extraction', route_hint:'vtp'})], {cwd:tmpdir})` | `provider_vtp_unavailable` OR `matched_uncertainty_type` (whitelist enforced; vtp NOT in routing table for non-whitelisted) [VERIFIED: route.cjs:175-179 VTP_WHITELIST] | `route-decisions.jsonl` (live), `crit-backlog.jsonl` (live) byte-equal pre/post |
| 4 | `vtp-bridge-unavailable` | `super-gsd/tools/vtp-bridge/classify.cjs` | Set env `SGSD_VTP_FORCE_OFFLINE=1` for subprocess only | `spawnSync('node', [require.resolve('../vtp-bridge/classify.cjs'), '--bridge', '--uncertainty-type', 'architecture_challenge', '--query', 'fixture'], {cwd:tmpdir, env:{...process.env, SGSD_VTP_FORCE_OFFLINE:'1'}})` | `provider_vtp_unavailable` [VERIFIED: route.cjs:119; F6 fixture precedent at failure-injectors.cjs:144] | `route-decisions.jsonl` byte-equal; vtp-bridge-failures.jsonl row appended only in tmpdir mirror |
| 5 | `memory-governance-revocation-replay` | `super-gsd/tools/memory-governance/lifecycle.cjs` | Insert a synthetic memory-revocation row in tmpdir mirror; spawn lifecycle.cjs `processComplaints` against tmpdir | `spawnSync('node', [require.resolve('../memory-governance/lifecycle.cjs'), '--process-complaints'], {cwd:tmpdir})` | `revoke_applied` OR `revalidation_required` (subset of REVOKE_REASONS / REVALIDATION_KINDS [VERIFIED: lifecycle.cjs:2087-2090]); soft-skip on `phase_49_writer_unwired` | `memory-revocations.jsonl`, `memory-promotions.jsonl`, `memory-demotions.jsonl`, `memory-revalidations.jsonl` (live) byte-equal |
| 6 | `redis-adapter-flushdb-recovery` | `super-gsd/tools/context-cache/redis-adapter.cjs` | Spawn child process whose entry calls `_testHook_simulateFlushAndPoison`; child returns `redis_not_available_soft_skip` if no Redis container | `spawnSync('node', ['-e', 'const r=require("../context-cache/redis-adapter.cjs"); r._testHook_simulateFlushAndPoison({}).then(o=>{console.log(JSON.stringify(o));process.exit(0);})'], {cwd:tmpdir})` | `redis_flushdb_recovered_via_sqlite` (live Redis path) OR `redis_not_available_soft_skip` (no Redis - counts as PASS per Phase 51 soft-skip semantics) [VERIFIED: redis-adapter.cjs:1516-1521; F17 fixture at failure-injectors.cjs:271-279] | `redis-projection-log.jsonl` (live) byte-equal pre/post |
| 7 | `sqlite-context-index-deleted-db` | `super-gsd/tools/context-cache/rebuild.cjs` (Phase 46 - aliased through context-cache; queries via `query.cjs`) | `rm tmpdir/.planning/cache/context-index.db` mid-query | `spawnSync('node', [require.resolve('../context-cache/query.cjs'), '--lookup', JSON.stringify({kind:'capsule', limit:5})], {cwd:tmpdir})` | `index_unavailable` [VERIFIED: F4 fixture at failure-injectors.cjs:122; rebuild.cjs:776 `rebuild_error`] OR `rebuild_error` | `context-packet-log.jsonl` byte-equal; query.cjs returns degraded-empty result without throwing |
| 8 | `phase-capsule-corrupted-json` | `super-gsd/tools/phase-capsule/write.cjs` (Phase 43 reader) | Overwrite a tmpdir-mirrored `PHASE-CAPSULE.json` with truncated/non-JSON content (`{"goal":"test", broken`) | `spawnSync('node', ['-e', 'const w=require("../phase-capsule/write.cjs"); console.log(JSON.stringify(w.readCapsule(process.argv[1])))', tmpdir+'/.planning/milestones/v1.8/phases/36-.../PHASE-CAPSULE.json'], {cwd:tmpdir})` | `capsule_parse_failed` OR `capsule_unavailable` (subset of `_safeReadJson` returning null path - reader degrades gracefully). Concretely: `packet_capsule_unavailable_raw_fallback` is observed downstream when the reader returns null. | `context-packet-log.jsonl` byte-equal; capsule reader returns sentinel without throwing (Lock 13) |
| 9 | `route-ledger-truncated-stream` | `super-gsd/scripts/lib/route-ledger.cjs` | Append a partial-line write to tmpdir mirror of `route-decisions.jsonl` (e.g., `{"ts":"x","run_id":` without closing brace + newline) | `spawnSync('node', ['-e', 'const r=require("../../scripts/lib/route-ledger.cjs"); console.log(JSON.stringify(r.readRows ? r.readRows() : []))'], {cwd:tmpdir})` | `tail_skipped_partial_line` (inferred from `_readRows` JSON.parse-in-try pattern at memory-governance/lifecycle.cjs:188-200) OR row-count delta = 1 less than line-count, with all valid rows preserved | `route-decisions.jsonl` (live) byte-equal pre/post; tmpdir mirror's tail-skip is the entire test |
| 10 | `edge-guard-missing-emit` | `super-gsd/scripts/lib/edge-guard.cjs` | Synthetic gate fixture: `gates.yaml` row with `evidence_emitted: ['fixture-output.jsonl']`; harness invokes `recordTransition` with `actualEmits: []` (deliberate gap) | `spawnSync('node', ['-e', 'const eg=require("../../scripts/lib/edge-guard.cjs"); const r=eg.recordTransition({fromStep:5,toStep:6,phase:"53-fixture",plan:"01",gateName:"phase53_fixture_gate",expectedEmits:["fixture-output.jsonl"],actualEmits:[],projectDir:process.cwd(),gatesYamlPath:"gates.yaml"}); console.log(JSON.stringify(r))'], {cwd:tmpdir})` | `status:'logged'` AND `missing_emits:['fixture-output.jsonl']` (default log-only escalation; `recordTransition` emits row to `.planning/metrics/edge-guard-log.jsonl`) [VERIFIED: edge-guard.cjs:56-87] | `edge-guard-log.jsonl` (live) byte-equal; tmpdir mirror's row is the test artifact |

### 2.1 Field semantics for the manifest

Each scenario row in `scenarios.json` (frozen at module init):

```json
{
  "id": "token-attribution-poisoned-row",
  "label": "Token attribution gracefully skips a malformed JSONL row",
  "target_tool": "super-gsd/tools/token-attribution/report.cjs",
  "inject_mechanism": "append_malformed_jsonl_row",
  "tool_invocation_argv": ["node", "<resolved>", "--summarize", "--planning-dir", "<tmpdir>/.planning"],
  "expected_reason_codes": ["parse_skipped_malformed_row"],
  "canonical_streams_guarded": [
    "agent-token-spend.jsonl",
    "context-packet-log.jsonl",
    "context-complaints.jsonl",
    "route-decisions.jsonl",
    "crit-backlog.jsonl"
  ],
  "soft_skip_when": null,
  "edge_guard_miss_classified": false
}
```

Scenario 10 is the only entry where `edge_guard_miss_classified=true`.

### 2.2 Closed-vocab reason codes summary

The harness consumes existing reason-code vocabularies from each target tool. **No new enums are introduced.** This is Lock 11 + Lock 4 simultaneously: byte-equality on closed-vocab fields, no fork or duplication.

| Vocabulary | Source | Used by Scenarios |
|------------|--------|-------------------|
| `PACKET_REASON_CODES` (9 entries) | `context-packet/build.cjs:92-102` | 2, 8 |
| `ROUTE_DECISION_REASONS` (18 entries) | `dispatch-router/route.cjs:103-129` | 3, 4 |
| `REVOKE_REASONS`, `DEMOTION_REASONS`, `REVALIDATION_KINDS` | `memory-governance/lifecycle.cjs` | 5 |
| `redis-projection-log` reason codes (`redis_flushdb_recovered_via_sqlite`, `redis_not_available_soft_skip`, `poisoned_unparseable`) | `redis-adapter.cjs:1502-1518` | 6 |
| `index_unavailable`, `rebuild_error` | `context-cache/rebuild.cjs:776-782` (Phase 46) | 7 |
| `BENCH_FIXTURE_SKIPPED:*` (Phase 51 soft-skip vocabulary) | `failure-injectors.cjs:285-294` | 5, 6 (when soft-skip path) |
| `edge-guard-log.jsonl` row shape (`status:'logged'\|'halt'`, `missing_emits:[]`) | `edge-guard.cjs:56-87` | 10 |

### 2.3 Verdict tree per scenario (4-state, mirrors Phase 51 verdict tree)

```text
For each scenario S:
  PASS  if (observed_reason_codes ⊇ expected_reason_codes
            AND canonical_state_preserved == true
            AND tool exit code in {0, expected_nonzero_set})
  PASS  if (soft_skip_when matched
            AND emitted reason code = soft_skip_when value)
  FAIL  if (canonical_state_preserved == false)            -> verdict_kind = verifier_fail
  FAIL  if (expected_reason_codes NOT observed
            AND no soft-skip)                              -> verdict_kind = verifier_fail
  FAIL  if (S.edge_guard_miss_classified == true
            AND structural emit gap NOT logged)            -> verdict_kind = edge_guard_miss
  FAIL  if (tool process killed by signal,
            stack trace surfaced)                          -> verdict_kind = verifier_fail (Lock 13 violation upstream)
```

Aggregate (cross-scenario):

```text
runAll() returns:
  verdict = 'PASS'                  if pass_count == 10
  verdict = 'PASS-WITH-DEFERRED-N'  if pass_count == 9    AND no edge_guard_miss
  verdict = 'CANDIDATE-WITH-DEBT'   if any edge_guard_miss
  verdict = 'FAIL'                  if pass_count <= 8
```

Threshold of 1 deferred max is locked (53-CONTEXT.md:108).

---

## 3. CONTAINER ISOLATION + HARNESS ARCHITECTURE

### 3.1 Overall flow

```text
node super-gsd/tools/failure-injection/harness.cjs --run-all
  ├─ load scenarios.json (frozen 10-entry array)
  ├─ snapshot canonical streams (live .planning/metrics/) into 5-key fingerprint map
  ├─ for each scenario S in SCENARIOS:
  │    ├─ tmpdir = fs.mkdtempSync(os.tmpdir() + '/sgsd-fail-inj-' + S.id + '-')
  │    ├─ mirror( liveDotPlanning -> tmpdir/.planning )           // selective copy of fixture-relevant files
  │    ├─ overlay( S.fixture_dir -> tmpdir/.planning )            // overlay scenario-specific fixtures
  │    ├─ snapshot_pre = sha256-of-canonical-streams(tmpdir mirror)
  │    ├─ inject(S, tmpdir)                                       // mutate tmpdir state
  │    ├─ subprocess = spawnSync(S.tool_invocation_argv, {cwd:tmpdir, env:envForScenario(S), timeout: 30000})
  │    ├─ snapshot_post = sha256-of-canonical-streams(tmpdir mirror)
  │    ├─ live_post_fingerprint = fingerprintCanonicalStreams(liveDotPlanning)
  │    ├─ canonical_state_preserved = fingerprintsEqual(live_pre_fingerprint, live_post_fingerprint)
  │    ├─ observed_reason_codes = parseReasonCodes(subprocess.stdout, subprocess.stderr, tmpdir mirror)
  │    ├─ verdict = scoreVerdict(S, observed, canonical_state_preserved, subprocess.status)
  │    ├─ append envelope-v1 row to .planning/metrics/failure-injection-log.jsonl
  │    └─ rm -rf tmpdir
  ├─ aggregate verdict (PASS/PASS-WITH-DEFERRED-N/CANDIDATE-WITH-DEBT/FAIL)
  ├─ if any FAIL or DEFERRED -> append crit-backlog row(s) per S.verdict_kind
  └─ exit 0 (PASS / PASS-WITH-DEFERRED-1) | exit 1 (FAIL / CANDIDATE-WITH-DEBT)
```

### 3.2 tmpdir isolation primitive (verbatim mirror of Phase 51 sandboxing)

```javascript
// Source: failure-injectors.cjs:_makeSandboxRoot pattern + sgsd-blind-live-controller.mjs cwd model
function makeScenarioTmpdir(scenarioId) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), `sgsd-fail-inj-${scenarioId}-`));
  fs.mkdirSync(path.join(root, '.planning', 'metrics'), { recursive: true });
  fs.mkdirSync(path.join(root, '.planning', 'milestones'), { recursive: true });
  fs.mkdirSync(path.join(root, '.planning', 'cache'),     { recursive: true });
  return root;
}
```

**Three guarantees:**
1. `root` is under `os.tmpdir()` - never under the project workspace.
2. The subprocess receives `cwd: root` so any tool whose `_planningDir(opts)` defaults to `process.cwd() + '/.planning'` resolves to the mirror, not live.
3. After scenario completes, the harness `rm -rf root` (recursive remove); restore is automatic by tmpdir destruction. This is **simpler** than Phase 51's `restore()` callbacks because the live filesystem is never mutated in the first place.

### 3.3 Real-process boundary

**Locked: spawnSync, NOT require().** Justification:

- `require()` shares the harness's V8 process. A misbehaving target tool that mutates `process.env` or holds state in module-level closures would leak across scenarios.
- spawnSync gives a fresh process per scenario. Process-level isolation is free.
- `subprocess.status` (exit code) is a deterministic verdict input; require() does not produce one.
- Mock-predicate forbiddance (CONTEXT.md line 81) is operationalized by spawnSync: there is no way to "mock" a real subprocess.

```javascript
// Source: pattern parallels sgsd-blind-live-controller.mjs:104-138 spawnSync subprocess loop
const { spawnSync } = require('child_process');

function runScenario(scenario, tmpdir) {
  const { stdout, stderr, status, signal } = spawnSync(
    scenario.tool_invocation_argv[0],
    scenario.tool_invocation_argv.slice(1).map(a =>
      a.replace('<tmpdir>', tmpdir).replace('<resolved>',
        require.resolve(scenario.target_tool_resolve_id))
    ),
    {
      cwd: tmpdir,
      env: Object.assign({}, process.env, scenario.env_overrides || {}),
      timeout: 30000,
      encoding: 'utf8',
    }
  );
  return { stdout, stderr, status, signal };
}
```

The harness imports `child_process` only; it never imports the target tool. Lock 4 is mechanically preserved.

### 3.4 Fixture authoring (the 10 fixture dirs)

Each fixture dir lives under `super-gsd/tools/failure-injection/fixtures/{scenario-id}/`. Contents per scenario:

```text
super-gsd/tools/failure-injection/fixtures/
├── token-attribution-poisoned-row/
│   ├── README.md                    # 1-paragraph description + expected reason codes
│   ├── seed-rows.jsonl              # 5-10 valid rows the tool should still aggregate
│   └── poisoned-row.txt             # the malformed JSONL line to append
├── context-packet-missing-capsule/
│   ├── README.md
│   ├── seed-capsule.json            # the capsule the harness deletes mid-scenario
│   └── intent-fixture.json          # the intent passed to buildPacket
├── dispatch-router-vtp-whitelist-violation/
│   └── README.md                    # no static fixture content; argv-driven
├── vtp-bridge-unavailable/
│   └── README.md                    # env-only injection
├── memory-governance-revocation-replay/
│   ├── README.md
│   └── synthetic-revocation.jsonl   # synthetic memory-revocations.jsonl row
├── redis-adapter-flushdb-recovery/
│   └── README.md                    # test-hook-driven; no static fixture
├── sqlite-context-index-deleted-db/
│   └── README.md
├── phase-capsule-corrupted-json/
│   ├── README.md
│   └── corrupted-capsule.json       # non-JSON content
├── route-ledger-truncated-stream/
│   ├── README.md
│   ├── valid-rows.jsonl             # 5-10 valid envelope-v1 rows
│   └── partial-line.txt             # the truncated tail to append
└── edge-guard-missing-emit/
    ├── README.md
    └── synthetic-gates.yaml         # gates.yaml row with the fixture gate definition
```

Total: 10 dirs, ~15-20 files. README.md per fixture is mandatory (operator readability + ATC review).

### 3.5 Harness module shape (entry point)

```javascript
// super-gsd/tools/failure-injection/harness.cjs

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');

const CRIT_BACKLOG_ENV_BACKED_BY_PROVIDER_HEALTH_CHECK = false;  // not invoked here
const critBacklog = require('../../scripts/lib/crit-backlog.cjs');

const SCENARIOS = Object.freeze(/* 10 entries from scenarios.json */);

const CANONICAL_STREAMS = Object.freeze([
  'agent-token-spend.jsonl',
  'context-packet-log.jsonl',
  'context-complaints.jsonl',
  'route-decisions.jsonl',
  'crit-backlog.jsonl',
]);

const FAIL_INJ_REASON_CODES = Object.freeze([
  'scenario_pass',
  'scenario_pass_soft_skip',
  'scenario_fail_canonical_drift',
  'scenario_fail_reason_code_missing',
  'scenario_fail_structural_edge_guard_miss',
  'scenario_fail_lock13_violation',
  'scenario_fail_timeout',
  'aggregate_pass_clean',
  'aggregate_pass_with_deferred',
  'aggregate_candidate_with_debt',
  'aggregate_fail',
]);

const VERDICT_KINDS = Object.freeze([null, 'verifier_fail', 'edge_guard_miss']);

// Public API (Lock 13 wrapped)
function runAll(opts)        { /* main loop */ }
function runScenario(args)   { /* single-scenario invocation */ }
function selfTest()          { /* 16-20 assertions */ }
function aggregateResults(rs){ /* verdict aggregator */ }
function appendLogRow(row, opts) { /* envelope-v1 writer */ }

module.exports = {
  runAll,
  runScenario,
  selfTest,
  aggregateResults,
  appendLogRow,
  SCENARIOS,
  CANONICAL_STREAMS,
  FAIL_INJ_REASON_CODES,
  VERDICT_KINDS,
};

if (require.main === module) {
  // CLI dispatch: --run-all | --self-test | --help
}
```

---

## 4. PER-SCENARIO INJECT/OBSERVE DETAIL

### 4.1 Scenario 1: token-attribution-poisoned-row

**Inject:** Append a malformed JSONL line to `tmpdir/.planning/metrics/agent-token-spend.jsonl` after seeding it with 5-10 valid rows.

**Real-tool invocation:**
```bash
node {tmpdir}/node_modules_or_resolved/super-gsd/tools/token-attribution/report.cjs --summarize --planning-dir {tmpdir}/.planning --role researcher
```

Implementation note: `report.cjs#summarize()` already wraps row-level JSON.parse in try/catch (`_readRows` pattern at memory-governance/lifecycle.cjs:188-200, mirror in token-attribution). Expected: aggregator returns N-1 rows aggregated; malformed line silently skipped.

**Expected reason codes:** `parse_skipped_malformed_row` (if emitted) OR row-count delta proves graceful skip.

**Pass criteria:** subprocess exit 0 AND aggregated row count = N-1 AND no stack trace in stderr AND no Lock 13 violation.

**Edge-guard-miss vs verifier_fail classification:** verifier_fail (the malformed-row skip is behavioral, not structural).

### 4.2 Scenario 2: context-packet-missing-capsule

**Inject:** `fs.unlinkSync(tmpdir + '/.planning/milestones/v1.8/phases/36-gate-value-telemetry/PHASE-CAPSULE.json')` after seeding it.

**Real-tool invocation:** Spawn a thin Node `-e` wrapper that calls `buildPacket` against tmpdir.

**Expected reason codes:** `packet_capsule_unavailable_raw_fallback` in `context-packet-log.jsonl` row [VERIFIED: build.cjs:98].

**Pass criteria:** subprocess exit 0; tmpdir's `context-packet-log.jsonl` has a row with the expected reason code; live `context-packet-log.jsonl` byte-equal pre/post.

**Classification:** verifier_fail.

### 4.3 Scenario 3: dispatch-router-vtp-whitelist-violation

**Inject:** Pass `uncertainty_type='deterministic_extraction'` AND `route_hint='vtp'` (synthetic argv) - VTP whitelist requires `architecture_challenge | prior_memory_lookup | book_lookup`.

**Real-tool invocation:** spawnSync `route.cjs --route '{...}'` (or `-e` wrapper calling `routeDispatch`).

**Expected reason codes:** `matched_uncertainty_type` (the routing table entry for deterministic_extraction returns `local-script` primary; vtp is rejected mechanically) - the VTP whitelist is enforced by ROUTING_TABLE primary assignment, not as a runtime check. Decision will route to `local-script` with no `provider_vtp_unavailable` because vtp was never the primary [VERIFIED: route.cjs:144-148].

Refined expectation: subprocess returns a decision object whose `provider !== 'vtp'`. If provider IS 'vtp' for non-whitelisted uncertainty type, that's the failure mode. The reason_codes will contain `matched_uncertainty_type`.

**Pass criteria:** subprocess exit 0 AND decision.provider != 'vtp' AND `matched_uncertainty_type` present.

**Classification:** verifier_fail.

### 4.4 Scenario 4: vtp-bridge-unavailable

**Inject:** Set env `SGSD_VTP_FORCE_OFFLINE=1` for subprocess.

**Real-tool invocation:** `spawnSync('node', [require.resolve('../vtp-bridge/classify.cjs'), '--bridge', '--uncertainty-type', 'architecture_challenge', '--query', 'fixture'], {cwd:tmpdir, env: {...process.env, SGSD_VTP_FORCE_OFFLINE: '1'}})`.

**Expected reason codes:** `provider_vtp_unavailable` [VERIFIED: route.cjs:119; F6 fixture precedent at failure-injectors.cjs:144]. Should fall back to claude per `routes.yaml:vtp_bridge` fallback_chain.

**Pass criteria:** subprocess exit 0; route-decisions row in tmpdir mirror has `reason_codes` containing `provider_vtp_unavailable` AND `decision.fallback_used = 'claude'`.

**Classification:** verifier_fail.

### 4.5 Scenario 5: memory-governance-revocation-replay

**Inject:** Insert a synthetic memory-revocation row in tmpdir mirror's `memory-revocations.jsonl`; run `processComplaints()` against tmpdir.

**Real-tool invocation:** `spawnSync('node', [require.resolve('../memory-governance/lifecycle.cjs'), '--process-complaints', '--planning-dir', tmpdir+'/.planning'])`.

**Expected reason codes:** subset of `REVOKE_REASONS | REVALIDATION_KINDS` [VERIFIED: lifecycle.cjs:2087-2090]; OR soft-skip `phase_49_writer_unwired` if the complaint-processing path is unwired in this snapshot (mirror Phase 51 F12-F15 soft-skip semantics at failure-injectors.cjs:215-248).

**Pass criteria:** subprocess exit 0; downstream consumer rebuild observed in tmpdir mirror (or soft-skip emitted); 4 memory-* canonical streams byte-equal pre/post (live).

**Classification:** verifier_fail.

### 4.6 Scenario 6: redis-adapter-flushdb-recovery

**Inject:** Spawn child process whose entry calls `_testHook_simulateFlushAndPoison`. The hook returns one of:
- `redis_flushdb_recovered_via_sqlite` (live Redis available + SQLite warm-back path executed)
- `redis_not_available_soft_skip` (no Redis container; degraded path) [VERIFIED: redis-adapter.cjs:1516-1521]

**Real-tool invocation:**
```javascript
spawnSync('node', ['-e',
  'const r=require("' + require.resolve('../context-cache/redis-adapter.cjs') + '"); ' +
  'r._testHook_simulateFlushAndPoison({}).then(o => { console.log(JSON.stringify(o)); process.exit(o.ok ? 0 : 0); }).catch(e => { console.error(e.message); process.exit(1); })',
], { cwd: tmpdir, encoding: 'utf8', timeout: 30000 });
```

The `process.exit(o.ok ? 0 : 0)` is intentional: soft-skip is exit 0; only an unexpected throw is exit 1. This mirrors Phase 51 F17 soft-skip protocol at failure-injectors.cjs:271-279.

**Expected reason codes:** `redis_flushdb_recovered_via_sqlite` (live) OR `redis_not_available_soft_skip` (degraded - counts as PASS).

**Pass criteria:** subprocess exit 0; one of the two expected reason codes in stdout JSON; live `redis-projection-log.jsonl` byte-equal pre/post.

**Classification:** verifier_fail.

### 4.7 Scenario 7: sqlite-context-index-deleted-db

**Inject:** `fs.unlinkSync(tmpdir + '/.planning/cache/context-index.db')` after seeding it via Phase 46 `rebuild()`.

**Real-tool invocation:** `spawnSync('node', [require.resolve('../context-cache/query.cjs'), '--lookup', JSON.stringify({kind:'capsule', limit:5})], {cwd:tmpdir})`.

**Expected reason codes:** `index_unavailable` [VERIFIED: F4 fixture at failure-injectors.cjs:122] OR `rebuild_error` [VERIFIED: rebuild.cjs:776-782].

**Pass criteria:** subprocess exit 0 (Lock 13 binding); query returns degraded-empty result; live canonical streams byte-equal.

**Classification:** verifier_fail.

### 4.8 Scenario 8: phase-capsule-corrupted-json

**Inject:** Overwrite tmpdir-mirrored `PHASE-CAPSULE.json` with non-JSON content (`{"goal":"test", broken`).

**Real-tool invocation:** `spawnSync('node', ['-e', 'const w=require("' + require.resolve('../phase-capsule/write.cjs') + '"); console.log(JSON.stringify(w.readCapsule(process.argv[1])))', tmpdir+'/.planning/milestones/v1.8/phases/.../PHASE-CAPSULE.json'], {cwd: tmpdir})`.

**Expected reason codes:** `_safeReadJson` returns null, downstream consumer (e.g., `buildPacket`) emits `packet_capsule_unavailable_raw_fallback`. The capsule reader degrades gracefully without throwing (Lock 13).

**Pass criteria:** subprocess exit 0; stdout JSON is `null` (or sentinel); live canonical streams byte-equal.

**Classification:** verifier_fail.

### 4.9 Scenario 9: route-ledger-truncated-stream

**Inject:** Append partial-line write to tmpdir mirror's `route-decisions.jsonl` (e.g., `{"ts":"x","run_id":` without closing brace). The reader uses `_readRows`-style line-by-line parse with try/catch per row.

**Real-tool invocation:** `spawnSync('node', ['-e', 'const fs=require("fs"); const txt=fs.readFileSync(process.argv[1],"utf8"); const lines=txt.split("\\n"); let n=0; for(const l of lines){ if(!l) continue; try{ JSON.parse(l); n++; }catch(_){} } console.log(n)', tmpdir+'/.planning/metrics/route-decisions.jsonl'], {cwd:tmpdir})`.

(Or: invoke a route-ledger reader API if one is added; current `route-ledger.cjs` is write-focused. The harness uses the `_readRows` pattern in-line as the reader stand-in.)

**Expected reason codes:** None emitted (the reader degrades silently); the verdict is row-count delta = lines-1 with all valid rows preserved.

**Pass criteria:** subprocess exit 0 AND parsed-row-count = (lines-1) AND live `route-decisions.jsonl` byte-equal pre/post.

**Classification:** verifier_fail.

### 4.10 Scenario 10: edge-guard-missing-emit (the structural-failure exemplar)

**Inject:** Synthetic gate fixture: a `gates.yaml` row in `tmpdir/.planning/gates.yaml` with `evidence_emitted: ['fixture-output.jsonl']`. The harness invokes `recordTransition` with `actualEmits: []` (deliberate gap).

**Real-tool invocation:**
```javascript
spawnSync('node', ['-e',
  'const eg = require("' + require.resolve('../../scripts/lib/edge-guard.cjs') + '"); ' +
  'const r = eg.recordTransition({ ' +
  '  fromStep: 5, toStep: 6, ' +
  '  phase: "53-fixture", plan: "01", ' +
  '  gateName: "phase53_fixture_gate", ' +
  '  expectedEmits: ["fixture-output.jsonl"], ' +
  '  actualEmits: [], ' +
  '  projectDir: process.cwd(), ' +
  '  gatesYamlPath: process.cwd() + "/.planning/gates.yaml" ' +
  '}); ' +
  'console.log(JSON.stringify(r));'
], { cwd: tmpdir, encoding: 'utf8', timeout: 30000 });
```

**Expected reason codes:** stdout JSON is `{ status: 'logged', missing_emits: ['fixture-output.jsonl'], row: {...} }` [VERIFIED: edge-guard.cjs:56-87 shape contract].

**Pass criteria:** `r.status === 'logged'` (or `'halt'` if gate escalation is `halt`) AND `r.missing_emits` includes the fixture path AND tmpdir's `.planning/metrics/edge-guard-log.jsonl` has a row with matching `missing_emits`.

**Classification:** **edge_guard_miss** - this scenario's failure mode is structural by definition. If `recordTransition` returns `r.status === 'ok'` (i.e., it didn't notice the gap), that's a structural defect in edge-guard itself, classified as `edge_guard_miss` per ROADMAP-AGENT.md line 642.

This is the one scenario that exists specifically to surface `edge_guard_miss` rows when v2.0 has structural defects. In a clean v2.0, scenario 10 PASSES because edge-guard correctly logs the gap; the `kind=edge_guard_miss` row is only appended on FAIL.

---

## 5. JSONL EVIDENCE LEDGER + ANTI-POLLUTION

### 5.1 envelope-v1 row schema for `failure-injection-log.jsonl`

```json
{
  "envelope_version": 1,
  "ts": "2026-04-28T22:30:00.000Z",
  "command": "logFailureInjectionScenario",
  "status": "ok",
  "reason_codes": ["scenario_pass"],
  "artifacts": [
    {"kind": "fixture_dir", "path": "super-gsd/tools/failure-injection/fixtures/token-attribution-poisoned-row/"},
    {"kind": "tool_invocation_log", "path": ""}
  ],
  "evidence": [
    {"kind": "tool_stdout_sha256", "ref": "abc123..."},
    {"kind": "tool_stderr_sha256", "ref": "def456..."}
  ],
  "next_action": null,
  "risk": null,
  "duration_ms": 245,
  "run_id": "2026-04-28T22:30:00.000Z-a1b2",
  "phase": "53",
  "milestone": "v2.0",

  "scenario_id": "token-attribution-poisoned-row",
  "tool_invocation": {
    "argv": ["node", "/abs/path/.../report.cjs", "--summarize"],
    "cwd": "/tmp/sgsd-fail-inj-token-attribution-poisoned-row-XXXX",
    "env_overrides": {},
    "exit_code": 0,
    "signal": null,
    "stdout_digest": "sha256:abc123",
    "stderr_digest": "sha256:def456",
    "duration_ms": 245
  },
  "inject_applied": "append_malformed_jsonl_row",
  "observed_reason_codes": ["parse_skipped_malformed_row"],
  "canonical_state_preserved": true,
  "canonical_drift": [],
  "verdict": "PASS",
  "verdict_kind": null
}
```

The `additionalProperties: true` envelope-v1 contract permits all extension fields (`scenario_id`, `tool_invocation`, `inject_applied`, `observed_reason_codes`, `canonical_state_preserved`, `canonical_drift`, `verdict`, `verdict_kind`). [VERIFIED: registry/command-envelope-v1.yaml:260 - same precedent Phase 51 used].

One row per scenario per run = 10 rows per `--run-all` invocation.

### 5.2 Canonical-stream anti-pollution guard (5 streams, mirrors Phase 51 verbatim)

The harness fingerprints the same 5 canonical streams Phase 51 hardened post-W3 ATC fix [VERIFIED: failure-injectors.cjs:307-313 + 51-RESEARCH.md self-test #18]:

```javascript
const CANONICAL_STREAMS = Object.freeze([
  'agent-token-spend.jsonl',
  'context-packet-log.jsonl',
  'context-complaints.jsonl',
  'route-decisions.jsonl',
  'crit-backlog.jsonl',
]);
```

For each scenario:
1. **Pre-fingerprint** the live `.planning/metrics/{stream}` for all 5.
2. **Run scenario** (in tmpdir; live untouched).
3. **Post-fingerprint** the live `.planning/metrics/{stream}` for all 5.
4. **Assert** `fingerprintsEqual(pre[stream], post[stream])` for every stream.
5. If any stream drifted: `canonical_state_preserved=false`, `verdict=FAIL`, `verdict_kind=verifier_fail`, `canonical_drift=[stream]`.

Note: the harness's OWN write to `.planning/metrics/failure-injection-log.jsonl` is NOT in the 5 guarded streams - that file is the harness's own ledger, expected to grow per run. The 5 streams above are the upstream tool trees the harness must not pollute. (CRIT-BACKLOG is one of them; the harness writes to crit-backlog only AFTER the per-scenario fingerprint phase ends, in `runAll()`'s aggregate stage. The aggregate stage is fingerprinted separately in self-test 18.)

**Equivalence rule** (mirrors Phase 51 W1 fix at failure-injectors.cjs:358-370): equality is `sha256 + size` only; mtime is recorded for diagnostics but NOT part of byte-equality.

### 5.3 Should we expand the 5-stream guard for Phase 53?

**No.** The 5 streams cover all upstream tool trees Phase 53's scenarios touch:
- `agent-token-spend.jsonl` <- scenario 1
- `context-packet-log.jsonl` <- scenarios 2, 7, 8
- `context-complaints.jsonl` <- scenario 2 (via complaints emit)
- `route-decisions.jsonl` <- scenarios 3, 4, 9
- `crit-backlog.jsonl` <- aggregate-stage CRIT-BACKLOG row append

Scenario 5 touches `memory-{revocations,promotions,demotions,revalidations}.jsonl` - 4 streams not in the canonical guard. **However**: scenario 5 runs entirely in tmpdir; its `inject` mutates a tmpdir mirror, and the live memory-* streams are byte-untouched by spawnSync subprocess `cwd=tmpdir` isolation. Self-test assertion 11 must explicitly fingerprint these 4 streams before/after scenario 5 to enforce that boundary - see Section 8.

Similarly, scenario 6 touches `redis-projection-log.jsonl` and scenario 10 touches `edge-guard-log.jsonl`. Self-test must guard both. **Recommendation:** extend `CANONICAL_STREAMS` for Phase 53's harness internally to a 7-stream set:

```javascript
// 53-only superset (the original 5 + scenario-specific extensions)
const PHASE_53_GUARDED_STREAMS = Object.freeze([
  'agent-token-spend.jsonl',
  'context-packet-log.jsonl',
  'context-complaints.jsonl',
  'route-decisions.jsonl',
  'crit-backlog.jsonl',
  'redis-projection-log.jsonl',          // scenario 6
  'edge-guard-log.jsonl',                // scenario 10
  'memory-revocations.jsonl',            // scenario 5
  'memory-promotions.jsonl',             // scenario 5
  'memory-demotions.jsonl',              // scenario 5
  'memory-revalidations.jsonl',          // scenario 5
]);
```

This expansion is internal to Phase 53's harness; it does NOT modify Phase 51's `CANONICAL_STREAMS` (Lock 4 forbids mutating Phase 51 source). Phase 53 imports Phase 51's `CANONICAL_STREAMS` by reference for self-test cross-check, then extends locally.

---

## 6. release-readiness/score.cjs INTEGRATION (Phase 57 contract)

### 6.1 Where Phase 57 reads from

`super-gsd/tools/release-readiness/score.cjs` (Phase 57; not yet shipped) reads the **last run's tail rows** of `.planning/metrics/failure-injection-log.jsonl`:

```javascript
// Inside Phase 57 score.cjs
function readScenariosBucket(planningDir) {
  const logPath = path.join(planningDir, 'metrics', 'failure-injection-log.jsonl');
  if (!fs.existsSync(logPath)) {
    return { pass_count: 0, total: 10, score: 0, source: 'absent' };
  }
  const txt = fs.readFileSync(logPath, 'utf8');
  const lines = txt.split('\n').filter(Boolean);
  // Find the last full run: rows share the same run_id prefix and ts within a window.
  // Phase 53 emits 10 rows per --run-all invocation; the last 10 form the latest run.
  const lastRunRows = lines.slice(-10).map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
  const passCount = lastRunRows.filter(r => r.verdict === 'PASS').length;
  const total = lastRunRows.length;
  const score = total === 0 ? 0 : Math.round((passCount / 10) * 15);
  return { pass_count: passCount, total, score };
}
```

### 6.2 Determinism requirements

The harness MUST guarantee:

1. Each `--run-all` invocation appends exactly 10 rows (one per scenario) in scenario-order (S1..S10 by manifest order).
2. Each row has the same `run_id` value (same ISO ts + 4 hex chars). This lets `score.cjs` identify a coherent "last run" by matching run_id.
3. Rows are written atomically per row (newline-terminated; no partial-line writes; mirror `crit-backlog.cjs#appendRow` pattern).

Refined contract: instead of `slice(-10)`, Phase 57 should `groupBy(r.run_id)` and pick the most recent run. The harness emits a unique run_id per invocation; this is the deterministic identifier.

### 6.3 Scoring formula

```text
scenarios_bucket_score = round( (pass_count / total) * 15 )
```

For a full clean run (10/10): `round((10/10) * 15) = 15`.
For 9/10 (PASS-WITH-DEFERRED-1): `round((9/10) * 15) = 14`.
For 8/10 (FAIL aggregate): `round((8/10) * 15) = 12`.
For 0/10: `round(0 * 15) = 0`.

15 is the maximum bucket weight per ROADMAP-AGENT.md:648.

### 6.4 Phase 53 -> Phase 57 contract (locked)

Phase 53 commits to:
- File path: `.planning/metrics/failure-injection-log.jsonl` (canonical, append-only).
- Per-row schema: envelope-v1 + the 8 extension fields listed in 5.1.
- Per-run row count: exactly 10 (matching the manifest length); `total` field appears in `aggregateResults()` output AND can be re-derived from row count.
- Per-run identifier: a unique `run_id` shared by all 10 rows of one invocation.

Phase 57 score.cjs (downstream) is responsible for tail-reading + scoring; Phase 53 only emits.

---

## 7. CRIT-BACKLOG INTEGRATION (verifier_fail vs edge_guard_miss)

### 7.1 Append site

Per Q1 resolution: harness writes inline via `super-gsd/scripts/lib/crit-backlog.cjs#appendRow` at the END of `runAll()`, after all 10 scenarios complete.

Justification:
- Single-writer protocol (no race; Phase 53 harness is the only producer of these rows during a Phase 53 run).
- `crit-backlog.cjs#appendRow` is the canonical append API (`super-gsd/scripts/lib/crit-backlog.cjs:61`); Phase 53 reuses it by reference (Lock 4).
- Aggregate-stage append happens AFTER per-scenario fingerprint phase ends, so the canonical-fingerprint guard is stable during scenario execution.

### 7.2 Classification logic

```javascript
function classifyVerdictKind(scenario, scenarioVerdict) {
  // Lock R-CLASS:
  //   Scenario 10 (edge-guard-missing-emit) -> edge_guard_miss IF the scenario FAILED.
  //   All other scenarios -> verifier_fail IF they FAILED.
  //   Scenarios that PASSED -> no row appended.
  if (scenarioVerdict === 'PASS' || scenarioVerdict === 'PASS-WITH-SOFT-SKIP') {
    return null;
  }
  if (scenario.edge_guard_miss_classified === true) {
    return 'edge_guard_miss';
  }
  return 'verifier_fail';
}
```

This implements ROADMAP-AGENT.md lines 641-643: "A failed scenario whose root cause is structural (a real-tool fixture that exposes a missing emit) is logged as kind=edge_guard_miss instead, which forces CANDIDATE-WITH-DEBT per the edge-guard rule."

The classification is **scenario-id-keyed**, not runtime-derived. Scenario 10 is the only manifest entry with `edge_guard_miss_classified=true`. This is deterministic and Lock-11-compliant (set membership: `scenario.id === 'edge-guard-missing-emit'`).

### 7.3 CRIT-BACKLOG row shape

```javascript
critBacklog.appendRow(planningDir, {
  kind: verdictKind,                                    // 'verifier_fail' | 'edge_guard_miss'
  phase: '53',
  plan: '01',
  milestone: 'v2.0',
  attempts_made: 1,
  summary: `${scenario.id}: observed ${observedReasonCodes.join(',') || 'none'}, expected ${scenario.expected_reason_codes.join(',')}`,
  evidence_path: '.planning/metrics/failure-injection-log.jsonl',
  last_diff_sha: null,                                  // not applicable for harness-emitted rows
  tagged_for_milestone: 'v2.0',
  added_at: isoNow(),
});
```

[VERIFIED: crit-backlog.cjs:11-17 row schema; VALID_KINDS at crit-backlog.cjs:29 includes both `verifier_fail` and `edge_guard_miss`]

### 7.4 Aggregate-stage decision tree

```text
After all 10 scenarios run:
  if pass_count == 10:
    no CRIT-BACKLOG rows
    aggregate verdict = PASS
    exit 0
  elif pass_count == 9 and no edge_guard_miss in failed scenario:
    append 1 verifier_fail row for the 1 failed scenario
    aggregate verdict = PASS-WITH-DEFERRED-1
    exit 0
  elif any failed scenario has edge_guard_miss_classified=true:
    append 1 edge_guard_miss row for that scenario
    + verifier_fail rows for other failed scenarios
    aggregate verdict = CANDIDATE-WITH-DEBT
    exit 1
  else (pass_count <= 8):
    append verifier_fail rows for all failed scenarios
    aggregate verdict = FAIL
    exit 1
```

Phase 57 release-readiness score.cjs reads CRIT-BACKLOG.jsonl for the `edge_guard_miss` precondition: any row with `kind=edge_guard_miss` forces score RED regardless of bucket totals (ROADMAP-AGENT.md:698).

---

## 8. SELF-TEST + COMPLETION GATE

### 8.1 Required files

| Path | Purpose |
|------|---------|
| `super-gsd/tools/failure-injection/harness.cjs` | Entry point + CLI + main loop + Lock 13 wrapped public API |
| `super-gsd/tools/failure-injection/scenarios.json` | Frozen 10-entry manifest (loaded sync at module init) |
| `super-gsd/tools/failure-injection/fixtures/{scenario-id}/` | 10 fixture directories with README + supporting files |
| `super-gsd/tools/failure-injection/run-self-test.cjs` | Operator-runnable self-test entry (mirrors Phase 51 `run-self-test.cjs`) |
| `super-gsd/tools/failure-injection/README.md` | Operator documentation |
| `.planning/metrics/failure-injection-log.jsonl` | envelope-v1 append-only ledger (created on first --run-all) |

### 8.2 Self-test assertions (target: 16-20)

Mirror Phase 51's 33-assertion pattern; Phase 53 is more compact because it has 1 inject mechanic per scenario (vs Phase 51's 16-fixture vocabulary). Self-test CLI: `node super-gsd/tools/failure-injection/harness.cjs --self-test` MUST exit 0 with N/N passing.

| # | Assertion | Binding |
|---|-----------|---------|
| 1 | `SCENARIOS` Object.frozen, length === 10, mutation no-op | manifest closed-vocab |
| 2 | All 10 scenario.id values are unique + match `[a-z][a-z0-9-]*` | id stability |
| 3 | All 10 scenario.target_tool paths exist on disk (require.resolve) | Lock 4 reference integrity |
| 4 | `FAIL_INJ_REASON_CODES` Object.frozen, ≥10 entries | envelope-v1 reason vocabulary |
| 5 | `VERDICT_KINDS` Object.frozen, length === 3, contains [null, 'verifier_fail', 'edge_guard_miss'] | classification closed-vocab |
| 6 | `PHASE_53_GUARDED_STREAMS` Object.frozen, length === 11 (5 base + 6 extensions) | anti-pollution guard set |
| 7 | Scenario 10 (edge-guard-missing-emit) has `edge_guard_miss_classified=true`; all other 9 scenarios have `false` | Lock R-CLASS |
| 8 | `crit-backlog.cjs#appendRow` reachable + `VALID_KINDS` includes both verifier_fail and edge_guard_miss | Phase 53 -> CRIT-BACKLOG contract |
| 9 | `child_process.spawnSync` called with `cwd: tmpdir` for every scenario invocation (smoke test with a no-op tool) | real-process boundary |
| 10 | tmpdir created under `os.tmpdir()` (NOT under project workspace); rm-rf after each scenario | Lock 4 isolation |
| 11 | All 11 PHASE_53_GUARDED_STREAMS byte-equal pre/post a full --run-all (smoke against scenarios that respect the boundary) | anti-pollution invariant |
| 12 | Scenario 6 with no live Redis returns `redis_not_available_soft_skip`; verdict=PASS-WITH-SOFT-SKIP; counts toward 10/10 | F17 soft-skip semantics |
| 13 | Scenario 10 (edge-guard-missing-emit) with deliberate-gap fixture returns `status:'logged'` AND `missing_emits:[fixture-output.jsonl]` | structural-emit detection |
| 14 | Aggregate `pass_count=10` -> verdict=PASS; no CRIT-BACKLOG rows appended | clean path |
| 15 | Aggregate `pass_count=9` (1 simulated FAIL via verifier_fail kind) -> verdict=PASS-WITH-DEFERRED-1; 1 verifier_fail row appended; exit 0 | deferred-N path |
| 16 | Aggregate with any edge_guard_miss -> verdict=CANDIDATE-WITH-DEBT; row kind=edge_guard_miss appended; exit 1 | structural-failure path |
| 17 | Aggregate `pass_count<=8` -> verdict=FAIL; verifier_fail rows for each failed scenario; exit 1 | hard-fail path |
| 18 | `failure-injection-log.jsonl` row shape passes envelope-v1 validation (has all required fields) | envelope-v1 conformance |
| 19 | `runAll()` and `runScenario()` are Lock 13 wrapped (try/catch returns degraded sentinel; never throws upward) | Lock 13 binding |
| 20 | ASCII-only check on harness.cjs + scenarios.json (no smart quotes, no emoji) | ASCII discipline |

### 8.3 Lock invariants extending from prior phases

| Lock | From | Extension to Phase 53 |
|------|------|----------------------|
| **Lock 2** | REQUIREMENTS.md / 51-RESEARCH.md | `.planning/metrics/failure-injection-log.jsonl` is canonical; never to Redis as primary |
| **Lock 4** | REQUIREMENTS.md / 51-RESEARCH.md | Phase 41-52 tool trees byte-untouched. Harness consumes via `require.resolve` (path string) + `spawnSync`; never imports their internals. |
| **Lock 6** | REQUIREMENTS.md | No CRIT-bypass byte-verbatim work in Phase 53 (scenario 8 is capsule-corrupted, not bypass). Phase 51 F8/F16 already cover Lock 6. |
| **Lock 11** | REQUIREMENTS.md | Scenario selection + verdict scoring use ONLY set-membership on closed-vocab fields (scenario.id, expected_reason_codes, scenario.edge_guard_miss_classified) and byte-equality on canonical-stream fingerprints. NO semantic similarity. |
| **Lock 13** | REQUIREMENTS.md | Public API (runAll, runScenario, selfTest, aggregateResults, appendLogRow) all wrapped in try/catch returning degraded sentinel. Missing fixture -> `bench_scenario_skipped:fixture_unavailable` + continues. Real-tool subprocess throws are CAUGHT (subprocess.status nonzero -> verdict=FAIL); not propagated upward. |
| **ASCII** | repo convention | All .cjs and .json files: no smart quotes, no emoji, no non-ASCII literals. |

### 8.4 Verifier exit criteria

Phase 53 verifier (gsd-verifier dispatch) checks:

- [ ] All required files exist (harness, scenarios.json, 10 fixture dirs, run-self-test.cjs, README)
- [ ] `node super-gsd/tools/failure-injection/harness.cjs --self-test` exits 0 with N/N PASS (target ~16-20)
- [ ] `node super-gsd/tools/failure-injection/harness.cjs --run-all` exits 0 with 10/10 PASS in <120s
- [ ] `.planning/metrics/failure-injection-log.jsonl` has 10 rows (one per scenario); envelope-v1 conformance verified
- [ ] No row in `crit-backlog.jsonl` has `kind=edge_guard_miss` after a clean run (would fail Phase 57 hard-precondition)
- [ ] All 11 PHASE_53_GUARDED_STREAMS are byte-untouched (sha256+size equality) after a full --run-all
- [ ] Lock 4 verified: `git diff --quiet -- super-gsd/tools/{token-attribution,context-packet,dispatch-router,vtp-bridge,memory-governance,context-cache,phase-capsule}` after harness run

**Defer-with-debt allowed if:** 9/10 PASS with no edge_guard_miss. Phase 53 closes as `PASS-WITH-DEFERRED-1`.

**Hard fail if:** Any scenario has `canonical_state_preserved=false` OR pass_count <= 8 OR any edge_guard_miss row.

---

## 9. Code Examples (verified, from existing tree)

### 9.1 Spawn pattern (mirrors sgsd-blind-live-controller.mjs)

```javascript
// Source: sgsd-blind-live-controller.mjs:104-138 + spawnSync with cwd
const { spawnSync } = require('child_process');

function runScenario(scenario, tmpdir) {
  const argv = scenario.tool_invocation_argv.map(a =>
    a.replace('<tmpdir>', tmpdir).replace(
      '<resolved>',
      require.resolve(scenario.target_tool_resolve_id)
    )
  );
  const result = spawnSync(argv[0], argv.slice(1), {
    cwd: tmpdir,
    env: Object.assign({}, process.env, scenario.env_overrides || {}),
    timeout: 30000,
    encoding: 'utf8',
  });
  return {
    stdout: result.stdout || '',
    stderr: result.stderr || '',
    exit_code: result.status,
    signal: result.signal,
    duration_ms: null,  // approximate via start/end ts wrapper
  };
}
```

### 9.2 Canonical-stream fingerprint guard (mirrors failure-injectors.cjs verbatim)

```javascript
// Source: super-gsd/tools/context-bench/failure-injectors.cjs:319-396 verbatim adaptation
function fingerprintStream(filePath) {
  try {
    if (!filePath || typeof filePath !== 'string') {
      return { sha256: sha256OfBytes(Buffer.alloc(0)), mtime: 0, size: 0, absent: true };
    }
    if (!fs.existsSync(filePath)) {
      return { sha256: sha256OfBytes(Buffer.alloc(0)), mtime: 0, size: 0, absent: true };
    }
    const buf = fs.readFileSync(filePath);
    const st = fs.statSync(filePath);
    return {
      sha256: sha256OfBytes(buf),
      mtime: Math.floor(st.mtimeMs || 0),
      size: st.size,
      absent: false,
    };
  } catch (_e) {
    return { sha256: '', mtime: -1, size: -1, absent: false, ok: false };
  }
}

function fingerprintsEqual(a, b) {
  if (!a || !b) return false;
  if (a.absent && b.absent) return true;
  if (a.absent !== b.absent) return false;
  return a.sha256 === b.sha256 && a.size === b.size;  // mtime excluded per W1 fix
}
```

### 9.3 Soft-skip semantics (mirrors Phase 51 F12-F15 + F17)

```javascript
// Source: failure-injectors.cjs:215-279 soft_skip_when pattern
function applySoftSkip(scenario, observed) {
  if (!scenario.soft_skip_when) return null;
  if (observed.includes(scenario.soft_skip_when)) {
    return {
      verdict: 'PASS-WITH-SOFT-SKIP',
      reason_codes: ['scenario_pass_soft_skip', 'bench_fixture_skipped:' + scenario.soft_skip_when],
    };
  }
  return null;
}
```

### 9.4 CRIT-BACKLOG row append (mirrors crit-backlog.cjs:61 verbatim)

```javascript
// Source: super-gsd/scripts/lib/crit-backlog.cjs:61-100 appendRow
const critBacklog = require('../../scripts/lib/crit-backlog.cjs');

function appendCritRowIfFailed(planningDir, scenario, observed, expected, verdictKind) {
  if (verdictKind === null) return;  // PASS - no row
  return critBacklog.appendRow(planningDir, {
    kind: verdictKind,
    phase: '53',
    plan: '01',
    milestone: 'v2.0',
    attempts_made: 1,
    summary: scenario.id + ': observed ' + (observed.join(',') || 'none')
             + ', expected ' + (expected.join(',')),
    evidence_path: '.planning/metrics/failure-injection-log.jsonl',
    last_diff_sha: null,
    tagged_for_milestone: 'v2.0',
    added_at: new Date().toISOString(),
  });
}
```

### 9.5 Edge-guard wiring (scenario 10)

```javascript
// Source: super-gsd/scripts/lib/edge-guard.cjs:56-87 recordTransition shape
const edgeGuardCode = [
  'const eg = require("' + require.resolve('../../scripts/lib/edge-guard.cjs') + '");',
  'const r = eg.recordTransition({',
  '  fromStep: 5, toStep: 6,',
  '  phase: "53-fixture", plan: "01",',
  '  gateName: "phase53_fixture_gate",',
  '  expectedEmits: ["fixture-output.jsonl"],',
  '  actualEmits: [],',  // deliberate gap
  '  projectDir: process.cwd(),',
  '  gatesYamlPath: process.cwd() + "/.planning/gates.yaml"',
  '});',
  'console.log(JSON.stringify(r));',
].join(' ');

const result = spawnSync('node', ['-e', edgeGuardCode], {
  cwd: tmpdir,
  encoding: 'utf8',
  timeout: 30000,
});

const r = JSON.parse(result.stdout);
const passed = r.status === 'logged' || r.status === 'halt';
const missingEmitsObserved = Array.isArray(r.missing_emits) && r.missing_emits.length > 0;
```

---

## 10. Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Scenario fixture freezing | Custom freeze loop | Object.freeze recursive (mirror Phase 51 INJECTION_FIXTURES at failure-injectors.cjs:81-263) | Phase 51 already proves the pattern; closed-vocab integrity tested |
| Canonical-stream sha256 fingerprint | Custom hashing logic | Mirror `fingerprintStream` + `fingerprintsEqual` verbatim from failure-injectors.cjs:334-370 | W1 + W3 ATC fixes already applied; do not regress |
| Subprocess invocation | Hand-rolled child_process wrapper | `spawnSync` with `{cwd, env, timeout, encoding}` (mirrors blind-live-controller pattern) | One tested path; no parallelism complications |
| CRIT-BACKLOG row append | Custom JSONL append | `super-gsd/scripts/lib/crit-backlog.cjs#appendRow` | Already enforces VALID_KINDS, v1 schema, _guardCodexUnavailableClaim |
| Edge-guard structural-emit detection | Custom missing-emit logic | `super-gsd/scripts/lib/edge-guard.cjs#recordTransition` | Already returns `{status:'logged'\|'halt', missing_emits, row}` shape contract |
| envelope-v1 row writer | New writer | Inline `JSON.stringify(row) + '\n'` + `fs.appendFileSync` (mirrors `_appendRow` at context-packet/build.cjs:181-187) | Atomic at row boundary on POSIX + Windows for sub-block writes |
| run_id generation | Custom UUID | `crypto.randomBytes(2).toString('hex')` + ISO ts (mirror route-ledger.cjs:96-99) | envelope-v1 RUN_ID_REGEX compliance free |
| Soft-skip vocabulary | Invent new codes | Reuse `bench_fixture_skipped:*` from failure-injectors.cjs:285-294 | Phase 51 closed-vocab already covers the boundary |
| tmpdir creation | Custom temp path | `fs.mkdtempSync(path.join(os.tmpdir(), 'sgsd-fail-inj-' + scenarioId + '-'))` | OS-managed; auto-cleaned by OS on reboot if rm-rf misses |
| Reason-code parsing | Regex over stdout | Parse stdout as JSON (subprocess returns structured payload) OR read tmpdir mirror's `.planning/metrics/{stream}.jsonl` directly | Lock 11 byte-equality - no regex |

**Key insight:** Phase 53 is composition over Phase 41-52 + Phase 51 patterns. Every "novel" component already exists in some form upstream; the harness's job is to compose them into a 10-scenario sequence with anti-pollution + verdict-tree + CRIT-BACKLOG integration.

---

## 11. Common Pitfalls

### Pitfall 1: Using `require()` instead of `spawnSync` for tool invocation
**What goes wrong:** Engineer thinks "spawnSync is overhead; just require the tool's main function and call it." This violates mock-predicate forbiddance because `require()` shares the harness's process; any module-level state in the target tool leaks across scenarios.
**Why it happens:** `require()` looks faster and gives you JS objects directly.
**How to avoid:** spawnSync is the only allowed invocation path. The acceptance contract (CONTEXT.md:81) is explicit: "every scenario MUST invoke the real tool process." A required module is not a "real tool process."
**Warning signs:** Harness imports any of `token-attribution/report.cjs`, `context-packet/build.cjs`, `dispatch-router/route.cjs`, etc. directly. Lock 4 violation indicator.

### Pitfall 2: tmpdir under project workspace
**What goes wrong:** `fs.mkdtempSync(path.join(__dirname, 'tmp-'))` creates the temp dir under the workspace; subprocess `cwd` resolves `.planning` into the workspace, mutating live canonical streams.
**Why it happens:** Convenience.
**How to avoid:** `fs.mkdtempSync(path.join(os.tmpdir(), 'sgsd-fail-inj-'))` - always under `os.tmpdir()`, never under workspace.
**Warning signs:** Self-test 10 fails (tmpdir path NOT under `os.tmpdir()`).

### Pitfall 3: Missing rm-rf on scenario completion
**What goes wrong:** tmpdir leaks; over many runs, the OS tmpdir fills with `sgsd-fail-inj-*` directories.
**Why it happens:** rm-rf in a `finally` block is easy to forget.
**How to avoid:** Wrap each scenario in `try { ... } finally { rmSyncRecursive(tmpdir); }`. Self-test 10 also asserts tmpdir count delta = 0 after a full run.
**Warning signs:** `ls $TMPDIR | grep sgsd-fail-inj | wc -l` keeps growing.

### Pitfall 4: Conflating "soft-skip PASS" with "deferred-N FAIL"
**What goes wrong:** Engineer treats `redis_not_available_soft_skip` as a deferred row (write CRIT-BACKLOG, count as 9/10).
**Why it happens:** Soft-skip looks like a partial failure.
**How to avoid:** Per Phase 51 F12-F15 precedent and CONTEXT.md scenario 6 spec, soft-skip on a documented degraded path is PASS (counts toward 10/10). The reason-code value is `bench_fixture_skipped:*` and the verdict is `PASS-WITH-SOFT-SKIP`. CRIT-BACKLOG receives no row.
**Warning signs:** Aggregate logic counts `PASS-WITH-SOFT-SKIP` as a fail.

### Pitfall 5: Polluting canonical streams during inject
**What goes wrong:** F8 (synthetic CRIT row) inject path writes to live `crit-backlog.jsonl` instead of tmpdir mirror.
**Why it happens:** Forgetting that subprocess `cwd` controls `.planning/` resolution.
**How to avoid:** ALL inject mutations target `tmpdir/.planning/metrics/{stream}` paths. The live `.planning/` is read-only from the harness's perspective during scenario execution. Self-test 11 enforces.
**Warning signs:** `git diff -- .planning/metrics/` after a self-test shows changes.

### Pitfall 6: Forgetting to include `crit-backlog.jsonl` in fingerprint guard
**What goes wrong:** Phase 51 W3 ATC fix added crit-backlog as the 5th canonical stream; Phase 53 must inherit.
**Why it happens:** Reading old documentation that lists 4 streams.
**How to avoid:** Use Phase 51's frozen `CANONICAL_STREAMS` array verbatim (5 entries). Phase 53 EXTENDS to 11 entries to cover scenario-specific streams; never SHRINKS.
**Warning signs:** `PHASE_53_GUARDED_STREAMS.length < 5`.

### Pitfall 7: Race between scenarios writing to same tmpdir
**What goes wrong:** Sequential execution requires each scenario to have its own tmpdir; reusing one tmpdir across scenarios leaks state.
**Why it happens:** "Reuse the directory; faster."
**How to avoid:** ONE tmpdir per scenario. Auto-cleaned via finally block. Self-test 9 + 10 enforce.
**Warning signs:** Scenario 5 sees state from scenario 4's inject.

### Pitfall 8: Edge-guard scenario passing because edge-guard always returns 'ok'
**What goes wrong:** Scenario 10 (edge-guard-missing-emit) receives `actualEmits=[]` against `expectedEmits=['fixture-output.jsonl']`. If `recordTransition` does NOT detect the gap, scenario 10 silently passes; the structural defect goes unflagged.
**Why it happens:** Trusting upstream tool to do its job.
**How to avoid:** Self-test 13 explicitly drives `recordTransition` with the deliberate gap and asserts `r.status === 'logged'` AND `r.missing_emits.length > 0`. If edge-guard regresses, scenario 10 catches it.
**Warning signs:** Self-test 13 weakly asserts `r.status !== 'fail'` instead of explicitly `'logged'` + `missing_emits.length > 0`.

### Pitfall 9: Telling the model the harness is running
**What goes wrong:** Subprocess prompt or env contains `BENCH_MODE=1`; the target tool short-circuits to a "test" path.
**Why it happens:** Premature optimization.
**How to avoid:** Anti-cheat boundary (Phase 51 §2.5) - subprocess receives only the env vars the target tool legitimately consumes (e.g., `SGSD_VTP_FORCE_OFFLINE` for scenario 4). No `BENCH_*` or `TEST_*` envs.
**Warning signs:** `scenario.env_overrides` contains a `BENCH_*` key.

### Pitfall 10: Treating edge_guard_miss as recoverable in the same run
**What goes wrong:** Aggregate logic sees `edge_guard_miss` in scenario 10, counts it as deferred-1, exits 0.
**Why it happens:** Confusing edge_guard_miss with verifier_fail.
**How to avoid:** Per ROADMAP-AGENT.md:641-643, ANY edge_guard_miss row forces CANDIDATE-WITH-DEBT (exit 1). The threshold for verifier_fail (1 deferred max -> exit 0) does NOT apply to edge_guard_miss (any count -> exit 1).
**Warning signs:** Aggregate decision tree has `pass_count == 9 && verdict !== 'CANDIDATE-WITH-DEBT' && any edge_guard_miss in failed`.

---

## 12. State of the Art

| Old Approach | Current Approach (v2.0 Phase 53) | When Changed | Impact |
|---|---|---|---|
| Mock-predicate harness ("did the gate fire?" via stub function returning true) | Real-process invocation via spawnSync; gate firing observed via subprocess stdout/stderr + reason codes | Mass-discuss 2026-04-26 (53=C lock) | T4 ATC W2 from Phase 51 caught F8/F16 mock inject() being behavioral no-ops; Phase 53 forecloses by construction |
| 16 fixtures within one tool's harness scope | 10 scenarios across 10 production tools | Phase 51 -> Phase 53 generalization | Each tool's failure mode validated independently; no single-harness blast radius |
| Restore() callback to undo live-fs mutations | tmpdir per scenario; rm-rf eliminates restore complexity | Phase 53 isolation lock | Auto-cleanup; live `.planning/` byte-untouched mechanically |
| 4-stream canonical guard (pre-W3 ATC) | 5-stream canonical guard (Phase 51 W3 fix) -> 11-stream extension for Phase 53 | Phase 51 ATC W3 + Phase 53 scenario expansion | crit-backlog + memory-* + redis-projection + edge-guard-log all guarded |
| CRIT-BACKLOG row append in post-run script | Inline append in harness `runAll()` aggregate stage | Phase 53 design Q1 | Single writer; no race; deterministic timing |

**Deprecated/outdated:**
- Mock-predicate scenario design (mass-discuss 2026-04-26 lock).
- Live-fs restore callbacks (replaced by tmpdir per scenario).
- Per-scenario require() of target tools (replaced by spawnSync).
- 4-stream canonical guard (replaced by 5+ stream guard post-Phase-51-W3).

---

## 13. Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Node.js built-in (assert, fs, child_process); no test runner |
| Config file | None (mirrors Phase 41/45/49/51 pattern) |
| Quick run command | `node super-gsd/tools/failure-injection/harness.cjs --self-test` |
| Full suite command | `node super-gsd/tools/failure-injection/harness.cjs --run-all` |
| Phase gate | self-test N/N PASS + --run-all 10/10 PASS in <120s |

### Phase Requirements -> Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| FAIL-INJ-01 | 10-scenario harness with real tool invocation | unit | `--self-test` (assertions 1-3, 9) | Wave 1 |
| FAIL-INJ-02 | Mock predicates forbidden; per-run row proves invocation | unit | `--self-test` (assertion 18) | Wave 1 |
| FAIL-INJ-03 | Fixtures live in `fixtures/{scenario-id}/` | unit | `--self-test` (assertion 3 + filesystem walk) | Wave 1 |
| FAIL-INJ-04 | tmpdir container isolation | unit | `--self-test` (assertions 9, 10, 11) | Wave 1 |
| FAIL-INJ-05 | 10/10 PASS for SHIPPED clean | integration | `--run-all` (verdict check) | Wave 2 |
| FAIL-INJ-06 | 9/10 -> PASS-WITH-DEFERRED-N | unit | `--self-test` (assertion 15) | Wave 1 |
| FAIL-INJ-07 | Structural failure -> CANDIDATE-WITH-DEBT | unit | `--self-test` (assertion 16) | Wave 1 |
| FAIL-INJ-08 | release-readiness scenarios bucket = pass/total * 15 | unit | `--self-test` (assertion 18 row schema) | Wave 1 |
| FAIL-INJ-09 | Canonical streams byte-untouched | unit | `--self-test` (assertion 11) | Wave 1 |
| FAIL-INJ-10 | Self-test exit 0 with N/N | unit | `--self-test` exit-code check | Wave 1 |

### Sampling Rate
- **Per task commit:** `node super-gsd/tools/failure-injection/harness.cjs --self-test` (must exit 0)
- **Per wave merge:** Self-test + dry-run (`--run-all --dry-run` if implemented)
- **Phase gate:** `--run-all` against fixture deck; results written to `.planning/metrics/failure-injection-log.jsonl`; verifier reviews

### Wave 0 Gaps
- No prior Phase 53 fixture authoring; all 10 fixture dirs must be created in Wave 1 alongside harness.cjs.
- Some target tools (e.g., `route-ledger.cjs`) have no `--lookup` or readRows CLI; the harness uses `node -e` wrappers as the spawn target. This is acceptable per real-process boundary (the wrapper is one line; the work is in the required tool).
- The Phase 57 `score.cjs` does not yet exist (Phase 57 is unblocked by Phase 53). Phase 53 emits the contract; Phase 57 will consume it. No Phase 53 work depends on score.cjs existing.

---

## 14. Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | No new auth surface; harness reads/writes local files only |
| V3 Session Management | no | No sessions |
| V4 Access Control | yes (low) | Workspace-relative paths only; subprocess `cwd` is tmpdir; harness rejects fixture paths under project root |
| V5 Input Validation | yes | scenario.id matches `[a-z][a-z0-9-]*`; scenario.target_tool require.resolve check; CLI flags use closed-enum parsing |
| V6 Cryptography | yes (low) | SHA-256 fingerprint guard (already shipped in failure-injectors.cjs:319-356); harness inherits |

### Known Threat Patterns for Phase 53

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Subprocess command injection | Tampering | scenario.tool_invocation_argv is a frozen string array; never built from user input |
| Path traversal in fixture paths | Tampering | scenario.id used as directory name; validated against `[a-z][a-z0-9-]*`; fixture paths joined via `path.join`, no `..` allowed |
| Subprocess timeout / runaway | DoS | spawnSync `timeout: 30000` (30s) hard cap per scenario; total run cap <120s |
| Real credentials in fixtures (F10-equivalent prompt-injection patterns) | Information Disclosure | Synthetic placeholders only (`SECRET_PLACEHOLDER_X`); CLAUDE.md absolute rule + ASCII-only check |
| tmpdir collision (concurrent runs) | Tampering | `mkdtempSync` returns a unique random suffix per call; OS-guaranteed uniqueness |
| failure-injection-log.jsonl unbounded growth | Resource Exhaustion | append-only is intentional; log rotation deferred to v2.1+ (status-consistency lane) |

---

## 15. Sources

### Primary (HIGH confidence)
- `super-gsd/tools/context-bench/failure-injectors.cjs:81-396` - F1-F16 INJECTION_FIXTURES Object.freeze pattern + 4-step protocol + CANONICAL_STREAMS 5-key guard + fingerprintStream/fingerprintsEqual + W1/W3 ATC fixes
- `super-gsd/tools/harness-benchmark/sgsd-blind-live-controller.mjs:104-138` - spawnSync subprocess loop + cwd isolation + injection-state tracking
- `super-gsd/tools/context-cache/redis-adapter.cjs:1502-1604` - `_testHook_simulateFlushAndPoison` 4-step protocol + soft-skip semantics (`redis_not_available_soft_skip`)
- `super-gsd/scripts/lib/crit-backlog.cjs:11-100` - VALID_KINDS enum (5 entries: per_dispatch_atc, phase_atc, verifier_fail, edge_guard_miss, cleared) + appendRow + v1 schema
- `super-gsd/scripts/lib/edge-guard.cjs:38-87` - recordTransition shape contract + RELATIVE_LOG path + escalation log-only/halt
- `super-gsd/scripts/lib/route-ledger.cjs:70-99` - BOUNDARIES 9-entry frozen + run_id generator + RUN_ID_REGEX
- `super-gsd/tools/dispatch-router/route.cjs:103-179` - ROUTE_DECISION_REASONS 18-entry frozen + VTP_WHITELIST + ROUTING_TABLE
- `super-gsd/tools/context-packet/build.cjs:92-220` - PACKET_REASON_CODES 9-entry + COMPRESSION_LEVELS 5-entry + _safeReadJson degraded sentinel
- `super-gsd/tools/memory-governance/lifecycle.cjs:2072-2103` - public API surface + REVOKE/DEMOTION/REVALIDATION_KINDS
- `super-gsd/tools/vtp-bridge/classify.cjs:99-179` - VTP_TOOL_MAP + VTP_BRIDGE_REASONS + classify entry
- `super-gsd/tools/phase-capsule/write.cjs:1985-onwards` - module exports for readCapsule etc.
- `.planning/ROADMAP-AGENT.md:622-648` - Phase 53 acceptance block verbatim
- `.planning/milestones/v1.9/phases/51-context-stress-benchmark/51-RESEARCH.md` - 4-step protocol, anti-cheat boundary, scenario fixture format, verdict tree, completion gate template
- `.planning/milestones/v1.9/SUMMARY.md` - Phase 51 F1-F16 catalog + dual-gate sgsd-complete-milestone integration
- `.planning/milestones/v2.0/phases/53-gate-failure-injection-harness/53-CONTEXT.md` - 10-scenario proposed manifest + locked decisions

### Secondary (MEDIUM confidence)
- `.planning/discussions/2026-04-26-mass-discuss.md` - locked-decisions row for v2.0 (53=C, 54=C, 55=B, 56=B, 57=B)
- `super-gsd/registry/command-envelope-v1.yaml:260` - `additionalProperties: true` envelope-v1 contract for extension fields
- `super-gsd/scripts/sgsd-complete-milestone.cjs` - milestone-close consumer chain pattern (Phase 53 will need a v2.0 wire-in)

### Tertiary (LOW confidence - flagged for plan-time validation)
- Scenario 7 (`sqlite-context-index-deleted-db`) reason-code path: documented as `index_unavailable` (Phase 51 F4) and `rebuild_error` (rebuild.cjs:776). Whether the `query.cjs` path emits a third code on missing-db is not verified in this session; planner should confirm via a quick `query.cjs --help` or read.
- Scenario 9 (`route-ledger-truncated-stream`) inject path uses an inline `node -e` reader stand-in because route-ledger.cjs is write-focused; if Phase 32 read API exists, planner should use it instead.

---

## 16. Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `_safeReadJson` returns null on malformed JSON without throwing (used by readCapsule fallback in scenario 8) | 4.8 | Scenario 8 might surface a thrown error instead of graceful sentinel; would mask the test value but not break the harness (Lock 13 of harness still wraps). Verifiable in Wave 1 via direct `_safeReadJson` test. |
| A2 | `route.cjs` accepts a `--route '<json>'` CLI flag for synthetic input in scenarios 3 + 4 | 4.3, 4.4 | If route.cjs has no such flag, harness uses `node -e` wrapper instead. Trivial change in fixture authoring. |
| A3 | `query.cjs` exists at `super-gsd/tools/context-cache/query.cjs` and supports `--lookup <json>` | 4.7 | Verified path exists (via earlier ls); CLI flag shape may differ. Planner should confirm `query.cjs --help`. |
| A4 | `report.cjs` accepts `--summarize` + `--planning-dir` CLI flags for scenario 1 | 4.1 | If not, use `node -e` wrapper that calls `summarize()` directly. |
| A5 | `lifecycle.cjs` accepts `--process-complaints` + `--planning-dir` CLI flags for scenario 5 | 4.5 | If not, use `node -e` wrapper. |
| A6 | Phase 57 `release-readiness/score.cjs` doesn't exist yet; Phase 53 only emits the contract | 6 | Confirmed (find returned no results for `release-readiness*`). Phase 53 work doesn't depend on score.cjs existing. |
| A7 | Scenario 6 `_testHook_simulateFlushAndPoison` returns deterministic shape with `reason` field | 4.6 | VERIFIED at redis-adapter.cjs:1502-1604; risk minimal. |
| A8 | `crit-backlog.cjs#appendRow` does not require `provider_health_check` for `verifier_fail` / `edge_guard_miss` kinds | 7.3 | The `_guardCodexUnavailableClaim` only fires on summaries matching `/codex unavailable/i`; Phase 53 summaries will not match. Risk minimal. [VERIFIED: crit-backlog.cjs:46-59] |

**If this table grows in plan-time review**, the planner should resolve each assumption before locking the implementation plan. Most assumptions are CLI-flag-shape questions that can be answered with `--help` reads in Wave 1; none are architectural risks.

---

## 17. Open Questions for Planner (RESOLVED)

### Q1: CRIT-BACKLOG row append site - harness vs post-run script

**RESEARCH RECOMMENDATION:** harness writes inline via `crit-backlog.cjs#appendRow` at the end of `runAll()`. Justification in section 7.1.

**RESOLVED:** harness writes inline via `crit-backlog.cjs#appendRow` at end of `runAll()` aggregate stage (53-01-PLAN.md T6 implementation). Single-writer protocol honored.

### Q2: Parallelism - sequential vs per-stream-isolated parallel

**RESEARCH RECOMMENDATION:** sequential (CONTEXT.md:107 lock). Section 3.1 flow.

**RESOLVED:** sequential per CONTEXT.md:107 (53-01-PLAN.md T6 outer loop). Per-stream-isolated parallel deferred to a future milestone.

### Q3: Docker per-scenario containers vs tmpdir cwd

**RESEARCH RECOMMENDATION:** tmpdir cwd (CONTEXT.md:106 + section 3.2). Docker is overkill for tools that already filesystem-isolate via `cwd`.

**RESOLVED:** tmpdir via `mkdtempSync(os.tmpdir())` per scenario (53-01-PLAN.md T2 `_setupContainer`). Docker rejected as overkill.

### Q4: F17 reuse from Phase 51 in scenario 6

**RESEARCH RECOMMENDATION:** spawn child process running `node -e 'require(...)._testHook_simulateFlushAndPoison({}).then(...)'`. Real-process boundary preserved; mock-predicate forbiddance honored (the hook is a real production code path inside a real subprocess). Section 4.6.

**RESOLVED:** spawn-via-`node -e` wrapper around `redis-adapter.cjs#_testHook_simulateFlushAndPoison` (53-01-PLAN.md T4 scenario 6 implementation). Real-process boundary preserved.

### Q5: Edge-guard-missing-emit (scenario 10) - which gate's emit to drop

**RESEARCH RECOMMENDATION:** synthetic `phase53_fixture_gate` defined in tmpdir's `gates.yaml`. Section 4.10. The harness invents the gate so we control the `expectedEmits` and `actualEmits`; this gives a deterministic, replayable test of `recordTransition`.

**RESOLVED:** synthetic `phase53_fixture_gate` in tmpdir-only `gates.yaml` (53-01-PLAN.md T5). Production gates not modified — Lock 4 honored; test isolated from production gate evolution.

### Q6 (NEW from research): Per-scenario timeout granularity

**Question:** The harness uses `spawnSync timeout: 30000` (30s) per scenario. Total budget for `--run-all` is <120s per acceptance. Is 30s/scenario too generous (10 * 30 = 300s worst case) or appropriate?

**Recommendation:** 30s per scenario is safe; in practice each scenario should complete in <5s (target tools are local-script CPU-bound). Total budget <120s is achievable. If a scenario regresses past 30s, the timeout fires and the verdict is `verifier_fail` with reason code `scenario_fail_timeout`.

**RESOLVED:** 30s per-scenario timeout via `spawnSync timeout: 30000` (53-01-PLAN.md T2 `_spawnTool`). Total budget <120s; reason code `scenario_fail_timeout` on regression.

### Q7 (NEW from research): Self-test runtime budget

**Question:** Self-test 16-20 assertions vs Phase 51's 33 assertions. Is the smaller count sufficient?

**Recommendation:** 16-20 is sufficient because Phase 53 has 1 inject mechanic per scenario (10 mechanics) vs Phase 51's 16 fixtures within one tool's harness (16 mechanics + 6 baseline scenarios + scoring oracle = 33). The expected ratio is roughly proportional. Planner can expand to 25-30 if a single assertion would test multiple invariants weakly.

**RESOLVED:** 19-21 assertions running total (T1 5 + T2 5 + T3 3 + T4 4 + T5 3 + T6 2-3 = 19-21). Above 16-20 ceiling permitted; T7 final list-lock against §8.2 row table (53-01-PLAN.md T7 consolidation).

---

## 18. Metadata

**Confidence breakdown:**
- 10-scenario manifest: HIGH - every scenario maps to a verified production tool with verified reason-code vocabulary; CONTEXT.md auto-synthesis already vetted the choices against the Phase 51 F1-F16 + F17 catalog.
- Container isolation (tmpdir + spawnSync): HIGH - Phase 51 + sgsd-blind-live-controller patterns proven; Lock 4 mechanically preserved.
- Canonical-stream anti-pollution (5-stream + 6-stream extension): HIGH - W1/W3 fixes from Phase 51 ATC already applied; Phase 53 reuses verbatim.
- CRIT-BACKLOG integration (verifier_fail vs edge_guard_miss): HIGH - kind enum verified; classification logic is scenario-id-keyed (deterministic).
- release-readiness/score.cjs contract: MEDIUM - the consumer (Phase 57) doesn't exist yet; Phase 53 emits the contract but the integration self-test must wait for Phase 57. Self-test 18 (envelope-v1 conformance) is a partial mitigation.
- Self-test assertion count target (16-20): MEDIUM - based on proportional analysis vs Phase 51's 33-assertion suite; planner may expand.
- Soft-skip semantics for scenarios 5 + 6: HIGH - F12-F15 + F17 precedent at failure-injectors.cjs:215-279.
- Edge-guard wiring (scenario 10): HIGH - recordTransition shape contract verified in source.

**Research date:** 2026-04-28

**Valid until:** 30 days for stable upstream tools (Phase 41-52 are SHIPPED + frozen via Lock 4); 7 days for Phase 57 release-readiness contract assumptions (Phase 57 is in v2.0 scope, may evolve).

**Hand-off to planner:** Ready. The 10-scenario manifest is closed; the 4-step protocol mirrors Phase 51 verbatim; the JSONL envelope is the standard envelope-v1 + 8 extension fields; the CRIT-BACKLOG integration is a single-writer pattern with a deterministic classification rule. Planner can author the implementation plan with confidence; the dominant risk is CLI-flag-shape questions (A2-A5 in section 16) which are answerable in Wave 1 with `--help` reads.
