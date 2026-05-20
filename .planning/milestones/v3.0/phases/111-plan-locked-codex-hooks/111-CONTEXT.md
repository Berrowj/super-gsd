---
phase: 111
phase_name: PLAN-LOCKED Contract + Codex Hooks
milestone: v3.0
created: 2026-05-20
status: queued-planning-only
implementation_status: not-started
source: DLB-09.2 from SGSD-PRO proposal §4.4 + §4.6
predecessor: P110 PASS (Codex Pro Mode lanes shipped)
---

# Phase 111 — PLAN-LOCKED Contract + Codex Hooks

> Second DLB-09 phase. Ships:
> 1. **PLAN-LOCKED.md formal lock contract** — schema + validator. A PLAN-LOCKED.md is a PLAN.md that has passed plan-check and is now the binding execution authority. Adds new fields (lock_status, locked_at, locked_by, allowed_files, forbidden_files, invariants, acceptance_commands, rollback_plan, risk_rating, operator_checkpoints).
> 2. **.codex/hooks.json + 5 hook scripts** — deterministic safety rails fired by Codex at UserPromptSubmit / PreToolUse / PostToolUse / Stop events.

## Goal

Ship 8 files total:

### PLAN-LOCKED contract
- **`super-gsd/schemas/plan-locked.schema.json`** — extends plan-schema-v2 with lock metadata. A PLAN.md becomes PLAN-LOCKED.md when it gains required fields: `lock_status: locked`, `locked_at`, `locked_by`, `allowed_files[]`, `forbidden_files[]`, `invariants[]`, `acceptance_commands[]`, `rollback_plan`, `risk_rating`, `operator_checkpoints[]`. The existing v2-schema fields (semantic_acceptance_criteria etc.) all remain required.
- **`super-gsd/tools/plan-lock/validate-plan-locked.cjs`** — validator CLI; consumes plan-locked.schema.json; same shape as `validate.cjs` for plan-schema-v2.

### Codex hooks
- **`.codex/hooks.json`** — Codex hook config; maps event → script.
- **`super-gsd/tools/codex-hooks/block-forbidden-write.cjs`** — PreToolUse hook; blocks writes outside PLAN-LOCKED's allowed_files.
- **`super-gsd/tools/codex-hooks/block-secret-leak.cjs`** — UserPromptSubmit hook; rejects prompts containing API keys / tokens / `.env` paths / production credentials.
- **`super-gsd/tools/codex-hooks/log-tool-event.cjs`** — PostToolUse hook; appends one row to `.planning/metrics/codex-tool-events.jsonl` per tool invocation.
- **`super-gsd/tools/codex-hooks/validate-stop-contract.cjs`** — Stop hook; ensures result contract exists (report file written, checkpoint updated, acceptance commands reported).
- **`super-gsd/tools/codex-hooks/enforce-allowed-files.cjs`** — PreToolUse hook; reads current PLAN-LOCKED.md allowed_files and rejects writes outside.

Plus a self-test runner `super-gsd/tools/codex-hooks/run-self-test.cjs` (≥15 assertions covering schema + all 5 hooks).

## Files this phase will create

| Path | Op |
|---|---|
| `super-gsd/schemas/plan-locked.schema.json` | create |
| `super-gsd/tools/plan-lock/validate-plan-locked.cjs` | create |
| `super-gsd/tools/plan-lock/package.json` | create |
| `super-gsd/tools/plan-lock/README.md` | create |
| `.codex/hooks.json` | create |
| `super-gsd/tools/codex-hooks/block-forbidden-write.cjs` | create |
| `super-gsd/tools/codex-hooks/block-secret-leak.cjs` | create |
| `super-gsd/tools/codex-hooks/log-tool-event.cjs` | create |
| `super-gsd/tools/codex-hooks/validate-stop-contract.cjs` | create |
| `super-gsd/tools/codex-hooks/enforce-allowed-files.cjs` | create |
| `super-gsd/tools/codex-hooks/run-self-test.cjs` | create |
| `super-gsd/tools/codex-hooks/package.json` | create |
| `super-gsd/tools/codex-hooks/README.md` | create |

13 files. PLAN-LOCKED schema extends plan-schema-v2 (does NOT replace).

## Binding invariants

