---
phase: 110
phase_name: Codex Pro Mode Lanes + Stoplight Routing + Native Review
milestone: v3.0
created: 2026-05-20
status: queued-planning-only
implementation_status: not-started
source: DLB-09.1 from SGSD-PRO proposal §4.1-4.5; wires Codex dispatch into the DLB-08 mesh substrate
predecessor: P109 PASS (DLB-08 complete)
---

# Phase 110 — Codex Pro Mode Lanes + Stoplight Routing + Native Review

> First DLB-09 phase. Replaces "send it to Codex" generic dispatch with typed Codex profiles + GREEN/AMBER/RED routing + native Codex review as first-class gate emitting `review_finding` CMBs into the mesh memory ledger (DLB-08 wire-in).

## Goal

Ship the three Codex Pro Mode tools per SGSD-PRO master proposal §4:

1. **`super-gsd/tools/codex-pro/profile-resolver.cjs`** — given phase type + risk + ambiguity + allowed files, returns one of 10 typed Codex profile envelopes:
   ```
   codex.readonly.audit       codex.plan              codex.goal
   codex.execute.bounded      codex.execute.patch     codex.review.native
   codex.review.swarm         codex.cockpit.brief     codex.app_lab
   codex.cloud_lab
   ```
   Each profile declares: model, reasoning, sandbox, approval, requires_worktree, requires_locked_plan, hooks_required, native_review_required, allowed_write_roots, max_changed_files.

2. **`super-gsd/tools/codex-pro/stoplight.cjs`** — Pre-execution classifier. Given a dispatch context, classifies as GREEN (bounded executor) / AMBER (goal lane or app-lab) / RED (no execution; route to board/operator). Appends one row per classification to `.planning/metrics/pro-mode-stoplight.jsonl`.

3. **`super-gsd/tools/codex-pro/native-review-runner.cjs`** — Native Codex review as first-class gate. Runs BEFORE SGSD ATC for source-changing work. **Emits one `review_finding` CMB per finding into `.planning/mesh/memory/cmbs.jsonl`** (wires Codex Pro Mode into the P107+P108 substrate). Writes `CODEX-NATIVE-REVIEW.md` to the phase dir.

Plus a profiles registry YAML and self-test extension.

## Files this phase will create

| Path | Op |
|---|---|
| `super-gsd/registry/codex-profiles.yaml` | create (10 profile definitions) |
| `super-gsd/tools/codex-pro/profile-resolver.cjs` | create |
| `super-gsd/tools/codex-pro/stoplight.cjs` | create |
| `super-gsd/tools/codex-pro/native-review-runner.cjs` | create |
| `super-gsd/tools/codex-pro/run-self-test.cjs` | create (≥15 assertions covering all 3 tools) |
| `super-gsd/tools/codex-pro/package.json` | create |
| `super-gsd/tools/codex-pro/README.md` | create |

7 files. No new schemas (consumes P106's). New JSONL streams: `pro-mode-stoplight.jsonl`.

## Binding invariants

1. **Profile resolution is rule-based, not LLM-based.** Deterministic mapping from phase context → profile envelope. Plug-in escape hatch for operator override.
2. **Stoplight is preventative.** GREEN/AMBER/RED is computed BEFORE Codex gets write permission. RED skips Codex entirely and routes to escalation_gate (P109 wire-in).
3. **Native review emits `review_finding` CMBs into the mesh ledger.** Each finding becomes a typed claim CMB with proper CAT7 envelope + lineage to the executor's execution_receipt. This is the DLB-08 wire-in: Codex Pro Mode native review IS a P107+P108 producer.
4. **Native review runs BEFORE SGSD ATC.** SGSD ATC (from prior phases) reviews the native review's findings + the executor diff together. Two reviewers; one substrate.
5. **No production mutation without GREEN stoplight + locked plan + native review pass.** Combined with P109 escalation_gate, the safety case stacks.
6. **All new CMBs have full schema shape** (lessons from P107/P108).

## Semantic acceptance criteria (target — 110-01 PLAN declares verbatim)

```yaml
semantic_acceptance_criteria:
  - id: SAC-P110-01
    input: "profile-resolver.cjs --resolve with context {phase_type: 'plan'}"
    expected_outcome: "returns codex.plan profile envelope with sandbox: 'read-only', approval: 'never'"
    verification_cmd: "node super-gsd/tools/codex-pro/profile-resolver.cjs --self-test-plan; test $? -eq 0"

  - id: SAC-P110-02
    input: "profile-resolver.cjs --resolve with context {phase_type: 'execute', allowed_files: ['src/x.ts'], risk: 'low'}"
    expected_outcome: "returns codex.execute.bounded profile with sandbox: 'workspace-write', requires_worktree: true, native_review_required: true"
    verification_cmd: "node super-gsd/tools/codex-pro/profile-resolver.cjs --self-test-bounded; test $? -eq 0"

  - id: SAC-P110-03
    input: "stoplight.cjs --classify with context {locked_plan: true, allowed_files_count: 3, risk: 'low', production_writes: false, secrets_required: false}"
    expected_outcome: "verdict: GREEN; logs one row to pro-mode-stoplight.jsonl"
    verification_cmd: "node super-gsd/tools/codex-pro/stoplight.cjs --self-test-green; test $? -eq 0"

  - id: SAC-P110-04
    input: "stoplight.cjs --classify with context {production_writes: true OR no locked_plan OR no acceptance_command}"
    expected_outcome: "verdict: RED; allow_execution: false"
    verification_cmd: "node super-gsd/tools/codex-pro/stoplight.cjs --self-test-red; test $? -eq 0"

  - id: SAC-P110-05
    input: "native-review-runner.cjs --self-test against a fixture diff with one obvious issue"
    expected_outcome: "emits at least 1 review_finding CMB to mesh memory ledger with proper CAT7 + lineage; writes CODEX-NATIVE-REVIEW.md"
    verification_cmd: "node super-gsd/tools/codex-pro/native-review-runner.cjs --self-test; test $? -eq 0"

  - id: SAC-P110-06
    input: "self-test runner over all 3 codex-pro tools"
    expected_outcome: "exit 0 with ≥15 assertions passed"
    verification_cmd: "node super-gsd/tools/codex-pro/run-self-test.cjs; test $? -eq 0"
```

6 SACs.

## Out of scope

- PLAN-LOCKED.md formal lock contract (P111)
- `.codex/hooks.json` safety rails (P111)
- Context Authority capsule (P112)
- Live integration with the actual orchestrator dispatch path (orchestrator wire-in is post-v3.0 work; P110 ships the tools, doesn't replace the existing dispatcher)
- Codex hooks (P111)
- Modifying P106-P109 frozen tools

## Cross-references

- `.planning/proposals/2026-05-20-sgsd-pro-mode-codex-context-authority-plan.md` — §4.1-4.5 spec source
- `super-gsd/tools/mesh-memory/review-finding-writer.cjs` (P107) — native-review uses this CMB shape
- `super-gsd/tools/mesh-memory/escalation-gate.cjs` (P109) — RED stoplight routes through this
- `super-gsd/scripts/codex-executor.sh` — existing direct executor; profile-resolver wraps invocation env
- `super-gsd/scripts/codex-exec.sh` — existing review wrapper; native-review-runner extends
