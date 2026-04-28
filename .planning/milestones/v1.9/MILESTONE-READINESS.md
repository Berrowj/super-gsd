---
milestone: v1.9
generated: 2026-04-27T00:00:00Z
probe_duration_sec: 47
phases_scanned: 12
status: PARTIAL
first_stall_eta_min: n/a
---

# Milestone Readiness — v1.9 (SGSD-Research)

> Pre-flight dependency audit. Generated before auto-mode execution.
> If this file is older than the latest phase change in the milestone, re-run `/gsd-readiness`.
>
> Controlling principle: **"Autonomy continues; evidence tells the truth."**
> Redis (Phase 52) and VTP (Phase 48) are both designed with a degraded-path contract per locked
> design decisions. Neither absence blocks unattended execution; they degrade to local/SQLite mode.
> Per REQUIREMENTS.md: "REDIS-04: If Redis is unavailable, SGSD runs with SQLite/local files."

---

## GO — Safe to run unattended

Phases whose probed dependencies are all green AND whose upstream phases are not blocked.

| Phase | Title | ETA | Notes |
|-------|-------|-----|-------|
| 41 | Baseline Token Attribution | ~60m | All deps green. `token-attribution/collect.cjs` PASS. Source analyses exist. PLAN.md not yet written (expected — planner dispatches first). |
| 42 | Token Budget Admission | ~60m | Upstream: Phase 41 (GO). No external deps; new `token-waste/check.cjs` built in-phase. |
| 43 | Phase Capsule Contract | ~90m | Upstream: Phase 41 (GO). No external deps; `phase-capsule/write.cjs` new in-phase. Backfill from git history. |
| 44 | Legal Context Registry | ~60m | Upstream: Phase 41 (GO). No external deps; `context-registry/` new in-phase. |
| 45 | Context Packet Builder | ~90m | Upstream: 43+44 (both GO). No external deps; `context-packet/build.cjs` new in-phase. |
| 46 | SQLite Context Index | ~90m | Upstream: 43+45 (both GO). `better-sqlite3` npm package MISSING from project deps — but phase builds the tool in-phase. `npm install better-sqlite3` required. sqlite3 binary present. See BLOCKED note. |
| 47 | Dispatch Routing Substitution | ~60m | Upstream: 42+45 (both GO). `route-ledger.cjs` self-test PASS (13/13). Codex provider AVAILABLE. |
| 48 | Selective VTP Bridge | ~60m | Upstream: 45+47 (both GO). VTP MCP not confirmed available in this session — but phase is designed for degraded mode: "Defer VTP automation if MCP returns schema/timeouts without reliable fallback." DEGRADED-OK. |
| 49 | Memory Governance Lifecycle | ~60m | Upstream: 43+44+45+46+47+48 (all GO or DEGRADED-OK). No external deps beyond prior phase artifacts. |
| 50 | Cockpit Research Dashboard | ~90m | Upstream: 42+45+47+49 (all GO). Cockpit scripts confirmed present. No new external deps. |
| 51 | Context Stress Benchmark | ~120m | Upstream: 41-50 (all GO/DEGRADED-OK). Benchmark harness scaffolding present (`harness-benchmark/`). Redis fixture needed but injected as failure fixture, not runtime requirement. |
| 52 | Redis Live Memory Projection Adapter | ~60m | Upstream: 46+50+51 (all GO). **Redis not running** (redis:DOWN, port 6379 closed) — but REDIS-04 locks this as graceful degraded mode. Phase builds the optional adapter; Redis absence is the expected test fixture. |

---

## BLOCKED AT START — Fix these before running

No phase has a full hard block — all 12 phases have a runnable path.

### Phase 46 — SQLite Context Index (soft dep: `better-sqlite3`)

`better-sqlite3` is not installed in the project `node_modules`. The phase builds `context-cache/rebuild.cjs` which will `require('better-sqlite3')` at runtime.

- **Failed probe:** `node -e "require('better-sqlite3')"` → `MODULE_NOT_FOUND`
- **Dependency:** `better-sqlite3` npm package (runtime dep for Phase 46 tool)
- **Impact:** Phase 46 self-test will fail on first executor run until the package is present.
- **Fix:** `npm install better-sqlite3 --save` (run from project root)
- **Classification:** SOFT — does not block phases 41-45 or 47-52. Phase 46 executor can install the dep as part of its implementation task. Mark DEGRADED-OK for GO classification; executor must install before self-test runs.

---

## WILL BLOCK MID-RUN — Cascade blockers

No cascade blockers identified. The `better-sqlite3` gap in Phase 46 is self-contained and does not cascade because:
- Phase 47 (routing) depends on Phase 45 context packet, not the SQLite index.
- Phase 49 (governance) can operate on capsules/files without the index being active.
- Phase 51 (benchmark) failure-injection suite explicitly includes "deleted SQLite DB" as a test fixture.

| Phase | Depends on | Reason |
|-------|-----------|--------|
| — | — | No cascade blockers identified |

---

## DEGRADED AUTO-RUN PATH

All 12 phases have a runnable path. No phase has zero runnable executor path.

- **Path:** 41 → 42 → 43 → 44 → 45 → 46* → 47 → 48† → 49 → 50 → 51 → 52‡
- **Total ETA:** ~900 minutes (12 phases, including planner + executor + verifier passes per phase)
- **Stops at:** No forced stop — full 12-phase run is viable
- **Degraded notes:**
  - `*` Phase 46: executor must `npm install better-sqlite3` before self-test. One line, in-scope.
  - `†` Phase 48: VTP MCP may be unavailable. Phase design mandates degraded-OK; MCP failures logged separately from conclusions. Auto-run continues.
  - `‡` Phase 52: Redis not running. This is the expected test state per REDIS-04. Phase builds the adapter and tests graceful degraded behavior. Auto-run continues.
