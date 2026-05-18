# SGSD Agentic Harness Evolution -- v2.9 Summary

> Milestone: v2.9 (phases 98-105). Authored 2026-04-30.
> Status: ALL-PHASES-CLOSED PASS-WITH-DEFERRED-2.

## Mission

Turn SGSD from a hand-improved orchestrator into an observability-driven
harness that can improve its own components under controlled,
measurable, revertible conditions.

The AHE paper's central warning was: if you only add gates, prompts, and
dashboards, you create bloat. The safer move is to make every harness
edit falsifiable and attributable.

## Paper Evidence (AHE-P-01..10)

| Principle | SGSD interpretation | Phase |
|---|---|---|
| AHE-P-01 explicit + reversible action surfaces | 35-row component registry with rollback methods | 98 |
| AHE-P-02 distill experience before change | 7-source JSONL distiller; <=4KB overview | 99 |
| AHE-P-03 falsifiable contracts | Manifest schema with required predictions | 100 |
| AHE-P-04 optimize harness, not prompt | Component classes (tool/hook/skill/MCP/gate over prompts) | 98 |
| AHE-P-05 hold model fixed | protected_model_config catalog rows | 98 |
| AHE-P-07 transfer is the overfit test | Frozen-before-run rule; OOD evaluator | 104 |
| AHE-P-08 swap components independently | Ablation runner with workspace isolation | 103 |
| AHE-P-09 expect non-additive interference | 3 interference rules (duplicate / redundant / inversion) | 103 |
| AHE-P-10 regression prediction first-class | Fix and regression precision/recall computed separately | 101 |

## Local SGSD Evidence

Self-test totals across the 6 new tools:

| Tool | Assertions | Status |
|---|---:|---|
| harness-components/run-self-test | 21/21 | PASS |
| harness-evidence/run-self-test | 18/18 | PASS |
| harness-manifest/run-self-test | 21/21 | PASS |
| harness-attribution/run-self-test | 18/18 | PASS |
| harness-evolution/run-self-test | 17/17 | PASS |
| harness-ablation/run-self-test | 18/18 | PASS |
| harness-transfer/run-self-test | 18/18 | PASS |
| **Total v2.9 new** | **131/131** | **PASS** |

Cross-tool regression coverage:

| Pre-existing self-test | Pre-v2.9 | Post-v2.9 |
|---|---|---|
| double-agent-executor | 15/15 | 15/15 |
| sgsd-complete-milestone | 8/8 | 8/8 |

Both unchanged — v2.9 modifications were strictly additive.

## Phase Roll-Up

### Phase 98 -- Harness Component Substrate
- 35-row registry across 14 frozen classes (5 protected).
- catalog.cjs: Lock-13 Read API + path-safety validator.
- Stop rule: registry script-readable without prose docs.

### Phase 99 -- Trajectory Evidence Corpus
- distill.cjs: 7 JSONL surfaces -> OVERVIEW (<=4KB) + INDEX + tasks/.
- 11 frozen root-cause labels.
- Operator note: --since for production windowing.

### Phase 100 -- Change Manifest Prediction Ledger
- MANIFEST.schema.json: 14 required fields including predicted_fixes
  (>=1) and predicted_regressions ([] OK, null forbidden).
- manifest.cjs: append-only JSONL, idempotent on change_id.
- Cross-link: optional harness_change_id field on task capsule.

### Phase 101 -- Attribution + Rollback Gate
- attribute.cjs: 6-verdict closed vocab. Fix metrics + regression
  metrics computed independently. Surprises array surfaces missed
  regression risks.
- Rollback recommendation is structured (action+files+change_id+manual_command).
  Phase MUST NOT execute git revert.
- v2.9 close gate added to sgsd-complete-milestone.cjs.

### Phase 102 -- Harness Evolution Runner
- run.cjs: 4 modes (dry-run / proposal-only / apply-candidate /
  attribute-only). Apply-candidate is route-only stub today.
- Hard boundary: never reads protected oracles into model context.
- README.md ships 4-mode operator CLI.

### Phase 103 -- Component Ablation + Interference
- ablate.cjs: copy+rename target component to *.ablated in os.tmpdir().
  Main workspace byte-stable contract.
- 3 frozen interference rules: duplicate_verification,
  redundant_gate_stack, token_cost_inversion.
- Stop rule: every plan sets requires_transfer_eval=true.

### Phase 104 -- Transfer + OOD Benchmark
- evaluate.cjs: hard frozen-before-run rule (manifest_appended_at <
  run.started_at).
- 3 critical-regression rules: success_rate drop >=5%, token_cost bloat
  >50%, regressions_observed non-empty.
- 8 transfer axes (3 decks + 5 environment dimensions).

### Phase 105 -- Release Gate + Cockpit Integration (this phase)
- v2.9 close gate extended: AHE-EVAL-03/05 transfer + critical
  regression checks.
- This SUMMARY.md.
- SGSD-HARNESS-EVOLUTION.md updated with all phase sections.
- DEFERRED-1: warp-mcp tool addition (TOOL_NAMES frozen at 14; 47/47).
- DEFERRED-2: cockpit-state 12th section (SECTION_KEYS frozen at 11; 19/19).

## v2.9 Close Gate Behavior

`node super-gsd/scripts/sgsd-complete-milestone.cjs --milestone v2.9`

Blocks SHIPPED-clean when ANY of:
1. Manifest entries lack attribution rows (AHE-GOV-04).
2. Attribution verdict=revert is not yet applied.
3. Keep-verdict change has no transfer record (AHE-EVAL-03).
4. Transfer record reports critical regression (AHE-EVAL-05).