1. **PLAN-LOCKED.md is an EXTENSION of v2-schema PLAN.md**, not a replacement. Every PLAN-LOCKED.md must ALSO validate against plan-schema-v2 (SCHEMA-09 + SCHEMA-10 still apply).
2. **Hooks are deterministic.** No LLM judgments inside hooks. Pure rule-based (regex matches, path-prefix checks, file-existence checks).
3. **Hooks fail-CLOSED on ambiguity.** If a hook cannot determine whether an action is safe, it MUST block (exit non-zero). Better to false-positive than to false-negative.
4. **Hooks log every decision** to `.planning/metrics/codex-tool-events.jsonl` for audit trail. No silent allows.
5. **PLAN-LOCKED required for `codex.execute.*` and `codex.goal` profiles** (P110 wire-in). Other profiles may skip.
6. **block-secret-leak guards UserPromptSubmit** — operator-typed secrets in interactive prompts get rejected before reaching Codex.
7. **enforce-allowed-files reads the active PLAN-LOCKED.md** (path passed via env or resolved from current phase). Writes outside `allowed_files` are blocked.

## Semantic acceptance criteria (target — 111-01 PLAN declares verbatim)

```yaml
semantic_acceptance_criteria:
  - id: SAC-P111-01
    input: "a PLAN.md fixture missing lock_status / locked_at / allowed_files"
    expected_outcome: "validate-plan-locked.cjs exits non-zero with PLAN-LOCKED-SCHEMA error"
    verification_cmd: "node super-gsd/tools/plan-lock/validate-plan-locked.cjs --self-test-incomplete; test $? -eq 0"

  - id: SAC-P111-02
    input: "a fully-formed PLAN-LOCKED.md fixture (extends v2-schema plus lock metadata)"
    expected_outcome: "validate-plan-locked.cjs exits 0 (VALID)"
    verification_cmd: "node super-gsd/tools/plan-lock/validate-plan-locked.cjs --self-test-valid; test $? -eq 0"

  - id: SAC-P111-03
    input: "block-forbidden-write hook invoked with target path outside PLAN-LOCKED allowed_files"
    expected_outcome: "exits non-zero (block); logs blocked event"
    verification_cmd: "node super-gsd/tools/codex-hooks/block-forbidden-write.cjs --self-test-blocked; test $? -eq 0"

  - id: SAC-P111-04
    input: "block-secret-leak hook with prompt containing 'API_KEY=sk_...'"
    expected_outcome: "exits non-zero (block); logs blocked secret pattern"
    verification_cmd: "node super-gsd/tools/codex-hooks/block-secret-leak.cjs --self-test-secret; test $? -eq 0"

  - id: SAC-P111-05
    input: "log-tool-event hook with a sample tool invocation"
    expected_outcome: "appends one row to .planning/metrics/codex-tool-events.jsonl"
    verification_cmd: "node super-gsd/tools/codex-hooks/log-tool-event.cjs --self-test; test $? -eq 0"

  - id: SAC-P111-06
    input: "validate-stop-contract hook on a completed dispatch missing the result report"
    expected_outcome: "exits non-zero (block); flags missing contract"
    verification_cmd: "node super-gsd/tools/codex-hooks/validate-stop-contract.cjs --self-test-missing-report; test $? -eq 0"

  - id: SAC-P111-07
    input: "self-test runner over schema + all 5 hooks"
    expected_outcome: "exit 0 with ≥15 assertions passed"
    verification_cmd: "node super-gsd/tools/codex-hooks/run-self-test.cjs; test $? -eq 0"
```

## Out of scope

- Context Authority capsule (P112)
- Orchestrator integration (existing `sgsd-orchestrate` dispatcher modification is post-v3.0 work)
- Codex CLI version pinning for hook compatibility
- Backporting PLAN-LOCKED to existing v2.x phases (they don't need it; v3.0+ uses it)

## Cross-references

- `.planning/proposals/2026-05-20-sgsd-pro-mode-codex-context-authority-plan.md` §4.4 + §4.6
- `super-gsd/registry/codex-profiles.yaml` (P110) — `requires_locked_plan` and `hooks_required` fields refer to this phase's artifacts
- `super-gsd/templates/plan-schema-v2.json` — plan-locked.schema.json extends this
- `super-gsd/tools/mesh-memory/escalation-gate.cjs` (P109) — hook-blocked actions can route through this for operator escalation
