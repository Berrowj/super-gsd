---
phase: 53
name: Gate Failure-Injection Harness
milestone: v2.0
depends_on: [51]
unblocks: [54, 55, 56, 57]
synthesized_at: 2026-04-28
synthesis_sources:
  - .planning/ROADMAP-AGENT.md (lines 622-645 — locked-decisions block; 53=C real-tool+container-isolation)
  - .planning/discussions/2026-04-26-mass-discuss.md (v2.0 locked decisions row)
  - .planning/milestones/v1.9/SUMMARY.md (Phase 51 16-fixture F1-F16 catalog as foundation)
  - .planning/milestones/v1.9/phases/51-context-stress-benchmark/51-RESEARCH.md (snapshot/inject/observe/restore protocol)
  - super-gsd/tools/context-bench/failure-injectors.cjs (live F1-F16 catalog)
synthesis_rule: "sgsd-orchestrate dispatch rule #1 (corrected 2026-04-28): AUTO mode synthesizes CONTEXT.md from roadmap+checkpoint+audit rather than pausing for /gsd-discuss-phase. Operator override @ ORCHESTRATOR-CHECKPOINT.md autopilot_override field."
---

# Phase 53 Context — Gate Failure-Injection Harness

## Goal

Build a 10-scenario failure-injection harness where each scenario invokes a REAL SGSD tool against a fixture in a temp/container directory. Mock predicates are FORBIDDEN. The harness writes a deterministic JSONL log every run; `release-readiness/score.cjs` consumes it.

This is the v2.0 entry point. The Phase 51 F1-F16 catalog proved the snapshot/inject/observe/restore protocol works against context-bench scenarios. Phase 53 generalizes that pattern: instead of injecting into one harness, the 10 scenarios each target a real production tool (token-attribution, context-packet, dispatch-router, vtp-bridge, memory-governance, redis-adapter, sqlite-context-index, phase-capsule, route-ledger, edge-guard).

## Locked Decisions (from .planning/discussions/2026-04-26-mass-discuss.md)

- **53=C** — real-tool + container-isolation (chosen over mock predicates)
- 10/10 scenarios required for clean PASS
- 9/10 or lower → PASS-WITH-DEFERRED-N (each failure logged to CRIT-BACKLOG.md with `kind=verifier_fail`)
- Structural failures (real-tool fixture exposes missing emit) → `kind=edge_guard_miss` → CANDIDATE-WITH-DEBT
- v2.0 milestone-close gate runs the harness; <10/10 forces SHIPPED-WITH-DEBT-N or CANDIDATE

## What v2.0 Phase 53 Builds On

Phase 51 shipped:
- F1-F16 frozen 16-fixture catalog with snapshot→inject→observe→restore protocol
- Anti-pollution canonical fingerprint guard (5 streams: agent-token-spend, context-packet-log, context-complaints, route-decisions, crit-backlog)
- F17 Phase 52 cross-binding (Redis FLUSHDB + poisoned-key recovery)
- 4-step protocol with sandboxed temp-dir mirrors

