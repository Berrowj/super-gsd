---
milestone: v2.0
milestone_name: Failure Injection
generated_at: "2026-04-28T22:45:00Z"
probe_duration_s: 42
total_phases_scanned: 5
phase_range: 53-57
overall_status: PARTIAL
---

# Milestone v2.0 Readiness Manifest

**Milestone**: v2.0 Failure Injection  
**Phases**: 53, 54, 55, 56, 57  
**Probed**: 2026-04-28T22:45:00Z  
**Probe wall-time**: ~42s  
**Total phases**: 5

---

## GO

### Phase 53 — Gate Failure-Injection Harness

**Status: GO**

All external dependencies are present and verified. The executor can be dispatched immediately.

| Dependency | Probe Result |
|---|---|
| Node.js v22.22.2 | OK |
| child_process.spawnSync | OK |
| os.tmpdir() writable (C:\Users\USER~1\AppData\Local\Temp) | OK |
| super-gsd/tools/context-bench/failure-injectors.cjs (Phase 51 precedent) | PRESENT |
| super-gsd/tools/context-cache/redis-adapter.cjs (Phase 52, scenario 6) | PRESENT |
| super-gsd/scripts/lib/crit-backlog.cjs (loadable) | OK |
| super-gsd/scripts/lib/route-ledger.cjs (loadable) | OK |
| super-gsd/scripts/lib/edge-guard.cjs (loadable) | OK |
| super-gsd/tools/token-attribution/report.cjs | PRESENT |
| super-gsd/tools/context-packet/build.cjs | PRESENT |
| super-gsd/tools/dispatch-router/route.cjs | PRESENT |
| super-gsd/tools/vtp-bridge/classify.cjs | PRESENT |
| super-gsd/tools/memory-governance/lifecycle.cjs | PRESENT |
| super-gsd/tools/phase-capsule/write.cjs | PRESENT |
| super-gsd/tools/context-cache/query.cjs (scenario 7 sqlite target) | PRESENT |
| super-gsd/tools/context-cache/rebuild.cjs (scenario 7 rebuild target) | PRESENT |
| better-sqlite3 native module | INSTALLED |
| super-gsd/scripts/sgsd-complete-milestone.cjs | PRESENT |
| super-gsd/scripts/codex-exec.sh | PRESENT |
| context-bench harness.selfTest export (milestone-close gate) | PRESENT |
| redis-adapter selfTest export (milestone-close gate) | PRESENT |
| docker binary (container isolation optional path) | PRESENT |
| Phase 53 PLAN.md (53-01-gate-failure-injection-harness-PLAN.md) | PRESENT |
| Phase 53 PLAN-CHECK verdict | PASS |
| .planning/metrics/failure-injection-log.jsonl | ABSENT (expected — created by executor) |

**Note on sqlite-context-index**: The PLAN references `super-gsd/tools/sqlite-context-index/` but this tool shipped under `super-gsd/tools/context-cache/` (Phase 46 naming). `query.cjs` and `rebuild.cjs` are present at the correct path. The harness `require.resolve('../context-cache/query.cjs')` will resolve correctly from within `super-gsd/tools/failure-injection/`.

**Note on Redis (scenario 6)**: Redis container is NOT required. The PLAN explicitly documents soft-skip semantics: absent Redis returns `redis_not_available_soft_skip` which counts as PASS-WITH-SOFT-SKIP. No Docker Redis probe needed.

---

## BLOCKED AT START

None. All Phase 53 external dependencies are green.

---

## WILL BLOCK MID-RUN

### Phase 54 — Restart + Handoff Chaos Tests

**Status: WILL BLOCK MID-RUN** (depends on Phase 53 output)

Phase 54 consumes `super-gsd/tools/failure-injection/harness.cjs` and `failure-injection-log.jsonl` (Phase 53 outputs). These do not exist yet. Phase 54 will block when its turn comes if Phase 53 did not complete.

- Upstream blocker: Phase 53 must ship `super-gsd/tools/chaos-restart/` (new dir) and pass 5-kill-point suite.
- No additional external deps beyond what Phase 53 requires.

### Phase 55 — Provider Backpressure + Timeout Circuits

**Status: WILL BLOCK MID-RUN** (depends on Phase 53; codex-exec.sh present)

Phase 55 requires `super-gsd/scripts/codex-exec.sh` (PRESENT) and must produce `super-gsd/scripts/lib/provider-circuit.cjs` (ABSENT — Phase 55 output). This phase's own deps are clear but it serializes after Phase 53 per ROADMAP-AGENT.md dependency graph `53 → {54 ∥ 55 ∥ 56}`.

### Phase 56 — Scenario-Based Acceptance Suite

**Status: WILL BLOCK MID-RUN** (depends on Phase 53)

Phase 56 requires `super-gsd/tools/scenario-suite/` (ABSENT — Phase 56 output) and the Phase 53 harness infrastructure. Serializes after Phase 53.

### Phase 57 — Canary Degradation Rehearsal / Release Readiness Score

**Status: WILL BLOCK MID-RUN** (depends on Phases 53, 54, 55, 56)

Phase 57 requires:
- `.planning/metrics/failure-injection-log.jsonl` (Phase 53 output — ABSENT)
- `super-gsd/tools/release-readiness/score.cjs` (Phase 57 output — must be built)
- `super-gsd/scripts/lib/provider-circuit.cjs` (Phase 55 output — ABSENT)
- All 4 upstream phases complete

---

## DEGRADED AUTO-RUN PATH

