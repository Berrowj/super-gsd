---
phase: 103
artifact: research
authored_by: orchestrator (Opus)
---

# Phase 103 -- Research

## Sources
- AHE paper: AHE-P-08 (locate gains by swapping components independently)
  + AHE-P-09 (expect non-additive component interference)
- Phase 98 catalog.cjs (component registry; protected guard)
- Phase 102 run.cjs (already enforces protected-surface check at proposal time)
- Existing super-gsd/tools/harness-benchmark/sgsd-harness-benchmark.mjs
  (PROTECTED oracle per Phase 98 catalog; we INVOKE, never modify)

## Key decisions

### D1 -- Workspace isolation contract
Ablation NEVER touches the main workspace. The runner:
1. Creates a temp dir under os.tmpdir().
2. Copies a minimal subset of the workspace needed to run the benchmark
   (super-gsd/, .planning/config.json) -- NOT the full repo.
3. Disables the target component in the copy by:
   - Renaming the file paths to `*.ablated` (rename, not delete).
   - Recording the rename in the ablation manifest.
4. Runs the benchmark in the temp dir.
5. Cleans up the temp dir.

Self-test asserts main workspace mtimes are unchanged before/after.

### D2 -- Sgsd-harness-benchmark.mjs is PROTECTED -- never modified
Per Phase 98 catalog row `scoring-oracle`, this file is `protected_oracle`.
Plan 103 lists it in files_touched but Phase 98's contract supersedes:
the ablation runner INVOKES the benchmark, never modifies it.

This phase ships ablate.cjs + run-self-test.cjs only. No edits to the
benchmark file. Verified by forbidden_files in the task capsule.

### D3 -- Ablation manifest schema
```json
{
  "ablation_id": "ab-2026-04-30-001",
  "baseline_run_id": "run-baseline-001",
  "target_component_id": "context-packet",
  "target_files": ["super-gsd/tools/context-packet"],
  "expected_behavior": "token cost should drop by N",
  "started_at": "ISO",
  "completed_at": "ISO",
  "outcome": {
    "success": true|false,
    "delta_token_cost": -200,
    "delta_runtime_ms": 0,
    "delta_failures": 0,
    "interference_signals": []
  }
}
```

### D4 -- Interference detection rules
- duplicate_verification: same root_cause label appears in baseline AND ablated
  variant with same frequency (component didn't actually contribute).
- redundant_gate_stack: ablated variant runs N% faster with same outcomes
  (gate was overhead, not value).
- token_cost_inversion: ablation REDUCES tokens (component was burning, not saving).

### D5 -- Per-component ablation list (8 first targets)
Per CONTEXT, the first ablation targets are:
- token-waste hook (orchestrator-hooks.cjs::onAfterCommit)
- context-packet hook (orchestrator-hooks.cjs::onBeforeDispatch)
- state-resolver read path
- soft gates (gates.yaml entries)
- cockpit render/cache (cockpit-state adapter)
- double-agent-executor routing
- memory injection (MEMORY.md auto-load)
- VTP enrichment

These component_ids exist in the Phase 98 catalog. Self-test exercises 1-2;
operator drives the full ablation matrix.

### D6 -- Lock-13 Public API
- planAblation(opts) -> { ok, ablation_spec, errors }
- isolateWorkspace(opts) -> { ok, temp_dir, files_renamed, errors }
- restoreWorkspace(opts) -> { ok, errors }
- recordAblation(ablation, opts) -> { ok, errors }
- detectInterference(baseline, ablated) -> { ok, signals[], errors }

### D7 -- Self-test ≥10 assertions, no LLM, no real benchmark
- Workspace isolation: temp dir created + disposed
- Main workspace byte-stable (file mtimes preserved)
- Ablation spec validates against schema
- Protected component refused (oracle/verifier/model_config)
- Interference detection: duplicate_verification rule fires
- Interference detection: redundant_gate rule fires on token-no-effect
- recordAblation appends JSONL row
- Lock-13 no-throw on bad input
- ASCII-only source
- Public API stable

### D8 -- Stop Rule (from PLAN.md)
"Do not recommend pruning a component from deterministic benchmark alone.
Live/transfer evidence is required." -> the ablation report ALWAYS includes
a `requires_transfer_eval: true` flag; Phase 104 fulfills that contract.

## Risks
- R1: Workspace copy for full repo is slow + large. Mitigation: copy
  minimal subset (super-gsd/ + .planning/config.json), enough to invoke
  benchmark; full-workspace ablation is operator-driven outside self-test.
- R2: Rename collisions if multiple ablations run in same temp. Mitigation:
  random suffix per ablation_id.
