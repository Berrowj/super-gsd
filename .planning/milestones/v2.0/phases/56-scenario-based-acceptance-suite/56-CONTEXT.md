---
phase: 56
name: Scenario-Based Acceptance Suite
milestone: v2.0
depends_on: [55]
unblocks: [57]
synthesized_at: 2026-04-29
synthesis_rule: "auto per dispatch rule #1"
---

# Phase 56 Context — Scenario-Based Acceptance Suite

## Goal (verbatim ROADMAP-AGENT.md:679)

6 happy + 4 adversarial scenarios.

## Locked: 56=B

## Required Outputs

- New: `super-gsd/tools/scenario-suite/` with 10 scenario specs
- Each scenario has fixture + expected outcomes
- 56-* artifacts

## Acceptance (verbatim 685-687)

- 10 scenarios runnable; each produces evidence file + asserted gate outcome
- 4 adversarial: poisoned PLAN.md, race-condition writes, malformed checkpoint, mid-write SIGKILL

## 10 Scenarios (proposed)

### 6 Happy Path
1. **clean-phase-close** — phase passes verifier + ATC + close cleanly
2. **deferred-debt-pass** — phase verifier PASS-WITH-DEFERRED-N (1 LOW), close clean
3. **soft-skip-codex-unavailable** — Codex degrades to Claude reviewer
4. **redis-on-graceful-degrade** — Redis up but timeout → fallback to SQLite
5. **memory-revocation-replay-clean** — Phase 49 lifecycle event triggers re-read
6. **plan-schema-load-valid** — schema_v2 plan validates clean

### 4 Adversarial
7. **poisoned-plan-md** — PLAN.md with embedded prompt-injection / oversized files_touched array; expect schema validator rejection
8. **race-condition-writes** — concurrent writes to a canonical stream; expect single-writer protocol holds (last-write-wins OR explicit lock)
9. **malformed-checkpoint** — ORCHESTRATOR-CHECKPOINT.md with missing required fields; expect manifest-validator rejection (Phase 54 contract)
10. **mid-write-sigkill** — SIGKILL during JSONL appendFileSync; expect tail-skip on next read + canonical preservation

## Lock Invariants

- Lock 4: Phase 41-55 byte-untouched
- Lock 11: byte-equality assertions only
- Lock 13: never throws; degraded sentinel
- ASCII-only

## Hand-off

Single executor dispatch (compressed): build scenario-suite/{harness,scenarios.json,fixtures/}.cjs + 10 fixture dirs + 12-15 self-tests + v2.0 sext-gate wire. Reuse Phase 53 pattern (real spawn + container isolation + closed-vocab reason codes).