**Path**: Phase 53 only  
**Total ETA**: ~4-6 hours (FULL ATC tier, 7 tasks, 10 scenarios, real-tool spawnSync)  
**Stop point**: After Phase 53 closes PASS, phases 54/55/56 may run in parallel — all three have only Phase 53 as prerequisite and no additional blocked external deps. Phase 57 must wait for all three.

**Recommended unattended execution order**:
1. Phase 53 (GO — dispatch executor now)
2. Phases 54, 55, 56 in parallel once Phase 53 PASS confirmed
3. Phase 57 after Phases 54+55+56 all PASS

No human intervention required between phases 53-57 once Phase 53 closes cleanly. All deps for phases 54-56 are either Phase 53 outputs or new files those phases create themselves.

---

## FIXES AVAILABLE

**0 fixes required.** All probed external dependencies for the first runnable phase (53) are green. No human action needed before auto-dispatch.

The following are not blockers but are informational:

- **Redis container**: Not needed for Phase 53 go. If a human wants to exercise the live-Redis path in scenario 6 (rather than the soft-skip path), run: `docker compose -f super-gsd/tools/context-cache/docker-compose.redis.yml up -d`
- **Phases 54-57 PLAN.md files**: These do not yet exist (phases are queued, no PLAN written yet). The phase-readiness agent (Rule 4.5) will catch any drift before first executor dispatch of each phase. This is expected and correct — the orchestrator writes PLAN.md as part of the loop for each phase.

---

## PROBE LOG

| # | Probe | Command | Result |
|---|---|---|---|
| 1 | Node.js version | `node --version` | v22.22.2 OK |
| 2 | child_process.spawnSync | `node -e "require('child_process').spawnSync"` | OK |
| 3 | os.tmpdir() writable | `node -e "fs.mkdirSync+writeFile+rmSync"` | WRITABLE at C:\Users\USER~1\AppData\Local\Temp |
| 4 | Phase 51 failure-injectors.cjs | `test -f super-gsd/tools/context-bench/failure-injectors.cjs` | PRESENT |
| 5 | Phase 52 redis-adapter.cjs | `test -f super-gsd/tools/context-cache/redis-adapter.cjs` | PRESENT |
| 6 | crit-backlog.cjs | `test -f + node -e require()` | PRESENT, LOADABLE |
| 7 | route-ledger.cjs | `test -f + node -e require()` | PRESENT, LOADABLE |
| 8 | edge-guard.cjs | `test -f + node -e require()` | PRESENT, LOADABLE |
| 9 | token-attribution/report.cjs | `test -f` | PRESENT |
| 10 | context-packet/build.cjs | `test -f` | PRESENT |
| 11 | dispatch-router/route.cjs | `test -f` | PRESENT |
| 12 | vtp-bridge/classify.cjs | `test -f` | PRESENT |
| 13 | memory-governance/lifecycle.cjs | `test -f` | PRESENT |
| 14 | phase-capsule/write.cjs | `test -f` | PRESENT |
| 15 | context-cache/query.cjs | `test -f` | PRESENT |
| 16 | context-cache/rebuild.cjs | `test -f + node -e require()` | PRESENT, LOADABLE |
| 17 | better-sqlite3 | `node -e require('better-sqlite3')` | INSTALLED |
| 18 | sgsd-complete-milestone.cjs | `test -f` | PRESENT |
| 19 | codex-exec.sh | `test -f + head -1` | PRESENT (valid bash shebang) |
| 20 | context-bench harness.selfTest | `node -e typeof require().selfTest` | PRESENT |
| 21 | redis-adapter selfTest | `node -e typeof require().selfTest` | PRESENT |
| 22 | docker binary | `command -v docker` | PRESENT |
| 23 | Phase 53 PLAN-CHECK verdict | read 53-PLAN-CHECK.md | PASS |
| 24 | failure-injection-log.jsonl | `test -f` | ABSENT (expected — Phase 53 creates it) |
| 25 | provider-circuit.json | `test -f` | ABSENT (Phase 55 output — expected) |
| 26 | chaos-restart dir | `test -d` | ABSENT (Phase 54 output — expected) |
| 27 | scenario-suite dir | `test -d` | ABSENT (Phase 56 output — expected) |
| 28 | release-readiness/score.cjs | `test -f` | ABSENT (Phase 57 output — expected) |
| 29 | provider-circuit.cjs lib | `test -f` | ABSENT (Phase 55 output — expected) |
| 30 | MILESTONE-READINESS.md pre-existing | `test -f` | ABSENT (first run) |

---

## SGSD-CURATE SUGGESTIONS

The following new dependency patterns were discovered during this probe and are not yet in `.brv/`:

1. **Pattern**: `sqlite-context-index` tool ships under `super-gsd/tools/context-cache/` (not a separate directory). Future probes for Phase 46 consumers should check `context-cache/query.cjs` and `context-cache/rebuild.cjs` rather than a `sqlite-context-index/` path.

2. **Pattern**: Phase 53 container isolation uses `os.tmpdir()` exclusively — no Docker daemon required for the primary isolation mechanism. Docker is only needed for the optional live-Redis scenario 6 path (which has a soft-skip fallback). Future failure-injection probes should NOT gate on Docker presence.

3. **Pattern**: `sgsd-complete-milestone.cjs` milestone-close gate triple-wires three harness selfTests in order: context-bench (Phase 51) → redis-adapter (Phase 52) → failure-injection (Phase 53, v2.0 only). Probing milestone close readiness for v2.0 requires all three `selfTest` exports, not just the newest.