- **Command:** `/sgsd-orchestrate go`

---

## PROBE LOG

| Time | Phase | Dep | Probe | Result |
|------|-------|-----|-------|--------|
| 2026-04-27T00:00:00Z | ALL | status-consistency v1.8 | `node check.cjs --milestone v1.8` | PASS — `status-consistency milestone v1.8: OK` |
| 2026-04-27T00:00:00Z | ALL | status-consistency v1.9 | `node check.cjs --milestone v1.9` | PASS — baseline empty OK (no phases shipped yet) |
| 2026-04-27T00:00:00Z | ALL | Codex behavioral | `node check.cjs --provider codex --behavioral` | PASS — `AVAILABLE`, login status OK, contract canary OK, v0.125.0 |
| 2026-04-27T00:00:00Z | ALL | crit-backlog self-test | `node crit-backlog.cjs --self-test` | PASS |
| 2026-04-27T00:00:00Z | ALL | backlog-schema check | `node check.cjs` | PASS — 26 rows (18 legacy_v0, 8 cleared) |
| 2026-04-27T00:00:00Z | ALL | review-ledger kill-check | `node review-ledger.cjs --kill-check` | INFO — empty_baseline (v1.9 not yet started, expected) |
| 2026-04-27T00:00:00Z | ALL | route-ledger self-test | `node route-ledger.cjs --self-test` | PASS — 13/13 |
| 2026-04-27T00:00:00Z | ALL | review-ledger self-test | `node review-ledger.cjs --self-test` | PASS — 18/18 |
| 2026-04-27T00:00:00Z | ALL | repair-command-checker self-test | `node repair-command-checker.cjs --self-test` | PASS — 14/14 |
| 2026-04-27T00:00:00Z | ALL | gate-value-log self-test | `node gate-value-log.cjs --self-test` | PASS — 14/14 |
| 2026-04-27T00:00:00Z | ALL | sampling-decider self-test | `node sampling-decider.cjs --self-test` | PASS — 17/17 |
| 2026-04-27T00:00:00Z | ALL | rubric self-test | `node rubric.cjs --self-test` | PASS — 14/14 |
| 2026-04-27T00:00:00Z | ALL | phase-folder-audit self-test | `node audit.cjs --self-test` | PASS — 13/13 |
| 2026-04-27T00:00:00Z | ALL | system-map self-test | `node generate.cjs --self-test` | PASS — 18/18 |
| 2026-04-27T00:00:00Z | ALL | token-attribution self-test | `node collect.cjs --self-test` | PASS |
| 2026-04-27T00:00:00Z | P46 | better-sqlite3 npm | `node -e "require('better-sqlite3')"` | FAIL — MODULE_NOT_FOUND |
| 2026-04-27T00:00:00Z | P46 | sqlite3 binary | `command -v sqlite3` | PASS — binary on PATH |
| 2026-04-27T00:00:00Z | P52 | Redis port 6379 | `redis-cli ping` / `nc -z localhost 6379` | FAIL — redis:DOWN (expected; degraded-OK per REDIS-04) |
| 2026-04-27T00:00:00Z | P48 | VTP MCP probe | Session MCP check | UNKNOWN — VTP MCP not confirmed in session; degraded-OK per design lock 7 |
| 2026-04-27T00:00:00Z | ALL | source analyses | `ls .planning/analyses/2026-04-27-*` | PASS — both audit files present |
| 2026-04-27T00:00:00Z | ALL | v1.9 phase context files | `ls .planning/milestones/v1.9/phases/*/` | PASS — all 12 CONTEXT.md files present |
| 2026-04-27T00:00:00Z | ALL | PLAN.md files | check per phase | INFO — all 12 PLAN.md MISSING (expected; planner dispatch generates them) |
| 2026-04-27T00:00:00Z | ALL | node binary | `node --version` | PASS — v22.22.2 |
| 2026-04-27T00:00:00Z | ALL | git binary | `git --version` | PASS — 2.50.1.windows.1 |
| 2026-04-27T00:00:00Z | P47 | harness-benchmark dir | `ls super-gsd/tools/harness-benchmark/` | PASS — scaffolding present |
| 2026-04-27T00:00:00Z | P41-52 | v1.9 target tools | check all 5 new tool dirs | INFO — all MISSING (expected; built by each phase) |

---

## Notes for the human

- The only actionable fix before auto-run: `npm install better-sqlite3 --save` (Phase 46 runtime dep). The executor can also do this as its first task.
- Redis absence is intentional test state for Phase 52. Do not start Redis before Phase 52 runs — its first job is to prove degraded mode.
- VTP MCP: if available in the session, Phase 48 will use it. If not, phase runs in degraded mode and logs the failure as a provider event, not a research conclusion.
- All 7 existing lib self-tests pass clean. Existing surface is stable.
- After running `npm install better-sqlite3`, reply `continue` — the orchestrator will re-probe Phase 46 and proceed.
- Never paste API key values — use `secure_env_collect` for secrets.

---

## sgsd-curate Suggestions

New dependency patterns found in this audit not currently in `.brv/`:

1. **`better-sqlite3` npm package pattern**: Phase 46 introduces a native addon npm dependency for SQLite FTS. Pattern: new tools that use `better-sqlite3` must include `npm install better-sqlite3 --save` as a setup step. Pre-flight should check `node -e "require('better-sqlite3')"`. Suggest curating under `architecture/patterns/sqlite-native-dep.md`.

2. **Redis degraded-OK contract**: A new class of "optional infrastructure" deps that have a locked degraded path (REDIS-04). Pre-flight should probe these as informational/degraded rather than blocking. Suggest curating under `architecture/patterns/optional-infra-dep-contract.md`.