Phase 53 generalizes:
- 10 scenarios (not 16 fixtures within one tool's scope)
- Each scenario targets ONE real tool's failure mode
- Container isolation: scenarios run in temp dirs (isolated from live `.planning/`)
- Real tool invocation logged to `.planning/metrics/failure-injection-log.jsonl` per run
- 10/10 PASS required for v2.0 SHIPPED clean

## Required Outputs

- `super-gsd/tools/failure-injection/harness.cjs` — entry point + CLI + JSONL writer
- `super-gsd/tools/failure-injection/fixtures/{scenario-id}/` — 10 fixture directories
- `super-gsd/tools/failure-injection/scenarios.json` — 10-entry frozen scenario manifest
- `super-gsd/tools/failure-injection/run-self-test.cjs` — operator-runnable self-test entry
- `.planning/metrics/failure-injection-log.jsonl` — envelope-v1, append-only, deterministic per-scenario evidence
- 53-* artifacts (CONTEXT, RESEARCH, PLAN, VERIFICATION, ATC-REVIEW, WASTE, commit-reviews.jsonl)

## 10 Scenario Targets (proposed — research will confirm)

Each scenario invokes a real production tool. Naming pattern: `<tool>-<failure-mode>`:

1. `token-attribution-poisoned-row` — corrupt one row in agent-token-spend.jsonl mid-summarize; expect graceful skip + log
2. `context-packet-missing-capsule` — buildPacket against a phase whose capsule was deleted; expect raw_fallback + reason code
3. `dispatch-router-vtp-whitelist-violation` — dispatch with non-whitelisted UNCERTAINTY_TYPE → VTP; expect rejection + claude fallback
4. `vtp-bridge-unavailable` — env SGSD_VTP_FORCE_OFFLINE=1; expect dispatch fallback to claude + provider_unavailable log
5. `memory-governance-revocation-replay` — synthetic revocation row triggers re-read; expect downstream consumer rebuild
6. `redis-adapter-flushdb-recovery` — FLUSHDB mid-run; expect cockpit/cache rebuild from SQLite within Ns
7. `sqlite-context-index-deleted-db` — rm context-index.db mid-query; expect index_unavailable + degraded sentinel
8. `phase-capsule-corrupted-json` — broken JSON in PHASE-CAPSULE.json; expect parse-fail + skip + log
9. `route-ledger-truncated-stream` — partial-line write to route-decisions.jsonl; expect tail-skip + canonical preservation
10. `edge-guard-missing-emit` — dispatch a step whose declared evidence_emitted path is never written; expect edge-guard halt OR log-only escalation

## Required Failure Contract

Each scenario:
1. **Snapshot** — capture canonical state hash (sha256 + size + mtime) of every stream/file the scenario could touch
2. **Inject** — apply the failure (corrupt/delete/truncate/env-toggle)
3. **Observe** — invoke the real tool; capture stdout/stderr/exit + any reason codes emitted to canonical streams
4. **Restore** — undo the injection; assert canonical state hash byte-equality (anti-pollution)
5. **Verdict** — PASS if expected reason codes appeared AND canonical state preserved AND tool degraded gracefully (Lock 13)

Mock predicates forbidden: every scenario MUST invoke the real tool process and observe real output. The harness can use child_process.spawnSync but cannot stub the tool's internals.

## Lock Invariants

- **Lock 4**: Phase 41-52 tool trees byte-untouched. The harness consumes them by reference (spawnSync or require).
- **Lock 11**: scenario selection + verdict scoring use ONLY set-membership and byte-equality on closed-vocab fields (no semantic similarity)
- **Lock 13**: harness never throws upward; missing fixture → emits `bench_scenario_skipped:fixture_unavailable` + continues. Real tool throws are CAUGHT (not propagated) and logged.
- **ASCII-only** on all .cjs files
- **Container isolation**: scenarios run with `cwd=tmp/container/{scenario-id}` so live `.planning/` is unaffected

## Acceptance (verbatim from ROADMAP-AGENT.md lines 632-645)

- Each scenario actually executes the tool it targets (mock predicates forbidden; verify by adding logging that records the tool invocation in `.planning/metrics/failure-injection-log.jsonl` per run)
- Fixtures live in `super-gsd/tools/failure-injection/fixtures/{scenario-id}/`
- Scenarios run in temp dirs (isolated from live `.planning/`)
- **Harness must run all 10 scenarios. 10/10 required for PASS.**
- **9/10 or lower may continue auto mode only as PASS-WITH-DEFERRED-N** (each failed scenario logged to CRIT-BACKLOG.md with `kind=verifier_fail`, `summary` quoting the scenario id and observed-vs-expected)
- **A failed scenario whose root cause is structural (a real-tool fixture that exposes a missing emit) is logged as `kind=edge_guard_miss` instead, which forces CANDIDATE-WITH-DEBT per the edge-guard rule**
- **v2.0 cannot be SHIPPED clean unless the harness is 10/10**. Milestone close runs the harness as a precondition; anything less than 10/10 forces SHIPPED-WITH-DEBT-N or CANDIDATE.
- `release-readiness/score.cjs` reads the harness's last-run JSONL output deterministically; the `scenarios` bucket is `pass / total * 15` rounded.

## Discussion Decision Record (auto-synthesized — substitute for /gsd-discuss-phase)

- **Q1 (gray area: real tool vs. mock predicate)** — RESOLVED locked decision 53=C: real tool only. Justification: v1.9 Phase 51 F1-F16 catalog already proved the mock-predicate path was fragile (T4 ATC W2 caught F8/F16 inject() being behavioral no-ops). Phase 53 forecloses that failure mode by construction.
- **Q2 (10 scenarios — which tools?)** — Auto-synthesized 10 above; researcher confirms or amends in 53-RESEARCH.md.
- **Q3 (container isolation mechanism)** — temp-dir cwd via `os.tmpdir()` mkdtempSync. Docker per-scenario is overkill for tools that already do file-system isolation by `cwd`.
- **Q4 (parallelism)** — sequential. The shared canonical streams (agent-token-spend.jsonl etc.) prevent safe concurrent injection. Sequential keeps the snapshot-restore protocol clean.
- **Q5 (PASS-WITH-DEFERRED-N threshold)** — locked at 1 deferred max. 8/10 or lower forces FAIL.
- **Q6 (release-readiness scoring weight)** — 15 points total (`pass/total * 15`). Locked.

## Cross-Phase Dependencies

- **Phase 51** (Context Stress Benchmark): the 16-fixture F1-F16 catalog is the protocol foundation. Phase 53 reuses snapshot→inject→observe→restore.
- **Phase 52** (Redis Live Cache Adapter): scenario 6 (redis-adapter-flushdb-recovery) reuses `_testHook_simulateFlushAndPoison` if available; otherwise soft-skips with `bench_scenario_skipped:redis_adapter_unavailable`.
- **Phase 41-49** tool trees: byte-untouched by Phase 53 (Lock 4). Harness invokes by `spawnSync` or `require()`-by-absolute-path.

## What Phase 53 Does NOT Build

- Restart/handoff chaos tests (Phase 54)
- Provider backpressure + circuit breaker (Phase 55)
- Scenario-based acceptance suite (Phase 56)
- Canary degradation rehearsal (Phase 57)

## Hand-off to Researcher

Researcher (gsd-phase-researcher) should produce 53-RESEARCH.md covering:
1. Final scenario list (confirm 10 above or amend with rationale)
2. Container isolation mechanism details (tmpdir mkdtemp + per-scenario subprocess env)
3. snapshot→inject→observe→restore implementation pattern (mirror sgsd-blind-live-controller.mjs + Phase 51 _F-factories)
4. failure-injection-log.jsonl envelope-v1 schema (extend route-ledger pattern)
5. release-readiness/score.cjs integration (read tail of last-run; scenarios bucket = pass/total * 15)
6. Soft-skip semantics when an upstream tool is unavailable
7. Open questions for planner (e.g., where does CRIT-BACKLOG.md row append happen — harness or post-run script?)