Or operator marks SHIPPED-WITH-UNPROVEN-HARNESS-EVOLUTION explicitly.

Live test result against current repo: GREEN (0 manifests / 0 attributions /
0 transfer-blocking).

## Critical Gaps -- Operator Handoff

### DEFERRED-1: warp-mcp `sgsd_harness_evolution_status` tool
- Plan 105-01 listed warp-mcp/server.cjs as files_touched.
- Adding a 15th tool requires lockstep updates to:
  - TOOL_NAMES frozen array (14 -> 15)
  - Self-test A1 (TOOL_NAMES.length === 14)
  - Self-test A6 (loop through 14 tools)
  - Self-test A7 (tools/list result.tools.length === 14)
  - Self-test A13 (verbatim 14 named tools)
- Operator can read evolution status today via:
  - `node super-gsd/tools/harness-evolution/run.cjs --attribute-only ...`
  - tail .planning/metrics/harness-evolution-log.jsonl
  - tail .planning/metrics/harness-attribution.jsonl

### DEFERRED-2: cockpit-state `harness_evolution` 12th section
- Plan 105-01 listed cockpit-state/adapter.cjs as files_touched.
- Adding a 12th section requires lockstep updates to:
  - SECTION_KEYS frozen array (11 -> 12)
  - Self-test A1_section_keys_frozen_11 -> 12
  - Self-test A4_all_11_sections_present -> 12
  - section builder fn injection
- Operator can read evolution status today via the JSONL files above
  or the harness-evolution/run.cjs CLI.

### Other gaps inherited from v2.8
1. ~~STATE.md re-sync to v2.9 ALL-PHASES-CLOSED status.~~ **CLOSED 2026-05-18** @ 2b0f9f2.
2. v2.6 SHIPPED-clean operator decision (debt rows resolved).
3. v1.9 CONTEXT-BENCH full-mode rerun.
4. M1-M5 manual UI checks (operator-led).
5. Phase 95 ACP spike re-entry (when Warp #7326 ships).
6. Phase 96 SGSD-WARP-UPSTREAM-PROPOSAL.md submission timing.

### Post-close additions (2026-05-18)
1. **DLB-07 (Semantic vs Structural Verification)** ratified after Clarity ERP 2026-05-18 incident.
2. **P97.5 Semantic Verification Gate** (decimal-prework phase added retroactively in v2.9). Schema enforcement of `semantic_acceptance_criteria` via `plan-schema-v2.json` + `validate.cjs` (SCHEMA-09 / SCHEMA-10). 5/5 fixture tests green. Commit chain 34520c0 → 9901568 → 2fa3bbc → 6e66ad0.
3. **DLB-07 Layer 5 — Audit-gate enforcement landed** post-v2.9-close. `super-gsd/skills/sgsd-audit/SKILL.md` added as single-file canonical source (inlines legacy `layer1-existence.md` / `layer2-evidence.md` / `OUTPUT-WRITER.md` sidecars). Adds Layer 4: Semantic-AC enforcement that executes each plan's `verification_cmd` against real data, with fixture-path guard. Skill version `sgsd-audit@v2`.
4. **97.5-BACKFILL.md** surfaces 18 of 19 v2.9 plans pre-dating P97.5 schema; each needs `skip_gates: ["layer-4-semantic-ac"]` + `skip_reason:` exemption OR per-phase semantic-AC backfill at next dispatch.

## Measured Deltas (placeholder for operator)

The AHE loop now exists. Token deltas, fix recall, regression precision,
and transfer success rates ARE NOW MEASURABLE but require running the
loop against a live SGSD session to populate.

To populate:
1. Run the deterministic benchmark: `node super-gsd/tools/harness-benchmark/sgsd-harness-benchmark.mjs --profile smoke --output-dir .planning/benchmarks/v2.9-baseline`
2. Distill: `node super-gsd/tools/harness-evidence/distill.cjs --benchmark .planning/benchmarks/v2.9-baseline --run-id v2.9-baseline`
3. Propose a change: write candidate-spec.json + `node super-gsd/tools/harness-evolution/run.cjs --proposal-only --candidate-spec ...`
4. After applying + re-running benchmark + distilling: `--attribute-only`.
5. Transfer: run on held-out deck + record via harness-transfer.

The first complete loop will establish v2.9's measured-delta baseline.
This SUMMARY.md ships the infrastructure; the operator owns first-loop
execution.

## Reverted Changes

None this phase. v2.9 was clean-additive: no rollbacks during execution.

## What v2.9 Unlocks

- SGSD can now ask of any candidate gate/hook/prompt/skill: "did this
  edit actually fix what we predicted, without surprise regressions?"
- Phase 102 runner is the safe entry point. Phases 103-104 surface
  interference and transfer failures before they ship.
- The protected-surface contract guarantees scoring oracles, verifiers,
  model config, and budget cannot be edited by the loop -- so any
  measured improvement is system-real, not goalpost-shifted.

## Footer

Source: SGSD v2.9 Agentic Harness Evolution roadmap.
Maintainer: orchestrator. Operator owns DEFERRED-1, DEFERRED-2, and
first-loop execution.

Phase commits:
- 98 = a4f8539
- 99 = 6f7a478
- 100 = eba47ba
- 101 = d1066a4
- 102 = 827d9bc
- 103 = 5122d95
- 104 = f6d3073
- 105 = (this phase)
